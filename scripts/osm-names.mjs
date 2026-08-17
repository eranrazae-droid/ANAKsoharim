// בודק את שמות הרחובות על הקטעים המדויקים באזור קרית אריה פ"ת, ישירות
// מנתוני המאגר (Overpass) — לא מהציור. מכריע אם הטעות בנתונים או במטמון.
const UA = { 'User-Agent': 'anak-ops-geo-verify/1.0 (ops maintenance check)', 'Content-Type': 'text/plain' };

// התיבה של האזור מהצילום: קרית אריה, סביב 32.095-32.105 / 34.855-34.875
const q = `
[out:json][timeout:30];
(
  way["highway"]["name"~"אם המושבות|אבשלום גיסין|השפלה|משה דיין"](32.090,34.850,32.108,34.880);
);
out tags center;
`;
const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q, headers: UA });
const j = await res.json();
const byName = {};
for (const el of j.elements) {
  const n = el.tags?.name || '?';
  (byName[n] ||= []).push(`(${el.center?.lat.toFixed(4)},${el.center?.lon.toFixed(4)})`);
}
console.log(`קטעי כביש באזור קרית אריה, לפי שם במאגר החי:`);
for (const [n, locs] of Object.entries(byName)) {
  console.log(`  "${n}" — ${locs.length} קטעים · דוגמאות: ${locs.slice(0, 4).join(' ')}`);
}
if (!j.elements.length) console.log('  (לא נמצאו קטעים — בעיה בשאילתה)');
