// אבחון בעלויות: משווה את המלאי מול מרשם הרכב ומדפיס מה חוזר בפועל
const INV = 'https://anak-harechev-crm.vercel.app/api/vehicles/carwiz';
const RES = '053cea08-09bc-40ec-8f7a-156f0677aff3';

const xml = await (await fetch(INV)).text();
const plates = [...xml.matchAll(/<CarNumber>([^<]+)<\/CarNumber>/gi)]
  .map(m => m[1].replace(/\D/g, '')).filter(p => p.length === 7 || p.length === 8);
const uniq = [...new Set(plates)];
console.log('לוחיות במלאי:', uniq.length, uniq.slice(0, 8).join(', '));
if (!uniq.length) { console.log('דוגמת XML:\n', xml.slice(0, 1200)); }
console.log('דוגמה מלאה של רשומה מהמרשם תודפס בהמשך');

const sample = uniq.slice(0, 40);
async function q(vals) {
  const f = encodeURIComponent(JSON.stringify({ mispar_rechev: vals }));
  const r = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${RES}&filters=${f}&limit=${vals.length}`);
  const j = await r.json().catch(() => null);
  return j?.result?.records || [];
}
let recs = await q(sample.map(Number));
console.log('נמצאו כמספרים:', recs.length);
if (!recs.length) { recs = await q(sample.map(String)); console.log('נמצאו כמחרוזות:', recs.length); }

const by = {};
for (const r of recs) by[String(r.mispar_rechev).replace(/\D/g, '')] = r;
const counts = {};
for (const p of sample) {
  const r = by[p];
  const b = r ? String(r.baalut || '(ריק)').trim() : '(לא נמצא)';
  counts[b] = (counts[b] || 0) + 1;
}
console.log('\n=== התפלגות בעלות על 40 רכבים ===');
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
if (recs[0]) console.log('\nשדות במאגר:', Object.keys(recs[0]).filter(k => !k.startsWith('_')).join(', '));

// רכבים שלא נמצאו — בדיקה במאגרי המשנה
const missing = sample.filter(p => !by[p]);
console.log('\nלא נמצאו במאגר הראשי:', missing.length, missing.slice(0, 10).join(', '));
const OTHER = {
  'רכב לא פעיל (ירד מהכביש)': '851ecab1-0622-4dbe-a6c7-f950cf82abf9',
  'רכב מסחרי כבד': 'cd3acc5c-03c3-4c89-9c54-d40f93c0d790',
  'אופנועים': 'bf9df4e2-d90d-4c0a-a400-19e15af8e95f',
};
for (const [name, res] of Object.entries(OTHER)) {
  if (!missing.length) break;
  try {
    const f = encodeURIComponent(JSON.stringify({ mispar_rechev: missing.map(Number) }));
    const r = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${res}&filters=${f}&limit=50`);
    const j = await r.json().catch(() => null);
    const rr = j?.result?.records || [];
    console.log(`  ${name}: ${rr.length}` + (rr[0] ? ` · שדות: ${Object.keys(rr[0]).filter(k=>!k.startsWith('_')).slice(0,14).join(', ')}` : ''));
  } catch (e) { console.log(`  ${name}: שגיאה`); }
}
