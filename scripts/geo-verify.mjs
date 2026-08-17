// בדיקת אמת של מנגנון הכתובות והמרחקים של מפת האיסוף.
// מריצה את הקוד האמיתי מתוך ops/index.html (לא העתק) על כתובות אמיתיות:
//   1. המרת כתובת לנקודה מול שירות הכתובות, עם אימות העיר החדש
//   2. חישוב התחנה הקרובה וזמן ההליכה כפי שהאפליקציה מציגה
//   3. השוואה למסלול הליכה אמיתי ממנוע ניווט (OSRM)
// נכשלת (exit 1) אם כתובת נפלה בעיר לא נכונה או שזמן ההליכה רחוק מהאמת.
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
// _CITY_COORD_NORM נבנה בקוד המקור לפני שחלק מהפונקציות מוגדרות — כאן
// הסדר שוחזר ידנית, והפונקציות נחשפות החוצה דרך return
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

async function osrmWalk(from, to) {
  await sleep(400);
  const url = `https://router.project-osrm.org/route/v1/foot/${from[1]},${from[0]};${to[1]},${to[0]}?overview=false`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error('osrm ' + res.status);
  const j = await res.json();
  const r = j.routes && j.routes[0];
  return r ? { km: r.distance / 1000, min: r.duration / 60 } : null;
}

// כתובות אמיתיות מכל הארץ + שני מקרי כשל מכוונים (רחוב שלא קיים בעיר)
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
  { address: 'ביל"ו 3',        city: 'עפולה',   expectFallback: true },   // ודאות נמוכה בכוונה
];

let failures = 0;
for (const c of CASES) {
  console.log(`\n📍 ${c.address}, ${c.city}`);
  const geo = await geocodeLikeApp(c.address, c.city);
  if (!geo) { console.log('   ❌ לא נמצאה נקודה בכלל'); failures++; continue; }
  console.log(`   → ${geo.exact ? 'נקודה מדויקת' : 'מרכז העיר'}: ${geo.resolved.slice(0, 90)}`);

  // הנקודה חייבת ליפול בעיר המבוקשת — נבדק מול מרכז העיר של האפליקציה
  const center = app._coordOfCity(c.city);
  if (center) {
    const off = app._haversineKm(geo.latlng, center);
    console.log(`   מרחק ממרכז ${c.city}: ${off.toFixed(1)} ק"מ`);
    if (off > 12) { console.log('   ❌ הנקודה רחוקה מדי מהעיר — כנראה עיר שגויה'); failures++; continue; }
  }
  if (c.expectFallback && geo.exact) console.log('   ℹ️ צפינו לנפילה למרכז העיר אך נמצאה נקודה — נבדוק שהיא בעיר הנכונה (עברה למעלה)');

  const st = app._nearestStation(geo.latlng);
  if (!st) { console.log('   (אין תחנה קרובה)'); continue; }
  const appLine = `${st.name} · ${app._stKm(st.km)} ק"מ אווירי` + (st.walkMin ? ` · ${st.walkMin} דק' הליכה (אפליקציה)` : ' · מעבר למרחק הליכה');
  console.log(`   🚆 ${appLine}`);

  // השוואה למסלול אמיתי רק כשהאפליקציה בכלל מציגה זמן הליכה
  if (st.walkMin) {
    try {
      const real = await osrmWalk(geo.latlng, [st.lat, st.lng]);
      if (real) {
        const dMin = Math.abs(real.min - st.walkMin);
        const verdict = dMin <= Math.max(5, real.min * 0.35) ? '✅' : '❌';
        console.log(`   🚶 מסלול אמיתי: ${real.km.toFixed(1)} ק"מ · ${Math.round(real.min)} דק' — פער ${Math.round(dMin)} דק' ${verdict}`);
        if (verdict === '❌') failures++;
      } else console.log('   (אין מסלול הליכה מהמנוע)');
    } catch (e) { console.log('   (מנוע המסלולים לא זמין: ' + e.message + ')'); }
  }
}

console.log(`\n${failures ? `❌ ${failures} כשלונות` : '✅ כל הבדיקות עברו'}`);
process.exit(failures ? 1 : 0);
