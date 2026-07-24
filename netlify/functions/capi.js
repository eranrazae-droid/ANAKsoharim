// Meta Conversions API (צד שרת). מקבל אירוע מהדפדפן ומעביר ל-Meta עם אותו event_id (deduplication).
// האסימון נשמר אך ורק במשתנה סביבה: META_CAPI_ACCESS_TOKEN  (לעולם לא בקוד/ריפו).
const https = require('https');

const PIXEL_ID = process.env.META_PIXEL_ID || '1715402413047260';
const GRAPH_VERSION = 'v19.0';

function post(url, bodyObj){
  return new Promise((resolve,reject)=>{
    const body = JSON.stringify(bodyObj);
    const u = new URL(url);
    const req = https.request({ hostname:u.hostname, path:u.pathname+u.search, method:'POST',
      headers:{ 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(body) } },
      (res)=>{ let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode, body:d})); });
    req.on('error',reject); req.write(body); req.end();
  });
}

exports.handler = async (event) => {
  const CORS = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:CORS, body:'' };

  const token = process.env.META_CAPI_ACCESS_TOKEN;
  // ללא אסימון — לא שולחים, אך מחזירים 200 כדי שהדפדפן לא ייכשל (הפיקסל לבדו עדיין עובד).
  if (!token) return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:false, reason:'no_token' }) };

  let p = {};
  try { p = JSON.parse(event.body || '{}'); } catch(e){ return { statusCode:400, headers:CORS, body:'bad json' }; }
  if (!p.event_name) return { statusCode:400, headers:CORS, body:'missing event_name' };

  const h = event.headers || {};
  const ip = (h['x-nf-client-connection-ip'] || (h['x-forwarded-for']||'').split(',')[0] || '').trim();
  const ua = h['user-agent'] || '';
  const ud = p.user_data || {};

  const payload = {
    data: [{
      event_name: p.event_name,
      event_time: Math.floor(Date.now()/1000),
      event_id: p.event_id || undefined,
      event_source_url: p.event_source_url || undefined,
      action_source: 'website',
      user_data: {
        client_ip_address: ip || undefined,
        client_user_agent: ua || undefined,
        fbp: ud.fbp || undefined,
        fbc: ud.fbc || undefined
      },
      custom_data: p.custom_data || {}
    }]
  };
  if (p.order_id) payload.data[0].custom_data.order_id = p.order_id;
  if (p.utm && typeof p.utm === 'object') { try { Object.keys(p.utm).forEach(function(k){ payload.data[0].custom_data[k] = p.utm[k]; }); } catch(e){} }

  try {
    const url = 'https://graph.facebook.com/' + GRAPH_VERSION + '/' + PIXEL_ID + '/events?access_token=' + encodeURIComponent(token);
    const r = await post(url, payload);
    return { statusCode:200, headers:CORS, body:JSON.stringify({ ok: r.status>=200 && r.status<300, status:r.status }) };
  } catch (e) {
    return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:false, error:String(e) }) };
  }
};
