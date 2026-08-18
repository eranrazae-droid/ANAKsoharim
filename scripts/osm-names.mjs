// אבחון: למה רכבי המלאי לא נמצאים במרשם הרכב?
const INV = 'https://anak-harechev-crm.vercel.app/api/vehicles/carwiz';
const RES = '053cea08-09bc-40ec-8f7a-156f0677aff3';
const api = async u => { const r = await fetch(u); const t = await r.text(); try { return JSON.parse(t); } catch { return { _status: r.status, _body: t.slice(0, 300) }; } };

const xml = await (await fetch(INV)).text();
const plates = [...new Set([...xml.matchAll(/<CarNumber>([^<]+)<\/CarNumber>/gi)]
  .map(m => m[1].replace(/\D/g, '')).filter(p => p.length === 7 || p.length === 8))];
console.log('לוחיות במלאי:', plates.length, '| דוגמאות:', plates.slice(0, 5).join(', '));

console.log('\n1) האם המשאב עצמו חי?');
const one = await api(`https://data.gov.il/api/3/action/datastore_search?resource_id=${RES}&limit=1`);
console.log('   success:', one.success, '| total:', one.result?.total);
const rec = one.result?.records?.[0];
if (rec) {
  console.log('   שדות:', Object.keys(rec).filter(k => !k.startsWith('_')).join(', '));
  console.log('   דוגמה: mispar_rechev =', JSON.stringify(rec.mispar_rechev), '| baalut =', JSON.stringify(rec.baalut));
}

if (rec) {
  const p = String(rec.mispar_rechev);
  console.log('\n2) סינון על רכב שידוע שקיים (' + p + ')');
  for (const v of [[Number(p)], [String(p)]]) {
    const f = encodeURIComponent(JSON.stringify({ mispar_rechev: v }));
    const j = await api(`https://data.gov.il/api/3/action/datastore_search?resource_id=${RES}&filters=${f}&limit=5`);
    console.log(`   ${typeof v[0]}: success=${j.success} records=${j.result?.records?.length ?? '-'}${j._status ? ' status=' + j._status : ''}`);
  }
}

console.log('\n3) חיפוש חופשי (q) על 5 רכבים מהמלאי');
for (const p of plates.slice(0, 5)) {
  const j = await api(`https://data.gov.il/api/3/action/datastore_search?resource_id=${RES}&q=${p}&limit=3`);
  const r0 = j.result?.records?.[0];
  console.log(`   ${p}: ${j.result?.records?.length ?? '-'} תוצאות${r0 ? ` · ${r0.mispar_rechev} · ${r0.baalut}` : ''}`);
  await new Promise(r => setTimeout(r, 300));
}

console.log('\n4) סינון ישיר על 5 רכבים מהמלאי');
for (const p of plates.slice(0, 5)) {
  const f = encodeURIComponent(JSON.stringify({ mispar_rechev: [Number(p)] }));
  const j = await api(`https://data.gov.il/api/3/action/datastore_search?resource_id=${RES}&filters=${f}&limit=3`);
  const r0 = j.result?.records?.[0];
  console.log(`   ${p}: ${j.result?.records?.length ?? '-'}${r0 ? ` · ${r0.baalut}` : ''}`);
  await new Promise(r => setTimeout(r, 300));
}
