/* איסוף: רחובות, מפות, כתובות ושיתוף
   חלק 12 מתוך 13 של אפליקציית התפעול.
   הקבצים נטענים לפי הסדר ומתנהגים בדיוק כמו קובץ אחד — אין לשנות את הסדר. */
window._snapCityField = _snapCityField;

/* ── השלמת רחובות ────────────────────────────────────────────────────
   מילון כל הרחובות בארץ שמור אצלנו (ops/streets.json, מתעדכן מהמאגר
   הממשלתי דרך Actions). נטען פעם אחת, בכניסה הראשונה לשדה כתובת.
   מקלידים רחוב → בוחרים מהרשימה → מוסיפים מספר בית. אם נבחרה עיר,
   הרחובות שלה קודמים; בחירת רחוב מעיר אחרת ממלאת גם את העיר. */
let _streetsByCity = null, _streetsLoading = null;
function _streetAcLoad() {
  if (_streetsByCity || _streetsLoading) return;
  _streetsLoading = fetch('streets.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(j => { _streetsByCity = j; })
    .catch(() => { _streetsLoading = null; });   // אין קובץ — השדה עובד כרגיל
}
window._streetAcLoad = _streetAcLoad;

const _normStreet = s => String(s || '').replace(/["'`״׳]/g, '').replace(/\s+/g, ' ').trim();

function _streetAutocomplete(inputId, ddId, cityInputId) {
  const input = document.getElementById(inputId), dd = document.getElementById(ddId);
  if (!input || !dd) return;
  const raw = input.value;
  const v = _normStreet(raw.replace(/[\d\-/]+\s*$/, ''));
  if (!_streetsByCity || v.length < 2 || /\d/.test(raw.trim().slice(0, 1))) {
    dd.style.display = 'none'; dd.innerHTML = ''; return;
  }
  // התאמה מתחילת השם או מתחילת כל מילה — "רוטשילד" מוצא גם "שדרות רוטשילד"
  const hit = st => {
    const n = _normStreet(st);
    return n.startsWith(v) || n.split(' ').some(w => w.startsWith(v));
  };
  const city = _normCityName(document.getElementById(cityInputId)?.value || '');
  const inCity = [], elsewhere = [];
  for (const [c, streets] of Object.entries(_streetsByCity)) {
    const cityMatches = city && (_normCityName(c) === city || _normCityName(c).startsWith(city));
    for (const st of streets) {
      if (!hit(st)) continue;
      (cityMatches ? inCity : elsewhere).push([st, c]);
      if (inCity.length > 40) break;
    }
    if (inCity.length > 40) break;
  }
  // כשנבחרה עיר — רק הרחובות שלה; רחובות מערים אחרות רק כשאין עיר עדיין
  const matches = (city ? inCity : elsewhere).slice(0, 8);
  if (!matches.length) { dd.style.display = 'none'; dd.innerHTML = ''; return; }
  // כבר נבחר רחוב מלא ועכשיו מוקלד מספר בית — אין מה להציע יותר
  if (/\d\s*$/.test(raw) && matches.some(([st]) => _normStreet(st) === v)) {
    dd.style.display = 'none'; dd.innerHTML = ''; return;
  }
  dd.innerHTML = matches.map(([st, c]) =>
    `<div onmousedown="event.preventDefault();_pickStreet('${inputId}','${ddId}','${cityInputId}',this.dataset.s,this.dataset.c)"
        data-s="${esc(st)}" data-c="${esc(c)}"
        style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:14px;font-weight:600;background:var(--card);color:var(--text)">
      ${esc(st)}${city ? '' : ` <span style="color:var(--muted);font-size:12px">· ${esc(c)}</span>`}</div>`).join('');
  dd.style.display = 'block';
}
window._streetAutocomplete = _streetAutocomplete;

function _pickStreet(inputId, ddId, cityInputId, street, city) {
  const input = document.getElementById(inputId);
  if (input) {
    input.value = street + ' ';
    input.focus();   // הסמן נשאר בשדה — נשאר רק להקליד מספר בית
  }
  const cityEl = document.getElementById(cityInputId);
  if (cityEl && !cityEl.value.trim()) cityEl.value = city;
  const dd = document.getElementById(ddId);
  if (dd) { dd.style.display = 'none'; dd.innerHTML = ''; }
}
window._pickStreet = _pickStreet;

function _streetBlur(ddId) {
  setTimeout(() => {
    const dd = document.getElementById(ddId);
    if (dd) { dd.style.display = 'none'; dd.innerHTML = ''; }
  }, 200);
}
window._streetBlur = _streetBlur;

/* יישור כתובת חופשית (הדבקה / ייבוא / הקלדה בלי בחירה מהרשימה) לשם
   הרחוב הרשמי מהמילון: "שינקר 15" בפתח תקווה → "שנקר אריה 15".
   התאמה לא מספיק בטוחה — הכתובת נשארת בדיוק כמו שנכתבה. */
function _snapAddressToStreets(city, address) {
  if (!_streetsByCity || !city || !address) return address;
  const w = _normCityName(city);
  if (!w) return address;
  const key = Object.keys(_streetsByCity).find(c => {
    const n = _normCityName(c);
    return n === w || n.startsWith(w) || w.startsWith(n);
  });
  if (!key) return address;
  const numM = String(address).match(/\d[\d\-/]*\s*$/);
  const num = numM ? numM[0].trim() : '';
  const typed = _normStreet(String(address).replace(/\d[\d\-/]*\s*$/, ''));
  if (typed.length < 2) return address;
  const withNum = st => (st + (num ? ' ' + num : '')).trim();
  const streets = _streetsByCity[key];
  // התאמה מלאה — מיידית
  for (const st of streets) if (_normStreet(st) === typed) return withNum(st);
  // "שנקר" ← "שנקר אריה": רק כשיש רחוב אחד ויחיד שהמילה מופיעה בו —
  // שניים או יותר זה ניחוש, ואז עדיף להשאיר את מה שנכתב
  const wordHits = streets.filter(st => _normStreet(st).split(' ').includes(typed));
  if (wordHits.length === 1) return withNum(wordHits[0]);
  if (wordHits.length > 1) return address;
  // שגיאת כתיב של אות אחת בלבד, ורק כשיש מועמד יחיד
  if (typed.length >= 4) {
    const typoHits = streets.filter(st => {
      const n = _normStreet(st);
      return _levenshtein(n, typed) <= 1 ||
             n.split(' ').some(x => x.length >= 4 && _levenshtein(x, typed) <= 1);
    });
    if (typoHits.length === 1) return withNum(typoHits[0]);
  }
  return address;
}

function _cityBlur(ddId, inputId) {
  setTimeout(() => {
    const d = document.getElementById(ddId); if (d) d.style.display = 'none';
    if (inputId) _snapCityField(inputId);
  }, 200);
}
window._cityBlur = _cityBlur;

// open (non-done) tasks that carry a city, kept live while on the pickup screen
let _regionTasksCache = [];
let _regionTasksUnsub = null;

// ── City coordinates + air-distance matching (radius) ──
const _TASK_RADIUS_KM = 40;
const _CITY_COORD = {"אום אל־פחם":[32.516,35.152],"אור עקיבא":[32.508,34.917],"באקה אל־גרבייה":[32.417,35.037],"בית שאן":[32.497,35.499],"דלית אל־כרמל":[32.696,35.048],"חיפה":[32.794,34.989],"טבריה":[32.789,35.531],"טירת הכרמל":[32.760,34.972],"טירת כרמל":[32.760,34.972],"טמרה":[32.851,35.207],"יקנעם עילית":[32.657,35.110],"כרמיאל":[32.916,35.292],"כפר קאסם":[32.114,34.977],"מעלות־תרשיחא":[33.016,35.270],"מגדל העמק":[32.675,35.240],"נוף הגליל":[32.708,35.317],"נהריה":[33.007,35.095],"נשר":[32.766,35.043],"נצרת":[32.702,35.303],"עכו":[32.928,35.082],"עפולה":[32.607,35.289],"עראבה":[32.851,35.338],"צפת":[32.965,35.498],"קריית אתא":[32.811,35.113],"קריית ביאליק":[32.827,35.086],"קריית ים":[32.848,35.070],"קריית מוצקין":[32.836,35.077],"קריית שמונה":[33.207,35.570],"שפרעם":[32.805,35.169],"סח'נין":[32.865,35.298],"טייבה":[32.267,35.010],"טירה":[32.234,34.951],"קלנסווה":[32.285,34.981],"אלעד":[32.050,34.951],"אריאל":[32.105,35.187],"באר יעקב":[31.943,34.834],"בת ים":[32.023,34.751],"בני ברק":[32.083,34.833],"גבעת שמואל":[32.078,34.849],"גבעתיים":[32.072,34.812],"הוד השרון":[32.150,34.889],"הרצליה":[32.166,34.843],"חולון":[32.010,34.779],"חדרה":[32.434,34.919],"חריש":[32.462,35.048],"יהוד־מונוסון":[32.033,34.889],"יבנה":[31.878,34.739],"ירושלים":[31.769,35.217],"מבשרת ציון":[31.800,35.155],"כפר סבא":[32.178,34.907],"לוד":[31.951,34.895],"מודיעין־מכבים־רעות":[31.898,35.010],"מעלה אדומים":[31.773,35.298],"נס ציונה":[31.929,34.799],"נתניה":[32.321,34.853],"אור יהודה":[32.030,34.849],"פתח תקווה":[32.087,34.887],"ראש העין":[32.095,34.956],"ראשון לציון":[31.964,34.805],"רחובות":[31.894,34.809],"רמלה":[31.925,34.866],"רעננה":[32.184,34.871],"רמת גן":[32.070,34.824],"רמת השרון":[32.146,34.840],"תל אביב–יפו":[32.080,34.780],"אופקים":[31.315,34.620],"אילת":[29.557,34.952],"אשדוד":[31.802,34.656],"אשקלון":[31.668,34.574],"באר שבע":[31.252,34.791],"בית שמש":[31.745,34.988],"דימונה":[31.070,35.033],"נתיבות":[31.421,34.588],"ערד":[31.259,35.213],"קריית גת":[31.610,34.771],"קריית מלאכי":[31.730,34.745],"רהט":[31.393,34.754],"שדרות":[31.525,34.596],"ניר צבי":[31.9514,34.8610],"גלילות":[32.1401,34.7952]};
const _CITY_COORD_NORM = (() => { const o = {}; for (const k in _CITY_COORD) o[_normCityName(k)] = _CITY_COORD[k]; return o; })();
function _coordOfCity(city) {
  const n = _normCityName(city); if (!n) return null;
  if (_CITY_COORD_NORM[n]) return _CITY_COORD_NORM[n];
  if (n.length >= 3) for (const k in _CITY_COORD_NORM) { if (k.startsWith(n) || n.startsWith(k)) return _CITY_COORD_NORM[k]; }
  return null;
}
// resolve a pickup car's effective city, applying locality aliases found in
// either the city or the address (e.g. "עין המפרץ" → "עכו")
// שמות המגרשים של יורודרייב הם מקומות, לא כתובות. כשאין עיר בכרטיס —
// שם המגרש הוא זה שקובע לאיזו עיר הרכב שייך, כדי שיופיע ברשימת הערים.
const _YARD_CITY = [
  ['ניר צבי',   'ניר צבי'],
  ['גלילות',    'גלילות'],
  ['סוחרים גלי', 'גלילות'],   // השם בדוח נחתך באמצע
  ['NRT',       'גלילות'],
  ['חיפה',      'חיפה'],
  ['ראשון לציו', 'ראשון לציון'],
  ['כרכור',     'כרכור'],
];

function _pickupCity(c) {
  const n = _normCityName(`${c.city || ''} ${c.address || ''}`);
  for (const a of (typeof _CITY_ALIASES !== 'undefined' ? _CITY_ALIASES : [])) {
    if (a.alias && n.includes(_normCityName(a.alias))) return a.city;
  }
  if (c.city) return c.city;
  // רק כשאין עיר: הכתובת מכילה שם מגרש בלבד, ולכן ההשוואה בטוחה
  const addr = String(c.address || '');
  for (const [yard, city] of _YARD_CITY) if (addr.includes(yard)) return city;
  return '';
}

/* ── תחנות רכבת ──────────────────────────────────────────────────────
   רשימת תחנות רכבת ישראל, עם נקודה לכל תחנה. הרשימה קבועה בקוד — היא
   כמעט לא משתנה, ואין טעם לפנות לשירות חיצוני בשביל נתון יציב.
   משמשת לשני דברים: סימון התחנות על מפת האיסוף, וחישוב התחנה הקרובה
   ביותר לכל רכב שמוצג ברשימה.
─────────────────────────────────────────────────────────────────────── */
const _TRAIN_STATIONS = [
  ['נהריה', 33.0072, 35.0938], ['עכו', 32.9257, 35.0836],
  ['קריית מוצקין', 32.8382, 35.0800], ['קריית חיים', 32.8266, 35.0700],
  ['חוצות המפרץ', 32.8103, 35.0470], ['לב המפרץ', 32.7940, 35.0490],
  ['חיפה מרכז השמונה', 32.8213, 34.9987], ['חיפה בת גלים', 32.8286, 34.9860],
  ['חיפה חוף הכרמל', 32.7870, 34.9560], ['עתלית', 32.6880, 34.9420],
  ['בנימינה', 32.5150, 34.9500], ['קיסריה פרדס חנה', 32.4900, 34.9800],
  ['חדרה מערב', 32.4380, 34.8880], ['נתניה ספיר', 32.3500, 34.8600],
  ['נתניה', 32.3200, 34.8570], ['בית יהושע', 32.2790, 34.8580],
  ['הרצליה', 32.1650, 34.8130], ['תל אביב אוניברסיטה', 32.1050, 34.8040],
  ['תל אביב סבידור מרכז', 32.0840, 34.7980], ['תל אביב השלום', 32.0730, 34.7930],
  ['תל אביב ההגנה', 32.0530, 34.7880], ['חולון וולפסון', 32.0250, 34.7690],
  ['חולון', 32.0060, 34.7760], ['בת ים יוספטל', 32.0180, 34.7500],
  ['בת ים קוממיות', 32.0000, 34.7480], ['ראשון לציון הראשונים', 31.9640, 34.8090],
  ['ראשון לציון משה דיין', 31.9600, 34.7810], ['יבנה מזרח', 31.8730, 34.7530],
  ['יבנה מערב', 31.8730, 34.7300], ['אשדוד עד הלום', 31.7700, 34.6700],
  ['אשקלון', 31.6710, 34.6000], ['שדרות', 31.5220, 34.6000],
  ['נתיבות', 31.4200, 34.5900], ['אופקים', 31.3100, 34.6200],
  ['להבים רהט', 31.3700, 34.8000], ['באר שבע צפון', 31.2620, 34.8090],
  ['באר שבע מרכז', 31.2420, 34.7980], ['דימונה', 31.0670, 35.0250],
  ['קריית גת', 31.6030, 34.7720], ['לוד', 31.9480, 34.8770],
  ['לוד גני אביב', 31.9760, 34.8830], ['רמלה', 31.9280, 34.8720],
  ['באר יעקב', 31.9370, 34.8340], ['רחובות', 31.9070, 34.8090],
  ['נתב"ג', 32.0000, 34.8720], ['מודיעין מרכז', 31.9020, 35.0080],
  ['פאתי מודיעין', 31.9130, 35.0270], ['בית שמש', 31.7450, 34.9880],
  ['ירושלים יצחק נבון', 31.7880, 35.2030], ['ירושלים מלחה', 31.7500, 35.1880],
  ['ירושלים גן החיות', 31.7440, 35.1830], ['כפר סבא נורדאו', 32.1740, 34.9130],
  ['הוד השרון סוקולוב', 32.1560, 34.8880], ['רעננה מערב', 32.1780, 34.8580],
  ['רעננה דרום', 32.1690, 34.8720], ['ראש העין צפון', 32.1130, 34.9600],
  ['פתח תקווה סגולה', 32.1050, 34.9060], ['פתח תקווה קרית אריה', 32.0980, 34.8620],
  ['בני ברק', 32.1000, 34.8380], ['כפר יהושע יקנעם', 32.6640, 35.1030],
  ['מגדל העמק כפר ברוך', 32.6640, 35.2010], ['עפולה', 32.6090, 35.2900],
  ['בית שאן', 32.4950, 35.5010], ['אחיהוד', 32.9040, 35.1810],
  ['כרמיאל', 32.9105, 35.3060],
];

// נקודת המוצא של רכב לצורך החישוב: המיקום המדויק אם כבר הומר, אחרת
// מרכז העיר. אם אין גם עיר — אין מה לחשב.
function _pickupLatLng(c) {
  if (c.lat && c.lng && c.geoKey === _geoKeyOf(c)) return [c.lat, c.lng];
  return _coordOfCity(_pickupCity(c));
}

// זמן נסיעה משוער. אין כאן שירות ניווט — המרחק האווירי מוכפל בתוספת
// דרכים, והמהירות נקבעת לפי אורך הנסיעה (עירונית איטית, בין־עירונית מהירה).
function _driveMinutes(km) {
  const road = km * 1.3;
  const speed = road < 5 ? 30 : road < 20 ? 50 : 70;
  return Math.max(1, Math.round(road / speed * 60));
}

// זמן הליכה משוער כשאין עדיין מסלול אמיתי: המרחק האווירי מוכפל בתוספת
// דרך שנמדדה מול מסלולים אמיתיים לתחנות רכבת (גשרים, כניסות, מעברי
// מסילה מאריכים הרבה מעבר לקו האווירי), במהירות 5 קמ"ש. ברגע שיש מסלול
// אמיתי מהמנוע — הוא זה שמוצג, לא הנוסחה.
const _WALK_ROAD_FACTOR = 1.5;
function _walkMinutes(km) {
  return Math.max(1, Math.round(km * _WALK_ROAD_FACTOR / 5 * 60));
}
// הליכה ארוכה מזה כבר אינה אפשרות מעשית, ואין טעם להציג אותה
const _WALK_MAX_KM = 3;
// מרחק קצר מוצג עם ספרה אחרי הנקודה — "0 ק\"מ" לא אומר כלום
const _stKm = km => km < 10 ? km.toFixed(1) : Math.round(km);

/* מרחקי אמת לתחנה: פנייה חד-פעמית למנוע ניווט (OSRM, מסלולי כבישים
   אמיתיים) שמחזירה את אורך הדרך בפועל וזמן נסיעה. זמן ההליכה נגזר
   מאורך המסלול במהירות 5 קמ"ש. נשמר על מסמך הרכב — פנייה אחת לרכב. */
async function _stationRouteInfo(latlng) {
  const st = _nearestStation(latlng);
  if (!st) return null;
  // גוגל קודם: הליכה ונסיעה אמיתיות, אותם מספרים כמו בגוגל מפות
  if (await _mapsPing()) {
    try {
      const j = await (await fetch(`${_MAPS_PROXY}?op=route&from=${latlng[0]},${latlng[1]}&to=${st.lat},${st.lng}`)).json();
      if (j.ok && j.walking) {
        return {
          stName: st.name,
          stRouteKm: +j.walking.km.toFixed(2),
          stWalkMin: Math.max(1, Math.round(j.walking.min)),
          stDriveMin: Math.max(1, Math.round(j.driving?.min || j.walking.min / 4)),
        };
      }
    } catch (e) { /* נפילה למסלול הרגיל */ }
  }
  try {
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 7000);
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${latlng[1]},${latlng[0]};${st.lng},${st.lat}?overview=false`, { signal: ctl.signal });
    clearTimeout(tm);
    if (!res.ok) return null;
    const j = await res.json();
    const r = j.routes && j.routes[0];
    if (!r || !r.distance) return null;
    const km = r.distance / 1000;
    return {
      stName: st.name,
      stRouteKm: +km.toFixed(2),
      stWalkMin: Math.max(1, Math.round(km / 5 * 60)),
      stDriveMin: Math.max(1, Math.round(r.duration / 60)),
    };
  } catch (e) { return null; }
}

// מה שמוצג בפועל: מסלול אמיתי אם כבר נשמר על הרכב, אחרת הנוסחה
function _stationDisplay(car, latlng) {
  if (car && car.stRouteKm != null && car.stName && car.geoKey === _geoKeyOf(car)) {
    // הנקודה של התחנה נשלפת מהרשימה, כדי שגם ניווט יוכל לצאת ממנה
    const row = _TRAIN_STATIONS.find(([n]) => n === car.stName);
    return {
      name: car.stName, km: car.stRouteKm, min: car.stDriveMin,
      lat: row ? row[1] : null, lng: row ? row[2] : null,
      walkMin: car.stRouteKm <= _WALK_MAX_KM ? car.stWalkMin : null, route: true,
    };
  }
  return _nearestStation(latlng);
}

// התחנה הקרובה ביותר לנקודה, עם המרחק וזמן הנסיעה המשוער
function _nearestStation(latlng) {
  if (!latlng) return null;
  let best = null;
  for (const [name, lat, lng] of _TRAIN_STATIONS) {
    const km = _haversineKm(latlng, [lat, lng]);
    if (!best || km < best.km) best = { name, km, lat, lng };
  }
  if (!best) return null;
  best.min = _driveMinutes(best.km);
  best.walkMin = best.km <= _WALK_MAX_KM ? _walkMinutes(best.km) : null;
  return best;
}

/* ── מפת האיסוף ──────────────────────────────────────────────────────
   המפה נטענת רק כשנכנסים אליה, כדי שהיא לא תכביד על שאר המערכת.
   כל כתובת מומרת לנקודה פעם אחת בלבד והנקודה נשמרת על הרכב עצמו, כך
   שפתיחה חוזרת של המפה לא פונה שוב לשירות הכתובות.
   על המפה מסומנות רק נקודות האיסוף — אין סימון של המגרש ואין סיכות אחרות.
─────────────────────────────────────────────────────────────────────── */
let _leafletP = null;
function _loadLeaflet() {
  if (_leafletP) return _leafletP;
  _leafletP = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => resolve(window.L);
    js.onerror = () => reject(new Error('טעינת המפה נכשלה'));
    document.head.appendChild(js);
  });
  return _leafletP;
}

// הכתובת כפי שהיא מזוהה — משמשת גם כמפתח של הנקודה השמורה, כדי שכתובת
// שהשתנתה תומר מחדש וכתובת שלא השתנתה לא תיגע בשירות
// גרסת המפתח מזהה גם את מקור הנתונים: ברגע שמפתח גוגל מוגדר, כל
// הנקודות והמרחקים השמורים מחושבים מחדש דרך גוגל — פעם אחת לרכב
const _geoKeyOf = car => `v2${_mapsHasKey ? 'g' : ''}|${_cleanStreet(car.address)}|${_pickupCity(car).trim()}`;

// הכתובת נכתבת בשדה חופשי, ולכן נגררות אליה הערות כמו "קומה 2" או
// "ליד הדואר". השירות מוצא רחוב ומספר, לא הערות — אז הן יורדות לפני החיפוש
function _cleanStreet(addr) {
  let s = String(addr || '').trim();
  // "סיבים3" נכתב לפעמים בלי רווח, ואז שירות המפות לא מוצא את הרחוב
  // ונופל למרכז העיר. מפרידים בין שם הרחוב למספר הבית.
  s = s.replace(/([א-ת])(\d)/g, '$1 $2');
  s = s.replace(/\(.*?\)/g, ' ');
  // גבול־מילה של JS לא עובד על עברית, ולכן ההפרדה נעשית לפי רווחים
  s = s.replace(/(^|\s)(קומה|דירה|כניסה|ליד|מול|בניין|חניון|מרתף)(\s|$)[\s\S]*$/u, ' ');
  s = s.split(/[,;]/)[0];
  return s.replace(/\s+/g, ' ').trim();
}

let _geoLast = 0;
async function _geoFetch(params) {
  // שירות הכתובות מבקש לא להעמיס — פנייה אחת בשנייה
  const wait = Math.max(0, 1100 - (Date.now() - _geoLast));
  if (wait) await new Promise(r => setTimeout(r, wait));
  _geoLast = Date.now();
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=il&' + params;
  const res = await fetch(url, { headers: { 'Accept-Language': 'he' } });
  if (!res.ok) throw new Error('geocode ' + res.status);
  const j = await res.json();
  return j.length ? j[0] : null;
}

/* אימות שהתוצאה באמת בעיר שביקשנו. שירות הכתובות מחזיר את ההתאמה
   הטובה ביותר בארץ כולה — רחוב "הרצל" שלא נמצא בעיר המבוקשת יוחזר
   מעיר אחרת, והמיקום על המפה (וגם המרחק מהרכבת) יוצא שגוי לגמרי.
   לכן נדרשות שתי בדיקות: שם היישוב בתשובה, ומרחק סביר ממרכז העיר. */
const _GEO_MAX_KM = 12;   // עיר גדולה ביותר בארץ קטנה משמעותית מזה
function _geoHitInCity(hit, city) {
  const want = _normCityName(city || '');
  if (!want) return true;                       // בלי עיר אין מה לאמת
  const a = hit.address || {};
  const match = n => { n = _normCityName(n); return n === want || n.startsWith(want) || want.startsWith(n); };
  // כל שם מקום בתשובה שמתאים לעיר המבוקשת — כולל שכונה — מאשר את התוצאה
  if ([a.city, a.town, a.village, a.municipality, a.county, a.suburb, a.neighbourhood, a.city_district]
      .filter(Boolean).some(match)) return true;
  // השירות נקב בשם יישוב אחר במפורש — זו כתובת בעיר אחרת, ואין מה לדון
  const named = [a.city, a.town, a.village, a.municipality].filter(Boolean);
  if (named.length) return false;
  // אין שם יישוב מוכר בתשובה — אז המרחק ממרכז העיר מכריע
  const center = _coordOfCity(city);
  if (!center) return false;
  return _haversineKm([Number(hit.lat), Number(hit.lon)], center) <= _GEO_MAX_KM;
}

/* ── גוגל מפות דרך השרת ─────────────────────────────────────────────
   כשמוגדר מפתח (הגדרות ← מפות), הכתובות והמרחקים מגיעים ישירות מגוגל —
   אותם מספרים כמו באפליקציית גוגל מפות. בלי מפתח — המנגנון הקיים.   */
const _MAPS_PROXY = 'https://europe-west1-anak-soharim.cloudfunctions.net/mapsProxy';
let _mapsHasKey = null;   // null = טרם נבדק
async function _mapsPing() {
  if (_mapsHasKey !== null) return _mapsHasKey;
  try {
    const j = await (await fetch(`${_MAPS_PROXY}?op=ping`)).json();
    _mapsHasKey = !!j.hasKey;
  } catch (e) { _mapsHasKey = false; }
  return _mapsHasKey;
}
async function _googleGeocode(address, city) {
  const j = await (await fetch(`${_MAPS_PROXY}?op=geocode&address=${encodeURIComponent(address)}&city=${encodeURIComponent(city || '')}`)).json();
  if (!j.ok || !j.found || j.cityLevel) return null;
  // אימות עיר — גוגל לפעמים מחזיר עיר אחרת כשהרחוב לא נמצא
  if (!_geoHitInCity({ lat: j.lat, lon: j.lng, address: {} }, city)) return null;
  return [j.lat, j.lng];
}

// מחזיר נקודה מדויקת לפי הרחוב, או null אם הרחוב לא נמצא בעיר המבוקשת.
// נפילה למרכז העיר נעשית בחוץ, כדי שיהיה ברור מתי המיקום מדויק ומתי משוער.
async function _geocodeAddress(address, city) {
  // גוגל קודם — המקור המדויק ביותר; נפילה למנגנון הקיים אם אין מפתח
  if (await _mapsPing()) {
    try {
      const g = await _googleGeocode(_cleanStreet(address), city);
      if (g) return g;
    } catch (e) { /* המשך למסלול הרגיל */ }
  }
  const street = _cleanStreet(address);
  if (!street) return null;
  const tries = [
    `street=${encodeURIComponent(street)}&city=${encodeURIComponent(city || '')}`,
    `q=${encodeURIComponent(`${street}, ${city || ''}, ישראל`)}`,
  ];
  for (const t of tries) {
    let hit = null;
    try { hit = await _geoFetch(t); } catch (e) { continue; }
    if (!hit) continue;
    // תוצאה שהיא עיר או אזור שלם אינה כתובת — עדיף לסמן אותה כמשוערת
    if (['city', 'town', 'village', 'municipality', 'state', 'county'].includes(hit.addresstype)) continue;
    // כתובת שנפלה בעיר אחרת — עדיף מרכז העיר הנכונה על נקודה מדויקת שגויה
    if (!_geoHitInCity(hit, city)) continue;
    return [Number(hit.lat), Number(hit.lon)];
  }
  return null;
}

let _pickupMap = null, _pickupMapLayer = null, _pickupCityLayer = null, _pickupTrainLayer = null;
let _pickupMapSig = '', _pickupMapIds = '', _pickupMapBusy = false;

// הערים שתמיד מוצגות ובולטות. השאר מופיעות רק כשמתקרבים, כדי שהמפה
// לא תתמלא בשמות במבט הכללי.
const _MAJOR_CITIES = ['תל אביב–יפו','ירושלים','חיפה','ראשון לציון','פתח תקווה','אשדוד','נתניה','באר שבע','חולון','בני ברק','רמת גן','אשקלון','רחובות','הרצליה','כפר סבא','נצרת','עכו','טבריה','אילת','מודיעין־מכבים־רעות'];

// סימון תחנות הרכבת. במבט כללי מוצגת רק נקודה קטנה, ומקרוב נוסף גם השם,
// כדי שהתחנות לא יסתירו את סיכות האיסוף.
function _drawTrainStations(L) {
  if (!_pickupTrainLayer) return;
  const z = _pickupMap.getZoom();
  _pickupTrainLayer.clearLayers();
  const withName = z >= 11;
  for (const [name, lat, lng] of _TRAIN_STATIONS) {
    const html = withName
      ? `<div style="display:flex;align-items:center;gap:4px;transform:translate(-8px,-50%);white-space:nowrap"><div style="background:#1d4ed8;color:#fff;border:2px solid #fff;border-radius:999px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 1px 4px rgba(0,0,0,.35)">🚆</div><div style="font-family:Heebo,sans-serif;font-size:11px;font-weight:800;color:#1d4ed8;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff">${esc(name)}</div></div>`
      : `<div style="background:#1d4ed8;border:2px solid #fff;border-radius:999px;width:9px;height:9px;transform:translate(-50%,-50%);box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>`;
    L.marker([lat, lng], {
      zIndexOffset: -800,                   // מתחת לסיכות האיסוף, מעל שמות הערים
      icon: L.divIcon({ className: '', html, iconSize: null }),
    }).addTo(_pickupTrainLayer).bindPopup(
      `<div style="font-family:Heebo,sans-serif;direction:rtl;text-align:right;font-size:13px">
         <b>🚆 תחנת ${esc(name)}</b>
         <br><a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank">ניווט</a>
       </div>`);
  }
}

function _drawCityLabels(L) {
  if (!_pickupCityLayer) return;
  // אריחי OSM כבר מציגים את שמות הערים בעברית — ציור כפול רק מלכלך.
  // הפונקציה נשארת למקרה שנחזור לרקע בלי שמות.
  _pickupCityLayer.clearLayers();
  return;
  const z = _pickupMap.getZoom();
  _pickupCityLayer.clearLayers();
  const seen = new Set();
  for (const name in _CITY_COORD) {
    const [lat, lng] = _CITY_COORD[name];
    const key = `${lat},${lng}`;
    if (seen.has(key)) continue;            // "טירת כרמל" ו"טירת הכרמל" הן אותה עיר
    const major = _MAJOR_CITIES.includes(name);
    if (!major && z < 10) continue;         // ערים קטנות רק כשמתקרבים
    if (major && z < 8 && !['תל אביב–יפו','ירושלים','חיפה','באר שבע'].includes(name)) continue;
    seen.add(key);
    const size = major ? (z < 10 ? 13 : 15) : 11;
    const weight = major ? 900 : 700;
    const color = major ? '#1f2937' : '#6b7280';
    L.marker([lat, lng], {
      interactive: false,
      zIndexOffset: -1000,                  // תמיד מתחת לסיכות האיסוף
      icon: L.divIcon({
        className: '',
        html: `<div style="font-family:Heebo,sans-serif;font-size:${size}px;font-weight:${weight};color:${color};white-space:nowrap;transform:translate(-50%,-50%);text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff,0 0 3px #fff">${esc(name)}</div>`,
        iconSize: null,
      }),
    }).addTo(_pickupCityLayer);
  }
}

// הכפתור מסתיר ומראה את עמודת המפה. במסך רחב היא פתוחה מלכתחילה.
function togglePickupMap() {
  const col = document.querySelector('.pickup-col-map');
  if (!col) return;
  const wide = window.matchMedia('(min-width:1000px)').matches;
  const shown = wide ? !col.classList.contains('closed') : col.classList.contains('open');
  if (shown) {
    col.classList.toggle('closed', wide);
    col.classList.remove('open');
  } else {
    col.classList.remove('closed');
    col.classList.add('open');
    drawPickupMap();
  }
  _syncMapToggleLabel();
}

// הכפתור יושב על המפה עצמה, ולכן הוא צריך לומר מה תעשה הלחיצה הבאה
function _syncMapToggleLabel() {
  const col = document.querySelector('.pickup-col-map');
  const b = document.getElementById('pickup-map-toggle');
  if (!col || !b) return;
  const wide = window.matchMedia('(min-width:1000px)').matches;
  const shown = wide ? !col.classList.contains('closed') : col.classList.contains('open');
  b.textContent = shown ? '🗺️ הסתר מפה' : '🗺️ הצג מפה';
}
window._syncMapToggleLabel = _syncMapToggleLabel;
window.togglePickupMap = togglePickupMap;

async function drawPickupMap() {
  const col = document.querySelector('.pickup-col-map');
  if (!col || !col.offsetParent) return;   // מוסתרת — אין מה לצייר
  const st = document.getElementById('pickup-map-status');
  const say = t => { if (st) st.textContent = t; };
  say('⏳ טוען מפה…');
  // לפני בדיקת הנקודות השמורות חייבים לדעת אם יש מפתח גוגל — זהות
  // המפתח של כל נקודה תלויה במקור הנתונים
  await _mapsPing();
  let L;
  try { L = await _loadLeaflet(); } catch (e) { return say('❌ ' + e.message); }

  if (!_pickupMap) {
    _pickupMap = L.map('pickup-map', { zoomControl: true }).setView([32.0, 34.85], 9);
    // רקע בסגנון גוגל מפות — יבשה בז', ים כחול, פארקים ירוקים וכבישים
    // צבעוניים — אבל בלי השמות של ספק המפה, שמגיעים גם באנגלית ובערבית.
    // את שמות הערים אנחנו כותבים בעצמנו, בעברית בלבד.
    // אריחי המפה הרשמיים של OpenStreetMap: מתעדכנים שוטף מהמאגר החי,
    // ולכן שמות הרחובות עדכניים (אומת: "אם המושבות" ו"השפלה" בפ"ת מופיעים
    // נכון במאגר בעוד שהאריחים הישנים של CARTO עוד הציגו את השמות הקודמים).
    // השמות מוצגים בשפה המקומית — בישראל זה עברית.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(_pickupMap);
    _pickupCityLayer = L.layerGroup().addTo(_pickupMap);
    _pickupTrainLayer = L.layerGroup().addTo(_pickupMap);
    _pickupMapLayer = L.layerGroup().addTo(_pickupMap);
    _drawCityLabels(L);
    _drawTrainStations(L);
    _pickupMap.on('zoomend', () => { _drawCityLabels(L); _drawTrainStations(L); });
  }
  // המודאל נפתח אחרי שהמפה נבנתה, אז צריך למדוד את הגודל מחדש
  setTimeout(() => _pickupMap.invalidateSize(), 250);

  const cars = _pickupMapCars();
  if (!cars.length) { _pickupMapLayer.clearLayers(); _pickupMapSig = ''; return say('אין רכבים לאיסוף'); }

  // ציור מחדש רק כשבאמת השתנה משהו. בלי זה כל עדכון של הרשימה היה
  // מצייר מחדש ומחזיר את המפה לתצוגה הכללית, ומבטל את הזום של המשתמש.
  const sig = cars.map(c => `${c.id}:${c.lat || ''},${c.lng || ''}`).join('|');
  if (_pickupMapBusy || sig === _pickupMapSig) return;
  // התכווננות אוטומטית רק כשמערך הרכבים המוצג התחלף (סינון, חיפוש,
  // פתיחה ראשונה) — לא בכל ציור
  const idsSig = cars.map(c => c.id).sort().join(',');
  const refit = idsSig !== _pickupMapIds;
  _pickupMapIds = idsSig;
  _pickupMapSig = sig;

  await _pickupDrawMarkers(L, cars, say, refit);
}
window.drawPickupMap = drawPickupMap;

// אותם רכבים שמוצגים ברשימה כרגע — אותו חיפוש ואותו סינון עיר
function _pickupMapCars() {
  const cityFilter = document.getElementById('pickup-filter-city')?.value || '';
  const term = (document.getElementById('pickup-search-plate')?.value || '').replace(/\D/g, '');
  let cars = [..._pickupAllCars];
  if (cityFilter) cars = cars.filter(c => _pickupCity(c).trim() === cityFilter);
  if (_pickupCompany) cars = cars.filter(c => (c.source || '') === _pickupCompany);
  if (term) cars = cars.filter(c => String(c.plate || '').replace(/\D/g, '').startsWith(term));
  return cars;
}

async function _pickupDrawMarkers(L, cars, say, refit) {
  _pickupMapBusy = true;
  _pickupMapLayer.clearLayers();
  const pts = [];
  let exact = 0, rough = 0, pending = 0;

  const place = (car, latlng, isExact) => {
    const color = isExact ? '#dc2626' : '#f59e0b';
    const icon = L.divIcon({
      className: '',
      html: `<div style="background:${color};color:#fff;border:2px solid #fff;border-radius:999px;padding:3px 8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:900;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.4)">${esc(car.plate || '')}</div>`,
      iconSize: null, iconAnchor: [0, 0],
    });
    const addr = [car.address, _pickupCity(car)].filter(Boolean).join(', ');
    // התחנה מחושבת מהנקודה שהרכב סומן בה בפועל — מסלול אמיתי אם נשמר
    const st = _stationDisplay(car, latlng);
    L.marker(latlng, { icon }).addTo(_pickupMapLayer).bindPopup(
      `<div style="font-family:Heebo,sans-serif;direction:rtl;text-align:right;font-size:13px">
         <b style="font-size:15px">${esc(car.plate || '')}</b><br>
         ${esc(car.type || '')}<br>${esc(addr)}
         ${car.contact ? '<br>☎ ' + esc(car.contact) : ''}
         ${st ? `<br><span style="color:#1d4ed8;font-weight:800">🚆 ${esc(st.name)} — כ־${st.min} דק׳ נסיעה${st.walkMin ? ` · 🚶 כ־${st.walkMin} דק׳ הליכה` : ''} (${_stKm(st.km)} ק"מ)</span>` : ''}
         ${isExact ? '' : '<br><span style="color:#b45309;font-weight:800">מיקום משוער — לפי העיר</span>'}
         <br><a href="https://www.google.com/maps/dir/?api=1&destination=${latlng[0]},${latlng[1]}" target="_blank">ניווט</a>
       </div>`);
    pts.push(latlng);
  };

  // קודם כל מה שכבר ידוע, כדי שהמפה תהיה שימושית מיד
  const missing = [];
  for (const car of cars) {
    if (car.lat && car.lng && car.geoKey === _geoKeyOf(car)) { place(car, [car.lat, car.lng], !car.geoApprox); car.geoApprox ? rough++ : exact++; }
    else missing.push(car);
  }
  if (pts.length && refit) _pickupMap.fitBounds(pts, { padding: [30, 30] });
  pending = missing.length;
  say(pending ? `📍 ${exact + rough} נקודות · ממיר ${pending} כתובות…` : `📍 ${exact} מדויקות · ${rough} לפי עיר`);

  for (const car of missing) {
    let latlng = null, approx = false;
    // יש כתובת — מחפשים אותה במדויק. אין כתובת, או שלא נמצאה — נופלים
    // למרכז העיר והנקודה מסומנת ככתומה, כדי שיהיה ברור שהיא משוערת.
    if (_cleanStreet(car.address)) {
      try { latlng = await _geocodeAddress(car.address, _pickupCity(car)); } catch (e) {}
    }
    if (!latlng) { latlng = _coordOfCity(_pickupCity(car)); approx = true; }
    if (!latlng) { pending--; continue; }
    // מרחקי האמת לתחנה נמשכים לפני הציור, כדי שהחלונית תציג אותם מיד
    const rt = await _stationRouteInfo(latlng);
    car.geoKey = _geoKeyOf(car);
    if (rt) Object.assign(car, rt);
    place(car, latlng, !approx);
    approx ? rough++ : exact++;
    pending--;
    // נשמר על הרכב, כך שבפעם הבאה אין צורך להמיר שוב
    _updateDoc(_docRef('pickup_cars', car.id), {
      lat: latlng[0], lng: latlng[1], geoKey: _geoKeyOf(car), geoApprox: approx,
      ...(rt || {}),
    }).catch(() => {});
    // התכווננות רק אם המשתמש עוד לא הזיז את המפה בעצמו
    if (refit) _pickupMap.fitBounds(pts, { padding: [30, 30] });
    say(pending ? `📍 ${exact + rough} נקודות · ממיר ${pending} כתובות…` : `📍 ${exact} מדויקות · ${rough} לפי עיר`);
  }
  // הנקודות שנשמרו כרגע יחזרו מהמאזין — הן כבר על המפה, אין לצייר שוב
  _pickupMapSig = _pickupMapCars().map(c => `${c.id}:${c.lat || ''},${c.lng || ''}`).join('|');
  _pickupMapBusy = false;
}

function _haversineKm(a, b) {
  const R = 6371, toR = x => x * Math.PI / 180;
  const dLat = toR(b[0] - a[0]), dLng = toR(b[1] - a[1]);
  const s = Math.sin(dLat/2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLng/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
// taskId → id of the nearest pickup car within radius (recomputed on each render)
let _taskClosestCarId = {};
function _computeTaskClosest() {
  _taskClosestCarId = {};
  for (const t of _regionTasksCache) {
    const tc = _coordOfCity(t.regionCity); if (!tc) continue;
    let best = { km: Infinity, id: null };
    for (const car of _pickupAllCars) {
      const cc = _coordOfCity(_pickupCity(car)); if (!cc) continue;
      const km = _haversineKm(cc, tc);
      if (km <= _TASK_RADIUS_KM && km < best.km) best = { km, id: car.id };
    }
    if (best.id) _taskClosestCarId[t.id] = best.id;
  }
}

// נעיצה של רכב בראש הרשימה. נשמרת על הרכב עצמו, כך שהיא נשארת גם אחרי
// רענון הדף. לחיצה נוספת מבטלת ומחזירה את הרכב לסדר הרגיל.
async function togglePickupPin(id) {
  const car = _pickupAllCars.find(c => c.id === id);
  if (!car) return;
  const next = !car.pinned;
  car.pinned = next;                 // תגובה מיידית — המאזין יעדכן אחר כך
  renderPickupCars();
  try {
    await _updateDoc(_docRef('pickup_cars', id), { pinned: next });
  } catch (e) {
    car.pinned = !next;              // לא נשמר — חוזרים למצב הקודם
    renderPickupCars();
    showToast('❌ שמירת הנעיצה נכשלה');
  }
}
window.togglePickupPin = togglePickupPin;

function togglePickupSelect(id) {
  if (_pickupSelected.has(id)) _pickupSelected.delete(id);
  else _pickupSelected.add(id);
  _syncSelectAllLabel();
  _updatePickupBatchBar();
  renderPickupCars();
}
window.togglePickupSelect = togglePickupSelect;

function clearPickupSelection() {
  _pickupSelected.clear();
  _syncSelectAllLabel();
  _updatePickupBatchBar();
  renderPickupCars();
}
window.clearPickupSelection = clearPickupSelection;

function _syncSelectAllLabel() {
  const btn = document.getElementById('pickup-select-btn');
  if (!btn) return;
  const allSelected = _pickupShownIds.length > 0 && _pickupShownIds.every(id => _pickupSelected.has(id));
  btn.textContent = allSelected ? '❎ נקה הכל' : '☑️ סמן הכל';
  btn.style.background = allSelected ? '#16a34a' : 'var(--card)';
  btn.style.color = allSelected ? '#fff' : 'var(--text)';
  btn.style.borderColor = allSelected ? '#16a34a' : 'var(--border)';
}

function _updatePickupBatchBar() {
  const bar = document.getElementById('pickup-batch-bar');
  const cnt = document.getElementById('pickup-batch-count');
  const active = _pickupSelected.size > 0;
  if (bar) bar.style.display = active ? 'flex' : 'none';
  if (cnt) cnt.textContent = `נבחרו ${_pickupSelected.size}`;
  const cnt2 = document.getElementById('pickup-select-count');
  if (cnt2) cnt2.textContent = _pickupSelected.size ? `נבחרו ${_pickupSelected.size}` : '';
}

function batchCollectPickup() {
  if (!_pickupSelected.size) { showToast('לא נבחרו רכבים'); return; }
  _pendingCollectBatch = [..._pickupSelected];
  _pendingCollectFromHome = false;
  document.getElementById('collect-pickup-by').value = '';
  openModal('modal-collect-pickup');
  setTimeout(() => document.getElementById('collect-pickup-by')?.focus(), 50);
}
window.batchCollectPickup = batchCollectPickup;

/* מלל לאיסוף — כל מה שנהג צריך כדי לצאת לדרך, מוכן להדבקה בוואטסאפ
   או בטלגרם. אישור העברת הבעלות לא נכלל בכוונה; הוא מסמך שמצורף לרכב
   ולא חלק ממה שמכתיבים בטלפון. */
function pickupCarText(c) {
  const lines = [];
  lines.push(`🚗 ${c.plate || ''}`);
  const desc = [c.type, c.year, c.color].filter(Boolean).join(' · ');
  if (desc) lines.push(desc);
  // אם הכתובת כבר כוללת את שם העיר, לא כותבים אותו פעמיים
  const _city = _pickupCity(c) || '';
  const _addr = c.address || '';
  const where = [_addr, _addr.includes(_city) ? '' : _city].filter(Boolean).join(', ');
  if (where) lines.push(`📍 ${where}`);
  if (c.contact) lines.push(`👤 ${c.contact}`);
  if (c.km) lines.push(`🛣️ ${_fmtKm(c.km)} ק"מ`);
  if (c.test) lines.push(`🔧 טסט: ${c.test}${_testExpired(c.test) ? ' (פג תוקף)' : ''}`);
  // ההערה הפנימית וקישור הניווט לא נכללים — המלל נשלח החוצה, וההערות
  // נכתבו לשימוש פנימי
  return lines.join('\n');
}

function batchCopyPickupText() {
  if (!_pickupSelected.size) { showToast('לא נבחרו רכבים'); return; }
  // לפי הסדר שמוצג על המסך, לא לפי סדר הסימון
  const cars = _pickupShownIds
    .filter(id => _pickupSelected.has(id))
    .map(id => _pickupAllCars.find(c => c.id === id))
    .filter(Boolean);
  if (!cars.length) { showToast('לא נמצאו רכבים'); return; }
  const head = cars.length === 1 ? 'רכב לאיסוף:' : `${cars.length} רכבים לאיסוף:`;
  const txt = `${head}\n\n` + cars.map(pickupCarText).join('\n\n────────\n\n');
  const done = () => showToast(`📋 ${cars.length === 1 ? 'הרכב הועתק' : `${cars.length} רכבים הועתקו`} — אפשר להדביק`);
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(txt).then(done).catch(() => _pcCopyFallback(txt, done));
  } else {
    _pcCopyFallback(txt, done);
  }
}
window.batchCopyPickupText = batchCopyPickupText;

/* ── שיתוף הרכבים שסומנו יחד עם אישורי העברת הבעלות ─────────────────
   הדפדפן יודע להעביר קבצים ישירות לוואטסאפ (Web Share), ולכן ההודעה
   והמסמכים יוצאים יחד. איפה שזה לא נתמך — המלל מועתק והקבצים יורדים
   למכשיר, כדי לצרף אותם ידנית.
─────────────────────────────────────────────────────────────────────── */
function _dataUrlToFile(dataUrl, name, mime) {
  const parts = String(dataUrl).split(',');
  const meta = parts[0] || '';
  const type = mime || (meta.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(parts[1] || '');
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const ext = type.includes('pdf') ? 'pdf' : type.includes('png') ? 'png' : 'jpg';
  const safe = String(name || '').trim() || `אישור.${ext}`;
  return new File([buf], /\.[a-z0-9]+$/i.test(safe) ? safe : `${safe}.${ext}`, { type });
}

async function batchSharePickup() {
  if (!_pickupSelected.size) { showToast('לא נבחרו רכבים'); return; }
  const cars = _pickupShownIds
    .filter(id => _pickupSelected.has(id))
    .map(id => _pickupAllCars.find(c => c.id === id))
    .filter(Boolean);
  if (!cars.length) { showToast('לא נמצאו רכבים'); return; }

  const head = cars.length === 1 ? 'רכב לאיסוף:' : `${cars.length} רכבים לאיסוף:`;
  const text = `${head}\n\n` + cars.map(pickupCarText).join('\n\n────────\n\n');

  const files = [];
  for (const c of cars) {
    if (!c.doc) continue;
    try { files.push(_dataUrlToFile(c.doc, c.docName || `אישור ${c.plate || ''}`, c.docMime)); }
    catch (e) {}
  }

  if (!files.length) {
    showToast('לאף רכב שסומן אין אישור העברת בעלות — הועתק מלל בלבד', 6000);
    return batchCopyPickupText();
  }

  if (_isHandheld() && navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ text, files });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;   // המשתמש ביטל
      console.warn('share failed', e);
    }
  }

  // מחשב: פותחים חלון שיתוף שמאפשר להעתיק כל אישור ולהדביק בוואטסאפ ווב
  _openDesktopShare(text, cars.filter(c => c.doc));
}

/* ── איחוד כל אישורי העברת הבעלות לקובץ אחד ─────────────────────────
   ברוב המקרים האישור הוא PDF, ולכן אפשר לאחד את כולם למסמך אחד:
   עמודי ה-PDF מועתקים כמו שהם, ותמונות נכנסות כעמוד מלא. התוצאה היא
   קובץ אחד לשליחה, במקום קובץ לכל רכב.
─────────────────────────────────────────────────────────────────────── */
let _pdfLibLoading = null;
function _loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (_pdfLibLoading) return _pdfLibLoading;
  _pdfLibLoading = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = 'vendor/pdf-lib.min.js';
    el.onload = () => window.PDFLib ? resolve(window.PDFLib) : reject(new Error('מנוע ה-PDF לא נטען'));
    el.onerror = () => reject(new Error('מנוע ה-PDF לא נטען'));
    document.head.appendChild(el);
  });
  return _pdfLibLoading;
}

