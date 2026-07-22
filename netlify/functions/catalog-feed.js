// פיד קטלוג אוטומטי ל-Meta — נשלף ממלאי האתר ב-Supabase.
// כתובת: https://autodealer.co.il/.netlify/functions/catalog-feed
// מזהי המוצר (id) חייבים להיות זהים ל-metaContentId שנשלח באירועי הפיקסל.
const https = require('https');

const SB_URL = 'https://vwfmfjjdusirabgbkhvw.supabase.co';
const SB_KEY = 'sb_publishable_E6Dd48mtyJyw5_6vgP2lzw_Gaj-QcAx';
const SITE = 'https://autodealer.co.il';

// ---- זהה בדיוק ל-catalog-xml.js ולצד הלקוח ----
const META_ID_BY_MODEL_RAW = {
  'Ultra RWD':'boqwy0lswj','G6 Core+ RWD':'pji79zen63','NIRO HEV LX 1.6':'zusxps8pyt',
  'BYD SEALION DESIGN 5 DM-i':'s7x208qk17','BYD SEALION COMF 5 DM-i':'ys2yq42hq5','BYD SEAL U BOOST DM-i':'ldfwwl7bno',
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
function stableId(s){ s=(s||'').toString(); let h=5381; for(let i=0;i<s.length;i++){ h=(((h<<5)+h)+s.charCodeAt(i))&0xffffffff; } return 'ad'+(h>>>0).toString(36); }
function metaContentId(car){
  if(car && car.meta_content_id) return car.meta_content_id;
  const m=matchExistingMetaId(car&&car.brand, car&&car.model);
  if(m) return m;
  return stableId(((car.brand||'')+'|'+((car&&car.model)||'').trim()));
}
const HIDDEN_IDS = [11,13];

function fetchJson(url, headers){
  return new Promise((resolve,reject)=>{
    https.get(url, { headers }, (res)=>{ let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{ resolve(JSON.parse(d)); }catch(e){ reject(e); } }); }).on('error',reject);
  });
}
function csvCell(v){ v=(v==null?'':String(v)).replace(/"/g,'""').replace(/[\r\n]+/g,' '); return '"'+v+'"'; }

exports.handler = async () => {
  try {
    const rows = await fetchJson(
      SB_URL + '/rest/v1/inventory?id=eq.1&select=data',
                                     { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
      );
    const cars = (rows && rows[0] && Array.isArray(rows[0].data)) ? rows[0].data : [];
    const cols = ['id','title','description','availability','condition','price','sale_price','link','image_link','brand'];
    const lines = [cols.join(',')];
    cars.forEach(c => {
      if(!c || c.hidden || HIDDEN_IDS.indexOf(c.id)>=0) return;
      const dealerPrice = Number(c.autodealerPriceNumber)||0;
      if(dealerPrice <= 1) return;
      const importerPrice = Number(c.catalogPriceNumber)||0;
      const listPrice = importerPrice > 0 ? importerPrice : dealerPrice;
      const id = metaContentId(c);
      const title = ((c.brand||'')+' '+(c.model||'')).trim();
      const desc = (c.summary && c.summary.trim()) ? c.summary.trim()
        : (title + (c.year?(' '+c.year):'') + (c.engine?(' · '+c.engine):'') + ' — רכב חדש 0 ק"מ מיבואן רשמי.');
      const avail = (c.stockStatus === 'אזל במלאי') ? 'out of stock' : 'in stock';
      const link = SITE + '/?car=' + encodeURIComponent(c.id);
      const img = (c.catalog_image && c.catalog_image.trim()) ? c.catalog_image.trim() : '';
      const salePrice = dealerPrice < listPrice ? (dealerPrice + ' ILS') : '';
      lines.push([
        csvCell(id), csvCell(title), csvCell(desc), csvCell(avail), csvCell('new'),
        csvCell(listPrice + ' ILS'), csvCell(salePrice), csvCell(link), csvCell(img), csvCell(c.brand||'')
        ].join(','));
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'public, max-age=1800', 'Access-Control-Allow-Origin': '*' },
      body: lines.join('\n')
    };
  } catch (e) {
    return { statusCode: 502, headers: { 'Content-Type':'text/plain' }, body: 'feed error: ' + String(e) };
  }
};
