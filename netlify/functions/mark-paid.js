// סימון ליד כ"שולם" ושליחת אירוע Purchase ל-Meta (צד שרת בלבד) — רק לאחר אישור ידני של הצוות.
// אטומיות: תופסים את הליד (paid=true) לפני השליחה; אם השליחה נכשלת מחזירים paid=false כדי לאפשר ניסיון חוזר.
// dedup: משתמשים באותו event_id ששמור על הליד → Meta מבצע deduplication, ולחיצה כפולה לא תשלח פעמיים.
// האסימון נשמר אך ורק במשתנה סביבה META_CAPI_ACCESS_TOKEN (זהה ל-capi.js) — לעולם לא בקוד/דפדפן.
const https = require('https');

const SB_URL = 'https://vwfmfjjdusirabgbkhvw.supabase.co';
const SB_KEY = 'sb_publishable_E6Dd48mtyJyw5_6vgP2lzw_Gaj-QcAx';
const PIXEL_ID = process.env.META_PIXEL_ID || '1715402413047260';
const GRAPH_VERSION = 'v19.0';

function req(method, url, headers, bodyObj){
  return new Promise((resolve,reject)=>{
    const u = new URL(url);
    const body = bodyObj!=null ? JSON.stringify(bodyObj) : null;
    const opts = { hostname:u.hostname, path:u.pathname+u.search, method, headers:Object.assign({}, headers) };
    if(body){ opts.headers['Content-Type']='application/json'; opts.headers['Content-Length']=Buffer.byteLength(body); }
    const r = https.request(opts,(res)=>{ let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode, body:d})); });
    r.on('error',reject); if(body) r.write(body); r.end();
  });
}

exports.handler = async (event) => {
  const H = { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:H, body:'' };
  if (event.httpMethod !== 'POST') return { statusCode:405, headers:H, body:JSON.stringify({ok:false, reason:'method_not_allowed'}) };

  // אבטחה: פעולה זו מסמנת ליד כשולם ושולחת Purchase — חובה סוד שרת. ללא MARK_PAID_TOKEN ה-endpoint מושבת (fail-closed).
  if (!process.env.MARK_PAID_TOKEN) return { statusCode:403, headers:H, body:JSON.stringify({ok:false, reason:'endpoint_disabled_no_token'}) };
  const _h = event.headers || {};
  const _t = _h['x-admin-token'] || _h['X-Admin-Token'];
  if (_t !== process.env.MARK_PAID_TOKEN) return { statusCode:403, headers:H, body:JSON.stringify({ok:false, reason:'unauthorized'}) };

  let p = {};
  try { p = JSON.parse(event.body||'{}'); } catch(e){ return { statusCode:400, headers:H, body:JSON.stringify({ok:false, reason:'bad_json'}) }; }
  const leadId = p.lead_id;
  if (leadId == null || leadId === '') return { statusCode:400, headers:H, body:JSON.stringify({ok:false, reason:'missing_lead_id'}) };

  const auth = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  const idFilter = 'id=eq.' + encodeURIComponent(leadId);

  try {
    // 1) שליפת הליד
    const got = await req('GET', SB_URL + '/rest/v1/leads?' + idFilter + '&select=*', auth);
    let rows; try{ rows = JSON.parse(got.body); }catch(e){ return { statusCode:502, headers:H, body:JSON.stringify({ok:false, reason:'bad_lead_json'}) }; }
    const lead = Array.isArray(rows) ? rows[0] : null;
    if (!lead) return { statusCode:404, headers:H, body:JSON.stringify({ok:false, reason:'lead_not_found'}) };
    if (lead.paid === true) return { statusCode:200, headers:H, body:JSON.stringify({ok:true, already:true}) };

    // 2) תפיסה אטומית: מעדכנים paid=true רק אם עדיין לא שולם (מונע שליחה כפולה במקביל)
    const claim = await req('PATCH',
      SB_URL + '/rest/v1/leads?' + idFilter + '&or=(paid.is.false,paid.is.null)',
      Object.assign({}, auth, { Prefer:'return=representation' }),
      { paid:true, paid_at:new Date().toISOString(), status:'שולם' });
    let claimed; try{ claimed = JSON.parse(claim.body); }catch(e){ claimed = []; }
    if (!Array.isArray(claimed) || claimed.length === 0) {
      // מישהו אחר כבר תפס — כבר שולם
      return { statusCode:200, headers:H, body:JSON.stringify({ok:true, already:true}) };
    }

    // 3) שליחת Purchase ל-Meta. אם נכשל — מחזירים paid=false כדי לאפשר retry עם אותו event_id
    const token = process.env.META_CAPI_ACCESS_TOKEN;
    const eventId = lead.event_id || (lead.order_id ? ('purchase_' + lead.order_id) : ('purchase_' + leadId));
    const value = Number(lead.amount) || 300;

    async function revert(reason){
      try{ await req('PATCH', SB_URL + '/rest/v1/leads?' + idFilter, Object.assign({}, auth, { Prefer:'return=minimal' }), { paid:false, paid_at:null }); }catch(e){}
      return { statusCode:200, headers:H, body:JSON.stringify({ok:false, reason:reason}) };
    }

    if (!token) return await revert('no_token');   // ללא אסימון — לא סומן, ניתן לנסות שוב אחרי הגדרת ENV

    const payload = { data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now()/1000),
      event_id: eventId,                 // dedup קבוע
      action_source: 'website',
      user_data: {
        fbp: lead.fbp || undefined,
        fbc: lead.fbc || undefined
      },
      custom_data: {
        value: value,
        currency: 'ILS',
        order_id: lead.order_id || undefined,
        content_type: 'product'
      }
    }]};

    const url = 'https://graph.facebook.com/' + GRAPH_VERSION + '/' + PIXEL_ID + '/events?access_token=' + encodeURIComponent(token);
    let sent;
    try { sent = await req('POST', url, {}, payload); }
    catch(e){ return await revert('meta_network_error'); }
    if (!(sent.status >= 200 && sent.status < 300)) return await revert('meta_rejected');

    return { statusCode:200, headers:H, body:JSON.stringify({ ok:true, event_id:eventId, value:value }) };
  } catch (e) {
    return { statusCode:502, headers:H, body:JSON.stringify({ ok:false, reason:'server_error' }) };
  }
};
