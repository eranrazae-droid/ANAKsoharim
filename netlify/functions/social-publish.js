// מנוע פרסום אוטומטי לרשתות של אוטודילר - Instagram (תמונה + רילס) + Facebook עמוד, דרך Meta Graph API.
// אבטחה: POST בלבד + סוד שרת SOCIAL_PUBLISH_TOKEN (x-admin-token). ללא הסוד ה-endpoint מושבת (fail-closed).
// טוקנים נשמרים אך ורק במשתני סביבה של Netlify - לעולם לא בקוד/דפדפן:
//   FB_PAGE_ID       - מזהה עמוד הפייסבוק
//   FB_PAGE_TOKEN    - Page Access Token ארוך-טווח (משמש גם לאינסטגרם)
//   IG_USER_ID       - מזהה חשבון האינסטגרם Business המקושר לעמוד
const https = require('https');

const SB_URL = 'https://vwfmfjjdusirabgbkhvw.supabase.co';
const SB_KEY = 'sb_publishable_E6Dd48mtyJyw5_6vgP2lzw_Gaj-QcAx';
const SITE = 'https://autodealer.co.il';
const GRAPH = 'https://graph.facebook.com/v19.0';

function reqUrl(method, url){
  return new Promise((resolve,reject)=>{
    const u = new URL(url);
    const opts = { hostname:u.hostname, path:u.pathname+u.search, method };
    const r = https.request(opts,(res)=>{ let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ let j=null; try{j=JSON.parse(d);}catch(e){} resolve({status:res.statusCode, json:j, raw:d}); }); });
    r.on('error',reject); r.end();
  });
}
function getJson(url, headers){
  return new Promise((resolve,reject)=>{ https.get(url,{headers},(res)=>{ let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d));}catch(e){reject(e);} }); }).on('error',reject); });
}
const wait = ms => new Promise(r=>setTimeout(r,ms));

function buildCaption(car){
  const name = ((car.brand||'')+' '+(car.model||'')+(car.year?(' '+car.year):'')).trim();
  const price = Number(car.autodealerPriceNumber)||0;
  const priceLine = price>1 ? ('\nהחל מ-'+price.toLocaleString('en-US')+' ₪') : '';
  const tags = '\n\n#אוטודילר #רכב0קמ #'+String(car.brand||'').replace(/\s/g,'')+' #רכבחדש #מבצערכב';
  return name+' חדש 0 ק"מ במחיר דיל 🚗'+priceLine+'\nמימון ללא מקדמה · טרייד-אין · אחריות יבואן רשמי.\nפרטים מלאים: '+SITE+'/?car='+car.id+tags;
}

async function igPublishPhoto(igId, token, imageUrl, caption){
  const create = await reqUrl('POST', GRAPH+'/'+igId+'/media?image_url='+encodeURIComponent(imageUrl)+'&caption='+encodeURIComponent(caption)+'&access_token='+encodeURIComponent(token));
  if(!create.json || !create.json.id) return { ok:false, step:'create', err:create.json&&create.json.error };
  const pub = await reqUrl('POST', GRAPH+'/'+igId+'/media_publish?creation_id='+encodeURIComponent(create.json.id)+'&access_token='+encodeURIComponent(token));
  if(!pub.json || !pub.json.id) return { ok:false, step:'publish', err:pub.json&&pub.json.error };
  return { ok:true, id:pub.json.id };
}
async function igPublishReel(igId, token, videoUrl, caption){
  const create = await reqUrl('POST', GRAPH+'/'+igId+'/media?media_type=REELS&video_url='+encodeURIComponent(videoUrl)+'&caption='+encodeURIComponent(caption)+'&access_token='+encodeURIComponent(token));
  if(!create.json || !create.json.id) return { ok:false, step:'create', err:create.json&&create.json.error };
  const cid = create.json.id;
  // המתנה לעיבוד הווידאו (עד ~20 שניות)
  let ready=false;
  for(let i=0;i<10;i++){
    await wait(2000);
    const st = await reqUrl('GET', GRAPH+'/'+cid+'?fields=status_code&access_token='+encodeURIComponent(token));
    const code = st.json && st.json.status_code;
    if(code==='FINISHED'){ ready=true; break; }
    if(code==='ERROR'){ return { ok:false, step:'processing', err:'video_processing_error' }; }
  }
  if(!ready) return { ok:false, step:'processing', err:'video_still_processing', creation_id:cid };
  const pub = await reqUrl('POST', GRAPH+'/'+igId+'/media_publish?creation_id='+encodeURIComponent(cid)+'&access_token='+encodeURIComponent(token));
  if(!pub.json || !pub.json.id) return { ok:false, step:'publish', err:pub.json&&pub.json.error };
  return { ok:true, id:pub.json.id };
}
async function fbPublishPhoto(pageId, token, imageUrl, caption){
  const r = await reqUrl('POST', GRAPH+'/'+pageId+'/photos?url='+encodeURIComponent(imageUrl)+'&caption='+encodeURIComponent(caption)+'&access_token='+encodeURIComponent(token));
  if(!r.json || !(r.json.id||r.json.post_id)) return { ok:false, err:r.json&&r.json.error };
  return { ok:true, id:r.json.post_id||r.json.id };
}