const _b64Bytes = dataUrl => {
  const bin = atob(String(dataUrl).split(',')[1] || '');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function _mergeDocsToPdf(cars) {
  const { PDFDocument, StandardFonts, rgb } = await _loadPdfLib();
  const merged = await PDFDocument.create();
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const failed = [];

  for (const c of cars) {
    const mime = String(c.docMime || '');
    try {
      if (mime.includes('pdf')) {
        const src = await PDFDocument.load(_b64Bytes(c.doc), { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(pg => merged.addPage(pg));
      } else if (mime.startsWith('image/')) {
        const bytes = _b64Bytes(c.doc);
        const img = mime.includes('png') ? await merged.embedPng(bytes) : await merged.embedJpg(bytes);
        // עמוד A4 עם התמונה מוגדלת לרוחב העמוד, בלי לחתוך
        const page = merged.addPage([595, 842]);
        const scale = Math.min(555 / img.width, 760 / img.height);
        const w = img.width * scale, h = img.height * scale;
        page.drawImage(img, { x: (595 - w) / 2, y: (842 - h) / 2 - 10, width: w, height: h });
        page.drawText(String(c.plate || ''), { x: 20, y: 812, size: 16, font, color: rgb(0.1, 0.1, 0.1) });
      } else { failed.push(c.plate || ''); }
    } catch (e) {
      console.warn('merge failed for', c.plate, e);
      failed.push(c.plate || '');
    }
  }
  if (!merged.getPageCount()) return { blob: null, failed };
  const bytes = await merged.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), failed };
}

/* ── הכנת האישורים לתצוגה ולשיתוף בטלפון ────────────────────────────
   וואטסאפ מציג תמונות בתוך השיחה, ובמחשב אפשר להדביק תמונה ישר לצ׳אט.
   לכן כל עמוד PDF מצויר לתמונה, ואפשר גם לאחד את כולן לתמונה אחת
   ארוכה — כדי שהדבקה אחת תכניס את כל האישורים.
─────────────────────────────────────────────────────────────────────── */
// תפריט השיתוף של המערכת שייך לטלפון. במחשב הוא פותח חלון של ווינדוס
// שלא עוזר לוואטסאפ ווב, ולכן שם עובדים עם ההעתקה שלנו.
const _isHandheld = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform || ''));

