// אבחון: מה מחזירה כרגע ה-API של מרשם הרכב, ומהו מזהה המשאב הנכון
const RES = '053cea08-09bc-40ec-8f7a-156f0677aff3';
const get = async u => { const r = await fetch(u); const t = await r.text(); return { status: r.status, ct: r.headers.get('content-type'), body: t }; };

console.log('1) datastore_search על המשאב הקיים');
let r = await get(`https://data.gov.il/api/3/action/datastore_search?resource_id=${RES}&limit=1`);
console.log('   status:', r.status, '| content-type:', r.ct);
console.log('   גוף:', r.body.slice(0, 400).replace(/\s+/g, ' '));

console.log('\n2) resource_show');
r = await get(`https://data.gov.il/api/3/action/resource_show?id=${RES}`);
console.log('   status:', r.status, '|', r.body.slice(0, 300).replace(/\s+/g, ' '));

console.log('\n3) חיפוש המאגר "כלי רכב" ב-CKAN');
r = await get('https://data.gov.il/api/3/action/package_search?q=%D7%9B%D7%9C%D7%99%20%D7%A8%D7%9B%D7%91&rows=5');
console.log('   status:', r.status);
try {
  const j = JSON.parse(r.body);
  for (const p of j.result?.results || []) {
    console.log(`   • ${p.title}`);
    for (const res of p.resources || []) console.log(`       - ${res.name} · ${res.id} · datastore_active=${res.datastore_active}`);
  }
} catch { console.log('   גוף:', r.body.slice(0, 300).replace(/\s+/g, ' ')); }
