// מיגרציה חד-פעמית ואידמפוטנטית של meta_content_id במלאי Supabase.
// דורסת מזהים שגויים היכן שיש התאמה חד-משמעית למפת 38 מזהי הקטלוג הקנונית.
// שימוש:
//   דוח בלבד (dry-run):  /.netlify/functions/migrate-metaids
//   הרצה בפועל:          /.netlify/functions/migrate-metaids?apply=1&confirm=REPLACE-META-IDS
// אבטחה: הכתיבה בפועל דורשת confirm=REPLACE-META-IDS (וגם token אם הוגדר MIGRATE_TOKEN).
const https = require('https');

const SB_URL = 'https://vwfmfjjdusirabgbkhvw.supabase.co';
const SB_KEY = 'sb_publishable_E6Dd48mtyJyw5_6vgP2lzw_Gaj-QcAx';

// ---- מפת 38 מזהי הקטלוג הקנונית (זהה ל-catalog-xml.js / index.html / admin.html) ----
const META_ID_BY_MODEL_RAW = {
  'Ultra RWD':'boqwy0lswj','G6 Core+ RWD':'pji79zen63','NIRO HEV LX 1.6':'zusxps8pyt',
  'BYD SEALION DESIGN 5 DM-i':'s7x208qk17','BYD SEALION COMF 5 DM-i':'ys2yq42hq5','BYD SEAL U BOOST  DM-i':'ldfwwl7bno',
  'PICANTO LX PLUS 1.2':'v4vovvsjur','ARIZO 8 PHEV COMFORT 1.5':'742opmtpgb',
  'TIGGO 9 PRO PHEV LUXURY + גג 1.5':'hhcs2egn5a','TIGGO 7 PRO PHEV LUXURY + גג 1.5':'ngh3409m94',
  'TIGGO 4 COMFORT HEV 1.5':'pzvraxvq1n','TIGGO 8 PRO PHEV NOBLE + גג 1.5':'fxhq9au8i3','FX COMFORT HEV 1.5':'9egvoqm8zi',
  'ACTIVE 2008':'cfbw9bj8i3','OCTAVIA FL SELECTION 1.5':'5x99nrhghk','OMODA 7 PHV - Harmony':'tnl6imzcgm',
  'OMODA 9 PHEV - Harmony':'9ce73qfbjx','THE NEW CROSSTREK LUXURY 2.5':'47he7lwg6l','ARONA STYLE 1.0':'r6rqj79r25',
  'OUTLANDER INSTYLE FL 2.5 גג':'2if572suv6','KAMIQ FL SELECTION 1.0':'tc644a8ggd','StarRay EM-i Pro':'6bey5nudn3',
  'OUTLANDER EXECUTIVE 2.5':'tnyzyzrzmt','SONATA LIMITED FL HYBRID 2.0':'imn9xsw08i','KONA PREMIUM HYBRID 1.6':'80w1sumrt0',
  'TUCSON PURE HYBRID 1.6':'fyo12b6yp2','ELANTRA PREMIUM FL HYBRID 1.6':'149a1rfwp1','YARIS CROSS ECO HSD 1.5':'icviu52dz7',
  'JAECOO 7 LUXURY PHEV 1.5':'tuap37v2id','EX5 PRO':'rje839v4np','JAECOO 7 PREMIUM PHEV 1.5':'g8w3y2rd35',
  'C10 LIFE':'36rjevja9f','RANGER XLT 4X4':'qfyq3aympk','COROLLA CROSS ACTIVE MC':'es0ae94upl',
  'COROLLA CROSS ACTIVE':'briwwf3fqa','COROLLA CROSS ADVENTURE':'ig69ke37xd'
};
const META_ID_CONTAINS = [['ranger','qfyq3aympk'],['c10','36rjevja9f']];
function _mnorm(s){ return (s==null?'':String(s)).toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]+/g,''); }
const META_ID_EXACT = (function(){ const o={}; for(const k in META_ID_BY_MODEL_RAW){ o[_mnorm(k)]=META_ID_BY_MODEL_RAW[k]; } return o; })();
function matchExistingMetaId(brand, model){
  const nm=_mnorm(model), nbm=_mnorm((brand||'')+' '+(model||''));
  if(META_ID_EXACT[nm]) return META_ID_EXACT[nm];
  if(META_ID_EXACT[nbm]) return META_ID_EXACT[nbm];
  for(let i=0;i<META_ID_CONTAINS.length;i++){ if(nm.indexOf(META_ID_CONTAINS[i][0])>=0) return META_ID_CONTAINS[i][1]; }
  return null;
}