async function _pdfToPngBlobs(dataUrl, scale) {
  const pdfjs = await _loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: _b64Bytes(dataUrl) }).promise;
  const out = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: scale || 2 });
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    out.push(await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.9)));
  }
  return out;
}

// כל אישור → תמונה אחת או יותר. תמונה נשארת כמו שהיא.
async function _docsToImages(cars) {
  const images = [], failed = [];
  for (const c of cars) {
    const mime = String(c.docMime || '');
    try {
      if (mime.includes('pdf')) {
        const blobs = await _pdfToPngBlobs(c.doc, 2);
        blobs.forEach((b, i) => images.push({ plate: c.plate || '', blob: b,
          name: `אישור ${c.plate || ''}${blobs.length > 1 ? ' - עמוד ' + (i + 1) : ''}.jpg` }));
      } else if (mime.startsWith('image/')) {
        const r = await fetch(c.doc);
        images.push({ plate: c.plate || '', blob: await r.blob(), name: `אישור ${c.plate || ''}.jpg` });
      } else failed.push(c.plate || '');
    } catch (e) { console.warn('to image failed', c.plate, e); failed.push(c.plate || ''); }
  }
  return { images, failed };
}

// כפתור אחד: המלל מועתק, וכל האישורים יורדים כקובץ PDF אחד.
// בטלפון שתומך בשיתוף — הכל יוצא בהודעה אחת עם הקובץ המאוחד.
async function batchExportPickup() {
  if (!_pickupSelected.size) { showToast('לא נבחרו רכבים'); return; }
  const cars = _pickupShownIds
    .filter(id => _pickupSelected.has(id))
    .map(id => _pickupAllCars.find(c => c.id === id))
    .filter(Boolean);
  if (!cars.length) { showToast('לא נמצאו רכבים'); return; }

  // רכבי יורודרייב אינם דורשים אישור העברת בעלות. כל השאר כן — ובלי
  // האישור אין טעם להעתיק הודעה חלקית, ולכן היא נחסמת.
  const needDoc = cars.filter(c => c.source !== 'יורודרייב' && !c.doc);
  if (needDoc.length) {
    const plates = needDoc.map(c => c.plate).filter(Boolean).join(', ');
    showToast(`⚠️ חסר אישור העברת בעלות ל${needDoc.length === 1 ? 'רכב' : '-' + needDoc.length + ' רכבים'}: ${plates}\nצרף אישור לכל רכב לפני שליחה`, 9000);
    return;
  }

  const head = cars.length === 1 ? 'רכב לאיסוף:' : `${cars.length} רכבים לאיסוף:`;
  const withDoc = cars.filter(c => c.doc);
  const text = `${head}\n\n` + cars.map(pickupCarText).join('\n\n────────\n\n');

  // המלל ללוח קודם, כדי שההעתקה תתבצע בתוך הלחיצה עצמה
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => _pcCopyFallback(text, () => {}));
  } else _pcCopyFallback(text, () => {});

  if (!withDoc.length) { showToast('📋 המלל הועתק — לאף רכב שסומן אין אישור', 6000); return; }

  showToast('⏳ מכין את האישורים...', 4000);
  let imgs;
  try { imgs = await _docsToImages(withDoc); }
  catch (e) {
    console.error('images error', e);
    showToast('לא הצלחתי להכין את האישורים — מוריד אותם כמו שהם', 6000);
    return _openDesktopShare(text, withDoc);
  }
  if (!imgs.images.length) { showToast('לא נמצאו אישורים', 6000); return _openDesktopShare(text, withDoc); }

  // בטלפון: הודעה אחת עם המלל וכל התמונות
  const files = imgs.images.map(im => new File([im.blob], im.name, { type: 'image/jpeg' }));
  if (_isHandheld() && navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ text, files }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }

  // במחשב: חלון עם תמונה אחת מאוחדת להדבקה, ואפשרות להוריד
  _openImageShare(text, imgs.images, withDoc);
}
window.batchExportPickup = batchExportPickup;

/* ── חלון השיתוף במחשב ──────────────────────────────────────────────
   המלל מועתק, ומתחתיו רשימת האישורים עם תצוגה מקדימה. הדרך המרכזית
   להוציא את כולם היא כפתור ה-PDF המאוחד; אפשר גם להעתיק אישור בודד.
─────────────────────────────────────────────────────────────────────── */
let _shareImages = [];
let _shareDocCars = [];

function _openImageShare(text, images, cars) {
  _shareText = text;
  _shareImages = images;
  _shareDocCars = cars;
  const wa = document.getElementById('share-open-wa');
  if (wa) wa.href = 'https://web.whatsapp.com/send?text=' + encodeURIComponent(text);
  const cnt = document.getElementById('share-docs-count');
  if (cnt) cnt.textContent = `(${images.length})`;
  const box = document.getElementById('share-docs');
  if (box) {
    box.innerHTML =
      images.map((im, i) => `<div style="display:flex;align-items:center;gap:10px;border:2px solid var(--border);border-radius:12px;padding:9px 11px;background:var(--card)">
        <img src="${URL.createObjectURL(im.blob)}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0">
        <div style="flex:1;min-width:0">
          <div style="font-weight:900;font-size:15px;letter-spacing:.5px">${esc(im.plate)}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">${esc(im.name)}</div>
        </div>
        <button onclick="_shareCopyOneImage(${i}, this)" style="background:var(--surface2);color:var(--text);border:2px solid var(--border);border-radius:9px;padding:7px 11px;font-family:Heebo,sans-serif;font-weight:800;font-size:12.5px;cursor:pointer;white-space:nowrap">📋 העתק</button>
      </div>`).join('');
  }
  const dl = document.getElementById('share-download-all');
  if (dl) dl.textContent = `⬇️ הורד PDF אחד עם כל האישורים`;
  openModal('modal-pickup-share');
}

async function _copyBlobToClipboard(blob) {
  // הלוח מקבל PNG בלבד, ולכן ממירים לפני ההעתקה
  const bmp = await createImageBitmap(blob);
  const cv = document.createElement('canvas');
  cv.width = bmp.width; cv.height = bmp.height;
  cv.getContext('2d').drawImage(bmp, 0, 0);
  const png = await new Promise(res => cv.toBlob(res, 'image/png'));
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}


async function _shareCopyOneImage(i, btn) {
  const im = _shareImages[i];
  if (!im) return;
  try {
    await _copyBlobToClipboard(im.blob);
    if (btn) { const t = btn.textContent; btn.textContent = '✅'; setTimeout(() => btn.textContent = t, 2000); }
    showToast('📋 האישור הועתק — Ctrl+V בצ׳אט', 5000);
  } catch (e) { showToast('הדפדפן לא אפשר העתקה', 5000); }
}
window._shareCopyOneImage = _shareCopyOneImage;

// ההורדה נשארת PDF אחד — נוח לשמירה ולתיוק
async function _shareDownloadMergedPdf() {
  if (!_shareDocCars.length) return;
  showToast('⏳ מכין קובץ אחד...', 3000);
  const res = await _mergeDocsToPdf(_shareDocCars).catch(() => null);
  if (!res || !res.blob) return showToast('לא הצלחתי להכין את הקובץ', 5000);
  const url = URL.createObjectURL(res.blob);
  const a = document.createElement('a');
  a.href = url; a.download = `אישורי העברת בעלות - ${_shareDocCars.length} רכבים.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
window._shareDownloadMergedPdf = _shareDownloadMergedPdf;

/* ── שיתוף במחשב ────────────────────────────────────────────────────
   וואטסאפ ווב אינו מקבל קבצים דרך קישור, אבל כן מקבל תמונה שהודבקה
   מהלוח. לכן כל אישור מקבל כפתור "העתק תמונה", וקובצי PDF — הורדה.
─────────────────────────────────────────────────────────────────────── */
let _shareText = '';
let _shareCars = [];

function _openDesktopShare(text, cars) {
  _shareText = text;
  _shareCars = cars;
  const wa = document.getElementById('share-open-wa');
  if (wa) wa.href = 'https://web.whatsapp.com/send?text=' + encodeURIComponent(text);
  const cnt = document.getElementById('share-docs-count');
  if (cnt) cnt.textContent = `(${cars.length})`;
  const box = document.getElementById('share-docs');
  if (box) {
    box.innerHTML = cars.map((c, i) => {
      const isImg = String(c.docMime || '').startsWith('image/');
      const thumb = isImg
        ? `<img src="${c.doc}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0">`
        : `<div style="width:64px;height:64px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">📄</div>`;
      const btn = isImg
        ? `<button onclick="_shareCopyImage(${i}, this)" style="background:#0d9488;color:#fff;border:none;border-radius:9px;padding:8px 12px;font-family:Heebo,sans-serif;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap">📋 העתק תמונה</button>`
        : `<button onclick="_shareDownloadOne(${i})" style="background:#6366f1;color:#fff;border:none;border-radius:9px;padding:8px 12px;font-family:Heebo,sans-serif;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap">⬇️ הורד PDF</button>`;
      return `<div style="display:flex;align-items:center;gap:10px;border:2px solid var(--border);border-radius:12px;padding:9px 11px;background:var(--card)">
        ${thumb}
        <div style="flex:1;min-width:0">
          <div style="font-weight:900;font-size:15px;letter-spacing:.5px">${esc(c.plate || '')}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">${esc(c.docName || (isImg ? 'תמונה' : 'מסמך'))}</div>
        </div>
        ${btn}
      </div>`;
    }).join('');
  }
  openModal('modal-pickup-share');
}

function _shareCopyText() {
  const done = () => showToast('📋 המלל הועתק — הדבק בוואטסאפ');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(_shareText).then(done).catch(() => _pcCopyFallback(_shareText, done));
  } else _pcCopyFallback(_shareText, done);
}
window._shareCopyText = _shareCopyText;

// הלוח מקבל PNG בלבד, ולכן כל תמונה עוברת המרה דרך קנבס לפני ההעתקה
async function _shareCopyImage(i, btn) {
  const car = _shareCars[i];
  if (!car || !car.doc) return;
  try {
    const img = new Image();
    img.src = car.doc;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    if (btn) { const t = btn.textContent; btn.textContent = '✅ הועתק'; setTimeout(() => btn.textContent = t, 2500); }
    showToast('📋 האישור הועתק — עבור לוואטסאפ והדבק עם Ctrl+V', 6000);
  } catch (e) {
    console.warn('copy image failed', e);
    _shareDownloadOne(i);
    showToast('הדפדפן לא אפשר העתקה — האישור ירד למחשב', 6000);
  }
}
window._shareCopyImage = _shareCopyImage;

function _shareDownloadOne(i) {
  const car = _shareCars[i];
  if (!car || !car.doc) return;
  const f = _dataUrlToFile(car.doc, car.docName || `אישור ${car.plate || ''}`, car.docMime);
  const url = URL.createObjectURL(f);
  const a = document.createElement('a');
  a.href = url; a.download = f.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
window._shareDownloadOne = _shareDownloadOne;

function _shareDownloadAll() {
  _shareCars.forEach((c, i) => setTimeout(() => _shareDownloadOne(i), i * 300));
  showToast(`⬇️ ${_shareCars.length} אישורים יורדים למחשב`, 5000);
}
window._shareDownloadAll = _shareDownloadAll;
window.batchSharePickup = batchSharePickup;

async function batchDeletePickup() {
  const ids = [..._pickupSelected];
  if (!ids.length) { showToast('לא נבחרו רכבים'); return; }
  if (!confirm(`להסיר ${ids.length} רכבים מהרשימה?`)) return;
  const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  let ok = 0;
  for (const id of ids) {
    try { await deleteDoc(doc(window._db, 'pickup_cars', id)); ok++; } catch (e) { console.error('batch delete', id, e); }
  }
  clearPickupSelection();
  showToast(`🗑️ ${ok} רכבים הוסרו`);
}
window.batchDeletePickup = batchDeletePickup;

// batch send-to-driver: reuse the same driver-picker modal
// מי משויך כרגע לכל הרכבים שסומנו — אם כולם לאותו יעד, לחיצה עליו מבטלת
function _batchCurrentTarget() {
  const cars = [..._pickupSelected].map(id => _pickupAllCars.find(c => c.id === id)).filter(Boolean);
  if (!cars.length) return '';
  const first = cars[0].assignedDriver || '';
  return first && cars.every(c => (c.assignedDriver || '') === first) ? first : '';
}

function batchSendPickupToDriver() {
  if (!_pickupSelected.size) { showToast('לא נבחרו רכבים'); return; }
  const cur = _batchCurrentTarget();
  const list = document.getElementById('pickup-driver-list');
  list.innerHTML = _PICKUP_DRIVER_LIST.map(name =>
    `<button onclick="_batchSendToDriver('${name}')" style="background:${cur===name?'#1e40af':'var(--surface2)'};color:${cur===name?'#fff':'var(--text)'};border:1.5px solid var(--border);border-radius:12px;padding:14px;font-family:Heebo,sans-serif;font-size:15px;font-weight:700;cursor:pointer;text-align:right">${cur===name?'✅ ':''}${name}</button>`
  ).join('') +
    `<button onclick="_batchSendToDriver('${_TOW_NAME}')" style="background:${cur===_TOW_NAME?'#7c3aed':'#ede9fe'};color:${cur===_TOW_NAME?'#fff':'#5b21b6'};border:1.5px solid #7c3aed;border-radius:12px;padding:14px;font-family:Heebo,sans-serif;font-size:15px;font-weight:800;cursor:pointer;text-align:right">${cur===_TOW_NAME?'✅ ':'🚛 '}${_TOW_NAME}</button>` +
    (cur ? `<div style="font-size:12.5px;color:var(--muted);font-weight:700;text-align:center;margin-top:2px">לחיצה על ${esc(cur)} תבטל את השליחה · לחיצה על יעד אחר תעביר אליו</div>` : '');
  openModal('modal-send-pickup-driver');
}
window.batchSendPickupToDriver = batchSendPickupToDriver;

async function _batchSendToDriver(driverName) {
  closeModal('modal-send-pickup-driver');
  const ids = [..._pickupSelected];
  if (!ids.length) return;
  const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

  // לחיצה על היעד שכבר משויך לכל הרכבים = ביטול השליחה, בדיוק כמו בכרטיס
  if (_batchCurrentTarget() === driverName) {
    let cleared = 0;
    for (const id of ids) {
      try {
        await updateDoc(doc(window._db, 'pickup_cars', id), { assignedDriver: '' });
        const car = _pickupAllCars.find(c => c.id === id);
        if (car) car.assignedDriver = '';
        cleared++;
      } catch (e) { console.error('batch unsend', id, e); }
    }
    clearPickupSelection();
    showToast(`בוטלה השליחה ל${driverName} · ${cleared} רכבים`);
    return;
  }

  let ok = 0;
  let front = _pkFrontIndex(ids.length);
  for (const id of ids) {
    try {
      const data = { assignedDriver: driverName };
      if (front !== null) data.sortIndex = front++;
      await updateDoc(doc(window._db, 'pickup_cars', id), data);
      const car = _pickupAllCars.find(c => c.id === id);
      if (car) Object.assign(car, data);
      ok++;
    } catch (e) { console.error('batch send', id, e); }
  }
  if (driverName === _TOW_NAME) {
    // הגרר אינו נהג במערכת ולכן אין למי לשלוח התראה — במקום זה נפתחת
    // חלונית השיתוף עם האישורים של אותם רכבים
    showToast(`🚛 ${ok} רכבים סומנו לגרר`);
    try { await batchExportPickup(); } catch (e) { console.error('tow share', e); }
    clearPickupSelection();
    return;
  }
  _notifyDriver(driverName, `🚙 הוקצו לך ${ok} רכבים לאיסוף. כנס לאפליקציה לפרטים.`);
  clearPickupSelection();
  showToast(`✅ ${ok} רכבים נשלחו ל${driverName}`);
}
window._batchSendToDriver = _batchSendToDriver;

function openPickupScreen() {
  document.getElementById('pickup-user-badge').textContent = currentUser.name;
  _listenPickupContacts();
  _pickupArchiveLoaded = false;
  _pickupArchiveOpen = false;
  // reset multi-select state on every entry
  _pickupSelected.clear();
  _pendingCollectBatch = null;
  _updatePickupBatchBar();
  _syncSelectAllLabel();
  const body = document.getElementById('pickup-archive-body');
  if (body) body.style.display = 'none';
  showScreen('pickup');
  loadPickupCars();
  loadPickupArchiveCount();
  loadPickupRegionTasks();
}
window.openPickupScreen = openPickupScreen;

// keep the region-tagged open tasks live so pickup cards can show them
function loadPickupRegionTasks() {
  if (_regionTasksUnsub) _regionTasksUnsub();
  _regionTasksUnsub = _onSnap(_colRef('tasks'), snap => {
    _regionTasksCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(t => t.regionCity && t.status !== 'done' && t.type !== 'divider');
    renderPickupCars();
  }, err => console.error('region tasks listen error', err));
}

function loadPickupArchiveCount() {
  _onSnap(_colRef('pickup_archive'), snap => {
    const cnt = document.getElementById('pickup-archive-count');
    if (cnt) cnt.textContent = snap.size ? `${snap.size} רכבים נאספו • לחץ להצגה/הסתרה` : 'אין רכבים בארכיון';
    _pickupArchiveLoaded = true;
    _pickupArchiveCars = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _renderPickupArchive(_pickupArchiveCars);
  });
}

function togglePickupArchive() {
  _pickupArchiveOpen = !_pickupArchiveOpen;
  const body = document.getElementById('pickup-archive-body');
  const search = document.getElementById('pickup-archive-search');
  if (!body) return;
  if (!_pickupArchiveOpen) {
    body.style.display = 'none';
    if (search) search.style.display = 'none';
    return;
  }
  body.style.display = 'flex';
  if (search) search.style.display = 'block';
  // render the current archive data now (the live listener only fires on changes)
  _renderPickupArchive(_pickupArchiveCars);
}
window.togglePickupArchive = togglePickupArchive;

// re-render the archive applying the current search term
function renderPickupArchiveFiltered() {
  _renderPickupArchive(_pickupArchiveCars);
}
window.renderPickupArchiveFiltered = renderPickupArchiveFiltered;

function _renderPickupArchive(docs) {
  const body = document.getElementById('pickup-archive-body');
  if (!body || !_pickupArchiveOpen) return;
  const term = (document.getElementById('pickup-archive-search')?.value || '').trim().toLowerCase();
  let filtered = docs;
  if (term) {
    filtered = docs.filter(c => [c.plate, c.type, c.brand, c.year, c.color, c.city, c.address, c.contact, c.collectedBy, c.collectedByText]
      .filter(Boolean).join(' ').toLowerCase().includes(term));
  }
  if (!filtered.length) {
    body.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted)">${term ? 'לא נמצאו רכבים תואמים' : 'אין רכבים בארכיון'}</div>`;
    return;
  }
  const sorted = [...filtered].sort((a,b) => (b.collectedAt?.seconds||0) - (a.collectedAt?.seconds||0));
  body.innerHTML = sorted.map(c => {
    const dt = c.collectedAt?.seconds
      ? new Date(c.collectedAt.seconds * 1000).toLocaleString('he-IL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : '';
    const e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    return `<div style="background:var(--surface2);border-radius:12px;padding:12px 14px;border-right:4px solid #16a34a">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          <div style="font-size:17px;font-weight:900;letter-spacing:.04em">${e(c.plate||'')}</div>
          <div style="font-size:13px;color:var(--muted);margin-top:2px">${e([c.type||c.brand||'',c.year,c.color].filter(Boolean).join(' · '))}</div>
          ${c.city ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">📍 ${e(c.city)}${c.address ? ' • '+e(c.address) : ''}</div>` : ''}
        </div>
        <div style="text-align:left;flex-shrink:0;font-size:12px;color:var(--muted)">
          ${dt ? `<div>🕐 ${e(dt)}</div>` : ''}
          ${c.collectedBy ? `<div style="font-weight:700;color:#16a34a;margin-top:3px">✅ ${e(c.collectedBy)}</div>` : ''}
        </div>
      </div>
      ${c.collectedByText ? `<div style="margin-top:8px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px">🧾 נאסף על ידי: <b>${e(c.collectedByText)}</b></div>` : ''}
    </div>`;
  }).join('');
}


function _pickupDays(car) {
  if (!car.createdAt?.seconds) return null;
  return Math.floor((Date.now() / 1000 - car.createdAt.seconds) / 86400);
}

/* ── מיון וסינון: הכל בכפתור אחד ────────────────────────────────────
   ארבע האפשרויות (חברה, עיר, סדר הרשימה, מרחק) יושבות יחד בחלון אחד,
   והכפתור במסך מראה כמה סינונים פעילים כרגע.
─────────────────────────────────────────────────────────────────────── */
let _pickupCompany = '';          // '' = כל החברות
let _pickupManualOrder = false;   // סדר שנקבע בגרירה

/* רכב שנשלח לנהג או לגרר עולה לתחילת הרשימה. כשאין סדר ידני המיון הרגיל
   כבר מרים רכבים משויכים למעלה, ולכן מחזירים null ולא נוגעים בכלום. */
function _pkFrontIndex(count) {
  const idx = (_pickupAllCars || []).map(c => c.sortIndex).filter(n => typeof n === 'number');
  if (!idx.length) return null;
  return Math.min(...idx) - (count || 1);
}

const _PICKUP_SORTS = [
  'החדשים ביותר קודם',
  'זמן המתנה — מהגבוה לנמוך',
  'זמן המתנה — מהנמוך לגבוה',
  '📍 לפי מרחק — מהקרוב לרחוק',
];

function openPickupActions() { openModal('modal-pickup-actions'); _renderPickupAddrBook(); }

/* ── פנקס הכתובות ────────────────────────────────────────────────────
   אותה כתובת נרשמה לאורך השנים בעשרות ניסוחים חופשיים ("טסט עכו",
   "נמצא בג.פ.י אצל אבו סלאח", "החרש 3 עכו"). כאן מזהים שכולן אותו מקום
   ומאחדים אותן לשורה אחת: אותה עיר + אותו מספר בית + מילת רחוב משותפת.
   אנשי הקשר מאוחדים לפי מספר הטלפון, כך שגם רישום קטוע לא מופיע פעמיים. */

// מנקה ניסוח חופשי ומשאיר את שם הרחוב ומספר הבית
function _addrTokens(city, address) {
  let t = _cleanStreet(address || '')
    .replace(/["'`׳״’‘“”.]/g, ' ')
    .replace(/[,\-]/g, ' ');
  if (city) t = t.split(String(city)).join(' ');
  t = t
    .replace(/נמצא(ים|ת)?/g, ' ')
    .replace(/(^|\s)(אצל|רחוב|רח|ב)(\s)/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const words = t.split(' ').filter(Boolean);
  // מספר הבית הוא המספר הראשון שבא אחרי שם רחוב — "עוצמה 11 1" הוא 11
  let num = '', seenName = false;
  const names = [];
  for (const w of words) {
    if (/^[א-ת]{3,}$/.test(w)) {
      seenName = true;
      // ה"א/ב"ית הידיעה לא אמורה לפצל בין "עמל" ל"העמל"
      const bare = w.replace(/^[הבלומ](?=[א-ת]{3,})/, '');
      if (!names.includes(bare)) names.push(bare);
    } else if (/^\d{1,3}$/.test(w) && seenName && !num) num = w;
  }
  return { num, names };
}

