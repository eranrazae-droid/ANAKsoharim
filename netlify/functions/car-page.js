// SSR לעמוד רכב בודד: מגיש /?car=<id> עם meta ייחודי כבר ב-HTML הגולמי,
// כדי שגוגל יאנדקס כל רכב בנפרד (canonical שמצביע על עצמו, כותרת/תיאור/OG של הרכב).
// ה-SPA עדיין נטען כרגיל אצל המשתמש; רק ה-<head> מוזרק מראש.
const https = require('https');
const SB_URL = 'https://vwfmfjjdusirabgbkhvw.supabase.co';
const SB_KEY = 'sb_publishable_E6Dd48mtyJyw5_6vgP2lzw_Gaj-QcAx';
const SITE = 'https://autodealer.co.il';
const HIDDEN_IDS = [11];

function fetchText(url, headers){ return new Promise((resolve,reject)=>{ https.get(url,{headers:headers||{}},(res)=>{ let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(d)); }).on('error',reject); }); }
function fetchJson(url, headers){ return fetchText(url, headers).then(t=>{ try{ return JSON.parse(t); }catch(e){ return null; } }); }
function htmlEsc(v){ return (v==null?'':String(v)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtPrice(n){ n=Number(n)||0; return n>0 ? n.toLocaleString('en-US') : ''; }

exports.handler = async (event) => {
  const id = event && event.queryStringParameters && event.queryStringParameters.id;

  // תמיד מגישים את ה-HTML הבסיסי; אם יש רכב תקין - מזריקים meta ייחודי.
  let html = '';
  try { html = await fetchText(SITE + '/index.html'); } catch(e) { html = ''; }
  if(!html){ return { statusCode:302, headers:{ Location: '/?car=' + encodeURIComponent(id||'') }, body:'' }; }

  let car = null;
  if(id){
    try {
      const rows = await fetchJson(SB_URL + '/rest/v1/inventory?id=eq.1&select=data', { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY });
      const cars = (rows && rows[0] && Array.isArray(rows[0].data)) ? rows[0].data : [];
      car = cars.find(c => c && String(c.id) === String(id)) || null;
      if(car && (car.hidden || HIDDEN_IDS.indexOf(car.id)>=0)) car = null;
    } catch(e) { car = null; }
  }

  if(car){
    const name = ((car.brand||'') + ' ' + (car.model||'')).trim();
    const yr = car.year ? (' ' + car.year) : '';
    const priceNum = Number(car.autodealerPriceNumber)||0;
    const priceTxt = priceNum>1 ? (' – החל מ-' + fmtPrice(priceNum) + ' ₪') : '';
    const title = name + yr + ' חדש 0 ק״מ' + priceTxt + ' | אוטודילר';
    const desc = (car.summary && String(car.summary).trim())
      ? String(car.summary).trim().replace(/\s+/g,' ').slice(0,300)
      : (name + yr + ' חדש 0 ק״מ מיבואן רשמי' + (car.engine?(' · '+car.engine):'') + '. מימון אישי, טרייד-אין וליווי עד סגירת העסקה — אוטודילר.');
    const url = SITE + '/?car=' + encodeURIComponent(car.id);
    const img = (car.catalog_image && String(car.catalog_image).trim()) ? String(car.catalog_image).trim()
      : (car.image && String(car.image).trim()) ? String(car.image).trim()
      : (SITE + '/og-image.png');

    const T = htmlEsc(title), D = htmlEsc(desc), U = htmlEsc(url), IMG = htmlEsc(img);

    html = html
      .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + T + '</title>')
      .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, '<meta name="description" content="' + D + '" />')
      .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, '<link rel="canonical" href="' + U + '" />')
      .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, '<meta property="og:url" content="' + U + '" />')
      .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, '<meta property="og:title" content="' + T + '" />')
      .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, '<meta property="og:description" content="' + D + '" />')
      .replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, '<meta property="og:image" content="' + IMG + '" />');
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'public, max-age=300' },
    body: html
  };
};
