// בדיקה: האם אפשר להוריד את קובץ מרשם הרכב במקום לשאול שאילתות
const RES = '053cea08-09bc-40ec-8f7a-156f0677aff3';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept': '*/*', 'Accept-Language': 'he-IL,he;q=0.9' };

const urls = [
  ['API datastore_search', `https://data.gov.il/api/3/action/datastore_search?resource_id=${RES}&limit=1`],
  ['API בלי UA', `https://data.gov.il/api/3/action/datastore_search?resource_id=${RES}&limit=1`],
  ['datastore dump CSV', `https://data.gov.il/datastore/dump/${RES}?limit=2`],
  ['עמוד הדאטהסט', 'https://data.gov.il/dataset/private-and-commercial-vehicles'],
  ['עמוד הבית', 'https://data.gov.il/'],
  ['אתר משרד התחבורה', 'https://www.gov.il/he/departments/ministry_of_transport'],
];

for (const [name, url] of urls) {
  try {
    const opts = name.includes('בלי UA') ? {} : { headers: UA };
    const r = await fetch(url, { ...opts, redirect: 'follow' });
    const t = await r.text();
    const isJson = t.trim().startsWith('{');
    console.log(`${name}: ${r.status} · ${r.headers.get('content-type')} · ${t.length} תווים`);
    console.log('   ' + t.slice(0, 160).replace(/\s+/g, ' '));
  } catch (e) {
    console.log(`${name}: שגיאה — ${e.message}`);
  }
}

console.log('\n=== מהשרת (Google Cloud) ===');
try {
  const r = await fetch('https://europe-west1-anak-soharim.cloudfunctions.net/govProbe');
  const j = await r.json();
  for (const t of j.tries || []) console.log(`  ${t.name} ${t.ua ? '(דפדפן)' : '(רגיל)'}: ${t.status || t.error} · ${t.len ?? ''} · ${(t.head || '').replace(/\s+/g, ' ').slice(0, 90)}`);
} catch (e) { console.log('  שגיאה:', e.message); }