// שני רישומים הם אותו מקום אם העיר זהה, מספר הבית זהה, ויש מילת רחוב משותפת
function _sameAddress(a, b) {
  if (a.city !== b.city) return false;
  if (a.num && b.num && a.num !== b.num) return false;
  if (!a.names.length || !b.names.length) return false;
  return a.names.some(n => b.names.includes(n));
}

// איחוד אנשי קשר לפי הטלפון: רישום קטוע נבלע ברישום המלא, ושם מנצח מספר לבד
function _mergeContacts(list) {
  const out = [];
  for (const raw of list) {
    const t = String(raw || '').trim();
    if (!t) continue;
    const d = t.replace(/\D/g, '');
    if (!d) { if (!out.some(o => o.text === t)) out.push({ text: t, digits: '' }); continue; }
    const hit = out.find(o => o.digits && (o.digits.startsWith(d) || d.startsWith(o.digits)));
    if (!hit) { out.push({ text: t, digits: d }); continue; }
    // שומרים את הרישום העשיר יותר — עם שם ועם מספר שלם
    const better = (d.length > hit.digits.length) || (d.length === hit.digits.length && t.length > hit.text.length);
    if (better) { hit.text = t; hit.digits = d; }
  }
  // שם בלי טלפון שכבר מופיע בתוך רישום אחר הוא כפילות ("שרית" מול "שרית 05...")
  const withPhone = out.filter(o => o.digits);
  return out
    .filter(o => o.digits || !withPhone.some(w => w.text.includes(o.text)))
    .map(o => o.text);
}

function _pickupAddrBookRows() {
  const raws = [];
  const add = (city, address, source, contact) => {
    city = String(city || '').trim();
    address = _cleanStreet(address || '');
    if (!city && !address) return;
    // רישום חופשי מתורגם לכתובת הקבועה של המגרש, כדי שכל הניסוחים
    // יתאחדו לשורה אחת עם הכתובת האמיתית
    const canon = _yardCanon(source, city, address);
    if (canon) { city = canon.city; address = canon.address; }
    raws.push({ city, address, source: String(source || '').trim(), contact: contact || '' });
  };
  Object.values(_addrContacts || {}).forEach(v => add(v.city, v.address, '', (v.contacts || []).join(' · ')));
  [...(_pickupAllCars || []), ...(_pickupArchiveCars || [])].forEach(c => add(_pickupCity(c), c.address, c.source, c.contact));

  const groups = [];
  for (const r of raws) {
    const tok = { city: r.city, ..._addrTokens(r.city, r.address) };
    let g = groups.find(x => _sameAddress(x.tok, tok));
    if (!g) { g = { tok, city: r.city, variants: [], sources: [], contacts: [] }; groups.push(g); }
    if (tok.num && !g.tok.num) g.tok.num = tok.num;
    tok.names.forEach(n => { if (!g.tok.names.includes(n)) g.tok.names.push(n); });
    if (r.address && !g.variants.includes(r.address)) g.variants.push(r.address);
    if (r.source && !g.sources.includes(r.source)) g.sources.push(r.source);
    _contactParts(r.contact).forEach(t => g.contacts.push(t));
  }

  // מעבר שני: אותה עיר ואותו מספר טלפון — אותו מקום, גם אם הניסוח שונה
  // לגמרי ואין אף מילת רחוב משותפת ("טסט עכו" מול "החרש 3 עכו").
  const phones = g => new Set(g.contacts.map(t => String(t).replace(/\D/g, '')).filter(d => d.length >= 9));
  for (let i = 0; i < groups.length; i++) {
    for (let j = groups.length - 1; j > i; j--) {
      if (groups[i].city !== groups[j].city) continue;
      // שתי כתובות תקינות ושונות באותה עיר נשארות נפרדות, גם אם יש להן
      // אותו איש קשר. האיחוד לפי טלפון נועד רק לרישום חופשי בלי כתובת.
      const clean = g => !!(g.tok.num && g.tok.names.length);
      if (clean(groups[i]) && clean(groups[j]) && groups[i].tok.num !== groups[j].tok.num) continue;
      const a = phones(groups[i]), b2 = phones(groups[j]);
      if (![...a].some(d => [...b2].some(e => d.startsWith(e) || e.startsWith(d)))) continue;
      groups[j].variants.forEach(v => { if (!groups[i].variants.includes(v)) groups[i].variants.push(v); });
      groups[j].sources.forEach(v => { if (!groups[i].sources.includes(v)) groups[i].sources.push(v); });
      groups[i].contacts.push(...groups[j].contacts);
      if (!groups[i].tok.num && groups[j].tok.num) groups[i].tok.num = groups[j].tok.num;
      groups.splice(j, 1);
    }
  }

  return groups.map(g => {
    // השם המוצג: הניסוח הקצר ביותר שמתחיל בעברית ומכיל מספר בית
    const clean = g.variants.filter(v => /\d/.test(v) && /^[א-ת]/.test(v.trim()));
    const pool = clean.length ? clean : g.variants;
    const address = pool.slice().sort((a, b) => a.length - b.length)[0] || '';
    return {
      city: g.city, address, sources: g.sources,
      contacts: _mergeContacts(g.contacts),
      others: g.variants.filter(v => v !== address),
    };
  })
  // ברשימה מופיעות רק כתובות שיש להן איש קשר. כתובות יורודרייב אינן
  // מנוהלות אצלנו ואין להן אנשי קשר, ולכן הן לא נכנסות לרשימה.
  .filter(r => r.contacts.length && !(r.sources.length && r.sources.every(x => x === 'יורודרייב')))
  .sort((a, b) =>
    (a.city || '').localeCompare(b.city || '', 'he') || (a.address || '').localeCompare(b.address || '', 'he'));
}

/* התצוגה: כרטיס לכל כתובת — העיר קטנה מעל, הכתובת גדולה, ואנשי הקשר
   כשבבים שאפשר להתקשר אליהם. כפתור עיפרון פותח עריכה במקום.
   במסך רחב הכרטיסים נפרסים לשתיים-שלוש עמודות, כדי לראות הרבה בבת אחת. */
let _pkAddrRows = [];

function _renderPickupAddrBook() {
  const box = document.getElementById('pk-addr-book');
  if (!box) return;
  const q = (document.getElementById('pk-addr-search')?.value || '').trim();
  _pkAddrRows = _pickupAddrBookRows();
  let rows = _pkAddrRows.map((r, i) => ({ ...r, _i: i }));
  if (q) rows = rows.filter(r => [r.city, r.address, (r.others || []).join(' '), (r.sources || []).join(' '), r.contacts.join(' ')].join(' ').includes(q));
  if (!rows.length) {
    box.innerHTML = '<div style="color:var(--muted);text-align:center;padding:16px;font-size:13px">אין עדיין כתובות עם אנשי קשר</div>';
    return;
  }
  const chip = t => {
    const phone = String(t).replace(/\D/g, '');
    const name = String(t).replace(/[\d\-\s]+$/, '').trim();
    return `<a href="tel:${esc(phone)}" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:5px;background:var(--surface2);border:1.5px solid var(--border);border-radius:999px;padding:3px 10px;font-size:12.5px;font-weight:800;color:var(--text);text-decoration:none">
      ${name ? `<span>${esc(name)}</span>` : ''}<span style="color:#1d4ed8;direction:ltr">${esc(phone)}</span></a>`;
  };
  box.innerHTML = rows.map(r => `
    <div style="background:var(--card);border:2px solid var(--border);border-radius:14px;padding:11px 12px;margin-bottom:9px">
      <div style="display:flex;align-items:flex-start;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:11.5px;font-weight:800;color:var(--muted)">${esc(r.city || '')}</div>
          <div style="font-size:15px;font-weight:900;margin-top:1px">${esc(r.address || '—')}</div>
        </div>
        <div style="flex-shrink:0;display:flex;align-items:center;gap:6px">
          ${(r.sources || []).map(src => `<span style="font-size:11px;font-weight:800;color:#fff;background:${_pickupSourceColor(src)};border-radius:7px;padding:2px 8px;white-space:nowrap">${esc(src)}</span>`).join('')}
          <button onclick="pkAddrEdit(${r._i})" title="עריכת אנשי הקשר" style="background:var(--surface2);border:1.5px solid var(--border);border-radius:9px;width:32px;height:32px;font-size:15px;cursor:pointer">✏️</button>
        </div>
      </div>
      <div id="pk-addr-view-${r._i}" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${r.contacts.map(chip).join('')}</div>
      <div id="pk-addr-edit-${r._i}" style="display:none;margin-top:8px">
        <input type="text" id="pk-addr-input-${r._i}" value="${esc(r.contacts.join(' · '))}"
          style="width:100%;padding:8px 10px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:Heebo,sans-serif;font-size:13px;box-sizing:border-box">
        <div style="font-size:11px;color:var(--muted);margin-top:4px">שם ומספר, מופרדים בנקודה: <b>שרית 0525816341 · לירון 0523358981</b></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button onclick="pkAddrSave(${r._i})" style="flex:1;background:#16a34a;color:#fff;border:none;border-radius:10px;padding:9px;font-family:Heebo,sans-serif;font-weight:800;font-size:13px;cursor:pointer">💾 שמור בכל המקומות</button>
          <button onclick="pkAddrEdit(${r._i},true)" style="background:var(--surface2);color:var(--text);border:1.5px solid var(--border);border-radius:10px;padding:9px 14px;font-family:Heebo,sans-serif;font-weight:800;font-size:13px;cursor:pointer">ביטול</button>
        </div>
      </div>
      ${(r.others || []).length ? `<div style="font-size:11px;color:var(--muted);font-weight:700;margin-top:7px" title="${esc(r.others.join(' | '))}">מאחד ${r.others.length + 1} ניסוחים של אותה כתובת</div>` : ''}
    </div>`).join('');
}

function pkAddrEdit(i, cancel) {
  const view = document.getElementById('pk-addr-view-' + i);
  const edit = document.getElementById('pk-addr-edit-' + i);
  if (!view || !edit) return;
  const open = edit.style.display === 'none' && !cancel;
  edit.style.display = open ? 'block' : 'none';
  view.style.display = open ? 'none' : 'flex';
  if (open) document.getElementById('pk-addr-input-' + i)?.focus();
}
window.pkAddrEdit = pkAddrEdit;

/* שמירה: מעדכנת את זיכרון הכתובת ואת כל הרכבים באותה כתובת — פעילים
   וארכיון — כך שהשינוי תופס בכל מקום ולא חוזר מהזיכרון בסיבוב הבא. */
async function pkAddrSave(i) {
  const row = _pkAddrRows[i];
  const inp = document.getElementById('pk-addr-input-' + i);
  if (!row || !inp) return;
  if (!_requireNet('עדכון אנשי הקשר')) return;
  const value = _dedupContacts(inp.value.trim());
  const names = _addrTokens(row.city, row.address).names;
  const match = c => {
    const city = String(_pickupCity(c) || '').trim();
    if (city !== row.city) return false;
    const t = _addrTokens(city, c.address);
    return t.names.some(n => names.includes(n));
  };
  try {
    await _setAddrContacts(row.city, row.address, value);
    const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const jobs = [];
    (_pickupAllCars || []).filter(match).forEach(c =>
      jobs.push(updateDoc(doc(window._db, 'pickup_cars', c.id), { contact: value }).catch(() => {})));
    (_pickupArchiveCars || []).filter(match).forEach(c =>
      jobs.push(updateDoc(doc(window._db, 'pickup_archive', c.id), { contact: value }).catch(() => {})));
    await Promise.all(jobs);
    showToast(`✅ עודכן ב-${jobs.length} רכבים ובזיכרון הכתובת`);
    _renderPickupAddrBook();
  } catch (e) {
    showToast('שמירה נכשלה: ' + (e.code || e.message), 6000);
  }
}
window.pkAddrSave = pkAddrSave;
window._renderPickupAddrBook = _renderPickupAddrBook;
window.openPickupActions = openPickupActions;

function openPickupFilters() {
  _renderPickupFilterPanel();
  openModal('modal-pickup-filters');
}
window.openPickupFilters = openPickupFilters;

function _renderPickupFilterPanel() {
  const comp = document.getElementById('pickup-company-btns');
  if (comp) {
    const all = `<button type="button" onclick="setPickupCompany('')" style="flex:1;padding:9px;border-radius:10px;border:2px solid ${_pickupCompany ? 'var(--border)' : 'var(--dark)'};background:${_pickupCompany ? 'var(--surface2)' : 'var(--dark)'};color:${_pickupCompany ? 'var(--text)' : '#fff'};font-family:Heebo,sans-serif;font-weight:800;font-size:14px;cursor:pointer">הכל</button>`;
    comp.innerHTML = all + _PICKUP_SOURCES.map(src => {
      const on = _pickupCompany === src.name;
      return `<button type="button" onclick="setPickupCompany('${src.name}')" title="${src.name}" style="flex:1;display:flex;align-items:center;justify-content:center;padding:6px;border-radius:10px;border:2px solid ${on ? src.color : 'var(--border)'};background:${src.color};cursor:pointer;opacity:${on ? 1 : .4}">${_PICKUP_LOGOS[src.name] || src.name}</button>`;
    }).join('');
  }
  const sorts = document.getElementById('pickup-sort-btns');
  if (sorts) {
    sorts.innerHTML = _PICKUP_SORTS.map((label, i) => {
      const on = i === 3 ? _pickupDistSort : (!_pickupDistSort && _pickupSortMode === i);
      return `<button type="button" onclick="setPickupSort(${i})" style="padding:9px 12px;border-radius:10px;border:2px solid ${on ? 'var(--dark)' : 'var(--border)'};background:${on ? 'var(--dark)' : 'var(--surface2)'};color:${on ? '#fff' : 'var(--text)'};font-family:Heebo,sans-serif;font-weight:700;font-size:13.5px;cursor:pointer;text-align:right">${label}</button>`;
    }).join('');
  }
  _syncPickupFilterBtn();
}

function setPickupCompany(name) {
  _pickupCompany = name;
  _renderPickupFilterPanel();
  renderPickupCars();
}
window.setPickupCompany = setPickupCompany;

function setPickupSort(i) {
  // בחירת מיון מבטלת את הסדר הידני שנקבע בגרירה, וכל הרכבים נסדרים מחדש
  _pickupClearManualOrder();
  // מיון לפי מרחק הוא אפשרות בפני עצמה, ולא תוספת על מיון הזמן
  _pickupDistSort = (i === 3);
  if (i < 3) _pickupSortMode = i;
  _renderPickupFilterPanel();
  renderPickupCars();
}
window.setPickupSort = setPickupSort;

// גובה הקובייה נקבע כך ששלוש שורות ימלאו בדיוק את גובה המסך, בלי שטח מת
function _pickupFitRows() {
  const list = document.getElementById('pickup-list');
  if (!list) return;
  const top = list.getBoundingClientRect().top;
  // שלוש שורות + שני רווחים של 12 + שוליים תחתונים, ממלאות בדיוק את הגובה
  const row = Math.max(210, Math.min(430, (window.innerHeight - top - 40) / 3));
  list.style.setProperty('--pk-row', Math.floor(row) + 'px');
}
window.addEventListener('resize', () => _pickupFitRows());

// ביטול הסדר הידני: מוחקים את מספרי הסדר מהרכבים וחוזרים למיון הרגיל
async function _pickupClearManualOrder() {
  if (!_pickupManualOrder) return;
  _pickupManualOrder = false;
  const ids = _pickupAllCars.filter(c => typeof c.sortIndex === 'number').map(c => c.id);
  _pickupAllCars.forEach(c => { delete c.sortIndex; });
  try {
    await Promise.all(ids.map(id => db.collection('pickup_cars').doc(id)
      .update({ sortIndex: firebase.firestore.FieldValue.delete() })));
  } catch (e) { console.warn('clear manual order', e); }
}

