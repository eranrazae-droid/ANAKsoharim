// פיד קטלוג XML ל-Meta (RSS 2.0 + מרחב שמות g:). נשלף ממלאי האתר ב-Supabase.
// כתובת ציבורית: https://autodealer.co.il/catalog.xml  (rewrite ב-netlify.toml)
// המזהה (g:id) הוא meta_content_id הקבוע ששמור על כל רכב במסד הנתונים.
const https = require('https');

const SB_URL = 'https://vwfmfjjdusirabgbkhvw.supabase.co';
const SB_KEY = 'sb_publishable_E6Dd48mtyJyw5_6vgP2lzw_Gaj-QcAx';
const SITE = 'https://autodealer.co.il';
const HIDDEN_IDS = [11,13];

// דריסות למזהי הקטלוג הקיימים (מ-meta_catalog_existing_ids.csv). מיזוג נוסף יתווסף כאן.
const META_ID_OVERRIDE = { 'Ultra RWD':'boqwy0lswj','Niro HEV LX':'zusxps8pyt','G6 Core+ RWD':'pji79zen63','SEAL U BOOST':'ldfwwl7bno','SEALION COMF':'ys2yq42hq5' };
function stableId(s){ s=(s||'').toString(); let h=5381; for(let i=0;i<s.length;i++){ h=(((h<<5)+h)+s.charCodeAt(i))&0xffffffff; } return 'ad'+(h>>>0).toString(36); }
function metaContentId(car){
  if(car && car.meta_content_id) return car.meta_content_id;       // מזהה קבוע ששמור במסד הנתונים
  const model=((car&&car.model)||'').trim();
  for(const k in META_ID_OVERRIDE){ if(model && (model===k || model.indexOf(k)===0 || k.indexOf(model)===0)) return META_ID_OVERRIDE[k]; }
  return stableId(((car.brand||'')+'|'+model));
}
function xmlEsc(v){ return (v==null?'':String(v)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
function fetchJson(url, headers){ return new Promise((resolve,reject)=>{ https.get(url,{headers},(res)=>{ let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{ resolve(JSON.parse(d)); }catch(e){ reject(e); } }); }).on('error',reject); }); }

exports.handler = async () => {
  try {
    const rows = await fetchJson(SB_URL + '/rest/v1/inventory?id=eq.1&select=data', { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY });
    const cars = (rows && rows[0] && Array.isArray(rows[0].data)) ? rows[0].data : [];
    let items = '';
    cars.forEach(c => {
      if(!c || c.hidden || HIDDEN_IDS.indexOf(c.id)>=0) return;                 // רכב מוסתר לא בפיד
      if(c.meta_hide) return;                                                    // הוסתר ידנית מקטלוג Meta
      const price = Number(c.autodealerPriceNumber)||0;
      if(price <= 1) return;
      const id = metaContentId(c);
      const title = ((c.brand||'')+' '+(c.model||'')+(c.year?(' '+c.year):'')).trim();
      const desc = (c.summary && c.summary.trim()) ? c.summary.trim()
        : (((c.brand||'')+' '+(c.model||'')).trim() + (c.engine?(' · '+c.engine):'') + ' — רכב חדש 0 ק"מ מיבואן רשמי, אחריות מלאה.');
      const avail = (c.stockStatus === 'אזל במלאי') ? 'out of stock' : 'in stock';
      const link = SITE + '/?car=' + encodeURIComponent(c.id);
      const img = (c.catalog_image && c.catalog_image.trim()) ? c.catalog_image.trim() : (c.image || (SITE + '/og-image.png'));
      items += '\n    <item>' +
        '\n      <g:id>' + xmlEsc(id) + '</g:id>' +
        '\n      <g:title>' + xmlEsc(title) + '</g:title>' +
        '\n      <g:description>' + xmlEsc(desc) + '</g:description>' +
        '\n      <g:availability>' + avail + '</g:availability>' +
        '\n      <g:condition>new</g:condition>' +
        '\n      <g:price>' + xmlEsc(price + ' ILS') + '</g:price>' +
        '\n      <g:link>' + xmlEsc(link) + '</g:link>' +
        '\n      <g:image_link>' + xmlEsc(img) + '</g:image_link>' +
        '\n      <g:brand>' + xmlEsc(c.brand||'') + '</g:brand>' +
        '\n    </item>';
    });
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n  <channel>\n' +
      '    <title>Autodealer — קטלוג רכבים</title>\n' +
      '    <link>' + SITE + '</link>\n' +
      '    <description>רכבים חדשים 0 ק"מ במחירי דיל</description>' +
      items + '\n  </channel>\n</rss>\n';
    return { statusCode:200, headers:{ 'Content-Type':'application/xml; charset=utf-8', 'Cache-Control':'public, max-age=1800', 'Access-Control-Allow-Origin':'*' }, body: xml };
  } catch (e) {
    return { statusCode:502, headers:{ 'Content-Type':'text/plain' }, body:'feed error: ' + String(e) };
  }
};
