// SSR לעמוד רכב בודד: מגיש /?car=<id> עם meta ייחודי כבר ב-HTML הגולמי,
// כדי שגוגל יאנדקס כל רכב בנפרד (canonical עצמי, כותרת/תיאור/OG/JSON-LD של הרכב).
// ה-SPA עדיין נטען כרגיל אצל המשתמש; רק ה-<head> מוזרק מראש.
// דה-דופ: אם קיימים כמה רכבים זהים (יצרן+דגם+שנה), ה-canonical מצביע על ה"מנצח"
// (המזהה הגבוה/החדש ביותר) כדי שגוגל יאחד אותם נכון - לעמוד הרכב, לא לעמוד הבית.
const https = require('https');
const SB_URL = 'https://vwfmfjjdusirabgbkhvw.supabase.co';
const SB_KEY = 'sb_publishable_E6Dd48mtyJyw5_6vgP2lzw_Gaj-QcAx';
const SITE = 'https://autodealer.co.il';
const HIDDEN_IDS = [11];

function fetchText(url, headers){ return new Promise((resolve,reject)=>{ https.get(url,{headers:headers||{}},(res)=>{ let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(d)); }).on('error',reject); }); }
function fetchJson(url, headers){ return fetchText(url, headers).then(t=>{ try{ return JSON.parse(t); }catch(e){ return null; } }); }
function htmlEsc(v){ return (v==null?'':String(v)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtPrice(n){ n=Number(n)||0; return n>0 ? n.toLocaleString('en-US') : ''; }
function _mnorm(s){ return (s==null?'':String(s)).toLowerCase().replace(/[^a-z0-9֐-׿]+/g,''); }

// נוסחת החזר חודשי - זהה לצד הלקוח (balloon 50%, ריבית 4.3%, 60 תשלומים)
function monthlyPmt(principal, annualRate, months, fv){
  const p=Number(principal||0); if(!p||!months) return 0;
  const r=annualRate/100/12, f=Number(fv||0);
  if(r===0) return (p-f)/months;
  return (p*r - f*r/Math.pow(1+r,months)) / (1-Math.pow(1+r,-months));
}
function balloon50(price){ const p=Number(price||0); return monthlyPmt(p, 4.3, 60, p*0.5); }

// מפתח זהות רכב לדה-דופ: יצרן+דגם+שנה מנורמלים
function carKey(c){ return _mnorm(c&&c.brand) + '|' + _mnorm(c&&c.model) + '|' + String((c&&c.year)||'').trim(); }

exports.handler = async (event) => {
  // ה-redirect ב-netlify.toml עשוי להעביר את הפרמטר המקורי (car) ולא את המשוכתב (id) - קוראים את שניהם
  const qp = (event && event.queryStringParameters) || {};
  const id = qp.id || qp.car;

  // תמיד מגישים את ה-HTML הבסיסי; אם יש רכב תקין - מזריקים meta ייחודי.
  let html = '';
  try { html = await fetchText(SITE + '/index.html'); } catch(e) { html = ''; }
  if(!html){ return { statusCode:302, headers:{ Location: '/?car=' + encodeURIComponent(id||'') }, body:'' }; }

  let car = null, cars = [];
  if(id){
    try {
      const rows = await fetchJson(SB_URL + '/rest/v1/inventory?id=eq.1&select=data', { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY });
      cars = (rows && rows[0] && Array.isArray(rows[0].data)) ? rows[0].data : [];
      car = cars.find(c => c && String(c.id) === String(id)) || null;
      if(car && (car.hidden || HIDDEN_IDS.indexOf(car.id)>=0)) car = null;
    } catch(e) { car = null; }
  }

  // אם הרכב לא נמצא/לא תקין: לא מתחזים לעמוד הבית - מסמנים noindex כדי שגוגל לא יאחד לבית.
  if(!car){
    html = html
      .replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i, '<meta name="robots" content="noindex, follow" />');
    return { statusCode:200, headers:{ 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'public, max-age=120' }, body: html };
  }

  // דה-דופ: מציאת ה"מנצח" (מזהה מספרי גבוה ביותר) בין רכבים זהים
  const active = cars.filter(c => c && !c.hidden && HIDDEN_IDS.indexOf(c.id)<0 && (Number(c.autodealerPriceNumber)||0) > 1);
  const key = carKey(car);
  let winner = car;
  active.forEach(c => { if(carKey(c)===key){ if(Number(c.id) > Number(winner.id)) winner = c; } });
  const canonId = winner.id;

  const name = ((car.brand||'') + ' ' + (car.model||'')).trim();
  const yr = car.year ? (' ' + car.year) : '';
  const priceNum = Number(car.autodealerPriceNumber)||0;
  const monthlyNum = priceNum>1 ? Math.round(balloon50(priceNum)) : 0;

  // כותרת בפורמט: "יונדאי טוסון 2026 0 ק״מ - מחיר דיל | אוטודילר"
  const title = name + yr + ' 0 ק״מ - מחיר דיל | אוטודילר';

  // תיאור ייחודי הכולל דגם, מחיר והחזר חודשי
  const priceTxt = priceNum>1 ? ('מחיר דיל ' + fmtPrice(priceNum) + ' ₪') : '';
  const monthlyTxt = monthlyNum>0 ? ('החזר חודשי מ-' + fmtPrice(monthlyNum) + ' ₪') : '';
  const desc = (name + yr + ' חדש 0 ק״מ מיבואן רשמי' + (car.engine?(' · '+car.engine):'') + '. ' +
    [priceTxt, monthlyTxt].filter(Boolean).join(' · ') + (priceTxt||monthlyTxt?'. ':'') +
    'מימון עד 100% ללא מקדמה, טרייד-אין וליווי אישי עד סגירת העסקה — אוטודילר.').replace(/\s+/g,' ').slice(0,320);

  const url = SITE + '/?car=' + encodeURIComponent(canonId);
  const img = (car.catalog_image && String(car.catalog_image).trim() && !String(car.catalog_image).startsWith('data:')) ? String(car.catalog_image).trim()
    : (car.image && String(car.image).trim() && !String(car.image).startsWith('data:')) ? String(car.image).trim()
    : (SITE + '/og-image.png');

  // JSON-LD מסוג Car (תת-סוג של Vehicle) עם מחיר, יצרן, דגם ושנה
  const ld = { "@context":"https://schema.org", "@type":"Car",
    "name": (name+yr).trim(), "url": url, "image": img,
    "brand": { "@type":"Brand", "name": car.brand||'' },
    "model": car.model||'', "vehicleModelDate": car.year||'',
    "itemCondition": "https://schema.org/NewCondition", "mileageFromOdometer": { "@type":"QuantitativeValue", "value":0, "unitCode":"KMT" } };
  if(car.engine) ld.vehicleEngine = { "@type":"EngineSpecification", "name": car.engine };
  if(priceNum>1) ld.offers = { "@type":"Offer", "priceCurrency":"ILS", "price":priceNum, "availability":"https://schema.org/InStock", "url":url, "seller":{ "@type":"AutoDealer", "name":"אוטודילר" } };

  const T = htmlEsc(title), D = htmlEsc(desc), U = htmlEsc(url), IMG = htmlEsc(img);

  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + T + '</title>')
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, '<meta name="description" content="' + D + '" />')
    .replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i, '<meta name="robots" content="index, follow" />')
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, '<link rel="canonical" href="' + U + '" />')
    .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, '<meta property="og:url" content="' + U + '" />')
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, '<meta property="og:title" content="' + T + '" />')
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, '<meta property="og:description" content="' + D + '" />')
    .replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, '<meta property="og:image" content="' + IMG + '" />')
    .replace(/<\/head>/i, '<script type="application/ld+json">' + JSON.stringify(ld) + '</script>\n</head>');

  return {
    statusCode: 200,
    headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'public, max-age=300' },
    body: html
  };
};
