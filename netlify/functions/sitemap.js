// Sitemap דינמי ל-Google - נשלף ממלאי האתר ב-Supabase. כתובת ציבורית: https://autodealer.co.il/sitemap.xml
// כולל את דף הבית, עמודי מידע, וכל עמוד רכב (?car=<id>) - כדי שגוגל יאנדקס כל רכב בנפרד.
const https = require('https');
const SB_URL = 'https://vwfmfjjdusirabgbkhvw.supabase.co';
const SB_KEY = 'sb_publishable_E6Dd48mtyJyw5_6vgP2lzw_Gaj-QcAx';
const SITE = 'https://autodealer.co.il';
const HIDDEN_IDS = [11,13];

function fetchJson(url, headers){ return new Promise((resolve,reject)=>{ https.get(url,{headers},(res)=>{ let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{ resolve(JSON.parse(d)); }catch(e){ reject(e); } }); }).on('error',reject); }); }
function xmlEsc(v){ return (v==null?'':String(v)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }

exports.handler = async () => {
  const urls = [
    { loc: SITE + '/', pri: '1.0', freq: 'daily' },
    { loc: SITE + '/?p=catalog', pri: '0.9', freq: 'daily' }
  ];
  try {
    const rows = await fetchJson(SB_URL + '/rest/v1/inventory?id=eq.1&select=data', { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY });
    const cars = (rows && rows[0] && Array.isArray(rows[0].data)) ? rows[0].data : [];
    cars.forEach(c => {
      if(!c || c.hidden || HIDDEN_IDS.indexOf(c.id)>=0) return;
      if((Number(c.autodealerPriceNumber)||0) <= 1) return;
      urls.push({ loc: SITE + '/?car=' + encodeURIComponent(c.id), pri: '0.8', freq: 'weekly' });
    });
  } catch (e) { /* אם Supabase נכשל - עדיין מחזירים sitemap בסיסי */ }

  const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => '  <url>\n    <loc>' + xmlEsc(u.loc) + '</loc>\n    <changefreq>' + u.freq + '</changefreq>\n    <priority>' + u.pri + '</priority>\n  </url>').join('\n') +
    '\n</urlset>\n';

  return { statusCode:200, headers:{ 'Content-Type':'application/xml; charset=utf-8', 'Cache-Control':'public, max-age=3600' }, body };
};
