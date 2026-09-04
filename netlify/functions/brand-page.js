// עמוד נחיתה לפי יצרן (SEO) - נוצר אוטומטית מהמלאי ב-Supabase.
// כתובת: /brand/<שם היצרן>  (למשל /brand/BYD או /brand/יונדאי)  → rewrite ב-netlify.toml
// מגיש HTML מלא עם כותרת/תיאור/canonical ייחודיים לכל יצרן, רשימת הרכבים, וקישור לכל רכב.
const https = require('https');
const SB_URL = 'https://vwfmfjjdusirabgbkhvw.supabase.co';
const SB_KEY = 'sb_publishable_E6Dd48mtyJyw5_6vgP2lzw_Gaj-QcAx';
const SITE = 'https://autodealer.co.il';
const HIDDEN_IDS = [11];

function fetchJson(url, headers){ return new Promise((resolve,reject)=>{ https.get(url,{headers},(res)=>{ let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d));}catch(e){reject(e);} }); }).on('error',reject); }); }
function esc(v){ return (v==null?'':String(v)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n){ n=Number(n)||0; return n>0 ? n.toLocaleString('en-US') : ''; }
function cldOpt(url,w){ try{ if(url && url.indexOf('res.cloudinary.com')>=0 && url.indexOf('/upload/')>=0 && url.indexOf('f_auto')<0){ return url.replace('/upload/','/upload/f_auto,q_auto,w_'+w+',c_limit,dpr_auto/'); } }catch(e){} return url; }

exports.handler = async (event) => {
  const reqBrand = (event.queryStringParameters && event.queryStringParameters.brand) ? decodeURIComponent(event.queryStringParameters.brand).trim() : '';
  let cars = [];
  try {
    const rows = await fetchJson(SB_URL + '/rest/v1/inventory?id=eq.1&select=data', { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY });
    cars = (rows && rows[0] && Array.isArray(rows[0].data)) ? rows[0].data : [];
  } catch (e) { cars = []; }

  const active = cars.filter(c => c && !c.hidden && HIDDEN_IDS.indexOf(c.id)<0 && (Number(c.autodealerPriceNumber)||0) > 1);
  const norm = s => (s==null?'':String(s)).trim().toLowerCase();
  // כל היצרנים במלאי (לניווט צולב)
  const brands = [...new Set(active.map(c=>c.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'he'));

  // אם לא נמצא יצרן תקין - מפנים לדף הבית
  const matchBrand = brands.find(b => norm(b) === norm(reqBrand));
  if(!matchBrand){ return { statusCode:302, headers:{ Location: SITE + '/' }, body:'' }; }

  const list = active.filter(c => norm(c.brand) === norm(matchBrand))
    .sort((a,b)=>(Number(a.autodealerPriceNumber)||0)-(Number(b.autodealerPriceNumber)||0));

  const brandUrl = SITE + '/brand/' + encodeURIComponent(matchBrand);
  const minPrice = list.reduce((m,c)=>{ const p=Number(c.autodealerPriceNumber)||0; return (p>1 && (m===0||p<m))?p:m; }, 0);
  const title = 'רכבי ' + matchBrand + ' חדשים 0 ק"מ במחירי דיל' + (minPrice?(' – החל מ-'+fmt(minPrice)+' ₪'):'') + ' | אוטודילר';
  const desc = 'כל דגמי ' + matchBrand + ' החדשים 0 ק"מ במלאי אוטודילר, במחירי דיל. ' + list.length + ' דגמים זמינים, מימון אישי, טרייד-אין וליווי עד סגירת העסקה. קבלו הצעה מהירה בוואטסאפ.';
  const ogImg = (function(){ const c=list.find(c=>c.catalog_image||c.image); const u=c?(c.catalog_image||c.image):''; return (u && !String(u).startsWith('data:'))?u:(SITE+'/og-image.png'); })();

  const cardsHtml = list.map(c => {
    const name = ((c.brand||'')+' '+(c.model||'')).trim();
    const price = Number(c.autodealerPriceNumber)||0;
    let img = c.catalog_image || c.image || '';
    if(String(img).startsWith('data:')) img = SITE+'/og-image.png';
    img = cldOpt(img, 600);
    const link = SITE + '/?car=' + encodeURIComponent(c.id);
    return '<a class="card" href="'+esc(link)+'">'+
      '<div class="imgw"><img loading="lazy" src="'+esc(img)+'" alt="'+esc(name)+' חדש 0 ק״מ"></div>'+
      '<div class="cbody"><div class="cname">'+esc(name)+(c.year?(' <span class="yr">'+esc(c.year)+'</span>'):'')+'</div>'+
      (c.engine?('<div class="ceng">'+esc(c.engine)+'</div>'):'')+
      (price>1?('<div class="cprice">החל מ-'+fmt(price)+' ₪</div>'):'')+
      '<div class="cbtn">לפרטים ומחיר →</div></div></a>';
  }).join('');

  const brandsNav = brands.map(b => b===matchBrand
    ? '<span class="bchip active">'+esc(b)+'</span>'
    : '<a class="bchip" href="'+SITE+'/brand/'+encodeURIComponent(b)+'">'+esc(b)+'</a>').join('');

  const jsonld = {
    "@context":"https://schema.org","@type":"CollectionPage","name":title,"url":brandUrl,
    "about":{"@type":"Brand","name":matchBrand},
    "isPartOf":{"@type":"WebSite","name":"אוטודילר","url":SITE}
  };

  const html = '<!doctype html><html lang="he" dir="rtl"><head>'+
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">'+
    '<title>'+esc(title)+'</title>'+
    '<meta name="description" content="'+esc(desc)+'">'+
    '<link rel="canonical" href="'+esc(brandUrl)+'">'+
    '<meta name="robots" content="index, follow">'+
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">'+
    '<meta property="og:type" content="website"><meta property="og:title" content="'+esc(title)+'">'+
    '<meta property="og:description" content="'+esc(desc)+'"><meta property="og:url" content="'+esc(brandUrl)+'">'+
    '<meta property="og:image" content="'+esc(ogImg)+'"><meta property="og:locale" content="he_IL">'+
    '<script type="application/ld+json">'+JSON.stringify(jsonld)+'</script>'+
    '<style>'+
    '*{box-sizing:border-box}body{margin:0;font-family:Arial,Heebo,sans-serif;background:#f6f6f4;color:#111;direction:rtl}'+
    'a{text-decoration:none;color:inherit}'+
    '.top{background:#0d0d0d;color:#fff;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}'+
    '.top .logo{font-size:22px;font-weight:900}.top .logo span{color:#D4A017}'+
    '.top .cta{display:flex;gap:8px;flex-wrap:wrap}'+
    '.top .cta a{padding:8px 14px;border-radius:10px;font-weight:800;font-size:14px}'+
    '.wa{background:#25D366;color:#fff}.tel{background:#D4A017;color:#000}'+
    '.hero{max-width:1100px;margin:0 auto;padding:26px 18px 6px}'+
    '.hero h1{font-size:26px;margin:0 0 8px}.hero p{color:#555;line-height:1.7;margin:0 0 14px}'+
    '.bnav{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 18px}'+
    '.bchip{background:#fff;border:1px solid #e5e5e5;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:700}'+
    '.bchip.active{background:#0d0d0d;color:#fff;border-color:#0d0d0d}'+
    '.grid{max-width:1100px;margin:0 auto;padding:0 18px 40px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}'+
    '.card{background:#fff;border:1px solid #ececec;border-radius:16px;overflow:hidden;transition:.15s;display:flex;flex-direction:column}'+
    '.card:hover{box-shadow:0 8px 24px rgba(0,0,0,.1);transform:translateY(-2px)}'+
    '.imgw{aspect-ratio:16/10;background:#f0f0f0;overflow:hidden}.imgw img{width:100%;height:100%;object-fit:cover}'+
    '.cbody{padding:12px 14px;display:flex;flex-direction:column;gap:4px;flex:1}'+
    '.cname{font-weight:800;font-size:15px}.yr{color:#888;font-weight:400}'+
    '.ceng{font-size:12px;color:#777}'+
    '.cprice{font-weight:900;color:#a16207;font-size:16px;margin-top:2px}'+
    '.cbtn{margin-top:auto;padding-top:8px;color:#2563eb;font-weight:800;font-size:13px}'+
    '.foot{background:#0d0d0d;color:#bbb;text-align:center;padding:24px 18px;font-size:13px;line-height:1.9}'+
    '.foot a{color:#D4A017;font-weight:700}'+
    '</style></head><body>'+
    '<div class="top"><a class="logo" href="'+SITE+'/"><span>אוטו</span>דילר</a>'+
    '<div class="cta"><a class="tel" href="tel:0508396030">📞 050-839-6030</a>'+
    '<a class="wa" href="https://wa.me/972508396030?text='+encodeURIComponent('היי, מעוניין ברכב '+matchBrand)+'" target="_blank">💬 וואטסאפ</a></div></div>'+
    '<div class="hero"><h1>'+esc('רכבי '+matchBrand+' חדשים 0 ק"מ במחירי דיל')+'</h1>'+
    '<p>'+esc(desc)+'</p>'+
    '<div class="bnav">'+brandsNav+'</div></div>'+
    (list.length?('<div class="grid">'+cardsHtml+'</div>'):'<div class="hero"><p>אין כרגע דגמי '+esc(matchBrand)+' זמינים במלאי. <a href="'+SITE+'/">לכל המלאי »</a></p></div>')+
    '<div class="foot"><a href="'+SITE+'/">אוטודילר</a> — רכבים חדשים 0 ק"מ במחירי דיל · מימון אישי · טרייד-אין<br>'+
    'דוד רזיאל 4, ראשון לציון · 050-839-6030 · <a href="'+SITE+'/">לכל המלאי »</a></div>'+
    '</body></html>';

  return { statusCode:200, headers:{ 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'public, max-age=600' }, body: html };
};