exports.handler = async (event) => {
  const H = { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type,x-admin-token' };
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:H, body:'' };
  if (event.httpMethod !== 'POST') return { statusCode:405, headers:H, body:JSON.stringify({ok:false, reason:'method_not_allowed'}) };

  // אבטחה: פעולה זו מפרסמת בשם החברה - חובה סוד שרת
  if (!process.env.SOCIAL_PUBLISH_TOKEN) return { statusCode:403, headers:H, body:JSON.stringify({ok:false, reason:'endpoint_disabled_no_token'}) };
  const _h = event.headers || {};
  if ((_h['x-admin-token']||_h['X-Admin-Token']) !== process.env.SOCIAL_PUBLISH_TOKEN)
    return { statusCode:403, headers:H, body:JSON.stringify({ok:false, reason:'unauthorized'}) };

  const FB_PAGE_ID=process.env.FB_PAGE_ID, FB_PAGE_TOKEN=process.env.FB_PAGE_TOKEN, IG_USER_ID=process.env.IG_USER_ID;

  let p={}; try{ p=JSON.parse(event.body||'{}'); }catch(e){ return { statusCode:400, headers:H, body:JSON.stringify({ok:false, reason:'bad_json'}) }; }
  const carId=p.carId, targets=Array.isArray(p.targets)?p.targets:['ig','fb'], type=(p.type==='reel')?'reel':'photo';

  // שליפת הרכב
  let car=null;
  try{
    const rows = await getJson(SB_URL+'/rest/v1/inventory?id=eq.1&select=data',{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY });
    const cars=(rows&&rows[0]&&Array.isArray(rows[0].data))?rows[0].data:[];
    car=cars.find(c=>c&&String(c.id)===String(carId))||null;
  }catch(e){ return { statusCode:502, headers:H, body:JSON.stringify({ok:false, reason:'inventory_error'}) }; }
  if(!car) return { statusCode:404, headers:H, body:JSON.stringify({ok:false, reason:'car_not_found'}) };

  const caption = (p.caption && String(p.caption).trim()) || buildCaption(car);
  const mediaUrl = (p.mediaUrl && String(p.mediaUrl).trim())
    || (type==='reel' ? '' : (car.catalog_image||car.image||''));
  if(!mediaUrl || String(mediaUrl).startsWith('data:'))
    return { statusCode:400, headers:H, body:JSON.stringify({ok:false, reason:type==='reel'?'missing_video_url':'missing_public_image_url'}) };

  const results={};
  if(targets.indexOf('ig')>=0){
    if(!IG_USER_ID||!FB_PAGE_TOKEN) results.ig={ok:false, err:'missing_ig_env'};
    else results.ig = type==='reel' ? await igPublishReel(IG_USER_ID,FB_PAGE_TOKEN,mediaUrl,caption)
                                    : await igPublishPhoto(IG_USER_ID,FB_PAGE_TOKEN,mediaUrl,caption);
  }
  if(targets.indexOf('fb')>=0){
    if(!FB_PAGE_ID||!FB_PAGE_TOKEN) results.fb={ok:false, err:'missing_fb_env'};
    else results.fb = await fbPublishPhoto(FB_PAGE_ID,FB_PAGE_TOKEN,mediaUrl,caption); // רילס לפייסבוק - שלב עתידי
  }
  const anyOk = Object.keys(results).some(k=>results[k]&&results[k].ok);
  return { statusCode: anyOk?200:502, headers:H, body:JSON.stringify({ ok:anyOk, results:results }) };
};
