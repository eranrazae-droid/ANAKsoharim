// בדיקת אמת של מנגנון הכתובות והמרחקים של מפת האיסוף.
// מריצה את הקוד האמיתי מתוך ops/index.html (לא העתק) על כתובות אמיתיות:
//   1. המרת כתובת לנקודה מול שירות הכתובות, עם אימות העיר
//   2. משיכת מסלול אמיתי לתחנה מהמנוע (OSRM) — מה שהאפליקציה שומרת ומציגה
//   3. השוואת נוסחת הגיבוי (קו אווירי) למסלול האמיתי — מידע בלבד
// נכשלת (exit 1) אם כתובת נפלה בעיר לא נכונה או שמנגנון המסלולים מת כולו.
import { readFileSync } from 'fs';

const html = readFileSync('ops/index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const lines = scripts.split('\n');
const grabFn = (marker) => {
  const i = lines.findIndex(l => l.startsWith(marker));
  if (i < 0) throw new Error('missing ' + marker);
  const j = lines.findIndex((l, k) => k >= i && l === '}');
  return lines.slice(i, j + 1).join('\n');
};
const grabLine = (m) => lines.find(l => l.startsWith(m)) || (() => { throw new Error('missing ' + m); })();
const stationsStart = lines.findIndex(l => l.startsWith('const _TRAIN_STATIONS = ['));
const stationsEnd = lines.findIndex((l, k) => k >= stationsStart && l.startsWith('];'));

const appCode = [
  grabLine('const _CITY_COORD = '),
  grabLine('const _GEO_MAX_KM = '),
  grabLine('const _WALK_MAX_KM = '),
  grabLine('const _WALK_ROAD_FACTOR = '),
  grabLine('const _stKm = '),
  lines.slice(stationsStart, stationsEnd + 1).join('\n'),
  grabFn('function _normCityName('),
  grabFn('function _coordOfCity('),
  grabFn('function _haversineKm('),
  grabFn('function _geoHitInCity('),
  grabFn('function _cleanStreet('),
  grabFn('function _driveMinutes('),
  grabFn('function _walkMinutes('),
  grabFn('function _nearestStation('),
  'const _CITY_COORD_NORM = (() => { const o = {}; for (const k in _CITY_COORD) o[_normCityName(k)] = _CITY_COORD[k]; return o; })();',
  'return { _geoHitInCity, _cleanStreet, _nearestStation, _coordOfCity, _haversineKm, _walkMinutes, _stKm };',
].join('\n');
// _CITY_COORD_NORM נבנה כאן בסוף כי סדר ההגדרות בקובץ המקור שונה
const app = new Function(appCode)();

const UA = { 'User-Agent': 'anak-ops-geo-verify/1.0 (ops maintenance check)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function nominatim(params) {
  await sleep(1100);
  const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=il&' + params, { headers: UA });
  if (!res.ok) throw new Error('nominatim ' + res.status);
  const j = await res.json();
  return j.length ? j[0] : null;
}

// בדיוק המסלול של האפליקציה: רחוב+עיר, ואם אין — חיפוש חופשי; כל
// תוצאה עוברת את אימות העיר; נפילה למרכז העיר כשאין תוצאה תקפה
async function geocodeLikeApp(address, city) {
  const street = app._cleanStreet(address);
  const tries = [
    `street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}`,
    `q=${encodeURIComponent(`${street}, ${city}, ישראל`)}`,
  ];
  for (const t of tries) {
    let hit = null;
    try { hit = await nominatim(t); } catch (e) { continue; }
    if (!hit) continue;
    if (['city', 'town', 'village', 'municipality', 'state', 'county'].includes(hit.addresstype)) continue;
    if (!app._geoHitInCity(hit, city)) { console.log(`      [נדחה ע"י אימות העיר: ${hit.display_name.slice(0, 80)}]`); continue; }
    return { latlng: [Number(hit.lat), Number(hit.lon)], exact: true, resolved: hit.display_name };
  }
  const c = app._coordOfCity(city);
  return c ? { latlng: c, exact: false, resolved: 'מרכז העיר (משוער)' } : null;
}

// בדיוק מה שהאפליקציה שומרת על הרכב: מסלול נהיגה אמיתי לתחנה;
// זמן הליכה = אורך המסלול במהירות 5 קמ"ש
async function stationRouteLikeApp(latlng) {
  const st = app._nearestStation(latlng);
  if (!st) return null;
  await sleep(400);
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${latlng[1]},${latlng[0]};${st.lng},${st.lat}?overview=false`, { headers: UA });
  if (!res.ok) return null;
  const j = await res.json();
  const r = j.routes && j.routes[0];
  if (!r || !r.distance) return null;
  const km = r.distance / 1000;
  return { st, routeKm: km, walkMin: Math.max(1, Math.round(km / 5 * 60)), driveMin: Math.max(1, Math.round(r.duration / 60)) };
}

// כתובות אמיתיות מכל הארץ + מקרה כשל מכוון (רחוב שלא קיים בעיר)
const CASES = [
  { address: 'שנקר 15',        city: 'פתח תקווה' },
  { address: 'רוטשילד 1',      city: 'תל אביב–יפו' },
  { address: 'אבא הלל 12',     city: 'רמת גן' },
  { address: 'הרצל 76',        city: 'ראשון לציון' },
  { address: 'ויצמן 100',      city: 'כפר סבא' },
  { address: 'סוקולוב 40',     city: 'הוד השרון' },
  { address: 'העצמאות 55',     city: 'חיפה' },
  { address: 'הנרייטה סולד 4', city: 'באר שבע' },
  { address: 'ז\'בוטינסקי 2',  city: 'רמלה' },
  { address: 'סמילנסקי 8',     city: 'נתניה' },
  { address: 'ההסתדרות 240',   city: 'חולון' },
  { address: 'שנקר 20',        city: 'ירושלים', expectFallback: true },   // אין רחוב כזה בירושלים
];

let cityFailures = 0, routeOk = 0, routeTried = 0;
for (const c of CASES) {
  console.log(`\n📍 ${c.address}, ${c.city}`);
  const geo = await geocodeLikeApp(c.address, c.city);
  if (!geo) { console.log('   ❌ לא נמצאה נקודה בכלל'); cityFailures++; continue; }
  console.log(`   → ${geo.exact ? 'נקודה מדויקת' : 'מרכז העיר'}: ${geo.resolved.slice(0, 90)}`);

  const center = app._coordOfCity(c.city);
  if (center) {
    const off = app._haversineKm(geo.latlng, center);
    if (off > 12) { console.log(`   ❌ הנקודה במרחק ${off.toFixed(1)} ק"מ ממרכז ${c.city} — עיר שגויה`); cityFailures++; continue; }
    console.log(`   בעיר הנכונה ✅ (${off.toFixed(1)} ק"מ ממרכז העיר)`);
  }

  routeTried++;
  const rt = await stationRouteLikeApp(geo.latlng);
  if (!rt) { console.log('   ⚠️ המנוע לא החזיר מסלול — האפליקציה תציג את נוסחת הגיבוי'); continue; }
  routeOk++;
  const walkTxt = rt.routeKm <= 3 ? `🚶 ${rt.walkMin} דק' הליכה` : 'מעבר למרחק הליכה';
  console.log(`   🚆 מה שיוצג: ${rt.st.name} · ${rt.routeKm.toFixed(1)} ק"מ בדרך · 🚗 ${rt.driveMin} דק' נסיעה · ${walkTxt}`);
  const fallback = app._nearestStation(geo.latlng);
  if (fallback?.walkMin && rt.routeKm <= 3) {
    console.log(`   (נוסחת הגיבוי הייתה נותנת ${fallback.walkMin} דק' — פער ${Math.abs(fallback.walkMin - rt.walkMin)} דק')`);
  }
}

console.log(`\nסיכום: ערים נכונות ${CASES.length - cityFailures}/${CASES.length} · מסלולים אמיתיים ${routeOk}/${routeTried}`);
const fail = cityFailures > 0 || routeOk === 0;
console.log(fail ? '❌ נכשל' : '✅ כל הבדיקות עברו');
process.exit(fail ? 1 : 0);