function reqJson(method, url, headers, bodyObj){
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
  const q = (event && event.queryStringParameters) || {};
  const apply = q.apply === '1' || q.apply === 'true';
  const CORS = { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*' };

  try {
    const auth = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
    const got = await reqJson('GET', SB_URL + '/rest/v1/inventory?id=eq.1&select=data', auth);
    let rows; try{ rows = JSON.parse(got.body); }catch(e){ return { statusCode:502, headers:CORS, body:JSON.stringify({error:'bad inventory json', raw:got.body}) }; }
    const cars = (rows && rows[0] && Array.isArray(rows[0].data)) ? rows[0].data : [];

    const report = [];
    let changed = 0;
    cars.forEach(c => {
      if(!c) return;
      const name = ((c.brand||'')+' '+(c.model||'')).trim();
      const before = c.meta_content_id || null;
      const expected = matchExistingMetaId(c.brand, c.model);
      let status, after = before;
      if(expected){
        if(before === expected){ status = 'already-correct'; }
        else { status = before ? 'updated (overwrote wrong id)' : 'filled (was empty)'; after = expected; c.meta_content_id = expected; changed++; }
      } else {
        status = before ? 'kept (no canonical match)' : 'empty (no canonical match)';
      }
      report.push({ id:c.id, name, before, after, status });
    });

    // בדיקת כפילויות על התוצאה הסופית (התעלמות מ-null)
    const byId = {};
    cars.forEach(c => { if(c && c.meta_content_id){ (byId[c.meta_content_id]=byId[c.meta_content_id]||[]).push(((c.brand||'')+' '+(c.model||'')).trim()); } });
    const duplicates = Object.keys(byId).filter(k => byId[k].length>1).map(k => ({ meta_content_id:k, cars:byId[k] }));

    let applied = false, writeStatus = null;
    if(apply){
      const confirmOk = q.confirm === 'REPLACE-META-IDS';
      const tokenOk = !process.env.MIGRATE_TOKEN || q.token === process.env.MIGRATE_TOKEN;
      if(!confirmOk) return { statusCode:403, headers:CORS, body:JSON.stringify({ error:'missing confirm=REPLACE-META-IDS' }) };
      if(!tokenOk)   return { statusCode:403, headers:CORS, body:JSON.stringify({ error:'bad token' }) };
      if(changed > 0){
        const w = await reqJson('PATCH', SB_URL + '/rest/v1/inventory?id=eq.1',
          Object.assign({}, auth, { Prefer:'return=minimal' }), { data: cars });
        writeStatus = w.status; applied = (w.status>=200 && w.status<300);
        if(!applied) return { statusCode:502, headers:CORS, body:JSON.stringify({ error:'supabase write failed', writeStatus, raw:w.body, report }) };
      } else { applied = true; /* אין מה לעדכן */ }
    }

    const exceptions = report.filter(r => r.status.indexOf('no canonical match')>=0);
    return { statusCode:200, headers:CORS, body:JSON.stringify({
      mode: apply ? 'APPLIED' : 'DRY-RUN (add ?apply=1&confirm=REPLACE-META-IDS to write)',
      total: cars.length,
      changed,
      applied,
      writeStatus,
      duplicates,
      exceptions_count: exceptions.length,
      exceptions,
      report
    }, null, 2) };
  } catch (e) {
    return { statusCode:502, headers:CORS, body:JSON.stringify({ error:String(e) }) };
  }
};