// חזרה למצב ההתחלתי: כל החברות, כל הערים, והחדשים ביותר קודם
function resetPickupFilters() {
  _pickupClearManualOrder();
  _pickupCompany = '';
  _pickupDistSort = false;
  _pickupSortMode = 0;
  const city = document.getElementById('pickup-filter-city');
  if (city) city.value = '';
  const term = document.getElementById('pickup-search-plate');
  if (term) term.value = '';
  _renderPickupFilterPanel();
  renderPickupCars();
}
window.resetPickupFilters = resetPickupFilters;

// הכפתור במסך מראה מה פעיל, כדי שלא יהיה סינון נסתר
function _syncPickupFilterBtn() {
  const btn = document.getElementById('pickup-filter-btn');
  if (!btn) return;
  const city = document.getElementById('pickup-filter-city')?.value || '';
  const n = (_pickupCompany ? 1 : 0) + (city ? 1 : 0) + (_pickupDistSort || _pickupSortMode !== 0 ? 1 : 0);
  btn.textContent = n ? `⚙️ מיון וסינון (${n})` : '⚙️ מיון וסינון';
  btn.style.background = n ? '#0f766e' : '#0d9488';
  btn.style.color = '#fff';
  btn.style.boxShadow = n ? '0 0 0 2px rgba(13,148,136,.35)' : 'none';
}
window._syncPickupFilterBtn = _syncPickupFilterBtn;

let _pickupTestBackfillDone = false;
function loadPickupCars() {
  const list = document.getElementById('pickup-list');
  if (!list) return;
  list.innerHTML = '<div class="loading"><div class="spinner"></div> טוען...</div>';
  const unsub = _onSnap(_colRef('pickup_cars'), snap => {
    _pickupAllCars = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (_pickupAllCars.some(c => typeof c.sortIndex === 'number')) _pickupManualOrder = true;
    _rebuildPickupCityFilter();
    renderPickupCars();
    _listenAddrContacts();
    _syncAddrContacts();
    _syncMapToggleLabel();
    if (!_pickupTestBackfillDone) {
      _pickupTestBackfillDone = true;
      _backfillPickupTestDates();
    }
  }, err => {
    console.error('pickup_cars listen error:', err);
    list.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#ef4444;font-size:14px">שגיאה בטעינה: ${err?.code || err?.message || 'אין גישה'}</div>`;
  });
}
window.loadPickupCars = loadPickupCars;

// one-time silent backfill: pull the missing test (tokef) date for existing cars
// that don't have one yet, so old records get it without any manual action
async function _backfillPickupTestDates() {
  const targets = _pickupAllCars.filter(c => c.plate && !_parseTestDate(c.test));
  if (!targets.length) return;
  const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  for (const car of targets) {
    try {
      const rec = await _plateLookup(car.plate);
      const test = _plateTestDate(rec);
      if (test) await updateDoc(doc(window._db, 'pickup_cars', car.id), { test });
    } catch(e) { /* skip this car, continue with the rest */ }
  }
}

function _rebuildPickupCityFilter() {
  const sel = document.getElementById('pickup-filter-city');
  if (!sel) return;
  const current = sel.value;
  // how many cars are waiting in each town, right there in the list
  const counts = {};
  for (const car of _pickupAllCars) {
    const city = _pickupCity(car).trim();
    if (city) counts[city] = (counts[city] || 0) + 1;
  }
  const cities = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b, 'he'));
  sel.innerHTML = `<option value="">כל הערים (${_pickupAllCars.length})</option>` +
    cities.map(c => `<option value="${c}"${c===current?' selected':''}>${c} (${counts[c]})</option>`).join('');
}

/* Distance is measured from the yard, so the nearest cars can be collected in
   one trip. A car whose town is unknown has no distance and goes last. */
// the yard: דוד רזיאל 4, ראשון לציון
const _PICKUP_BASE_CITY = 'ראשון לציון';
let _pickupDistSort = false;

function _pickupDistKm(car) {
  const base = _coordOfCity(_PICKUP_BASE_CITY);
  const cc = _coordOfCity(_pickupCity(car));
  return (base && cc) ? _haversineKm(base, cc) : Infinity;
}

// מיון המרחק נבחר עכשיו מתוך חלון ״מיון וסינון״ (setPickupSort)

/* ── contacts you deal with again and again ─────────────────────────── */
let _pickupContacts = [];
let _pickupContactsUnsub = null;

const _pcLabel = c => `${c.name || ''} ${c.phone || ''}`.trim();

function _listenPickupContacts() {
  if (_pickupContactsUnsub) return;
  _pickupContactsUnsub = _onSnap(_colRef('pickup_contacts'), snap => {
    _pickupContacts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'he'));
    _renderPickupContacts();
    _fillPickupContactPicker();
  });
}

function openPickupContacts() {
  _listenPickupContacts();
  _listenAddrContacts();          // מוודא שהשיוכים לכתובות נטענו
  _renderPickupContacts();
  _renderAddrContacts();
  openModal('modal-pickup-contacts');
}
window.openPickupContacts = openPickupContacts;

// כל השיוכים של אנשי קשר לכתובות, ממוינים לפי עיר ורחוב
function _renderAddrContacts() {
  const c = document.getElementById('pc-addr-list');
  if (!c) return;
  const term = (document.getElementById('pc-addr-search')?.value || '').trim().toLowerCase();
  let rows = Object.values(_addrContacts || {})
    .filter(a => a && (a.contacts || []).length)
    .sort((a, b) => `${a.city} ${a.address}`.localeCompare(`${b.city} ${b.address}`, 'he'));
  if (term) rows = rows.filter(a =>
    `${a.city || ''} ${a.address || ''} ${(a.contacts || []).join(' ')}`.toLowerCase().includes(term));
  if (!rows.length) {
    c.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted)">${term ? 'לא נמצא' : 'עדיין אין שיוכים — הם נלמדים מרכבים עם כתובת ואיש קשר'}</div>`;
    return;
  }
  c.innerHTML = rows.map(a => `<div style="border:2px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px">
      <div style="font-weight:900;font-size:14px">📍 ${esc([a.address, a.city].filter(Boolean).join(', '))}</div>
      <div style="font-size:13px;color:var(--muted);font-weight:700;direction:ltr;text-align:right;margin-top:3px">${esc((a.contacts || []).join(' · '))}</div>
    </div>`).join('');
}
window._renderAddrContacts = _renderAddrContacts;

function _fillPickupContactPicker() {
  const sel = document.getElementById('pickup-contact-pick');
  if (!sel) return;
  sel.innerHTML = `<option value="">— בחר איש קשר שמור —</option>` +
    _pickupContacts.map(c => `<option value="${esc(c.id)}">${esc(_pcLabel(c))}</option>`).join('');
}

function pickupUseContact(id) {
  const c = _pickupContacts.find(x => x.id === id);
  const el = document.getElementById('pickup-contact');
  if (c && el) el.value = _pcLabel(c);
}
window.pickupUseContact = pickupUseContact;

function _renderPickupContacts() {
  const c = document.getElementById('pc-list');
  if (!c) return;
  c.innerHTML = _pickupContacts.length
    ? _pickupContacts.map(x => `<div style="display:flex;align-items:center;gap:10px;border:2px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:900;font-size:14px">${esc(x.name || '')}</div>
          <div style="font-size:13px;color:var(--muted);font-weight:700;direction:ltr;text-align:right">${esc(x.phone || '')}</div>
        </div>
        <button onclick="deletePickupContact('${esc(x.id)}')" style="background:#ef4444;color:#fff;border:none;border-radius:8px;width:30px;height:30px;cursor:pointer">🗑</button>
      </div>`).join('')
    : `<div style="padding:16px;text-align:center;color:var(--muted)">עדיין לא נשמרו אנשי קשר</div>`;
}

async function savePickupContact() {
  const name = document.getElementById('pc-name').value.trim();
  const phone = document.getElementById('pc-phone').value.replace(/[^\d+]/g, '');
  if (!name) return showToast('נא להזין שם');
  if (!phone) return showToast('נא להזין טלפון');
  try {
    await _addDoc(_colRef('pickup_contacts'), { name, phone, createdBy: currentUser.name, createdAt: _serverTs() });
    document.getElementById('pc-name').value = '';
    document.getElementById('pc-phone').value = '';
    showToast('✅ נשמר');
  } catch (e) { showToast('שגיאה בשמירה'); }
}
window.savePickupContact = savePickupContact;

async function deletePickupContact(id) {
  const c = _pickupContacts.find(x => x.id === id);
  if (!c || !confirm(`למחוק את ${c.name}?`)) return;
  try {
    const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(_docRef('pickup_contacts', id));
  } catch (e) { showToast('שגיאה במחיקה'); }
}
window.deletePickupContact = deletePickupContact;

/* ── שיוך אנשי קשר לכתובות ───────────────────────────────────────────
   כל כתובת מלאה (עיר + רחוב ומספר) זוכרת את אנשי הקשר שכבר נרשמו בה.
   הזיכרון נבנה מעצמו מהרכבים הקיימים, ומתעדכן בכל שמירה של רכב.
   כשמזינים כתובת מוכרת בטופס, איש הקשר מתמלא לבד; אם כבר רשום שם
   מישהו אחר — שניהם נשארים, מופרדים בנקודה.
─────────────────────────────────────────────────────────────────────── */
let _addrContacts = {};            // מפתח כתובת → { city, address, contacts: [] }
let _addrContactsUnsub = null;

