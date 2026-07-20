// פיד קטלוג אוטומטי ל-Meta — נשלף ממלאי האתר ב-Supabase.
// כתובת: https://autodealer.co.il/.netlify/functions/catalog-feed
// מזהי המוצר (id) חייבים להיות זהים ל-metaContentId שנשלח באירועי הפיקסל.
const https = require('https');

const SB_URL = 'https://vwfmfjjdusirabgbkhvw.supabase.co';
const SB_KEY = 'sb_publishable_E6Dd48mtyJyw5_6vgP2lzw_Gaj-QcAx';
const SITE = 'https://autodealer.co.il';

// ---- זהה בדיוק לצד הלקוח ----
const META_ID_OVERRIDE = { 'Ultra RWD':'boqwy0lswj','Niro HEV LX':'zusxps8pyt','G6 Core+ RWD':'pji79zen63','SEAL U BOOST':'ldfwwl7bno','SEALION COMF':'ys2yq42hq5' };
function stableId(s){ s=(s||'').toString(); let h=5381; for(let i=0;i<s.length;i++){ h=(((h<<5)+h)+s.charCodeAt(i))&0xffffffff; } return 'ad'+(h>>>0).toString(36); }
function metaContentId(car){
  const model=((car&&car.model)||'').trim();
  for(const k in META_ID_OVERRIDE){ if(model && (model===k || model.indexOf(k)===0 || k.indexOf(model)===0)) return META_ID_OVERRIDE[k]; }
  return stableId(((car.brand||'')+'|'+model));
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
    const cols = ['id','title','description','availability','condition','price','link','image_link','brand'];
    const lines = [cols.join(',')];
    cars.forEach(c => {
      if(!c || c.hidden || HIDDEN_IDS.indexOf(c.id)>=0) return;
      const price = Number(c.autodealerPriceNumber)||0;
      if(price <= 1) return; // מסנן רכבי placeholder
      const id = metaContentId(c);
      const title = ((c.brand||'')+' '+(c.model||'')).trim();
      const desc = (c.summary && c.summary.trim()) ? c.summary.trim()
        : (title + (c.year?(' '+c.year):'') + (c.engine?(' · '+c.engine):'') + ' — רכב חדש 0 ק"מ מיבואן רשמי.');
      const avail = (c.stockStatus === 'אזל במלאי') ? 'out of stock' : 'in stock';
      const link = SITE + '/?car=' + encodeURIComponent(c.id);
      const img = c.image || (SITE + '/og-image.png');
      lines.push([
        csvCell(id), csvCell(title), csvCell(desc), csvCell(avail), csvCell('new'),
        csvCell(price + ' ILS'), csvCell(link), csvCell(img), csvCell(c.brand||'')
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
