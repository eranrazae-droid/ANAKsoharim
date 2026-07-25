// פרוקסי בצד שרת למשיכת דף מפרט מ-ICAR (עוקף CORS; ICAR עלול לחסום IP של שרת — אז יש נפילה-אחורה להדבקת טקסט).
// שימוש: /admin-api/icar?url=<כתובת ICAR>  → מחזיר את ה-HTML של הדף.
const https = require('https');

function fetchText(url, depth){
  depth = depth||0;
  return new Promise((resolve,reject)=>{
    if(depth>4) return reject(new Error('too many redirects'));
    let u; try{ u=new URL(url); }catch(e){ return reject(e); }
    const opts = { hostname:u.hostname, path:u.pathname+u.search, method:'GET', headers:{
      'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
      'Accept':'text/html,application/xhtml+xml',
      'Accept-Language':'he-IL,he;q=0.9,en;q=0.8'
    }};
    https.get(opts, (res)=>{
      if(res.statusCode>=300 && res.statusCode<400 && res.headers.location){
        const next = new URL(res.headers.location, url).href;
        res.resume(); return fetchText(next, depth+1).then(resolve, reject);
      }
      if(res.statusCode!==200){ res.resume(); return reject(new Error('status '+res.statusCode)); }
      let d=''; res.setEncoding('utf8'); res.on('data',c=>d+=c); res.on('end',()=>resolve(d));
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  const H = { 'Content-Type':'text/plain; charset=utf-8', 'Access-Control-Allow-Origin':'*' };
  const url = ((event.queryStringParameters||{}).url||'').trim();
  if(!/^https?:\/\/(www\.)?icar\.co\.il\//i.test(url)) return { statusCode:400, headers:H, body:'bad url (icar.co.il only)' };
  try {
    const html = await fetchText(url);
    return { statusCode:200, headers:H, body:html };
  } catch (e) {
    return { statusCode:502, headers:H, body:'fetch error: ' + String(e && e.message || e) };
  }
};
