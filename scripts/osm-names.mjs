// בודק אם מאגר המפות העדכני (OSM) מכיר שמות רחובות שהתלוננו עליהם —
// כדי להכריע אם הבעיה בנתונים עצמם או רק בעותק הישן של ספק האריחים.
const UA = { 'User-Agent': 'anak-ops-geo-verify/1.0 (ops maintenance check)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const CHECKS = [
  'אם המושבות, פתח תקווה',
  'השפלה, פתח תקווה',
  'אבשלום גיסין, פתח תקווה',
  'משה דיין, פתח תקווה',
];

for (const q of CHECKS) {
  await sleep(1100);
  const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=2&countrycodes=il&q=' + encodeURIComponent(q), { headers: UA });
  const j = await res.json();
  console.log(`🔎 ${q}`);
  if (!j.length) { console.log('   — לא נמצא'); continue; }
  for (const h of j) console.log(`   → ${h.display_name.slice(0, 100)} (${(+h.lat).toFixed(4)},${(+h.lon).toFixed(4)})`);
}
