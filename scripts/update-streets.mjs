// מושך את רשימת כל הרחובות בישראל מהמאגר הממשלתי הפתוח ובונה את
// ops/streets.json — המילון שההשלמה האוטומטית של הכתובות עובדת ממנו.
// רץ ב-GitHub Actions (ידנית או ברענון מתוזמן), לא מהדפדפן.
import { writeFileSync } from 'fs';

const RESOURCE = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b';   // רחובות בישראל
const BASE = `https://data.gov.il/api/3/action/datastore_search?resource_id=${RESOURCE}`;

const first = await (await fetch(`${BASE}&limit=1`)).json();
if (!first.success) throw new Error('CKAN error');
const total = first.result.total;
const rec0 = first.result.records[0] || {};
// שמות השדות במאגר משתנים מדי פעם — מזהים אותם לפי התוכן ולא בשם קשיח
const keys = Object.keys(rec0);
const cityKey = keys.find(k => /ישוב|city/i.test(k) && !/סמל|semel|id/i.test(k));
const streetKey = keys.find(k => /רחוב|street/i.test(k) && !/סמל|semel|id/i.test(k));
if (!cityKey || !streetKey) throw new Error('לא זוהו שדות עיר/רחוב: ' + keys.join(','));
console.log(`שדות: עיר=${cityKey} רחוב=${streetKey} · סה"כ ${total} רשומות`);

const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const byCity = {};
let fetched = 0;
for (let offset = 0; offset < total; offset += 5000) {
  const res = await fetch(`${BASE}&limit=5000&offset=${offset}`);
  const j = await res.json();
  for (const r of j.result.records) {
    const city = clean(r[cityKey]);
    const street = clean(r[streetKey]);
    if (!city || !street) continue;
    (byCity[city] ||= new Set()).add(street);
  }
  fetched += j.result.records.length;
  console.log(`${fetched}/${total}`);
}

const out = {};
for (const c of Object.keys(byCity).sort()) out[c] = [...byCity[c]].sort();
const json = JSON.stringify(out);
writeFileSync('ops/streets.json', json);
const cities = Object.keys(out).length;
const streets = Object.values(out).reduce((s, a) => s + a.length, 0);
console.log(`נכתב ops/streets.json — ${cities} יישובים · ${streets} רחובות · ${(json.length / 1048576).toFixed(1)}MB`);
if (streets < 30000) throw new Error('פחות מדי רחובות — כנראה משיכה חלקית, לא שומרים');