// מפתח הכתובת. מתעלם לגמרי מרווחים, מגרשיים ומכל סימני הפיסוק, ומוריד
// את המילה "רחוב". כך "רח' העמל 1, באר שבע", "העמל1 בארשבע" ו־"העמל  1,
// באר־שבע" הם אותה כתובת בדיוק.
function _addrKey(city, address) {
  const norm = s => String(s || '')
    .replace(/["'`׳״’‘“”]/g, '')
    .replace(/^\s*(רחוב|רח)\s+/, '')
    .replace(/[^א-תa-zA-Z0-9]+/g, '')   // כולל רווחים, מקפים ופסיקים
    .toLowerCase();
  const a = norm(_cleanStreet(address)), c = norm(city);
  // כתובת בלי מספר בית אינה "כתובת ברורה" — לא שומרים עליה איש קשר
  if (!a || !c || !/\d/.test(a)) return '';
  return `${c}|${a}`;
}

// מסלק כפילויות ממחרוזת אנשי קשר ומחזיר מחרוזת נקייה, מופרדת ב־" · ".
// המחרוזת מפוצלת לרכיבים לפי · , ; או שורה חדשה. שני רכיבים הם אותו אדם
// אם הטלפון זהה; בלי טלפון — אם השם זהה. טלפון שהופיע בלי שם ואחר כך עם
// שם — מקבל את השם. כך "עמוס 054... , 053... · סרגיי 053... · סרגיי 053..."
// מתנקה ל־"עמוס 054... · סרגיי 053...".
function _dedupContacts(str) {
  const parts = String(str || '').split(/[·,;\n]+/).map(s => s.trim()).filter(Boolean);
  const out = [];      // {key, name, phone}
  const idx = {};      // key → מיקום ב-out
  for (const p of parts) {
    const digits = p.replace(/\D/g, '');
    const phone = digits.length >= 7 ? digits : '';
    const name = p.replace(/[\d()+\-]/g, ' ').replace(/\s+/g, ' ').trim();
    const key = phone || (name ? 'name:' + name.toLowerCase() : '');
    if (!key) continue;
    if (key in idx) { const e = out[idx[key]]; if (!e.name && name) e.name = name; continue; }
    idx[key] = out.length;
    out.push({ key, name, phone });
  }
  return out.map(o => [o.name, o.phone].filter(Boolean).join(' ')).join(' · ');
}
// רשימת רכיבים נקייה (מערך) לשמירה על הכתובת
function _contactParts(str) { const d = _dedupContacts(str); return d ? d.split(' · ') : []; }

function _listenAddrContacts() {
  if (_addrContactsUnsub) return;
  _addrContactsUnsub = _onSnap(_colRef('pickup_addr_contacts'), snap => {
    _addrContacts = {};
    snap.docs.forEach(d => { _addrContacts[d.id] = d.data(); });
    _syncAddrContacts();
    if (document.getElementById('modal-pickup-contacts')?.classList.contains('open')) _renderAddrContacts();
  }, () => {});
}

// כל אנשי הקשר הידועים לכתובת של הרכב — תמיד מוחזרים נקיים מכפילויות
function _knownContactsFor(car) {
  const key = _addrKey(_pickupCity(car), car.address);
  return key && _addrContacts[key] ? _contactParts((_addrContacts[key].contacts || []).join(' · ')) : [];
}

// לומד כתובת ואיש קשר. הרשימה נשמרת תמיד מנוקה מכפילויות, ונכתבת רק אם
// באמת השתנתה — כך גם רשימות ישנות עם כפילויות מתנקות מעצמן.
async function _learnAddrContact(city, address, contact) {
  const key = _addrKey(city, address);
  if (!key || !String(contact || '').trim()) return;
  const cur = _addrContacts[key] || { city, address: _cleanStreet(address), contacts: [] };
  const parts = _contactParts([...(cur.contacts || []), contact].join(' · '));
  if (parts.join('·') === (cur.contacts || []).join('·')) return;   // שום שינוי
  const next = { city: cur.city || city, address: cur.address || _cleanStreet(address), contacts: parts };
  _addrContacts[key] = next;       // מיידית, כדי שלא נכתוב פעמיים באותו סבב
  try { await window._setDoc(_docRef('pickup_addr_contacts', key.replace(/\//g, '-')), next, { merge: true }); } catch (e) {}
}

// שכתוב זיכרון הכתובת לפי מה שנרשם עכשיו ברכב — כך מחיקה של איש קשר
// נשמרת ולא חוזרת מהזיכרון בסיבוב הבא
async function _setAddrContacts(city, address, contact) {
  const key = _addrKey(city, address);
  if (!key || !window._setDoc) return;
  const parts = _contactParts(contact || '');
  const cur = _addrContacts[key];
  if (cur && (cur.contacts || []).join('·') === parts.join('·')) return;
  const next = { city, address: _cleanStreet(address), contacts: parts };
  _addrContacts[key] = next;
  try { await window._setDoc(_docRef('pickup_addr_contacts', key.replace(/\//g, '-')), next); } catch (e) {}
}

// מעבר על הרכבים הקיימים: לומד מהם כתובות ואנשי קשר, ומנקה כפילויות
// בשדה של הרכב. הוא לא מוסיף לרכב איש קשר שלא נרשם בו.
let _addrSyncBusy = false;
async function _syncAddrContacts() {
  if (_addrSyncBusy || !window._setDoc) return;
  _addrSyncBusy = true;
  try {
    for (const car of _pickupAllCars) {
      const key = _addrKey(_pickupCity(car), car.address);
      if (!key) continue;
      if (car.contact) await _learnAddrContact(_pickupCity(car), car.address, car.contact);
      // מנקה כפילויות בשדה של הרכב בלבד. אין מיזוג מהזיכרון, כדי שאיש
      // קשר שנמחק ידנית לא יחזור לרכב.
      const merged = _dedupContacts(car.contact || '');
      if (!merged || merged === String(car.contact || '').trim()) continue;
      car.contact = merged;
      try { await _updateDoc(_docRef('pickup_cars', car.id), { contact: merged }); } catch (e) {}
    }
  } finally { _addrSyncBusy = false; }
  renderPickupCars();
}

// בטופס: כשהכתובת או העיר מסתיימות, איש הקשר מושלם מהזיכרון
function pickupAddrContactHint() {
  const city = document.getElementById('pickup-city')?.value || '';
  const addr = document.getElementById('pickup-address')?.value || '';
  const el = document.getElementById('pickup-contact');
  const hint = document.getElementById('pickup-contact-hint');
  const key = _addrKey(city, addr);
  const known = key && _addrContacts[key] ? (_addrContacts[key].contacts || []) : [];
  if (hint) hint.innerHTML = '';
  if (!known.length || !el) return;
  el.value = _dedupContacts([el.value, ...known].join(' · '));
  if (hint) hint.innerHTML = `<div style="margin-top:4px;font-size:12px;font-weight:800;color:#1d4ed8">👤 מולא לפי הכתובת: ${esc(known.join(' · '))}</div>`;
}
window.pickupAddrContactHint = pickupAddrContactHint;

function renderPickupCars() {
  const list = document.getElementById('pickup-list');
  if (!list) return;
  const cityFilter = document.getElementById('pickup-filter-city')?.value || '';
  let cars = [..._pickupAllCars];
  if (cityFilter) cars = cars.filter(c => _pickupCity(c).trim() === cityFilter);
  // searching by plate ignores dashes and spaces, and a part of the number works
  const term = (document.getElementById('pickup-search-plate')?.value || '').replace(/\D/g, '');
  // matches from the start of the number, so "42" is the cars that begin with 42
  if (term) cars = cars.filter(c => String(c.plate || '').replace(/\D/g, '').startsWith(term));
  // סינון לפי חברה — מציג רק את הרכבים של הספק שסומן
  if (_pickupCompany) cars = cars.filter(c => (c.source || '') === _pickupCompany);
  // סדר ידני מגרירה גובר על כל מיון אחר
  const hasManual = cars.some(c => typeof c.sortIndex === 'number');
  if (_pickupManualOrder && hasManual) {
    cars.sort((a, b) => (a.sortIndex ?? 9e9) - (b.sortIndex ?? 9e9));
  } else
  // sort
  if (_pickupSortMode === 0) {
    cars.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } else if (_pickupSortMode === 1) {
    cars.sort((a, b) => (_pickupDays(b) || 0) - (_pickupDays(a) || 0));
  } else {
    cars.sort((a, b) => (_pickupDays(a) || 0) - (_pickupDays(b) || 0));
  }
  const manual = _pickupManualOrder && hasManual;
  // distance takes over from the time sort while it is on
  if (!manual && _pickupDistSort) cars.sort((a, b) => _pickupDistKm(a) - _pickupDistKm(b));
  // assigned cars always float to top (stable) — אבל לא כשהסדר נקבע ידנית
  if (!manual) cars.sort((a, b) => (b.assignedDriver ? 1 : 0) - (a.assignedDriver ? 1 : 0));
  // נעיצה גוברת על כל מיון — הרכב הנעוץ נשאר בראש עד שמורידים את הנעץ
  cars.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  _computeTaskClosest();
  _syncPickupFilterBtn();
  _pickupShownIds = cars.map(c => c.id);
  if (!cars.length) {
    list.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--muted);font-size:15px">${term ? 'לא נמצא רכב במספר הזה' : 'אין רכבים לאיסוף'}</div>`;
    _syncSelectAllLabel();
    return;
  }
  // ציור מחדש באמצע גרירה הורס את הקובייה שנגררת ומחזיר את הסדר.
  // דוחים אותו עד שהגרירה מסתיימת.
  if (_pkDrag || _pkPressing) { _pkPendingRender = true; return; }
  _pkGroupAddresses(cars);
  list.innerHTML = cars.map(_pickupCardHtml).join('');
  _pickupFitRows();
  _pickupEnableDrag();
  _syncSelectAllLabel();
  _schedulePickupMap();
}

// המפה עוקבת אחרי מה שמוצג ברשימה, אבל לא מצטיירת מחדש על כל הקלדה
let _pickupMapT = null;
function _schedulePickupMap() {
  clearTimeout(_pickupMapT);
  _pickupMapT = setTimeout(() => { drawPickupMap().catch(() => {}); }, 500);
}

// "סמן הכל" — select every visible car (or clear if all already selected)
function toggleSelectAllPickup() {
  const allSelected = _pickupShownIds.length > 0 && _pickupShownIds.every(id => _pickupSelected.has(id));
  if (allSelected) _pickupSelected.clear();
  else _pickupShownIds.forEach(id => _pickupSelected.add(id));
  _syncSelectAllLabel();
  _updatePickupBatchBar();
  renderPickupCars();
}
window.toggleSelectAllPickup = toggleSelectAllPickup;
window.renderPickupCars = renderPickupCars;

// parse either DD/MM/YYYY (current) or legacy MM/YYYY into a Date
function _parseTestDate(test) {
  if (!test) return null;
  const full = String(test).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (full) return new Date(parseInt(full[3]), parseInt(full[2]) - 1, parseInt(full[1]));
  const legacy = String(test).match(/^(\d{1,2})\/(\d{4})$/);
  if (legacy) return new Date(parseInt(legacy[2]), parseInt(legacy[1]) - 1, 1);
  return null;
}

function _testExpiredSoon(test) {
  const exp = _parseTestDate(test);
  if (!exp) return false;
  const soon = new Date(); soon.setMonth(soon.getMonth() + 2);
  return exp <= soon;
}

// test has actually expired (past today)
function _testExpired(test) {
  const exp = _parseTestDate(test);
  if (!exp) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return exp < today;
}

// tasks within air-distance radius of this car's city — shown inside the card
function _pickupRegionTasksHtml(c, e) {
  const carC = _coordOfCity(_pickupCity(c));
  if (!carC) return '';
  const rows = [];
  for (const t of _regionTasksCache) {
    const tc = _coordOfCity(t.regionCity); if (!tc) continue;
    const km = _haversineKm(carC, tc);
    if (km > _TASK_RADIUS_KM) continue;
    rows.push({ t, km });
  }
  if (!rows.length) return '';
  rows.sort((a, b) => a.km - b.km);
  return `<div style="margin-top:8px;background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:8px 10px">
    <div style="font-size:11px;font-weight:900;color:#92400e;margin-bottom:4px">📍 משימות בקרבת מקום (עד ${_TASK_RADIUS_KM} ק"מ)</div>
    ${rows.map(({ t, km }) => {
      const closest = _taskClosestCarId[t.id] === c.id;
      return `<div style="font-size:13px;color:#78350f;font-weight:600;line-height:1.6">• ${e(t.title)}${t.regionCity ? ` <span style="color:#b45309">(${e(t.regionCity)})</span>` : ''} — <b>${Math.round(km)} ק"מ</b>${closest ? ` <span style="background:#16a34a;color:#fff;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:800;white-space:nowrap">🎯 הכי קרוב למשימה</span>` : ''}</div>`;
    }).join('')}
  </div>`;
}

/* ניווט הליכה ליעד. היעד הוא הנקודה המדויקת אם היא כבר חושבה, אחרת
   הכתובת כטקסט. נקודת המוצא היא תחנת הרכבת הקרובה ביותר לכתובת — כך
   הנהג רואה מיד את המסלול מהתחנה שממנה הוא יורד ועד לרכב. אם אין נקודה
   מחושבת ואי אפשר לדעת מהי התחנה, המוצא נשאר ריק וגוגל לוקח את המיקום
   הנוכחי. */
function _pickupNavUrl(c) {
  const ll = _pickupLatLng(c);
  const exact = c.lat && c.lng && c.geoKey === _geoKeyOf(c);
  const dest = exact ? `${c.lat},${c.lng}`
    : [c.address, _pickupCity(c), 'ישראל'].filter(Boolean).join(', ');
  if (!dest || (!exact && !c.address && !_pickupCity(c))) return '';
  /* נקודת המוצא נשלחת כשם התחנה ולא כנקודת ציון: הנקודות ברשימה הן
     קירוב, וגוגל היה פותח בכתובת שכנה. שם התחנה מדויק אצלו. */
  const st = _stationDisplay(c, ll);
  const origin = st && st.name ? `תחנת רכבת ${st.name}` : '';
  return 'https://www.google.com/maps/dir/?api=1&travelmode=walking'
    + (origin ? '&origin=' + encodeURIComponent(origin) : '')
    + '&destination=' + encodeURIComponent(dest);
}

// תחנת הרכבת הקרובה לרכב — מוצגת בתוך הכרטיס, לנהג שמגיע או חוזר ברכבת
function _pickupStationHtml(c, e) {
  const s = _stationDisplay(c, _pickupLatLng(c));
  if (!s) return '';
  return `<div style="margin-top:6px;background:#eff6ff;border:1px solid #bfdbfe;border-right:5px solid #1d4ed8;border-radius:8px;padding:7px 10px;font-size:13px;font-weight:800;color:#1e3a8a">
    🚆 תחנה קרובה: ${e(s.name)} — כ־${s.min} דק׳ נסיעה${s.walkMin ? ` · 🚶 כ־${s.walkMin} דק׳ הליכה` : ''} <span style="color:#3b82f6;font-weight:700">(${_stKm(s.km)} ק"מ)</span>
  </div>`;
}

/* ── ספקי האיסוף ────────────────────────────────────────────────────
   שני מקורות, וכל אחד שולח את הרשימה בפורמט אחר. הסימון נקבע לבד לפי
   הפורמט שהודבק, ואפשר להחליף אותו ידנית בכל רכב.
─────────────────────────────────────────────────────────────────────── */
const _PICKUP_SOURCES = [
  { name: 'יורודרייב', color: '#111827' },
  { name: 'כלמוביל',  color: '#0B7A4B' },
];
const _pickupSourceColor = n => (_PICKUP_SOURCES.find(s => s.name === n) || {}).color || '#64748b';

// הלוגואים מצוירים בקוד (SVG) ולא כתמונות — כך הם חדים בכל גודל מסך,
// לא נטענים מהרשת, ושני התגים יוצאים בדיוק באותה מידה.
const _PICKUP_LOGOS = {
  'יורודרייב': `<svg viewBox="0 0 132 34" width="112" height="29" role="img" aria-label="יורודרייב" style="direction:ltr">
      <rect x="0" y="0" width="132" height="34" rx="5" fill="#000"/>
      <text x="66" y="19" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="15" font-weight="900" font-style="italic" letter-spacing="-0.5">
        <tspan fill="#fff">EURO</tspan><tspan fill="#4CBB3C">DRIVE</tspan>
      </text>
      <rect x="10" y="23" width="112" height="7" rx="1.5" fill="#4CBB3C"/>
    </svg>`,
  'כלמוביל': `<svg viewBox="0 0 132 34" width="112" height="29" role="img" aria-label="כלמוביל" style="direction:ltr">
      <rect x="0" y="0" width="132" height="34" rx="5" fill="#fff"/>
      <circle cx="24" cy="17" r="13" fill="#0B7A4B"/>
      <path d="M24 6a11 11 0 0 1 0 22 7 7 0 0 0 0-14 4 4 0 0 1 0-8z" fill="#5BC98A"/>
      <circle cx="24" cy="17" r="4.5" fill="#fff"/>
      <text x="86" y="23" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#0B2B3C">כלמוביל</text>
    </svg>`,
};

// תג הספק — מופיע בכרטיס הרכב אצל המנהל ואצל הנהג
function _pickupSourceTag(c) {
  const logo = c && c.source ? _PICKUP_LOGOS[c.source] : null;
  if (!logo) return '';
  return `<span title="${c.source}" style="display:inline-flex;align-items:center;justify-content:center;width:100%;min-width:0;height:100%;min-height:38px;border-radius:8px;background:${_pickupSourceColor(c.source)};border:1px solid ${_pickupSourceColor(c.source)};overflow:hidden">${logo}</span>`;
}

// בורר הספק בטופס ההוספה והעריכה
function _renderPickupSourceBtns() {
  const box = document.getElementById('pickup-source-btns');
  const cur = (document.getElementById('pickup-source') || {}).value || '';
  if (!box) return;
  box.innerHTML = _PICKUP_SOURCES.map(s => {
    const on = cur === s.name;
    return `<button type="button" onclick="pickupPickSource('${s.name}')" title="${s.name}" style="flex:1;display:flex;align-items:center;justify-content:center;padding:8px;border-radius:10px;border:2px solid ${on ? s.color : 'var(--border)'};background:${on ? s.color : 'var(--surface2)'};cursor:pointer;opacity:${on ? 1 : .55}">${_PICKUP_LOGOS[s.name] || s.name}</button>`;
  }).join('');
}

function pickupPickSource(name) {
  const f = document.getElementById('pickup-source');
  if (f) f.value = f.value === name ? '' : name;   // לחיצה חוזרת מבטלת
  _renderPickupSourceBtns();
}
window.pickupPickSource = pickupPickSource;

// שתי שורות הפעולה בכרטיס בנויות על אותה רשת: שתי עמודות שוות ברוחב
// מלא, ופריט בודד בשורה האחרונה נפרס על שתיהן — כך אין שוליים ריקים.
function _pickupCell(html, span) {
  return `<div style="${span ? 'grid-column:span 2;' : ''}display:flex">${html}</div>`;
}
function _pickupGridWrap(cells, grow) {
  const fill = grow ? 'flex:1;grid-auto-rows:1fr;min-height:78px;' : '';
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%;${fill}">${cells.join('')}</div>`;
}
// אזור התגים שומר על אותו גובה תמיד (שתי שורות), כדי שהכפתורים יישארו
// באותה מידה בין רכב שנשלח לנהג לרכב שעוד לא. כשאין שם נהג — הלוגו וימי
// ההמתנה מתפרשים על כל השטח הפנוי.
function _pickupCellGrid(items) {
  const odd = items.length % 2 === 1;
  const cells = items.map((html, i) => _pickupCell(html, odd && i === items.length - 1));
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%;height:82px;grid-auto-rows:1fr">${cells.join('')}</div>`;
}
function _pickupBtnGrid(btns) {
  const odd = btns.length % 2 === 1;
  return _pickupGridWrap(btns.map(([fn, label, color, blockedMsg], i) => {
    const span = (odd && i === btns.length - 1) ? 'grid-column:span 2;' : '';
    // כפתור חסום נשאר במקומו כדי שהכרטיס לא יקפוץ — אבל אפור, ולחיצה
    // עליו מסבירה מה חסר במקום לבצע פעולה
    const off = !!blockedMsg;
    const act = off ? `showToast('${blockedMsg}', 4000)` : fn;
    const bg  = off ? 'var(--surface2)' : color;
    const fg  = off ? 'var(--muted)' : '#fff';
    return `<button onclick="event.stopPropagation();${act}" style="${span}background:${bg};color:${fg};border:${off ? '2px dashed var(--border)' : 'none'};border-radius:8px;padding:6px 5px;font-family:Heebo,sans-serif;font-weight:700;font-size:12px;line-height:1.15;cursor:${off ? 'not-allowed' : 'pointer'};white-space:nowrap;width:100%;height:100%">${label}</button>`;
  }), true);
}

/* ── גרירה לשינוי סדר הקוביות ────────────────────────────────────────
   הגרירה מתחילה מהידית ⠿ בלבד, כדי שלחיצה על הקובייה ועל הכפתורים
   תמשיך לעבוד ושגלילה במסך לא תיתפס כגרירה. התזוזה של שאר הקוביות
   מונפשת בשיטת FLIP: מודדים לפני ואחרי, ומחליקים מהמצב הישן לחדש.
─────────────────────────────────────────────────────────────────────── */
let _pkDrag = null;
let _pkPressing = false;      // לחיצה ארוכה שממתינה להבשיל
let _pkPendingRender = false; // ציור מחדש שנדחה בגלל גרירה

function _pickupEnableDrag() {
  const list = document.getElementById('pickup-list');
  if (!list || list.dataset.dragReady) return;
  list.dataset.dragReady = '1';

  // הגרירה מתחילה בלחיצה ארוכה על הקובייה, או מיד מהידית ⠿
  let pressTimer = null, pressInfo = null;

  const beginDrag = (tile, x, y, pointerId, source, startTarget) => {
    const r = tile.getBoundingClientRect();
    const ghost = tile.cloneNode(true);
    ghost.classList.add('pk-ghost');
    ghost.style.width = r.width + 'px';
    ghost.style.height = r.height + 'px';
    ghost.style.left = r.left + 'px';
    ghost.style.top = r.top + 'px';
    document.body.appendChild(ghost);
    tile.classList.add('pk-dragging');
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }

    _pkPressing = false;
    _pkDrag = { tile, ghost, dx: x - r.left, dy: y - r.top, moved: false, startTarget };
    try { (source || list).setPointerCapture(pointerId); } catch (e) {}
  };

  // ביטול לחיצה ארוכה שטרם הבשילה — למשל כשהמשתמש רק לחץ ופתח עריכה
  const cancelPress = () => { clearTimeout(pressTimer); pressTimer = null; pressInfo = null; _pkPressing = false;
    if (_pkPendingRender && !_pkDrag) { _pkPendingRender = false; renderPickupCars(); } };

  list.addEventListener('pointerdown', ev => {
    // גרירה בעכבר רק בלחיצה שמאלית ממושכת
    if (ev.pointerType === 'mouse' && ev.button !== 0) { cancelPress(); return; }
    if (ev.button > 0) { cancelPress(); return; }
    const tile = ev.target.closest('.pk-tile');
    if (!tile) { cancelPress(); return; }
    const handle = ev.target.closest('.pk-drag');
    if (handle) { ev.preventDefault(); beginDrag(tile, ev.clientX, ev.clientY, ev.pointerId, handle, null); return; }
    // הלחיצה הארוכה תופסת בכל שטח הקובייה, גם מעל הכפתורים ושורת הניווט.
    // לחיצה קצרה עליהם ממשיכה לעבוד כרגיל, כי רק גרירה שזזה בולעת את הקליק.
    pressInfo = { tile, x: ev.clientX, y: ev.clientY, id: ev.pointerId, target: ev.target };
    _pkPressing = true;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      if (!pressInfo) return;
      beginDrag(pressInfo.tile, pressInfo.x, pressInfo.y, pressInfo.id, list, pressInfo.target);
      pressInfo = null;
    }, 350);
  });

  // הרפיית האצבע או העכבר לפני שהלחיצה הבשילה = קליק רגיל, בלי גרירה.
  // רק על המסמך כולו — האזנה על הקוביות עצמן ביטלה גם תזוזות זעירות.
  document.addEventListener('pointerup', cancelPress);
  document.addEventListener('pointercancel', cancelPress);
  window.addEventListener('blur', cancelPress);

  // אחרי גרירה אמיתית בולעים את הקליק שאחריה, כדי שלא ייפתח חלון עריכה
  list.addEventListener('click', ev => {
    if (!list.dataset.swallowClick) return;
    delete list.dataset.swallowClick;
    ev.stopPropagation();
    ev.preventDefault();
  }, true);

  // תזוזה לפני שהלחיצה הארוכה הבשילה = גלילה, ולא גרירה
  list.addEventListener('pointermove', ev => {
    if (!pressInfo || _pkDrag) return;
    if (Math.abs(ev.clientX - pressInfo.x) > 12 || Math.abs(ev.clientY - pressInfo.y) > 12) {
      clearTimeout(pressTimer); pressInfo = null;
    }
  }, { passive: true });

  list.addEventListener('pointermove', ev => {
    const d = _pkDrag;
    if (!d) return;
    ev.preventDefault();
    d.moved = true;
    d.ghost.style.left = (ev.clientX - d.dx) + 'px';
    d.ghost.style.top  = (ev.clientY - d.dy) + 'px';

    // מוצאים את הקובייה שמתחת ליד (או הקרובה אליה ביותר), ומחליפים
    // איתה מקום: אם היא אחרי הקובייה הנגררת — נכנסים אחריה, ואם היא
    // לפניה — נכנסים לפניה. כך ההחלפה מדויקת בשני הכיוונים.
    // המדידה נעשית לפי מיקום הפריסה (offsetLeft/offsetTop) ולא לפי
    // getBoundingClientRect, כי בזמן אנימציית ההחלקה הקוביות מוזזות
    // ויזואלית והמדידה הרגילה הייתה מחזירה מיקומי ביניים שגויים.
    const tiles = [...list.querySelectorAll('.pk-tile')];
    const op = d.tile.offsetParent || list;
    const opr = op.getBoundingClientRect();
    const px = ev.clientX - opr.left + op.scrollLeft;
    const py = ev.clientY - opr.top  + op.scrollTop;
    const before = new Map(tiles.map(t => [t, {
      left: t.offsetLeft, top: t.offsetTop, w: t.offsetWidth, h: t.offsetHeight
    }]));
    let over = null;
    for (const t of tiles) {
      if (t === d.tile) continue;
      const b = before.get(t);
      // רק כניסה ממש לתוך קובייה אחרת מחליפה מקום. כשהיד נמצאת מעל
      // המקום של הקובייה הנגררת עצמה — כלום לא זז, וכך אין ריצוד.
      if (px >= b.left && px <= b.left + b.w && py >= b.top && py <= b.top + b.h) { over = t; break; }
    }
    if (!over) return;
    const isAfter = !!(d.tile.compareDocumentPosition(over) & Node.DOCUMENT_POSITION_FOLLOWING);
    const ref = isAfter ? over.nextElementSibling : over;
    if (ref === d.tile || ref === d.tile.nextElementSibling) return;
    list.insertBefore(d.tile, ref);
    for (const t of tiles) {
      if (t === d.tile) continue;
      const b = before.get(t);
      const mx = b.left - t.offsetLeft, my = b.top - t.offsetTop;
      if (!mx && !my) continue;
      t.classList.remove('pk-shift');
      t.style.transform = `translate(${mx}px, ${my}px)`;
      requestAnimationFrame(() => {
        t.classList.add('pk-shift');
        t.style.transform = '';
      });
    }
  });

  const finish = () => {
    cancelPress();
    const d = _pkDrag;
    if (!d) return;
    _pkDrag = null;
    d.ghost.remove();
    d.tile.classList.remove('pk-dragging');
    list.querySelectorAll('.pk-tile').forEach(t => { t.classList.remove('pk-shift'); t.style.transform = ''; });
    if (d.moved) {
      list.dataset.swallowClick = '1';
      _pkPendingRender = false;      // הסדר החדש על המסך הוא הנכון
      _savePickupOrder();
      return;
    }
    if (_pkPendingRender) { _pkPendingRender = false; renderPickupCars(); }
    // לחיצה ארוכה שלא זזה = המשתמש רק התעכב על הכפתור. הדפדפן בולע את
    // הקליק אחרי תפיסת המצביע, ולכן מפעילים אותו בעצמנו.
    const el = d.startTarget;
    if (el && el.isConnected) setTimeout(() => el.click(), 0);
  };
  list.addEventListener('pointerup', finish);
  list.addEventListener('pointercancel', finish);
}

// הסדר החדש נשמר על הרכבים עצמם, כדי שיישמר גם בכניסה הבאה ולכל מכשיר
async function _savePickupOrder() {
  const list = document.getElementById('pickup-list');
  if (!list) return;
  const ids = [...list.querySelectorAll('.pk-tile')].map(t => t.dataset.id).filter(Boolean);
  _pickupManualOrder = true;
  _pickupSortMode = 0;
  _pickupDistSort = false;
  // מעדכנים בזיכרון מיד, כדי שהרשימה לא תקפוץ חזרה בזמן השמירה
  ids.forEach((id, i) => {
    const car = _pickupAllCars.find(c => c.id === id);
    if (car) car.sortIndex = i;
  });
  try {
    const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await Promise.all(ids.map((id, i) => updateDoc(doc(window._db, 'pickup_cars', id), { sortIndex: i })));
    showToast('✅ הסדר נשמר');
  } catch (e) {
    console.error('save order failed', e);
    showToast('שגיאה בשמירת הסדר');
  }
}

/* כמה רכבים באותה כתובת מקבלים את אותו צבע בשורת המיקום, כדי לראות
   במבט אחד מה אפשר לאסוף באותה נסיעה. כתובת יחידה נשארת בכחול הרגיל. */
/* צבע נפרד לכל כתובת. כל הצבעים כהים מספיק לטקסט לבן, ושונים זה מזה
   כדי שאפשר יהיה להבדיל ביניהם במבט אחד. הכחול הרגיל שמור לרכב בלי כתובת. */
const _PK_ADDR_COLORS = [
  '#7c3aed','#0f766e','#b45309','#be185d','#15803d','#c2410c','#0e7490','#4338ca',
  '#a16207','#9d174d','#1e40af','#4d7c0f','#b91c1c','#6d28d9','#047857','#92400e',
  '#0369a1','#7e22ce','#065f46','#831843',
];
let _pkAddrColor = {};

/* הקיבוץ זהה לזה של פנקס הכתובות: אותה עיר, אותו מספר בית ומילת רחוב
   משותפת. כך "שנקר 15" ו"שנקר אריה 15" נחשבים אותו מקום. */
function _pkGroupAddresses(cars) {
  _pkAddrColor = {};
  const clusters = [];
  for (const c of cars) {
    const city = String(_pickupCity(c) || '').trim();
    const tok = { city, ..._addrTokens(city, c.address) };
    if (!tok.names.length) continue;
    let g = clusters.find(x => _sameAddress(x.tok, tok));
    if (!g) { g = { tok, ids: [] }; clusters.push(g); }
    if (tok.num && !g.tok.num) g.tok.num = tok.num;
    tok.names.forEach(n => { if (!g.tok.names.includes(n)) g.tok.names.push(n); });
    g.ids.push(c.id);
  }
  // כל כתובת מקבלת צבע משלה — גם כתובת עם רכב אחד. הצבע נקבע לפי סדר
  // ההופעה ברשימה, ולכן הוא יציב בכל ציור מחדש של אותה רשימה.
  clusters.forEach((g, i) => {
    const color = _PK_ADDR_COLORS[i % _PK_ADDR_COLORS.length];
    g.ids.forEach(id => { _pkAddrColor[id] = color; });
  });
}

function _pickupCardHtml(c) {
  const e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const km = c.km ? _fmtKm(c.km) : '';
  const days = _pickupDays(c);
  const waitLabel = days === null ? '' : `${days === 1 ? 'יום המתנה' : days + ' ימי המתנה'}`;
  // צבע רגוע כברירת מחדל; כתום אחרי שבוע ואדום אחרי שבועיים
  const waitColor = days === null ? '#64748b' : days > 14 ? '#dc2626' : days > 7 ? '#d97706' : '#64748b';
  const checked = _pickupSelected.has(c.id);
  const pinned = !!c.pinned;
  const expired = c.test && _testExpired(c.test);
  // בשורת המיקום מציגים את הכתובת ואחריה את שם העיר
  const _city = _pickupCity(c) || '';
  const place = [c.address || '', c.address && _city && !c.address.includes(_city) ? _city : (c.address ? '' : _city)]
    .filter(Boolean).join(', ');
  // שם המקום מוצג מעל הכתובת — כך רואים מאיזה מגרש הרכב בלי לזכור כתובות
  const yardName = String(c.yard || _yardNameFor(_city, c.address) || '').trim();
  const nav = _pickupNavUrl(c);
  const groupColor = _pkAddrColor[c.id] || '';
  const addrStyle = groupColor ? ` style="background:${groupColor}"` : '';
  const sent = !!c.assignedDriver;
  // רכב שנשלח לנהג מקבל רקע צהוב; רכב שסומן — ירוק, והסימון גובר
  // רכב שנשלח לגרר מקבל סגול, נהג רגיל צהוב, וסימון ידני ירוק שגובר על שניהם
  const toTow = c.assignedDriver === _TOW_NAME;
  const bg = checked ? 'background:#dcfce7;border-color:#059669;'
    : toTow ? 'background:#ede9fe;border-color:#7c3aed;'
    : sent ? 'background:#fef9c3;border-color:#eab308;' : '';

  return `<div class="pk-tile" data-id="${e(c.id)}" style="border-top:4px solid ${waitColor};${bg}" onclick="openEditPickupModal('${e(c.id)}')">
    <div class="pk-tile-top">
      <div style="display:flex;align-items:center;gap:6px;min-width:0">
        <div onclick="event.stopPropagation();togglePickupSelect('${e(c.id)}')" title="סימון" class="pk-tick" style="${checked?'background:#16a34a;color:#fff;border-color:#16a34a':'background:var(--card);color:transparent'}">✓</div>
        <div onclick="event.stopPropagation();togglePickupPin('${e(c.id)}')" title="${pinned?'ביטול נעיצה':'נעיצה בראש'}" class="pk-tick" style="${pinned?'background:#f59e0b;border-color:#f59e0b':'background:var(--card);opacity:.5'}">📌</div>
        <span class="pk-plate" title="לחיצה מעתיקה את מספר הרישוי" style="cursor:pointer" onclick="event.stopPropagation();bsmCopyPlate('${e(c.plate||'')}')">${e(c.plate||'')}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;min-width:0">
        ${_pickupSourceTag(c)}
        <div class="pk-drag" title="גרור כדי לשנות מקום" onclick="event.stopPropagation()">⠿</div>
      </div>
    </div>

    <div class="pk-who">${e(c.type || '—')}${c.year ? `<span class="pk-year">${e(c.year)}</span>` : ''}</div>

    <div class="pk-chips">
      ${c.color ? `<span class="pk-chip">${e(c.color)}</span>` : ''}
      ${km ? `<span class="pk-chip">${e(km)} ק"מ</span>` : ''}
      ${c.doc ? `<span class="pk-chip" style="background:#e0f2fe;color:#0369a1">✓ בעלות</span>` : ''}
      ${c.note ? `<span class="pk-chip" style="background:#fef08a;color:#713f12" title="${e(c.note)}">📝 הערה</span>` : ''}
    </div>

    <div class="pk-lines">
      ${yardName ? `<div class="pk-line" style="font-weight:900">🏢 ${e(yardName)}</div>` : ''}
      ${place ? (nav
        ? `<a class="pk-line pk-nav" href="${nav}" target="_blank" rel="noopener"${addrStyle} onclick="event.stopPropagation()">📍 ${e(place)} <span style="margin-right:auto;font-size:11px">🚶 ניווט</span></a>`
        : `<div class="pk-line pk-nav"${addrStyle}>📍 ${e(place)}</div>`) : `<div class="pk-line" style="color:var(--muted)">📍 אין כתובת</div>`}
      <div class="pk-line" style="display:flex;align-items:center;gap:6px">
        <span style="${expired ? 'color:#dc2626;font-weight:900' : ''};flex-shrink:0">🔧 טסט: ${c.test ? e(c.test) : '—'}${expired ? ' · פג תוקף' : ''}</span>
        ${c.contact ? `<span title="${e(c.contact)}" style="margin-right:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-weight:700">👤 ${e(c.contact)}</span>` : ''}
      </div>
    </div>

    <div class="pk-status">
      <span class="pk-badge" style="background:${waitColor};color:#fff">⏱ ${waitLabel || 'חדש'}</span>
      ${sent
        ? `<span class="pk-badge" style="background:${toTow ? '#7c3aed' : '#1e40af'};color:#fff">${toTow ? '🚛' : '🚗'} ${e(c.assignedDriver)}</span>`
        : `<span class="pk-badge" style="border:2px dashed var(--border);color:var(--muted)">לא נשלח לנהג</span>`}
    </div>

    <div class="pk-acts">
      <button onclick="event.stopPropagation();openSendPickupToDriver('${e(c.id)}')" title="שלח לנהג" style="background:#0ea5e9">📲<b>שלח לנהג</b></button>
      ${sent
        ? `<button onclick="event.stopPropagation();sendPickupCarIntake('${e(c.id)}')" title="שלח קליטה" style="background:#7c3aed">📥<b>שלח קליטה</b></button>`
        : `<button onclick="event.stopPropagation();showToast('קודם שלח את הרכב לנהג, ואז אפשר לשלוח קליטה', 4000)" title="צריך קודם לשלוח לנהג" style="background:var(--surface2);color:var(--muted);border:2px dashed var(--border);cursor:not-allowed">📥<b>שלח קליטה</b></button>`}
      <button onclick="event.stopPropagation();collectPickupCar('${e(c.id)}')" title="הרכב נאסף" style="background:#059669">✅<b>נאסף</b></button>
      <button onclick="event.stopPropagation();deletePickupCar('${e(c.id)}')" title="הסר" style="background:#ef4444">🗑️<b>הסר</b></button>
    </div>
  </div>`;
}

let _pickupEditId = null;
let _pickupDocData = null; // base64 or null
let _pickupDocMime = '';

function _pickupFillForm(c) {
  document.getElementById('pickup-plate').value = c.plate || '';
  document.getElementById('pickup-type').value = c.type || '';
  document.getElementById('pickup-year').value = c.year || '';
  document.getElementById('pickup-color').value = c.color || '';
  document.getElementById('pickup-km').value = c.km || '';
  document.getElementById('pickup-test').value = c.test || '';
  document.getElementById('pickup-contact').value = c.contact || '';
  document.getElementById('pickup-city').value = c.city || '';
  document.getElementById('pickup-address').value = c.address || '';
  document.getElementById('pickup-note').value = c.note || '';
  document.getElementById('pickup-source').value = c.source || '';
  _renderPickupSourceBtns();
  document.getElementById('pickup-lookup-status').textContent = '';
  const _ch = document.getElementById('pickup-contact-hint'); if (_ch) _ch.innerHTML = '';
  document.getElementById('pickup-doc-file').value = '';
  document.getElementById('pickup-doc-name').textContent = c.docName || '';
  document.getElementById('pickup-doc-preview').innerHTML = c.doc ? _pickupDocThumb(c.doc, c.docMime, c.docName) : '';
  _pickupDocData = c.doc || null;
  _pickupDocMime = c.docMime || '';
  _togglePickupDocRemove(!!c.doc);
}

// show/hide the "delete file" button depending on whether a doc is attached
function _togglePickupDocRemove(show) {
  const btn = document.getElementById('pickup-doc-remove-btn');
  if (btn) btn.style.display = show ? 'inline-block' : 'none';
}

// remove the attached document/image from the pickup form
function clearPickupDoc() {
  _pickupDocData = null;
  _pickupDocMime = '';
  document.getElementById('pickup-doc-file').value = '';
  document.getElementById('pickup-doc-name').textContent = '';
  document.getElementById('pickup-doc-preview').innerHTML = '';
  _togglePickupDocRemove(false);
}
window.clearPickupDoc = clearPickupDoc;

function _pickupDocThumb(data, mime, name) {
  if (!data) return '';
  if ((mime||'').startsWith('image/')) {
    return `<img src="${data}" onclick="openLightbox(this.src)" style="max-width:100%;max-height:160px;border-radius:8px;object-fit:cover;cursor:zoom-in;margin-top:6px">`;
  }
  return `<a href="${data}" download="${name||'מסמך'}" style="display:inline-flex;align-items:center;gap:6px;background:#6366f1;color:#fff;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;text-decoration:none;margin-top:6px">📄 פתח מסמך</a>`;
}

function previewPickupDoc(input) {
  const file = input.files[0];
  if (!file) return;
  // המסמך נשמר בתוך הרשומה, ולכן יש לו תקרת גודל. עדיף לומר את זה
  // בזמן הצירוף מאשר להיכשל בשמירה
  if (file.size > 700 * 1024) {
    input.value = '';
    showToast(`⚠️ הקובץ גדול מדי (${(file.size / 1024 / 1024).toFixed(1)}MB). המקסימום הוא 0.7MB — צלם מחדש או שמור באיכות נמוכה יותר.`, 10000);
    return;
  }
  document.getElementById('pickup-doc-name').textContent = file.name;
  _pickupDocMime = file.type;
  const reader = new FileReader();
  reader.onload = e => {
    _pickupDocData = e.target.result;
    document.getElementById('pickup-doc-preview').innerHTML = _pickupDocThumb(_pickupDocData, _pickupDocMime, file.name);
    _togglePickupDocRemove(true);
  };
  reader.readAsDataURL(file);
}
window.previewPickupDoc = previewPickupDoc;

function openAddPickupModal() {
  _pickupEditId = null;
  _pickupFillForm({});
  document.getElementById('pickup-modal-title').childNodes[0].textContent = '🚙 הוספת רכב לאיסוף ';
  document.getElementById('pickup-submit-btn').textContent = '✅ הוסף רכב';
  openModal('modal-add-pickup');
}
window.openAddPickupModal = openAddPickupModal;

function openEditPickupModal(id) {
  const car = _pickupAllCars.find(c => c.id === id);
  if (!car) return;
  _pickupEditId = id;
  _pickupFillForm(car);
  document.getElementById('pickup-modal-title').childNodes[0].textContent = '✏️ עריכת רכב לאיסוף ';
  document.getElementById('pickup-submit-btn').textContent = '💾 שמור שינויים';
  openModal('modal-add-pickup');
}
window.openEditPickupModal = openEditPickupModal;

async function pickupLookupPlate() {
  const plate = document.getElementById('pickup-plate').value.trim().replace(/\D/g,'');
  if (!plate) return;
  const status = document.getElementById('pickup-lookup-status');
  status.textContent = '⏳ מחפש...'; status.style.color = 'var(--muted)';
  try {
    const rec = await _plateLookup(plate);
    if (!rec) { status.textContent = '❌ לא נמצא'; status.style.color = 'var(--danger,#ef4444)'; return; }
    document.getElementById('pickup-type').value = [rec.maker, rec.model].filter(Boolean).join(' ');
    document.getElementById('pickup-year').value = rec.year;
    document.getElementById('pickup-color').value = rec.color;
    const td = _plateTestDate(rec);
    if (td) document.getElementById('pickup-test').value = td;
    status.textContent = '✅ פרטים נטענו'; status.style.color = 'var(--success,#16a34a)';
  } catch(e) {
    status.textContent = '⚠️ שגיאה בחיבור'; status.style.color = 'var(--danger,#ef4444)';
  }
}
window.pickupLookupPlate = pickupLookupPlate;

async function submitPickupCar() {
  const plate = document.getElementById('pickup-plate').value.trim();
  if (!plate) return showToast('נא להזין לוחית רישוי');
  // הטופס נשאר פתוח עם כל מה שמילאת, ואפשר לשלוח שוב כשהחיבור יחזור
  if (!_requireNet('שמירת הרכב')) return;
  const btn = document.getElementById('pickup-submit-btn');
  btn.disabled = true;
  const isEdit = !!_pickupEditId;
  const docName = document.getElementById('pickup-doc-name').textContent || '';
  const data = {
    plate,
    type: document.getElementById('pickup-type').value.trim(),
    year: document.getElementById('pickup-year').value.trim(),
    color: document.getElementById('pickup-color').value.trim(),
    km: document.getElementById('pickup-km').value.trim(),
    test: document.getElementById('pickup-test').value.trim(),
    contact: _dedupContacts(document.getElementById('pickup-contact').value),
    city: document.getElementById('pickup-city').value.trim(),
    address: _snapAddressToStreets(
      document.getElementById('pickup-city').value.trim(),
      document.getElementById('pickup-address').value.trim()),
    note: document.getElementById('pickup-note').value.trim(),
    source: document.getElementById('pickup-source').value.trim(),
    ...(_pickupDocData
      ? { doc: _pickupDocData, docMime: _pickupDocMime, docName }
      : { doc: null, docMime: null, docName: null }),
  };
  try {
    if (_pickupEditId) {
      const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await updateDoc(doc(window._db, 'pickup_cars', _pickupEditId), data);
      closeModal('modal-add-pickup');
      showToast('✅ הפרטים עודכנו');
    } else {
      await _addDoc(_colRef('pickup_cars'), { ...data, createdBy: currentUser.name, createdAt: _serverTs() });
      closeModal('modal-add-pickup');
      showToast('✅ הרכב נוסף');
    }
    // הכתובת ואיש הקשר נשמרים יחד, כדי שהרכב הבא באותה כתובת יתמלא לבד.
    // בעריכה מה שנרשם עכשיו קובע — כך מחיקה של איש קשר באמת נשמרת.
    if (isEdit) _setAddrContacts(data.city, data.address, data.contact);
    else _learnAddrContact(data.city, data.address, data.contact);
  } catch(e) { showToast('שגיאה בשמירה'); }
  btn.disabled = false;
}
window.submitPickupCar = submitPickupCar;

async function deletePickupCar(id) {
  if (!confirm('להסיר רכב זה מהרשימה?')) return;
  const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await deleteDoc(doc(window._db, 'pickup_cars', id));
  showToast('הרכב הוסר');
}
window.deletePickupCar = deletePickupCar;

// ── Upload ownership transfers: split file into pages, OCR the plate on each,
//    and attach every page to the matching pickup car ──
let _ownFlow = null; // { images, idx, pages:[{img,plate,carId}], worker, pendingCarId }

function openOwnershipModal() {
  if (_ownFlow && _ownFlow.worker) { try { _ownFlow.worker.terminate(); } catch (e) {} }
  _ownFlow = null;
  document.getElementById('ownership-file').value = '';
  document.getElementById('ownership-status').textContent = '';
  document.getElementById('ownership-results').innerHTML = '';
  document.getElementById('ownership-commit-btn').style.display = 'none';
  openModal('modal-upload-ownership');
}
window.openOwnershipModal = openOwnershipModal;

/* Some transfer confirmations are real digital documents, not scans — the plate
   is written inside the file. Reading it out is exact, so those pages skip the
   OCR guessing entirely; a scanned page still falls back to OCR. */
function _ownPlateFromText(text) {
  const t = String(text || '').replace(/[\u200e\u200f]/g, '');
  const m = t.match(/מספר\s*הרכב[^0-9]{0,4}(\d{7,8})/);
  return m ? m[1] : '';
}

async function _pdfFileToImages(file) {
  if (!window.pdfjsLib) throw new Error('pdf.js not loaded');
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const imgs = [];
  _ownPdfText = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    try {
      const tc = await page.getTextContent();
      _ownPdfText.push(tc.items.map(x => x.str).join(' '));
    } catch (e) { _ownPdfText.push(''); }
    const vp1 = page.getViewport({ scale: 1 });
    const scale = Math.min(3, 1600 / vp1.width);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); // white bg (avoid black from transparency)
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    imgs.push(canvas.toDataURL('image/jpeg', 0.75));
  }
  return imgs;
}

function _fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

let _ownPdfText = [];   // the text layer of the last PDF, page by page

function _normPlate(p) { return String(p || '').replace(/\D/g, ''); }

function _loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

// Crop a region (fractional box), upscale, grayscale + autocontrast (2% cutoff).
// Binarizing these faint scans destroyed the text, so we stretch contrast
// instead. box = {x0,y0,x1,y1} as fractions (default whole page); scale = zoom.
async function _prepRegion(dataUrl, box, scale) {
  const img = await _loadImg(dataUrl);
  box = box || {};
  const x0 = Math.round(img.width * (box.x0 || 0)), y0 = Math.round(img.height * (box.y0 || 0));
  const x1 = Math.round(img.width * (box.x1 == null ? 1 : box.x1)), y1 = Math.round(img.height * (box.y1 == null ? 1 : box.y1));
  const sw = Math.max(1, x1 - x0), sh = Math.max(1, y1 - y0), sc = scale || 2;
  const c = document.createElement('canvas');
  c.width = sw * sc; c.height = sh * sc;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x0, y0, sw, sh, 0, 0, c.width, c.height);
  const id = ctx.getImageData(0, 0, c.width, c.height), d = id.data;
  const total = d.length / 4;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    const g = (0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]) | 0;
    d[i] = d[i+1] = d[i+2] = g; hist[g]++;
  }
  const cut = total * 0.02;
  let lo = 0, hi = 255, acc = 0;
  for (let t = 0; t < 256; t++) { acc += hist[t]; if (acc > cut) { lo = t; break; } }
  acc = 0;
  for (let t = 255; t >= 0; t--) { acc += hist[t]; if (acc > cut) { hi = t; break; } }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    let v = (d[i] - lo) * 255 / range; v = v < 0 ? 0 : v > 255 ? 255 : v;
    d[i] = d[i+1] = d[i+2] = v;
  }
  ctx.putImageData(id, 0, 0);
  return c.toDataURL('image/png');
}

function _plateTokens(text) {
  return (text.match(/\d{6,9}/g) || []).filter(t => t.length === 7 || t.length === 8);
}

// snap a set of OCR'd digit tokens to the nearest plate among the cars already
// in the pickup list. The candidate pool is small, so even a 1-char OCR error
// still resolves to the correct car; anything further is left for manual pick.
function _matchNearestPlate(tokens) {
  const known = _pickupAllCars.map(c => ({ id: c.id, plate: _normPlate(c.plate) })).filter(c => c.plate.length >= 7);
  let best = { dist: 99, carId: null, plate: '' };
  for (const t of tokens) {
    for (const k of known) {
      if (Math.abs(k.plate.length - t.length) > 1) continue;
      const dd = _levenshtein(t, k.plate);
      if (dd < best.dist) best = { dist: dd, carId: k.id, plate: k.plate };
    }
  }
  if (best.carId && best.dist <= 1) return { plate: best.plate, carId: best.carId };
  return { plate: tokens[0] || '', carId: null };
}

// Rich, early-exit plate OCR for one page. Tries the tight plate-cell crop
// first (fast), then the top region, then wider/offset crops — stopping as
// soon as a token snaps to a known pickup plate.
async function _ownOcrPage(worker, img) {
  let tokens = [];
  const groups = [
    [{ x0: 0.55, y0: 0.15, x1: 0.80, y1: 0.215 }, 4, ['6', '7']],
    [{ x1: 1, y1: 0.45 }, 2, ['6', '11']],
    [{ x0: 0.55, y0: 0.15, x1: 0.80, y1: 0.215 }, 4, ['8', '11']],
    [{ x0: 0.52, y0: 0.135, x1: 0.82, y1: 0.205 }, 4, ['6', '7', '11']],
    [{ x0: 0.50, y0: 0.16, x1: 0.86, y1: 0.225 }, 4, ['6', '11']],
    [{ x1: 1, y1: 0.55 }, 2, ['4', '3']],
  ];
  for (const [box, scale, psms] of groups) {
    const prep = await _prepRegion(img, box, scale);
    for (const psm of psms) {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      tokens = tokens.concat(_plateTokens((await worker.recognize(prep)).data.text));
    }
    const m = _matchNearestPlate(tokens);
    if (m.carId) return m;
  }
  return _matchNearestPlate(tokens);
}

async function handleOwnershipFiles(input) {
  const files = [...(input.files || [])];
  if (!files.length) return;
  const status = document.getElementById('ownership-status');
  const results = document.getElementById('ownership-results');
  results.innerHTML = '';
  document.getElementById('ownership-commit-btn').style.display = 'none';
  try {
    status.textContent = '⏳ מפצל את הקובץ לעמודים...';
    const images = [];
    const texts = [];
    for (const f of files) {
      if (f.type === 'application/pdf') {
        const imgs = await _pdfFileToImages(f);
        images.push(...imgs);
        texts.push(...imgs.map((_, i) => _ownPdfText[i] || ''));
      } else if (f.type.startsWith('image/')) { images.push(await _fileToDataUrl(f)); texts.push(''); }
    }
    if (!images.length) { status.textContent = 'לא זוהו עמודים בקובץ'; return; }
    const worker = await Tesseract.createWorker('eng', 1);
    await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
    _ownFlow = { images, texts, idx: 0, pages: [], worker, pendingCarId: null };
    await _ownProcessNext();
  } catch (e) {
    console.error('handleOwnershipFiles error', e);
    status.textContent = 'שגיאה בעיבוד הקובץ';
  }
}
window.handleOwnershipFiles = handleOwnershipFiles;

function _ownCarOptions() {
  return ['<option value="">— בחר רכב —</option>']
    .concat(_pickupAllCars.slice()
      .sort((a, b) => _normPlate(a.plate).localeCompare(_normPlate(b.plate)))
      .map(c => `<option value="${c.id}">${esc((c.plate || '') + (c.type ? ' — ' + c.type : ''))}</option>`))
    .join('');
}

function _ownDoneListHtml() {
  if (!_ownFlow || !_ownFlow.pages.length) return '';
  return '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">' + _ownFlow.pages.map(p => {
    const car = _pickupAllCars.find(c => c.id === p.carId);
    const label = car ? (car.plate || '') + (car.type ? ' — ' + car.type : '') : p.plate;
    return `<div style="background:#dcfce7;border-radius:8px;padding:6px 10px;border-right:3px solid #059669;font-size:12px;font-weight:700;color:#166534">✅ ${esc(p.plate || '')} → ${esc(label)}</div>`;
  }).join('') + '</div>';
}

async function _ownProcessNext() {
  const f = _ownFlow; if (!f) return;
  const status = document.getElementById('ownership-status');
  const results = document.getElementById('ownership-results');
  const n = f.images.length;
  if (f.idx >= n) {
    try { await f.worker.terminate(); } catch (e) {}
    status.textContent = `✅ כל ${n} העמודים שויכו. אשר להצמדה:`;
    results.innerHTML = _ownDoneListHtml();
    document.getElementById('ownership-commit-btn').style.display = 'block';
    return;
  }
  const cur = f.idx + 1;
  status.textContent = `🔍 מזהה רכב ${cur} מתוך ${n}...`;
  results.innerHTML = _ownDoneListHtml() +
    `<div style="text-align:center;background:var(--surface2);border-radius:12px;padding:12px">
      <div style="font-weight:800;margin-bottom:8px">עמוד ${cur} מתוך ${n}</div>
      <img src="${f.images[f.idx]}" style="max-height:220px;max-width:100%;border-radius:8px;border:1px solid var(--border)">
      <div style="margin-top:8px;color:var(--muted);font-size:13px">⏳ מזהה מספר רכב...</div>
    </div>`;
  await new Promise(r => setTimeout(r, 40)); // let the UI paint before the heavy OCR
  let m = { plate: '', carId: null };
  // a plate written in the file itself is read as it is — no OCR, no guessing
  const exact = _ownPlateFromText((f.texts || [])[f.idx]);
  if (exact) {
    const car = _pickupAllCars.find(c => _normPlate(c.plate) === exact);
    m = { plate: exact, carId: car ? car.id : null };
  } else {
    try { m = await _ownOcrPage(f.worker, f.images[f.idx]); } catch (e) { console.error('own ocr', e); }
  }
  if (m.carId) {
    f.pages.push({ img: f.images[f.idx], plate: m.plate, carId: m.carId });
    f.idx++;
    return _ownProcessNext();
  }
  // not matched — block here until the user assigns this page to a car
  f.pendingCarId = null;
  status.textContent = `⚠️ עמוד ${cur} מתוך ${n} — בחר רכב כדי להמשיך`;
  results.innerHTML = _ownDoneListHtml() +
    `<div style="background:#fff7ed;border:1px solid #f59e0b;border-radius:12px;padding:12px">
      <div style="font-weight:800;color:#b45309;margin-bottom:8px">⚠️ עמוד ${cur} מתוך ${n} — לא זוהה אוטומטית${m.plate ? ` (נקרא: ${esc(m.plate)})` : ''}</div>
      <div style="text-align:center;margin-bottom:10px"><img src="${f.images[f.idx]}" onclick="openLightbox(this.src)" style="max-height:260px;max-width:100%;border-radius:8px;border:1px solid var(--border);cursor:zoom-in"></div>
      <select onchange="_ownManualSelect(this.value)" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-family:Heebo,sans-serif;font-size:14px;margin-bottom:10px">${_ownCarOptions()}</select>
      <button id="own-continue-btn" onclick="_ownContinue()" disabled style="width:100%;padding:12px;border-radius:10px;border:none;background:#9ca3af;color:#fff;font-family:Heebo,sans-serif;font-weight:800;font-size:14px;cursor:not-allowed">המשך לעמוד הבא ←</button>
    </div>`;
}

function _ownManualSelect(carId) {
  if (!_ownFlow) return;
  _ownFlow.pendingCarId = carId || null;
  const btn = document.getElementById('own-continue-btn');
  if (btn) {
    const on = !!carId;
    btn.disabled = !on;
    btn.style.background = on ? '#059669' : '#9ca3af';
    btn.style.cursor = on ? 'pointer' : 'not-allowed';
  }
}
window._ownManualSelect = _ownManualSelect;

function _ownContinue() {
  const f = _ownFlow; if (!f) return;
  if (!f.pendingCarId) { showToast('בחר רכב לעמוד זה'); return; }
  const car = _pickupAllCars.find(c => c.id === f.pendingCarId);
  f.pages.push({ img: f.images[f.idx], plate: car ? _normPlate(car.plate) : '', carId: f.pendingCarId });
  f.pendingCarId = null;
  f.idx++;
  _ownProcessNext();
}
window._ownContinue = _ownContinue;

async function commitOwnershipAttach() {
  const f = _ownFlow;
  const toAttach = (f ? f.pages : []).filter(p => p.carId);
  if (!toAttach.length) { showToast('אין עמודים לשיוך'); return; }
  const btn = document.getElementById('ownership-commit-btn');
  btn.disabled = true;
  const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  let ok = 0;
  for (const p of toAttach) {
    try {
      await updateDoc(doc(window._db, 'pickup_cars', p.carId), {
        doc: p.img, docMime: 'image/jpeg', docName: `בעלות ${p.plate || ''}.jpg`.trim()
      });
      ok++;
    } catch (e) { console.error('attach ownership failed for', p.carId, e); }
  }
  btn.disabled = false;
  closeModal('modal-upload-ownership');
  showToast(`✅ ${ok} בעלויות שויכו לרכבים`);
}
window.commitOwnershipAttach = commitOwnershipAttach;

// ── Free text pickup parser ──

const _PICKUP_COLORS = ['לבן','שחור','אפור','כסף','כחול','אדום','ירוק','צהוב','כתום','חום','בז','זהב','סגול','ורוד','תכלת','בורדו','טיטניום','פנינה'];

let _freetextParsed = [];

function openFreeTextPickupModal() {
  document.getElementById('freetext-pickup-input').value = '';
  document.getElementById('freetext-pickup-preview').innerHTML = '';
  document.getElementById('freetext-pickup-save-btn').style.display = 'none';
  document.getElementById('freetext-img-input').value = '';
  document.getElementById('freetext-img-preview').style.display = 'none';
  document.getElementById('freetext-img-loading').style.display = 'none';
  document.getElementById('freetext-img-label').style.display = '';
  // image mode — hide the free-text box + detect button
  document.getElementById('freetext-pickup-input').style.display = 'none';
  document.getElementById('pickup-detect-btn').style.display = 'none';
  _freetextParsed = [];
  openModal('modal-freetext-pickup');
}
window.openFreeTextPickupModal = openFreeTextPickupModal;

function openTextPickupModal() {
  openFreeTextPickupModal();
  // text mode — reveal the free-text box + detect button, hide the image row
  document.getElementById('freetext-img-label').style.display = 'none';
  const ta = document.getElementById('freetext-pickup-input');
  ta.style.display = 'block';
  document.getElementById('pickup-detect-btn').style.display = 'block';
  setTimeout(() => ta.focus(), 50);
}
window.openTextPickupModal = openTextPickupModal;

function clearPickupImage() {
  document.getElementById('freetext-img-input').value = '';
  document.getElementById('freetext-img-preview').style.display = 'none';
  document.getElementById('freetext-img-label').style.display = '';
}
window.clearPickupImage = clearPickupImage;

function _parsePlatesFromOcr(fullText, digitsText) {
  const seen = new Set();
  const results = [];

  // Collapse noise: remove single non-digit chars between digit groups to handle
  // OCR splitting "60056003" → "6005 6003" or "6005|6003"
  const _collapseDigits = str =>
    str.replace(/(\d{2,})[\s\-|]{1,2}(\d{2,})/g, (_, a, b) => {
      const merged = a + b;
      return (merged.length === 7 || merged.length === 8) ? merged : _ ;
    });

  const _extractPlatesFromStr = str => {
    const collapsed = _collapseDigits(str);
    const plates = new Set();
    // standalone 7-8 digit numbers
    for (const m of collapsed.matchAll(/(?<!\d)(\d{7,8})(?!\d)/g)) plates.add(m[1]);
    // recover plates from longer runs where a row's cells merged (plate+year+km):
    // strip an embedded year, then re-extract a clean 7-8 digit plate
    for (const m of collapsed.matchAll(/\d{9,}/g)) {
      const run = m[0].replace(/(19[89]\d|20[0-3]\d)/, ' ');
      for (const p of run.matchAll(/(?<!\d)(\d{7,8})(?!\d)/g)) plates.add(p[1]);
    }
    return [...plates];
  };

  // Primary: all plates from digits-only OCR pass
  const digitPlates = digitsText ? _extractPlatesFromStr(digitsText) : [];
  // Secondary: plates found in full text
  const linePlates = _extractPlatesFromStr(fullText||'');

  // Merge, preserving order (digits pass first, then any extras from full text)
  const allPlates = [...digitPlates, ...linePlates];

  for (const plate of allPlates) {
    if (seen.has(plate)) continue;
    seen.add(plate);

    // Find context in full text around this plate for year/km/model
    const idx = (fullText||'').indexOf(plate);
    const ctx = idx >= 0
      ? (fullText||'').slice(Math.max(0, idx - 120), idx + 120)
      : '';

    const yearM  = ctx.match(/\b(19[89]\d|20[0-3]\d)\b/);
    const kmM    = ctx.match(/(\d{1,3},\d{3})/);
    const modelM = ctx.replace(plate, '').replace(yearM?.[0]||'', '').replace(kmM?.[0]||'', '')
                      .replace(/ענק\s*הרכבים/gi,'').replace(/שנקר/g,'').replace(/[|פ"ת\/\\]/g,'')
                      .replace(/\d+/g,'').replace(/\s{2,}/g,' ').trim().slice(0, 30);

    results.push({
      plate,
      type: modelM || '',
      year: yearM ? yearM[0] : '',
      color: '',
      km: kmM ? kmM[0] : '',
      test: '',
      contact: '',
      city: '',
      address: '',
    });
  }
  return results;
}

async function _fetchGovDataForAll(onProgress) {
  const cars = _freetextParsed.filter(c => c.plate);
  let done = 0;
  // fetch all plates in parallel (much faster than one-by-one)
  await Promise.all(cars.map(async car => {
    try {
      const rec = await _plateLookup(car.plate);
      if (rec) {
        car.type  = [rec.maker, rec.model].filter(Boolean).join(' ');
        car.year  = String(rec.year || car.year);
        car.color = String(rec.color || car.color || '');
        car.test  = _plateTestDate(rec) || car.test;
        car._fetched = true;
      }
    } catch(e) {}
    done++;
    if (onProgress) onProgress(Math.round(done / cars.length * 100));
  }));
  _renderFreetextPreview();
}

async function extractTextFromImage(input) {
  const file = input.files[0];
  if (!file) return;

  // show thumbnail
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('freetext-img-thumb').src = e.target.result;
    document.getElementById('freetext-img-preview').style.display = 'block';
    document.getElementById('freetext-img-label').style.display = 'none';
  };
  reader.readAsDataURL(file);

  // show loading
  document.getElementById('freetext-img-loading').style.display = 'flex';

  try {
    const setSpan = t => { const s = document.getElementById('freetext-img-loading').querySelector('span'); if (s) s.textContent = t; };

    // Prepare canvas: upscale + grayscale + Otsu binarize, and detect row bands to slice by
    const prepAndSlice = file => new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const sc = 3, W = img.width * sc, H = img.height * sc;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, W, H);
        const id = ctx.getImageData(0, 0, W, H); const d = id.data;
        const N = W * H;
        const hist = new Array(256).fill(0);
        let sumAll = 0;
        for (let i = 0; i < d.length; i += 4) {
          const g = (0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]) | 0;
          d[i]=d[i+1]=d[i+2]=g; hist[g]++; sumAll += g;
        }
        let wB = 0, sumB = 0, maxVar = -1, thr = 127;
        for (let t = 0; t < 256; t++) {
          wB += hist[t]; if (!wB) continue;
          const wF = N - wB; if (!wF) break;
          sumB += t * hist[t];
          const mB = sumB / wB, mF = (sumAll - sumB) / wF;
          const between = wB * wF * (mB - mF) * (mB - mF);
          if (between > maxVar) { maxVar = between; thr = t; }
        }
        const dark = (sumAll / N) < 128;
        const darkCount = new Int32Array(H);
        for (let y = 0; y < H; y++) {
          let cnt = 0; const off = y * W * 4;
          for (let x = 0; x < W; x++) {
            const i = off + x*4;
            const on = dark ? (d[i] > thr) : (d[i] < thr);
            const px = on ? 0 : 255;
            d[i]=d[i+1]=d[i+2]=px;
            if (on) cnt++;
          }
          darkCount[y] = cnt;
        }
        // remove grid lines (full-height vertical + full-width horizontal borders)
        // so a "|" separator isn't read as a "1" and stuck onto the km value
        for (let x = 0; x < W; x++) {
          let cd = 0;
          for (let yy = 0; yy < H; yy++) if (d[(yy*W + x)*4] === 0) cd++;
          if (cd > H * 0.5) for (let yy = 0; yy < H; yy++) { const i = (yy*W + x)*4; d[i]=d[i+1]=d[i+2]=255; }
        }
        for (let yy = 0; yy < H; yy++) {
          if (darkCount[yy] > W * 0.5) { const off = yy*W*4; for (let x = 0; x < W; x++) { const i = off + x*4; d[i]=d[i+1]=d[i+2]=255; } }
        }
        ctx.putImageData(id, 0, 0);
        // detect text row bands using a dynamic valley threshold that adapts to the image
        let sumDark = 0, cntRows = 0;
        for (let yy = 0; yy < H; yy++) if (darkCount[yy] > W*0.005) { sumDark += darkCount[yy]; cntRows++; }
        const meanDark = cntRows ? sumDark / cntRows : W*0.05;
        const sepLow = meanDark * 0.45, lineThr = W*0.55;
        const minH = Math.round(H*0.01) + 6, gapMax = 3;
        const isText = new Uint8Array(H);
        for (let yy = 0; yy < H; yy++) isText[yy] = (darkCount[yy] > sepLow && darkCount[yy] < lineThr) ? 1 : 0;
        const rows = []; let y = 0;
        while (y < H) {
          if (!isText[y]) { y++; continue; }
          let y0 = y, y1 = y, gap = 0; y++;
          while (y < H && (isText[y] || gap < gapMax)) { if (isText[y]) { y1 = y; gap = 0; } else gap++; y++; }
          if (y1 - y0 >= minH) rows.push([Math.max(0, y0-6), Math.min(H, y1+6)]);
        }
        res({ canvas: c, rows });
      };
      img.src = URL.createObjectURL(file);
    });

    const toBlob = c => new Promise(r => c.toBlob(r, 'image/png'));
    const cropStrip = (canvas, y0, y1) => {
      const h = y1 - y0;
      const s = document.createElement('canvas'); s.width = canvas.width; s.height = h;
      s.getContext('2d').drawImage(canvas, 0, y0, canvas.width, h, 0, 0, canvas.width, h);
      return s;
    };

    setSpan('⏳ מעבד תמונה...');
    const { canvas, rows } = await prepAndSlice(file);

    let digitsOnly = '', fullText = '', _rowTexts = null;
    if (rows.length >= 2) {
      // OCR each detected row separately (single line) — reliable for uniform tables
      let _ocrRow = 0;
      const worker = await Tesseract.createWorker('heb+eng', 1, { logger: m => {
        if (m && m.status && m.status.indexOf('recogniz') !== -1) {
          const pct = Math.min(99, Math.round(((_ocrRow + (m.progress || 0)) / rows.length) * 100));
          setSpan(`⏳ מחלץ נתונים מהתמונה... ${pct}%`);
        }
      }});
      await worker.setParameters({ tessedit_pageseg_mode: '7' });
      _rowTexts = [];
      for (let r = 0; r < rows.length; r++) {
        _ocrRow = r;
        const blob = await toBlob(cropStrip(canvas, rows[r][0], rows[r][1]));
        const { data: { text } } = await worker.recognize(blob);
        _rowTexts.push(text);
        fullText += text + '\n';
      }
      await worker.terminate();
      digitsOnly = fullText;
    } else {
      // fallback: whole-image OCR
      setSpan('⏳ מחלץ נתונים מהתמונה...');
      const blob = await toBlob(canvas);
      const w = await Tesseract.createWorker('heb+eng', 1);
      await w.setParameters({ tessedit_pageseg_mode: '6' });
      const { data: { text } } = await w.recognize(blob);
      await w.terminate();
      fullText = text; digitsOnly = text;
    }

    console.log('[OCR] digits:', digitsOnly);
    console.log('[OCR] full:', fullText);

    if (digitsOnly.trim() || fullText.trim()) {
      // when sliced by rows, parse each row into one car (avoids cross-row mixing & false plates)
      const parsed = _rowTexts
        ? _rowTexts.map(_parseRowText).filter(c => /^\d{7,8}$/.test(c.plate) && !/^00/.test(c.plate) && (c.year || c.km))
        : _parsePlatesFromOcr(fullText || '', digitsOnly || '');
      if (parsed.length) {
        document.getElementById('freetext-pickup-input').value = (fullText || '').trim();
        _freetextParsed = parsed;
        // keep the loader running while pulling vehicle data — so when it ends, everything is ready
        setSpan('⏳ מושך נתוני רכבים... 0%');
        await _fetchGovDataForAll(pct => setSpan(`⏳ מושך נתוני רכבים... ${pct}%`));
      } else {
        document.getElementById('freetext-pickup-input').value = (fullText || '').trim();
        parseFreeTextPickup();
      }
    } else {
      showToast('לא זוהו נתונים בתמונה');
    }
  } catch(e) {
    console.error('extractTextFromImage error', e);
    showToast('שגיאה בחילוץ נתונים מהתמונה');
  }
  document.getElementById('freetext-img-loading').style.display = 'none';
}
window.extractTextFromImage = extractTextFromImage;

// ── Israeli cities list for fuzzy city matching ──
const _IL_CITIES = [
  'אבו גוש','אבו סנאן','אבן יהודה','אור יהודה','אור עקיבא','אזור','אילת','אילות',
  'אכסאל','אל עריאן','אלעד','אלפי מנשה','אמנון','אפרת','אריאל','ארסוף','אשדוד',
  'אשקלון','באקה אל גרביה','באר שבע','באר יעקב','בועינה','בית אל','בית אריה',
  'בית דגן','בית חנן','בית חנינא','בית ג׳אן','בית ג׳ן','בית לחם הגלילית',
  'בית שאן','בית שמש','ביתר עילית','ביתר','בנימינה','בני ברק','בת ים','גבעת זאב',
  'גבעת שמואל','גבעתיים','גדרה','גילה','גן יבנה','גן שורק','גני תקווה',
  'גני הדר','דבורייה','דימונה','דלית אל כרמל','הוד השרון','הרצליה','זכרון יעקב',
  'חדרה','חולון','חיפה','חריש','טבריה','טייבה','טירה','טירת הכרמל','טמרה',
  'יבנה','יהוד','יהוד מונוסון','יוקנעם','יקנעם','ירוחם','ירושלים','ישראל',
  'כוכב יעקב','כוכב יאיר','כפר יונה','כפר כנא','כפר מנדא','כפר סבא','כפר קרע',
  'כפר שמריהו','כפר ברא','כרמיאל','לוד','לקייה','מגאר','מגדל העמק','מגדל',
  'מודיעין','מודיעין עילית','מועאוויה','מטולה','מעלה אדומים','מעלות תרשיחא',
  'מעלות','מצפה רמון','מרכז שפירא','נהריה','נוף הגליל','נס ציונה','נצרת',
  'נצרת עילית','נשר','נתיבות','נתניה','סכנין','עכו','עפולה','עראבה','עראד',
  'ערד','עלי','פוריידיס','פרדס חנה','פתח תקווה','צפת','קדומים','קיסריה',
  'קלנסווה','קצרין','קריית אונו','קריית אתא','קריית ביאליק','קריית גת',
  'קריית טבעון','קריית מוצקין','קריית מלאכי','קריית שמונה','קריית ים',
  'ראש העין','ראשון לציון','רהט','רחובות','רמלה','רמת גן','רמת השרון',
  'רעננה','שדרות','שוהם','שפרעם','תל אביב','תל שבע','תרשיחא',
  'אום אל פחם','ג׳לג׳וליה','ג׳סר א-זרקא','א-טור','אבו דיס',
  'בסמת טבעון','ביר אלמכסור','ג׳ת','זמר','חצור הגלילית','חצור',
  'יפיע','ירכא','כסיפה','מזרחית','מזכרת בתיה','עיבלין','עיינות',
  'סאג׳ור','ריינה','שגב שלום','שייח׳ אברק','טול כרם',
  'אופקים','ביר הדאג','גני אבישי','חורה','יטבתה','מעיליא','פסוטה',
  'ספירא','עוספיה','דייר חנא','כפר מצר','סייד','צור שלום',
];

function _levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i?j?0:j:i));
  for (let i=1;i<=m;i++) for (let j=1;j<=n;j++)
    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}

// Explicit locality → city overrides (kibbutzim/moshavim that the fuzzy
// matcher would otherwise mis-guess). Checked before fuzzy matching.
// To add more: { alias: 'שם היישוב', city: 'העיר המשויכת' }
const _CITY_ALIASES = [
  { alias: 'שנקר', city: 'פתח תקווה' },
  { alias: 'סיבים', city: 'פתח תקווה' },
  // one spelling only, so the same town never appears twice in a list
  { alias: 'טירת כרמל', city: 'טירת הכרמל' },
  { alias: 'עין המפרץ', city: 'עכו' },
  { alias: 'המפרץ', city: 'עכו' },
];

function _fuzzyMatchCity(raw) {
  const t = (raw||'').trim();
  if (!t) return { city:'', rest:'' };
  // explicit alias override — keep the locality name in the address (rest)
  for (const a of _CITY_ALIASES) {
    if (t.includes(a.alias)) return { city: a.city, rest: t, adj: 0 };
  }
  const tWords = t.split(/\s+/);
  // Strip Hebrew preposition prefixes (ב,ל,מ,כ,ו,ה) for matching purposes
  const stripped = tWords.map(w => w.replace(/^[בלמכוה]/, ''));
  let best = { adj: Infinity, city: null, start: -1, wLen: 0 };

  for (const city of _IL_CITIES) {
    const cWords = city.split(' ');

    // A) Match a window of words from the input against the full city name
    // Try both original words and prefix-stripped words
    for (let wLen = Math.min(tWords.length, cWords.length + 1); wLen >= 1; wLen--) {
      for (let start = 0; start + wLen <= tWords.length; start++) {
        // Try with stripped prefixes
        const candidateStripped = stripped.slice(start, start + wLen).join(' ');
        const dStripped = _levenshtein(candidateStripped, city) / Math.max(candidateStripped.length, city.length);
        // Also try original (unstripped)
        const candidateOrig = tWords.slice(start, start + wLen).join(' ');
        const dOrig = _levenshtein(candidateOrig, city) / Math.max(candidateOrig.length, city.length);
        const d = Math.min(dStripped, dOrig);
        // reject clearly non-matching windows early (prevents bonus from masking bad matches)
        if (d > 0.45) continue;
        // prefer matches at end of input; prefer longer word matches
        const adj = d - (start + wLen === tWords.length ? 0.06 : 0) - wLen * 0.04;
        if (adj < best.adj) best = { adj, city, start, wLen };
      }
    }

    // B) Suffix match: input is a suffix of a multi-word city ("שבע" → "באר שבע")
    if (cWords.length > 1) {
      for (let sfx = 1; sfx < cWords.length; sfx++) {
        const citySuffix = cWords.slice(sfx).join(' ');
        const candidate = stripped.join(' ');
        const d = _levenshtein(candidate, citySuffix) / Math.max(candidate.length, citySuffix.length);
        const adj = d + 0.12; // small penalty for partial match
        if (adj < best.adj) best = { adj, city, start: 0, wLen: tWords.length };
      }
    }
  }

  if (best.adj < 0.5 && best.city) {
    const rest = [
      ...tWords.slice(0, best.start),
      ...tWords.slice(best.start + best.wLen)
    ].join(' ').trim();
    return { city: best.city, rest, adj: best.adj };
  }

  // fallback: last word
  return { city: tWords[tWords.length - 1], rest: tWords.slice(0, -1).join(' ').trim(), adj: best.adj };
}

function _fmtKm(raw) {
  const digits = String(raw).replace(/[,\.]/g,'');
  return isNaN(Number(digits)) ? raw : Number(digits).toLocaleString('en-US');
}

// Expand common Israeli city abbreviations (tolerating spaces/gershayim from OCR)
const _CITY_ABBR = [
  [/(^|\s)פ\s*["״׳']?\s*ת(\s|$)/g, '$1פתח תקווה$2'],
  [/(^|\s)ת\s*["״׳']?\s*א(\s|$)/g, '$1תל אביב$2'],
  [/(^|\s)ב\s*["״׳']?\s*ש(\s|$)/g, '$1באר שבע$2'],
  [/(^|\s)ר\s*["״׳']?\s*ג(\s|$)/g, '$1רמת גן$2'],
  [/(^|\s)ר\s*["״׳']?\s*ל(\s|$)/g, '$1ראשון לציון$2'],
  [/(^|\s)כ\s*["״׳']?\s*ס(\s|$)/g, '$1כפר סבא$2'],
  [/(^|\s)ר\s*["״׳']?\s*ע(\s|$)/g, '$1רעננה$2'],
  [/(^|\s)נ\s*["״׳']?\s*ת(\s|$)/g, '$1נתניה$2'],
  [/(^|\s)ק\s*["״׳']?\s*ג(\s|$)/g, '$1קרית גת$2'],
];
function _expandCityAbbr(s) {
  let t = ' ' + String(s) + ' ';
  for (const [re, full] of _CITY_ABBR) t = t.replace(re, full);
  return t.replace(/\s+/g, ' ').trim();
}

// Parse a single OCR'd table row into one car (plate + year + km from that row)
function _parseRowText(text) {
  const t = ' ' + String(text).replace(/[|/\\]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const plateM = t.match(/(?<!\d)(\d{7,8})(?!\d)/);
  const plate = plateM ? plateM[1] : '';
  const yearM = t.match(/\b(19[89]\d|20[0-3]\d)\b/) || t.match(/(19[89]\d|20[0-3]\d)/);
  const year = yearM ? yearM[1] : '';
  // km: prefer a number with a thousands separator (20,682 / 143.724); else a 4-5 digit
  // standalone that isn't the plate or the year (handles 82400 / 47000 / 6046)
  let km = '';
  const kmSep = t.match(/(\d{1,3}[.,]\d{3})/);
  if (kmSep) km = _fmtKm(kmSep[1]);
  else {
    const nums = [...t.matchAll(/(?<!\d)(\d{4,6})(?!\d)/g)].map(m => m[1])
      .filter(n => n !== plate && !/^(19[89]\d|20[0-3]\d)$/.test(n));
    // a 6-digit km with a leading 1 usually comes from a "|" separator read as "1"
    let n = nums[0];
    if (n && n.length === 6 && n[0] === '1') n = n.slice(1);
    if (n) km = _fmtKm(n);
  }
  // location = trailing text after the last number; split into city + street using the
  // same fuzzy city matcher used for free text (keep quotes for abbreviation expansion)
  let loc = String(text).replace(/^[\s\S]*\d/, '')
    .replace(/[|/\\]/g, ' ').replace(/[A-Za-z]/g, ' ').replace(/\s+/g, ' ').trim();
  loc = _expandCityAbbr(loc);
  let city = '', address = '';
  if (loc) {
    const mc = _fuzzyMatchCity(loc);
    if (mc.city && mc.adj !== undefined && mc.adj < 0.4) { city = mc.city; address = (mc.rest || '').replace(/["״׳']/g,'').trim(); }
    else { address = loc.replace(/["״׳']/g,'').trim(); }
  }
  return { plate, type: '', year, color: '', km, test: '', contact: '', city, address };
}

function _extractPhone(str) {
  const m = str.match(/0\d[-\s]?\d{3}[-\s]?\d{4,5}/);
  return m ? m[0].replace(/[\s-]/g,'') : '';
}

// Split raw text into per-car blocks (each block starts with a plate line)
function _splitPickupBlocks(raw) {
  // Normalize: remove header lines like "ענק הרכבים"
  const lines = raw.split('\n')
    .map(l => l.trim().replace(/ענק\s+הרכבים/gi, '').trim())
    .filter(Boolean);
  const blocks = [];
  let cur = [];
  for (const line of lines) {
    if (/^\d{7,8}$/.test(line) && cur.length) { blocks.push(cur); cur = [line]; }
    else cur.push(line);
  }
  if (cur.length) blocks.push(cur);
  return blocks.filter(b => b.length);
}

// Parse a block of lines into a car object
// Structured format (line-by-line):
//   plate / model / year / km / city / [extra lines = address + contact]
/* Cars standing at the Techno external garages always come from the same place
   and the same person, whatever the list says. The address on the list is the
   old one, so it is replaced and the change is written on the car as a note the
   collector reads before he sets off. */
const _TECHNO_RE = /טכנו/;
const _TECHNO = { contact: 'שרית 0525816341', city: 'טירת הכרמל', address: 'עוצמה 11' };
/* Our own yard. The list writes it as "שנקר פ״ת", which the city matcher used to
   twist into some other town — the name is now recognised outright. */
const _SHENKAR_RE = /שנקר/;
