/* קריאת דוחות, צירוף קבצים ונסיעות מבחן
   חלק 13 מתוך 13 של אפליקציית התפעול.
   הקבצים נטענים לפי הסדר ומתנהגים בדיוק כמו קובץ אחד — אין לשנות את הסדר. */
const _SHENKAR = { city: 'פתח תקווה', address: 'שנקר 15' };

/* ── קריאת דוח מצבת רכב ─────────────────────────────────────────────
   שורה אחת לכל רכב, בסדר: מס' רכב · יצרן · דגם · שנה · ק"מ · צבע ·
   נפח מנוע · מגרש · מחירון. כשמעתיקים מ-PDF בעברית הסדר של המילים
   הלועזיות מתהפך, ולכן מרכיבים אותן מחדש.
─────────────────────────────────────────────────────────────────────── */

// כתובות המגרשים — למלא פעם אחת, ומשם כל דוח נקלט עם ניווט לנהג
/* שם המגרש בדוח אינו כתובת. הטבלה מופרדת לפי חברה — לכלמוביל וליורודרייב
   יכולים להיות סניפים באותה עיר בכתובות שונות, ולכן אסור לערבב ביניהן.
   כתובת שאינה רשומה כאן נלמדת לבד מרכבים שכבר נאספו מאותו מגרש ואותה
   חברה (ראה _yardAddrFromHistory). */
/* המפתח הוא הצירוף שמופיע בדוח או ברישום החופשי. strong=true מחליף את
   הכתובת תמיד; בלעדיו ההחלפה נעשית רק כשאין כתובת תקינה משלה. הסדר חשוב:
   הצירוף הארוך והמדויק נבדק לפני שם עיר בודד. */
const _YARD_ADDR_BY_SOURCE = {
  'כלמוביל': {
    'טרייד ירושלים': { city: 'ירושלים', address: 'גנרל פייר קניג 36', strong: true },
    'טרייד נתניה':   { city: 'נתניה',   address: 'אורג 16',           strong: true },
    'טרייד עפולה':   { city: 'עפולה',   address: 'קדרון 1',           strong: true },
    'טרייד נשר':     { city: 'נשר',     address: 'השיש 10',           strong: true },
    // מגרש רעננה נרשם כ"אוטורן" / "טרייד אין אוטורן"
    'אוטורן':        { city: 'רעננה',   address: 'הנופר 6',           strong: true },
    'אוטו רן':       { city: 'רעננה',   address: 'הנופר 6',           strong: true },
    'רעננה':         { city: 'רעננה',   address: 'הנופר 6',           strong: true },
    'עין המפרץ':     { city: 'עכו',     address: 'החרש 3',            strong: true },
    // כלמוביל בית אמות — נרשם גם כ"ב.אמות" וגם כ"ב אמות"
    'בית אמות':      { city: 'חיפה',    address: 'דרך יפו 157',       strong: true },
    'ב.אמות':        { city: 'חיפה',    address: 'דרך יפו 157',       strong: true },
    'ב אמות':        { city: 'חיפה',    address: 'דרך יפו 157',       strong: true },
    // מגרש עכו נרשם כ"גפי", "ג.פ.י" או "טסט"
    'ג.פ.י':         { city: 'עכו',     address: 'החרש 3',            strong: true },
    'גפי':           { city: 'עכו',     address: 'החרש 3',            strong: true },
    'טסט':           { city: 'עכו',     address: 'החרש 3',            strong: true },
    'המפרץ':         { city: 'עכו',     address: 'החרש 3',            strong: true },
    'מפרץ':          { city: 'עכו',     address: 'החרש 3',            strong: true },
    'גאקו חיפה':     { city: 'עכו',     address: 'החרש 3',            strong: true },
    // שם עיר בלבד — משמש רק כשאין כתובת תקינה ברישום
    'עכו':           { city: 'עכו',     address: 'החרש 3' },
    'נשר':           { city: 'נשר',     address: 'השיש 10' },
    'ירושלים':       { city: 'ירושלים', address: 'גנרל פייר קניג 36' },
    'מודיעין':       { city: 'מודיעין מכבים רעות', address: 'המכונאי 21' },
    'עפולה':         { city: 'עפולה',   address: 'קדרון 1' },
    // "טרייד" לבדו הוא מגרש נשר, אבל רק כשאין ברישום כתובת משלו —
    // אחרת הוא היה חוטף גם רישומים כמו "כלמוביל טרייד - הנופר 6 רעננה"
    'טרייד':         { city: 'נשר',     address: 'השיש 10' },
  },
  'יורודרייב': {},
};

/* שם המגרש ואיש הקשר הקבוע שלו, לפי עיר וכתובת. ההיסטוריה לא תמיד
   מספיקה — כשהרישום מגיע בלי שם חברה אין ממה ללמוד — ולכן המידע הזה
   יושב במקום אחד, ומשם הוא מגיע לכרטיס הרכב ולפנקס הכתובות. */
const _YARD_INFO = {
  'ירושלים|גנרל פייר קניג 36':      { name: 'כלמוביל טרייד אין ירושלים' },
  'נתניה|אורג 16':                  { name: 'כלמוביל טרייד אין נתניה' },
  'עפולה|קדרון 1':                  { name: 'כלמוביל טרייד אין עפולה' },
  'נשר|השיש 10':                    { name: 'כלמוביל טרייד אין נשר' },
  'רעננה|הנופר 6':                  { name: 'כלמוביל טרייד אין אוטורן' },
  'מודיעין מכבים רעות|המכונאי 21':  { name: 'כלמוביל מודיעין' },
  'עכו|החרש 3':                     { name: 'גאקו חיפה', contact: 'סלאח' },
  'חיפה|דרך יפו 157':               { name: 'כלמוביל בית אמות', contact: 'מאור 0546510509' },
};
const _yardInfoFor = (city, address) =>
  _YARD_INFO[`${String(city || '').trim()}|${String(address || '').trim()}`] || null;
const _yardContactFor = (city, address) => _yardInfoFor(city, address)?.contact || '';
const _yardNameFor = (city, address) => _yardInfoFor(city, address)?.name || '';

/* מתרגם רישום חופשי לכתובת הקבועה של המגרש. מחזיר null כשאין התאמה. */
function _yardCanon(source, city, address) {
  const src = String(source || '').trim();
  // רישום ישן נשמר לעיתים בלי חברה — המגרשים שלנו הם של כלמוביל
  const t = _YARD_ADDR_BY_SOURCE[src] || (src ? null : _YARD_ADDR_BY_SOURCE['כלמוביל']);
  if (!t) return null;
  // "טרייד אין נתניה" זהה ל"טרייד נתניה" — המילה "אין" היא חלק מהשם המסחרי
  const hay = [address, city].filter(Boolean).join(' ')
    .replace(/\u05d0\u05d9\u05df/g, ' ').replace(/\s+/g, ' ').trim();
  const tok = _addrTokens(city, address);
  const hasOwnAddress = !!(tok.num && tok.names.length);
  for (const k of Object.keys(t)) {
    if (!hay.includes(k)) continue;
    if (!t[k].strong && hasOwnAddress) continue;
    return { city: t[k].city, address: t[k].address };
  }
  return null;
}

/* לומד את הכתובת של מגרש מרכבים קודמים: אותה חברה, אותה עיר, כתובת עם
   מספר בית. כך מגרש שכבר אספנו ממנו מקבל את הכתובת שלו בלי להזין אותה. */
function _yardAddrFromHistory(source, city, yard) {
  const pool = [...(_pickupArchiveCars || []), ...(_pickupAllCars || [])];
  const norm = t => String(t || '').trim();
  const cand = pool.filter(c =>
    norm(c.source) === norm(source) &&
    (city ? norm(_pickupCity(c)) === norm(city) : norm(c.address).includes(norm(yard))) &&
    /\d/.test(norm(c.address)));
  if (!cand.length) return null;
  // הכתובת שחוזרת הכי הרבה פעמים היא הכתובת האמיתית של המגרש
  const tally = {};
  cand.forEach(c => { const a = _cleanStreet(c.address); tally[a] = (tally[a] || 0) + 1; });
  const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  const hit = cand.find(c => _cleanStreet(c.address) === best[0]);
  return { city: _pickupCity(hit) || city, address: best[0] };
}

/* מחזיר עיר וכתובת למגרש, לפי החברה. קודם הטבלה הקבועה, ואם אין בה
   כתובת — משלימים מההיסטוריה. */
function _yardLookup(source, yard) {
  const table = _YARD_ADDR_BY_SOURCE[source] || {};
  const key = Object.keys(table).find(k => String(yard || '').includes(k));
  const base = key ? { ...table[key] } : { city: '', address: '' };
  // שם המגרש הוא לפעמים שם העיר עצמה — אז זו העיר, גם בלי רשומה בטבלה
  if (!base.city && _IL_CITIES.includes(String(yard || '').trim())) base.city = String(yard).trim();
  if (!base.address) {
    const learned = _yardAddrFromHistory(source, base.city, yard);
    if (learned) { base.city = base.city || learned.city; base.address = learned.address; }
  }
  if (!base.address && yard) base.address = yard;
  return base.city || base.address ? base : null;
}

const _zivNum = t => Number(String(t).replace(/,/g, ''));
const _zivIsNum = t => /^[\d,]+$/.test(t);
const _zivHasLatin = t => /[A-Za-z]/.test(t);

// מילה לועזית שהועתקה מ-PDF עברי חוזרת הפוכה: SDRIVE18I הופך ל-I18SDRIVE
function _zivFixLatin(tokens) {
  return tokens.slice().reverse().map(t =>
    (t.match(/[A-Za-z]+|\d+|[^A-Za-z\d]+/g) || [t]).reverse().join(''));
}

// הדגם בדוח בנוי מחלק לועזי (שם הדגם) וחלק עברי (סוג מרכב ומנוע)
function _zivModel(tokens) {
  const out = []; let run = []; const fromRun = [];
  for (const t of tokens) {
    // מספר באמצע שם לועזי שייך לשם עצמו — TIGGO 7 PRO
    if (_zivHasLatin(t) || (run.length && /^\d+$/.test(t))) run.push(t);
    else {
      if (run.length) { const f = _zivFixLatin(run); out.push(...f); fromRun.push(...f.map(() => true)); run = []; }
      out.push(t); fromRun.push(false);
    }
  }
  if (run.length) { const f = _zivFixLatin(run); out.push(...f); fromRun.push(...f.map(() => true)); run = []; }
  return { latin: out.filter((t, i) => fromRun[i]).join(' ').trim(),
           hebrew: out.filter((t, i) => !fromRun[i]).join(' ').trim() };
}

// מחזיר רכב, או null אם השורה אינה שורת דוח
function _parseZivLine(line) {
  const t = String(line).trim().split(/\s+/).filter(Boolean);
  if (t.length < 8 || !/^\d{7,8}$/.test(t[0])) return null;

  // העוגן: השנה היא המספר בן 4 הספרות שאחריו מגיע הקילומטראז'.
  // בלי העוגן הזה נפח מנוע כמו 1998 היה נקרא בטעות כשנה.
  let y = -1;
  for (let i = 2; i < t.length - 4; i++) {
    if (/^\d{4}$/.test(t[i]) && _zivNum(t[i]) >= 1990 && _zivNum(t[i]) <= 2035 && _zivIsNum(t[i + 1])) { y = i; break; }
  }
  if (y < 0) return null;

  const hasPrice = _zivIsNum(t[t.length - 1]);
  const end = hasPrice ? t.length - 1 : t.length;
  // מהסוף אחורה: מחירון · שם המגרש · נפח מנוע · צבע
  let e = end - 1;
  while (e > y + 1 && !/^\d{3,4}$/.test(t[e])) e--;
  const yard  = t.slice(e + 1, end).join(' ');
  const color = t.slice(y + 2, e).join(' ');

  // יצרן: מילה אחת, ולפעמים גם ארץ הייצור ("צ'רי סין")
  const makerLen = /^(סין|קוריאה|יפן|צרפת|ספרד|גרמניה|ארה"ב|ארה״ב)$/.test(t[2] || '') ? 2 : 1;
  const maker = t.slice(1, 1 + makerLen).join(' ');
  const { latin, hebrew } = _zivModel(t.slice(1 + makerLen, y));

  const car = { plate: t[0], type: [maker, latin].filter(Boolean).join(' ').trim(),
    year: t[y], color, km: _fmtKm(String(_zivNum(t[y + 1]))),
    contact: '', city: '', address: '', note: '', source: 'יורודרייב' };

  // המגרש הוא שם ולא כתובת — עד שממלאים את הטבלה למעלה, השם נשמר
  // בשדה הכתובת כדי שלא ילך לאיבוד, והמנהל יכול להשלים ידנית
  const yl = _yardLookup(car.source, yard);
  if (yl) { car.city = yl.city; car.address = yl.address; }
  else if (yard) car.address = yard;
  // סוג המרכב והמנוע כבר מופיעים בשם הרכב — אין צורך בהערה נוספת
  return car;
}

// גיליון אקסל: כאן יש עמודות אמיתיות, ולכן קוראים לפי שמות הכותרות
// ולא לפי מיקום — כך הדוח נקרא גם אם יתווספו או יזוזו עמודות.
function _parseZivSheet(rows) {
  const clean = v => String(v == null ? '' : v).replace(/\u00a0/g, ' ').trim();
  const h = rows.findIndex(r => {
    const j = r.map(clean).join(' ');
    return j.includes('יצרן') && j.includes('מגרש');
  });
  if (h < 0) return null;

  const head = rows[h].map(clean);
  const find = (...names) => head.findIndex(c => names.some(n => c.includes(n)));
  const col = {
    maker: find('יצרן'), model: find('דגם'), year: find('שנה'),
    km: find('ק"מ', 'ק״מ', 'קמ'), color: find('צבע'), yard: find('מגרש'),
  };
  if (col.maker < 0 || col.yard < 0) return null;

  const cars = [];
  for (const r of rows.slice(h + 1)) {
    const cells = r.map(clean);
    // עמודת מספר הרכב אינה תמיד מסומנת בכותרת — מזהים אותה לפי התוכן
    const pi = cells.findIndex(c => /^\d{7,8}$/.test(c));
    if (pi < 0 || pi >= col.maker) continue;
    const yard = col.yard >= 0 ? cells[col.yard] : '';
    const car = {
      plate: cells[pi],
      type: [cells[col.maker], cells[col.model]].filter(Boolean).join(' ').trim(),
      year: col.year >= 0 ? cells[col.year] : '',
      color: col.color >= 0 ? cells[col.color] : '',
      km: col.km >= 0 && cells[col.km] ? _fmtKm(cells[col.km].replace(/,/g, '')) : '',
      contact: '', city: '', address: '', note: '', source: 'יורודרייב',
    };
    const yl = _yardLookup(car.source, yard);
    if (yl) { car.city = yl.city; car.address = yl.address; }
    else if (yard) car.address = yard;
    cars.push(car);
  }
  return cars.length ? cars : null;
}

// טקסט שלם: אם לפחות שורה אחת נראית כמו דוח — קוראים את כולו ככה
function _parseZivReport(raw) {
  const cars = String(raw).split(/\r?\n/).map(_parseZivLine).filter(Boolean);
  return cars.length ? cars : null;
}

/* ── צירוף קובץ: PDF, אקסל או CSV ────────────────────────────────── */
let _pdfjsLoading = null;
// הספרייה יושבת אצלנו ולא ב-CDN, כדי שהקריאה תעבוד גם בלי רשת חיצונית
function _loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjsLoading) return _pdfjsLoading;
  _pdfjsLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/pdf.min.js';
    s.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else reject(new Error('קורא ה-PDF לא נטען'));
    };
    s.onerror = () => reject(new Error('קורא ה-PDF לא נטען'));
    document.head.appendChild(s);
  });
  return _pdfjsLoading;
}

// ב-PDF אין שורות — יש מילים עם מיקום. מקבצים לפי גובה ומסדרים מימין
// לשמאל, וכך מקבלים בדיוק את מה שמתקבל בהעתקה ידנית.
async function _pdfToLines(buf) {
  const pdfjs = await _loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const rows = {};
    for (const item of content.items) {
      const str = (item.str || '').trim();
      if (!str) continue;
      const y = Math.round(item.transform[5]);
      (rows[y] = rows[y] || []).push({ x: item.transform[4], w: item.width, h: item.height, str });
    }
    // pdf.js מפרק את השורה לחתיכות קטנות. חתיכות צמודות הן אותה מילה,
    // ורק רווח אמיתי בין שתי חתיכות מפריד בין מילים.
    for (const y of Object.keys(rows).sort((a, b) => b - a)) {
      const items = rows[y].sort((a, b) => b.x - a.x);
      let line = '';
      items.forEach((it, i) => {
        if (i) {
          const prev = items[i - 1];
          // מרווח חיובי גדול = רווח אמיתי. מרווח שלילי גדול = מעבר בין
          // כיוון כתיבה עברי ללועזי, וגם הוא מפריד בין מילים.
          const gap = prev.x - (it.x + it.w);
          if (Math.abs(gap) > (it.h || 10) * 0.15) line += ' ';
        }
        line += it.str;
      });
      lines.push(line);
    }
  }
  return lines;
}

async function extractTextFromPickupFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const label = document.getElementById('freetext-file-label');
  const load  = document.getElementById('freetext-file-loading');
  if (label) label.style.display = 'none';
  if (load) load.style.display = 'flex';
  try {
    const buf = await file.arrayBuffer();
    let lines = [], sheetCars = null;
    if (/\.pdf$/i.test(file.name)) {
      lines = await _pdfToLines(buf);
    } else {
      if (typeof XLSX === 'undefined') throw new Error('ספריית האקסל עדיין נטענת — נסה שוב עוד רגע');
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      sheetCars = _parseZivSheet(rows);
      lines = rows.map(r => r.map(c => String(c).replace(/\u00a0/g, ' ').trim()).filter(Boolean).join(' '))
        .filter(Boolean);
    }
    const ta = document.getElementById('freetext-pickup-input');
    ta.value = lines.join('\n');
    ta.style.display = 'block';
    document.getElementById('pickup-detect-btn').style.display = 'block';
    const found = sheetCars ? sheetCars.length : (_parseZivReport(ta.value) || []).length;
    showToast(found ? `📎 נקראו ${found} רכבים מהקובץ` : '📎 הקובץ נקרא — לחץ ״זהה רכבים״', 4000);
    if (found) parseFreeTextPickup(sheetCars);
  } catch (err) {
    console.error('pickup file read failed', err);
    showToast(/\.pdf$/i.test(file.name)
      ? 'לא הצלחתי לקרוא את ה-PDF. פתח אותו, סמן הכל, העתק — והדבק כאן בתיבה'
      : 'שגיאה בקריאת הקובץ: ' + (err.message || err), 7000);
    const ta = document.getElementById('freetext-pickup-input');
    if (ta) { ta.style.display = 'block'; document.getElementById('pickup-detect-btn').style.display = 'block'; }
  } finally {
    if (label) label.style.display = 'flex';
    if (load) load.style.display = 'none';
    input.value = '';
  }
}
window.extractTextFromPickupFile = extractTextFromPickupFile;

function _parsePickupBlock(lines) {
  const car = { plate:'', type:'', year:'', color:'', km:'', contact:'', city:'', address:'', note:'', source:'כלמוביל' };
  const extra = [];
  let step = 0; // 0=plate 1=model 2=year 3=km 4=city 5+=extra

  for (const line of lines) {
    if (step === 0 && /^\d{7,8}$/.test(line)) { car.plate = line; step = 1; continue; }
    if (step === 1) { car.type = line; step = 2; continue; }
    if (step === 2 && /^(19[89]\d|20[0-3]\d)$/.test(line)) { car.year = line; step = 3; continue; }
    if (step <= 3 && /^[\d,]+$/.test(line)) { car.km = _fmtKm(line); step = 4; continue; }
    if (step === 4) {
      // skip lines that are clearly business/garage descriptions (not city lines)
      const _NON_CITY_LINE = /^(מוסכים|חניה|גרז|מוסך|חיצוניים|פנימיים)/;
      if (_NON_CITY_LINE.test(line)) { extra.push(line); continue; }
      const { city, rest, adj } = _fuzzyMatchCity(line);
      // if match is very poor (probably a notes/business line), keep trying next lines
      if (adj !== undefined && adj >= 0.45) { extra.push(line); continue; }
      car.city = city;
      if (rest) extra.push(rest);
      step = 5; continue;
    }
    extra.push(line);
  }

  // parse extra lines for address + phone + contact name
  const extraFull = extra.join(' ');
  const phone = _extractPhone(extraFull);
  if (phone) { car.contact = phone; }
  // strip phone from extra, rest is address
  const addrRaw = extraFull.replace(/0\d[-\s]?\d{3}[-\s]?\d{4,5}/g,'').replace(/\s+/g,' ').trim();
  if (addrRaw) car.address = addrRaw;

  // fallback: if no structured parse succeeded, try heuristic on joined text
  if (!car.plate && !car.type) {
    const joined = lines.join(' ');
    const plateM = joined.match(/\b(\d{7,8})\b/); if (plateM) car.plate = plateM[1];
    const yearM = joined.match(/\b(19[89]\d|20[0-3]\d)\b/); if (yearM) car.year = yearM[1];
    const kmM = joined.match(/\b([\d,]{3,})\b/); if (kmM && !car.km) car.km = _fmtKm(kmM[1]);
    const ph = _extractPhone(joined); if (ph) car.contact = ph;
  }

  if (lines.some(l => _SHENKAR_RE.test(l))) {
    car.city = _SHENKAR.city;
    car.address = _SHENKAR.address;
  }

  if (lines.some(l => _TECHNO_RE.test(l))) {
    const wasAddr = [car.address, car.city].filter(Boolean).join(', ');
    const nowAddr = `${_TECHNO.address}, ${_TECHNO.city}`;
    car.contact = _TECHNO.contact;
    car.city = _TECHNO.city;
    car.address = _TECHNO.address;
    car.note = wasAddr && wasAddr !== nowAddr
      ? `לוודא שהרכב נמצא, כתובת שונתה מ(${wasAddr}) ל(${nowAddr})`
      : 'לוודא שהרכב נמצא — מוסכים חיצוניים טכנו';
  }

  return car;
}

// החלפת הספק של רכב בתצוגה המקדימה, לפני השמירה
function _freetextSetSource(i, name) {
  if (!_freetextParsed[i]) return;
  _freetextParsed[i].source = _freetextParsed[i].source === name ? '' : name;
  // הכתובת ואיש הקשר תלויים בחברה — החלפת חברה מחשבת אותם מחדש
  _freetextFillAddresses();
  _freetextFillContacts();
  _renderFreetextPreview();
}
window._freetextSetSource = _freetextSetSource;

/* אנשי קשר מרכבים שכבר טיפלנו בהם, לפי חברה ועיר. זה המקור שעובד גם
   כשאין מספר בית — למשל מגרש שנרשם בשם ולא בכתובת. אותה עיר בשתי חברות
   שונות לא מתערבבת, כי החברה היא חלק מהתנאי. */
function _historyContactsFor(car) {
  const city = _pickupCity(car), src = String(car.source || '').trim();
  if (!city || !src) return [];
  const pool = [...(_pickupArchiveCars || []), ...(_pickupAllCars || [])];
  const same = pool.filter(c =>
    String(c.source || '').trim() === src &&
    _pickupCity(c) === city &&
    String(c.contact || '').trim());
  if (!same.length) return [];
  const tally = {};
  same.forEach(c => _contactParts(c.contact).forEach(t => { tally[t] = (tally[t] || 0) + 1; }));
  return Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
}

/* משלים כתובת למגרש שנרשם בשם בלבד. קודם הטבלה הקבועה של החברה (שם
   מגרש → כתובת מלאה), ואם אין — לומדים מרכבים שכבר נאספו מאותה חברה
   ואותה עיר. שם המגרש נבדק גם מול הכתובת וגם מול העיר שזוהתה, כי בדוח
   הוא יכול להופיע בשני המקומות ("טרייד" / "טרייד נשר"). */
function _freetextFillAddresses() {
  for (const c of _freetextParsed) {
    c._unknownYard = '';
    const raw = String(c.address || '').trim();
    const canon = _yardCanon(c.source, c.city, c.address);
    if (canon) {
      c.city = canon.city; c.address = canon.address; c._addrFromHistory = true;
      // שם המגרש: מהטבלה אם הוא מוכר, אחרת מה שנרשם בפועל
      c.yard = _yardNameFor(canon.city, canon.address) || c.yard || raw;
      continue;
    }
    if (/\d/.test(raw)) continue;   // כבר כתובת מלאה
    const city = _pickupCity(c);
    if (!city) { if (raw) c._unknownYard = raw; continue; }
    const learned = _yardAddrFromHistory(c.source, city, c.address);
    if (learned && learned.address) {
      c.yard = c.yard || raw;
      c.address = learned.address; c._addrFromHistory = true; continue;
    }
    // מגרש שנרשם בשם, לא מוכר בטבלה ולא נאסף ממנו בעבר — צריך את תשומת ליבך
    if (raw) { c._unknownYard = raw; c.yard = c.yard || raw; }
  }
}

/* אנשי הקשר שנלמדו מולאים כבר בחלונית התצוגה המקדימה, כדי שיהיה
   אפשר לראות ולתקן אותם לפני שהרכבים עולים — ולא רק אחרי. */
function _freetextFillContacts() {
  for (const c of _freetextParsed) {
    let known = _knownContactsFor(c);
    if (!known.length) known = _historyContactsFor(c);
    if (!known.length) {
      const fixed = _yardContactFor(_pickupCity(c), c.address);
      if (fixed) known = [fixed];
    }
    if (!known.length) { c._knownContacts = ''; continue; }
    c._knownContacts = known.join(' · ');
    c.contact = _dedupContacts([c.contact || '', ...known].join(' · '));
  }
}

function _renderFreetextPreview() {
  const preview = document.getElementById('freetext-pickup-preview');
  // מגרשים שלא זוהו — מוצגים למעלה כדי שלא יעלו רכבים עם כתובת חסרה
  const unknown = [...new Set(_freetextParsed.filter(c => c._unknownYard).map(c => c._unknownYard))];
  const warn = unknown.length
    ? `<div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:12px;padding:11px 13px;margin-bottom:12px">
         <div style="font-size:14px;font-weight:900;color:#92400e">⚠️ מגרש חדש שאיני מזהה</div>
         <div style="font-size:13px;font-weight:700;color:#92400e;margin-top:4px">
           ${unknown.map(u => `<span style="background:#fff;border-radius:999px;padding:3px 10px;margin-left:5px;display:inline-block">${esc(u)}</span>`).join('')}
         </div>
         <div style="font-size:12.5px;font-weight:700;color:#92400e;margin-top:6px">אין לו כתובת קבועה ולא אספנו ממנו בעבר. תשלים כתובת ואיש קשר בשדות למטה, או תגיד לי לאיזו כתובת לשייך אותו והוא ייקלט אוטומטית מהפעם הבאה.</div>
       </div>`
    : '';
  preview.innerHTML = warn + _freetextParsed.map((c, i) => `
    <div style="background:var(--surface2);border:1.5px solid ${c._unknownYard ? '#f59e0b' : 'var(--border)'};border-radius:12px;padding:12px;margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="font-size:11px;font-weight:700;color:var(--muted)">רכב ${i+1}${c._fetched ? ' ✅' : c._fetching ? ' ⏳' : ''}</div>
        <div style="display:flex;gap:5px">
          ${(c.source ? _PICKUP_SOURCES.filter(src => src.name === c.source) : _PICKUP_SOURCES)
            .map(src => `<button type="button" onclick="_freetextSetSource(${i},'${src.name}')" title="${c.source ? 'לחיצה מבטלת את הזיהוי' : src.name}" style="display:inline-flex;align-items:center;justify-content:center;width:92px;height:28px;padding:0;border-radius:7px;border:2px solid ${c.source === src.name ? src.color : 'var(--border)'};background:${src.color};cursor:pointer;overflow:hidden;opacity:${c.source === src.name ? 1 : .4}">${_PICKUP_LOGOS[src.name] || src.name}</button>`).join('')}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${[
          ['לוחית','plate'],['סוג','type'],['שנה','year'],['צבע','color'],
          ['קמ','km'],['תוקף טסט','test'],['איש קשר','contact'],['שם המקום','yard'],
          ['עיר','city'],['כתובת','address']
        ].map(([label,key]) => `
          <div>
            <div style="font-size:10px;color:var(--muted)">${label}</div>
            <input type="text" value="${(c[key]||'').replace(/"/g,'&quot;')}" oninput="_freetextParsed[${i}].${key}=this.value"
              style="width:100%;padding:5px 7px;border-radius:7px;border:1px solid var(--border);background:var(--card);color:var(--text);font-family:Heebo,sans-serif;font-size:13px;box-sizing:border-box">
          </div>`).join('')}
      </div>
      ${c._unknownYard ? `<div style="margin-top:6px;font-size:12.5px;font-weight:800;color:#92400e">⚠️ "${esc(c._unknownYard)}" — מגרש שאיני מזהה, השלם כתובת ואיש קשר</div>` : ''}
      ${c._knownContacts ? `<div style="margin-top:6px;font-size:12px;font-weight:800;color:#1d4ed8">👤 מולא לפי הכתובת: ${esc(c._knownContacts)}</div>` : ''}
      ${c.note ? `<div style="margin-top:8px;background:#fef08a;color:#000;border-right:5px solid #eab308;border-radius:8px;padding:8px 10px;font-size:13px;font-weight:800">📝 ${esc(c.note)}</div>
        <input type="text" value="${(c.note||'').replace(/"/g,'&quot;')}" oninput="_freetextParsed[${i}].note=this.value"
          style="width:100%;margin-top:6px;padding:5px 7px;border-radius:7px;border:1px solid var(--border);background:var(--card);color:var(--text);font-family:Heebo,sans-serif;font-size:13px;box-sizing:border-box">` : ''}
    </div>`).join('');
  document.getElementById('freetext-pickup-save-btn').style.display = 'block';
  document.getElementById('freetext-pickup-save-btn').textContent = `✅ שמור ${_freetextParsed.length} רכבים`;
}

async function parseFreeTextPickup(readyCars) {
  const raw = document.getElementById('freetext-pickup-input').value.trim();
  if (!raw && !(Array.isArray(readyCars) && readyCars.length)) return showToast('נא להזין טקסט');

  // דוח מצבת רכב — שורה אחת לכל רכב. אם זה הפורמט, קוראים אותו ישירות
  const zivCars = (Array.isArray(readyCars) && readyCars.length) ? readyCars : _parseZivReport(raw);
  if (zivCars) {
    _freetextParsed = zivCars;
  } else {
    const lineBlocks = _splitPickupBlocks(raw);
    _freetextParsed = lineBlocks.map(_parsePickupBlock).filter(c => c.plate || c.type || c.contact);
  }

  // יישור הכתובות שזוהו לשמות הרחובות הרשמיים מהמילון, לפני התצוגה —
  // כך רואים (ואפשר לתקן) את הכתובת הסופית עוד לפני השמירה
  _streetAcLoad();
  if (_streetsLoading) await _streetsLoading.catch(() => {});
  for (const c of _freetextParsed) {
    c.address = String(c.address || '').replace(/([א-ת])(\d)/g, '$1 $2').trim();
    if (c.city && c.address) c.address = _snapAddressToStreets(c.city, c.address);
  }
  _freetextFillAddresses();
  _freetextFillContacts();

  const preview = document.getElementById('freetext-pickup-preview');
  if (!_freetextParsed.length) { preview.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">לא זוהו רכבים</div>'; return; }

  _renderFreetextPreview();

  // fetch gov.il data for each car that has a plate
  for (let i = 0; i < _freetextParsed.length; i++) {
    const car = _freetextParsed[i];
    if (!car.plate) continue;
    car._fetching = true;
    _renderFreetextPreview();
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
    car._fetching = false;
    _renderFreetextPreview();
  }
}
window.parseFreeTextPickup = parseFreeTextPickup;

async function saveFreeTextPickup() {
  if (!_freetextParsed.length) return;
  const btn = document.getElementById('freetext-pickup-save-btn');
  btn.disabled = true;
  try {
    const _norm = p => String(p||'').replace(/\D/g,'');
    const active = _pickupAllCars || [];
    const archived = _pickupArchiveCars || [];
    let added = 0;
    const dupExists = [], dupCollected = [];
    for (const car of _freetextParsed) {
      const pn = _norm(car.plate);
      if (!pn) continue;
      if (archived.some(c => _norm(c.plate) === pn)) { dupCollected.push(car); continue; }
      if (active.some(c => _norm(c.plate) === pn)) { dupExists.push(car); continue; }
      // שדות עבודה פנימיים (מתחילים ב-_) נשארים במסך ולא נכתבים למסד
      const clean = Object.fromEntries(Object.entries(car).filter(([k]) => !k.startsWith('_')));
      await _addDoc(_colRef('pickup_cars'), { ...clean, createdBy: currentUser.name, createdAt: _serverTs() });
      added++;
    }
    closeModal('modal-freetext-pickup');
    if (added) showToast(`✅ ${added} רכבים נוספו`);
    _showPickupDupBanner(dupExists, dupCollected);
  } catch(e) { showToast('שגיאה בשמירה'); }
  btn.disabled = false;
}
window.saveFreeTextPickup = saveFreeTextPickup;

function _showPickupDupBanner(dupExists, dupCollected) {
  const banner = document.getElementById('pickup-dup-banner');
  if (!banner) return;
  if (!dupExists.length && !dupCollected.length) { banner.style.display = 'none'; banner.innerHTML = ''; return; }
  const line = (c, collected) => `<div style="margin:2px 0">🚗 <b>${esc(c.plate||'')}</b>${c.type ? ' — ' + esc(c.type) : ''} — ${collected ? 'רכב זה קיים וכבר נאסף' : 'רכב זה קיים'}</div>`;
  banner.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
    <div style="flex:1">⚠️ לא נוספו רכבים כפולים:${dupExists.map(c => line(c, false)).join('')}${dupCollected.map(c => line(c, true)).join('')}</div>
    <button onclick="document.getElementById('pickup-dup-banner').style.display='none'" style="background:#854d0e;color:#fff;border:none;border-radius:8px;width:24px;height:24px;font-size:13px;cursor:pointer;flex-shrink:0;line-height:1">✕</button>
  </div>`;
  banner.style.display = 'block';
}

// ── Send pickup car to driver ──
const _PICKUP_DRIVER_LIST = ['עופר', 'גיל', 'איתי', 'הילה'];
// הגרר אינו נהג במערכת — הוא יעד איסוף חיצוני. רכב שנשלח אליו מסומן
// בקוביה בצבע נפרד, וחלונית השיתוף נפתחת מיד כדי לשלוח לו את האישורים.
const _TOW_NAME = 'גרר';

let _pendingSendCarId = null;

function openSendPickupToDriver(id) {
  const car = _pickupAllCars.find(c => c.id === id);
  if (!car) return;
  // רכבי יורודרייב אינם דורשים אישור העברת בעלות — נשלחים ישר לנהג
  if (!car.doc && car.source !== 'יורודרייב') {
    _pendingSendCarId = id;
    document.getElementById('pickup-doc-required-preview').innerHTML = '';
    openModal('modal-pickup-doc-required');
    return;
  }
  _showDriverPicker(car);
}
window.openSendPickupToDriver = openSendPickupToDriver;

function _showDriverPicker(car) {
  const id = car.id;
  const list = document.getElementById('pickup-driver-list');
  list.innerHTML = _PICKUP_DRIVER_LIST.map(name =>
    `<button onclick="sendPickupToDriver('${id}','${name}')" style="background:${car.assignedDriver===name?'#1e40af':'var(--surface2)'};color:${car.assignedDriver===name?'#fff':'var(--text)'};border:1.5px solid var(--border);border-radius:12px;padding:14px;font-family:Heebo,sans-serif;font-size:15px;font-weight:700;cursor:pointer;text-align:right">
      ${car.assignedDriver===name?'✅ ':''} ${name}
    </button>`
  ).join('') +
    `<button onclick="sendPickupToDriver('${id}','${_TOW_NAME}')" style="background:${car.assignedDriver===_TOW_NAME?'#7c3aed':'#ede9fe'};color:${car.assignedDriver===_TOW_NAME?'#fff':'#5b21b6'};border:1.5px solid #7c3aed;border-radius:12px;padding:14px;font-family:Heebo,sans-serif;font-size:15px;font-weight:800;cursor:pointer;text-align:right">
      ${car.assignedDriver===_TOW_NAME?'✅ ':'🚛 '}${_TOW_NAME}
    </button>`;
  openModal('modal-send-pickup-driver');
}

async function attachDocAndSend(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('pickup-doc-required-preview');
  preview.innerHTML = '<div style="color:var(--muted);font-size:13px">מעלה...</div>';
  const reader = new FileReader();
  reader.onload = async ev => {
    const data = ev.target.result;
    const mime = file.type;
    const name = file.name;
    try {
      const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await updateDoc(doc(window._db, 'pickup_cars', _pendingSendCarId), { doc: data, docMime: mime, docName: name });
      // update local cache
      const car = _pickupAllCars.find(c => c.id === _pendingSendCarId);
      if (car) { car.doc = data; car.docMime = mime; car.docName = name; }
      closeModal('modal-pickup-doc-required');
      showToast('📎 מסמך צורף');
      if (car) _showDriverPicker(car);
    } catch(e) { preview.innerHTML = `<div style="color:#ef4444;font-size:13px">שגיאה: ${e.message}</div>`; }
  };
  reader.readAsDataURL(file);
}
window.attachDocAndSend = attachDocAndSend;

async function sendPickupToDriver(id, driverName) {
  closeModal('modal-send-pickup-driver');
  const car = _pickupAllCars.find(c => c.id === id);
  const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  // tapping the already-assigned driver cancels the assignment
  if (car && car.assignedDriver === driverName) {
    await updateDoc(doc(window._db, 'pickup_cars', id), { assignedDriver: '' });
    car.assignedDriver = '';
    showToast(`בוטלה השליחה ל${driverName}`);
    return;
  }
  const data = { assignedDriver: driverName };
  const front = _pkFrontIndex(1);
  if (front !== null) data.sortIndex = front;
  await updateDoc(doc(window._db, 'pickup_cars', id), data);
  if (car) Object.assign(car, data);
  const plate = car?.plate || '';
  const desc = [car?.type, car?.city].filter(Boolean).join(' · ');
  if (driverName === _TOW_NAME) {
    showToast(`🚛 ${plate} סומן לגרר`);
    // חלונית השיתוף עובדת על הרכבים המסומנים — מסמנים את הרכב הזה בלבד
    const prev = new Set(_pickupSelected);
    _pickupSelected.clear(); _pickupSelected.add(id);
    try { await batchExportPickup(); } catch (e) { console.error('tow share', e); }
    _pickupSelected.clear(); prev.forEach(x => _pickupSelected.add(x));
    _updatePickupBatchBar(); _syncSelectAllLabel(); renderPickupCars();
    return;
  }
  _notifyDriver(driverName, `🚙 יש לך רכב ממתין לאיסוף — ${plate}${desc ? ' · ' + desc : ''}. כנס לאפליקציה לפרטים.`);
  showToast(`✅ נשלחה התראה ל${driverName}`);
}
window.sendPickupToDriver = sendPickupToDriver;

// send an intake ("קליטה") assignment for a pickup car, to the same driver
// it's assigned to, auto-filling vehicle details from the gov.il registry
async function sendPickupCarIntake(id) {
  const car = _pickupAllCars.find(c => c.id === id);
  if (!car) return;
  if (!car.assignedDriver) return showToast('נא לשלוח קודם את הרכב לנהג');
  const plate = String(car.plate || '').replace(/\D/g, '');
  if (!plate) return showToast('לרכב הזה אין מספר לוחית');
  showToast('⏳ שולח קליטה...');
  try {
    const { getDocs, query, collection, where } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    // avoid duplicating an active intake for the same plate
    const snap = await getDocs(query(collection(window._db, 'intake_assignments'), where('plate', '==', plate)));
    const conflict = snap.docs.map(d => d.data()).find(d => ['pending', 'done', 'checked'].includes(d.status));
    if (conflict) {
      const stLabel = conflict.status === 'pending' ? 'בתהליך קליטה' : conflict.status === 'done' ? 'בוצעה — ממתינה לבדיקה' : 'נבדקה';
      return showToast(`⚠️ לרכב ${plate} כבר נעשתה קליטה (${stLabel})`, 5000);
    }
    // auto-pull vehicle details from the gov.il registry (same source used elsewhere)
    let brand = '', model = '', color = car.color || '', year = car.year || '';
    try {
      const rec = await _plateLookup(plate);
      if (rec) {
        brand = rec.maker;
        model = rec.model;
        color = rec.color || color;
        year  = rec.year || year;
      }
    } catch (e) { console.error('gov.il lookup for intake', e); }
    if (!brand && !model && car.type) { const parts = car.type.split(' '); brand = parts[0] || ''; model = parts.slice(1).join(' '); }

    await _addDoc(_colRef('intake_assignments'), {
      plate, brand, model, color, year,
      spot: _pickupCity(car) || car.city || '',
      assignedTo: car.assignedDriver,
      createdBy: currentUser.name,
      status: 'pending',
      createdAt: _serverTs()
    });
    _notifyDriver(car.assignedDriver, `🚗 קליטת רכב חדשה ממתינה לך — ${plate} ${brand} ${model}. כנס לאפליקציה ענק הרכבים.`);
    showToast(`✅ קליטה נשלחה ל${car.assignedDriver}`);
  } catch (e) {
    console.error('sendPickupCarIntake', e);
    showToast('⚠️ שגיאה בשליחת הקליטה');
  }
}
window.sendPickupCarIntake = sendPickupCarIntake;

let _pendingCollectId = null;
let _pendingCollectFromHome = false;
let _pendingCollectBatch = null; // array of ids when collecting several at once

function collectPickupCar(id) {
  _pendingCollectId = id;
  _pendingCollectFromHome = false;
  document.getElementById('collect-pickup-by').value = '';
  openModal('modal-collect-pickup');
  setTimeout(() => document.getElementById('collect-pickup-by')?.focus(), 50);
}
window.collectPickupCar = collectPickupCar;

/* האיסוף כותב לארכיון ומוחק מהרשימה — שתי פניות לשרת. ברשת סלולרית זה
   נמשך כמה שניות, ולכן: הכפתור ננעל ומראה שהוא עובד, הרכב נעלם מהרשימה
   מיד, ובאיסוף מרובה כל הרכבים נכתבים במקביל ולא זה אחר זה. */
let _collectBusy = false;

function _collectBtnState(busy) {
  const btn = document.querySelector('#modal-collect-pickup .btn-submit');
  if (!btn) return;
  btn.disabled = busy;
  btn.style.opacity = busy ? '.6' : '';
  btn.textContent = busy ? '⏳ מעביר לארכיון...' : 'אישור והעברה לארכיון ✅';
}

async function submitCollectPickup() {
  if (_collectBusy) return;                       // לחיצה שנייה לא יוצרת כפילות
  if (!_requireNet('רישום האיסוף')) return;
  const collectedByText = document.getElementById('collect-pickup-by').value.trim();
  if (!collectedByText) {
    showToast('נא להזין על ידי מי נאסף הרכב');
    document.getElementById('collect-pickup-by')?.focus();
    return;
  }
  _collectBusy = true;
  _collectBtnState(true);
  try {
    const { addDoc, deleteDoc, doc, collection } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const archive = async (car, id) => {
      await addDoc(collection(window._db, 'pickup_archive'), { ...car, collectedAt: _serverTs(), collectedBy: currentUser.name, collectedByText });
      await deleteDoc(doc(window._db, 'pickup_cars', id));
      _notifyPickupCollected(car, collectedByText);
    };

    // batch mode — several cars collected in one action
    if (_pendingCollectBatch && _pendingCollectBatch.length) {
      const ids = _pendingCollectBatch;
      const jobs = ids.map(id => {
        const car = _pickupAllCars.find(c => c.id === id);
        return car ? archive(car, id).then(() => true).catch(err => { console.error('batch collect failed for', id, err); return false; }) : Promise.resolve(false);
      });
      const ok = (await Promise.all(jobs)).filter(Boolean).length;
      closeModal('modal-collect-pickup');
      _pendingCollectBatch = null;
      clearPickupSelection();
      showToast(ok === ids.length ? `✅ ${ok} רכבים הועברו לארכיון`
                                  : `✅ ${ok} מתוך ${ids.length} הועברו — נסה שוב את השאר`, 6000);
      return;
    }

    const id = _pendingCollectId;
    if (!id) return;
    const cars = _pendingCollectFromHome ? _driverPickupCars : _pickupAllCars;
    const car = cars.find(c => c.id === id) || {};
    // הרכב נעלם מהמסך מיד; אם השמירה תיכשל הוא יחזור מהשרת בסנכרון הבא
    _pickupAllCars = _pickupAllCars.filter(c => c.id !== id);
    try { renderPickupCars(); } catch (e) {}
    closeModal('modal-collect-pickup');
    _pendingCollectId = null;
    if (_pendingCollectFromHome) { closeModal('modal-driver-pickup'); loadStats(); }
    try {
      await archive(car, id);
      showToast('✅ הרכב הועבר לארכיון');
      _askTasksHandled(car);
    } catch (err) {
      console.error('collect failed', err);
      showToast('⚠️ ההעברה לארכיון נכשלה — הרכב נשאר ברשימה', 7000);
    }
  } finally {
    _collectBusy = false;
    _collectBtnState(false);
  }
}
window.submitCollectPickup = submitCollectPickup;

/* התראה למשה על כל רכב שנאסף — אצלו זה הסימן להתקדם לרכב הבא.
   נשלחת ברקע: כישלון בטלגרם לא מעכב ולא מבטל את האיסוף עצמו. */
async function _notifyPickupCollected(car, collectedByText) {
  try {
    const contacts = await _loadDriverContacts();
    const chatId = contacts['משה']?.telegramId;
    if (!chatId) return;
    const lines = [
      '✅ רכב נאסף',
      `🚗 ${car.plate || ''} ${[car.type, car.year].filter(Boolean).join(' · ')}`.trim(),
      [car.address, _pickupCity(car)].filter(Boolean).join(', '),
      // מה שהוקלד בשדה "על ידי מי נאסף הרכב" — לא איש הקשר של הכתובת
      collectedByText ? `👤 נאסף ע״י: ${collectedByText}` : '',
      // מי דיווח באפליקציה — רק אם זה מישהו אחר, כדי לא לחזור על אותו שם
      (currentUser?.name && currentUser.name !== collectedByText) ? `📲 דווח ע״י: ${currentUser.name}` : '',
    ].filter(Boolean);
    await _sendTelegram(chatId, lines.join('\n'));
  } catch (e) { console.error('pickup collected notify', e); }
}


// after a car is collected, ask which of its in-radius region tasks were handled
let _handledPending = [];
function _askTasksHandled(car) {
  if (!car) return;
  const carC = _coordOfCity(_pickupCity(car)); if (!carC) return;
  const rows = [];
  for (const t of _regionTasksCache) {
    const tc = _coordOfCity(t.regionCity); if (!tc) continue;
    if (_haversineKm(carC, tc) <= _TASK_RADIUS_KM) rows.push({ id: t.id, title: t.title, regionCity: t.regionCity });
  }
  if (!rows.length) return;
  _handledPending = rows.map(r => ({ ...r, checked: false }));
  document.getElementById('task-handled-list').innerHTML = _handledPending.map((r, i) =>
    `<label style="display:flex;align-items:center;gap:10px;background:var(--surface2);border-radius:10px;padding:10px;cursor:pointer">
      <input type="checkbox" onchange="_toggleHandled(${i},this.checked)" style="width:20px;height:20px;flex-shrink:0">
      <span style="font-size:14px;font-weight:600">${esc(r.title)}${r.regionCity ? ` <span style="color:var(--muted)">(${esc(r.regionCity)})</span>` : ''}</span>
    </label>`).join('');
  openModal('modal-task-handled');
}
window._toggleHandled = (i, ch) => { if (_handledPending[i]) _handledPending[i].checked = ch; };

async function submitTasksHandled() {
  const toDelete = _handledPending.filter(r => r.checked);
  closeModal('modal-task-handled');
  if (toDelete.length) {
    const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    for (const r of toDelete) {
      try { await deleteDoc(doc(window._db, 'tasks', r.id)); } catch (e) { console.error('delete handled task', e); }
    }
    showToast(`✅ ${toDelete.length} משימות טופלו ונמחקו`);
  }
  _handledPending = [];
}
window.submitTasksHandled = submitTasksHandled;

// ── Driver pickup card on home screen ──
let _driverPickupCars = [];

function openDriverPickupModal() {
  _renderDriverPickupModal();
  openModal('modal-driver-pickup');
}

function _renderDriverPickupModal() {
  const list = document.getElementById('driver-pickup-list');
  if (!list) return;
  if (!_driverPickupCars.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:15px">אין רכבים ממתינים לאיסוף</div>';
    return;
  }
  const e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  list.innerHTML = _driverPickupCars.map(c => {
    const km = c.km ? c.km + ' ק"מ' : '';
    const rows = [
      c.type && `<div style="font-size:15px;font-weight:700">${e(c.type)}${c.year?' · '+e(c.year):''}</div>`,
      c.city && `<div style="font-size:13px;color:var(--muted)">🏙️ ${e(c.city)}</div>`,
      // הכתובת עצמה היא כפתור הניווט — לחיצה פותחת מסלול הליכה בגוגל מפות
      c.address && (_pickupNavUrl(c)
        ? `<a href="${_pickupNavUrl(c)}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;background:#1d4ed8;color:#fff;border-radius:10px;padding:10px 12px;margin:6px 0;font-size:15px;font-weight:800;text-decoration:none">📍 ${e(c.address)} <span style="margin-right:auto;font-size:13px">🚶 ניווט</span></a>`
        : `<div style="font-size:13px;color:var(--muted)">📍 ${e(c.address)}</div>`),
      c.note && `<div style="background:#fef08a;color:#000;border-right:5px solid #eab308;border-radius:8px;padding:8px 10px;margin:6px 0;font-size:14px;font-weight:800">📝 ${e(c.note)}</div>`,
      c.contact && `<div style="font-size:13px;color:var(--muted)">📞 <a href="tel:${e(c.contact)}" style="color:inherit">${e(c.contact)}</a></div>`,
      km && `<div style="font-size:13px;color:var(--muted)">🛣️ ${e(km)}</div>`,
    ].filter(Boolean).join('');

    // doc/image attachment
    let docHtml = '';
    if (c.doc) {
      const isImage = (c.docMime||'').startsWith('image/');
      if (isImage) {
        docHtml = `<div style="margin-top:10px">
          <div style="font-size:13px;font-weight:800;color:var(--muted);margin-bottom:5px">📄 אישור העברת בעלות</div>
          <img src="${c.doc}" onclick="openLightbox(this.src)" style="max-width:100%;max-height:200px;object-fit:cover;border-radius:10px;cursor:zoom-in;border:1.5px solid var(--border)">
        </div>`;
      } else {
        const label = e(c.docName || 'פתח קובץ');
        const mime = e(c.docMime || 'application/octet-stream');
        docHtml = `<div style="margin-top:10px">
          <button onclick="_openDocBlob('${c.id}')" style="display:flex;width:100%;align-items:center;justify-content:center;gap:8px;background:#0369a1;color:#fff;border:none;border-radius:10px;padding:12px 14px;font-family:Heebo,sans-serif;font-size:14px;font-weight:800;cursor:pointer">
            📄 אישור העברת בעלות
          </button>
        </div>`;
      }
    }

    return `<div style="background:var(--surface2);border-radius:14px;padding:14px 16px;border-right:5px solid #1e40af">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="font-size:22px;font-weight:900;letter-spacing:2px;font-family:monospace">${e(c.plate||'')}</div>
        <div style="margin-right:auto;width:112px;flex-shrink:0">${_pickupSourceTag(c)}</div>
      </div>
      ${rows}
      ${docHtml}
      <button onclick="collectPickupCarFromHome('${e(c.id)}')" style="width:100%;margin-top:14px;background:#059669;color:#fff;border:none;border-radius:12px;padding:14px;font-family:Heebo,sans-serif;font-size:16px;font-weight:800;cursor:pointer">✅ הרכב נאסף</button>
    </div>`;
  }).join('');
}

function collectPickupCarFromHome(id) {
  _pendingCollectId = id;
  _pendingCollectFromHome = true;
  document.getElementById('collect-pickup-by').value = '';
  openModal('modal-collect-pickup');
  setTimeout(() => document.getElementById('collect-pickup-by')?.focus(), 50);
}
function _openDocBlob(carId) {
  const car = _driverPickupCars.find(c => c.id === carId)
           || _pickupAllCars.find(c => c.id === carId);
  if (!car?.doc) return;
  // תמונה נפתחת בתצוגה המוגדלת, ולא כקובץ להורדה
  if ((car.docMime || '').startsWith('image/')) return void openLightbox(car.doc);
  try {
    // convert data URL to blob for reliable mobile opening
    const [header, b64] = car.doc.split(',');
    const mime = car.docMime || (header.match(/:(.*?);/)||[])[1] || 'application/octet-stream';
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch(e) {
    window.open(car.doc, '_blank');
  }
}
window._openDocBlob = _openDocBlob;
window.collectPickupCarFromHome = collectPickupCarFromHome;
window.openDriverPickupModal = openDriverPickupModal;

// ── My pickup cars (driver / הילה view) ──
function openMyPickupScreen() {
  document.getElementById('pickup-user-badge').textContent = currentUser.name;
  document.getElementById('pickup-filter-city').closest('div').style.display = 'none';
  showScreen('pickup');
  document.querySelectorAll('#screen-pickup .fab').forEach(b => b.style.display='none');
  const list = document.getElementById('pickup-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div> טוען...</div>';
  _onSnap(_query(_colRef('pickup_cars'), _where('assignedDriver','==',currentUser.name)), snap => {
    const cars = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _pickupAllCars = [..._pickupAllCars.filter(c => c.assignedDriver !== currentUser.name), ...cars];
    if (!cars.length) { list.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--muted);font-size:15px">אין רכבים ממתינים לאיסוף</div>'; return; }
    list.innerHTML = cars.map(_myPickupCardHtml).join('');
  }, err => {
    console.error('my pickup listen error:', err);
    list.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#ef4444;font-size:14px">שגיאה בטעינה: ${err?.code || err?.message || 'אין גישה'}</div>`;
  });
}
window.openMyPickupScreen = openMyPickupScreen;

function _myPickupCardHtml(c) {
  const e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const km = c.km ? _fmtKm(c.km) + ' ק"מ' : '';
  return `<div class="vehicle-card" style="border-right:5px solid #1e40af;margin-bottom:8px;cursor:pointer" onclick="openPickupDetail('${e(c.id)}')">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="flex:1;min-width:0">
        <div class="vehicle-plate">${e(c.plate||'')}</div>
        ${c.type ? `<div class="vehicle-info">${e(c.type)}${c.year?' · '+e(c.year):''}</div>` : ''}
        <div class="vehicle-meta">
          ${c.color?`<span class="tag assignee">🎨 ${e(c.color)}</span>`:''}
          ${km?`<span class="tag assignee">🛣️ ${e(km)}</span>`:''}
          ${c.city?`<span class="tag assignee">🏙️ ${e(c.city)}</span>`:''}
        </div>
        ${c.address ? (_pickupNavUrl(c)
          ? `<a href="${_pickupNavUrl(c)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="display:flex;align-items:center;gap:8px;background:#1d4ed8;color:#fff;border-radius:10px;padding:9px 12px;margin-top:8px;font-size:14px;font-weight:800;text-decoration:none">📍 ${e(c.address)} <span style="margin-right:auto;font-size:12px">🚶 ניווט</span></a>`
          : `<div style="margin-top:6px;font-size:13px;color:var(--muted)">📍 ${e(c.address)}</div>`) : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        ${_pickupSourceTag(c)}
        ${c.doc ? `<button onclick="event.stopPropagation();_openDocBlob('${e(c.id)}')" style="background:#0369a1;color:#fff;border:none;border-radius:10px;padding:8px 12px;font-family:Heebo,sans-serif;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap">📄 בעלות</button>` : ''}
        <span style="background:#1e40af;color:#fff;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;white-space:nowrap">פתח ▶</span>
        <button onclick="event.stopPropagation();collectPickupCar('${e(c.id)}')" style="background:#059669;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">✅ הרכב נאסף</button>
      </div>
    </div>
  </div>`;
}

function openPickupDetail(id) {
  const car = _pickupAllCars.find(c => c.id === id) || {};
  const e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const km = car.km ? _fmtKm(car.km) + ' ק"מ' : '';
  const rows = [
    ['לוחית', car.plate], ['סוג רכב', [car.type,car.year].filter(Boolean).join(' · ')],
    ['צבע', car.color], ['קמ"ש', km], ['איש קשר', car.contact],
    ['עיר', car.city], ['כתובת', car.address], ['מאיפה', car.source], ['הערה', car.note]
  ].filter(([,v]) => v);
  const docHtml = car.doc ? `<div style="margin-top:14px"><div style="font-size:13px;font-weight:700;color:var(--muted);margin-bottom:6px">אישור העברת בעלות:</div>${_pickupDocThumb(car.doc, car.docMime, car.docName)}</div>` : '';
  const navUrl = _pickupNavUrl(car);
  document.getElementById('pickup-detail-body').innerHTML =
    `<div style="display:flex;flex-direction:column;gap:10px">
      ${rows.map(([label,val]) => (label === 'כתובת' && navUrl)
        // שורת הכתובת היא כפתור הניווט
        ? `<a href="${navUrl}" target="_blank" rel="noopener" style="display:block;background:#1d4ed8;color:#fff;border-radius:10px;padding:10px 14px;text-decoration:none">
             <div style="font-size:11px;font-weight:700;opacity:.85">${label} — לחץ לניווט הליכה</div>
             <div style="font-size:15px;font-weight:800;margin-top:2px">📍 ${e(val)} 🚶</div>
           </a>`
        : `<div style="background:var(--surface2);border-radius:10px;padding:10px 14px">
        <div style="font-size:11px;color:var(--muted);font-weight:700">${label}</div>
        <div style="font-size:15px;font-weight:700;margin-top:2px">${e(val)}</div>
      </div>`).join('')}
      ${docHtml}
    </div>`;
  openModal('modal-pickup-detail');
}
window.openPickupDetail = openPickupDetail;

// ══════════════════════════════════════════
//  TEST DRIVE
// ══════════════════════════════════════════

const _TD_DRIVERS = ['עופר','גיל','איתי'];
let _tdSelectedDriver = null;
let _tdLookedUpModel = ''; // model pulled from gov.il alongside maker/year/color
let _tdVehicleData = {};
let _tdAllForms = [];

async function openTestDriveFromHome() {
  if (currentUser.role === 'manager') {
    openTestDriveScreen();
    return;
  }
  // driver: load pending forms and open directly if only one
  try {
    const { getDocs, query, where, collection } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDocs(query(collection(window._db,'test_drives'), where('assignedTo','==',currentUser.name), where('status','==','pending')));
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (docs.length === 1) {
      if (!_tdAllForms.find(f => f.id === docs[0].id)) _tdAllForms.push(docs[0]);
      openFillTestDriveModal(docs[0].id);
    } else {
      openTestDriveScreen();
    }
  } catch(e) { openTestDriveScreen(); }
}
window.openTestDriveFromHome = openTestDriveFromHome;

function openTestDriveScreen() {
  showScreen('test-drive');
  _tdLoadList();
}

// כשנסיעות המבחן מוצגות בלשונית שבמסך הבית של המנהל — אותה טעינה
// בדיוק, בלי מעבר מסך
function _tdMountedOnHome() { _tdLoadList(); }
window._tdMountedOnHome = _tdMountedOnHome;

let _tdUnsub = null;
function _tdLoadList() {
  document.getElementById('td-user-badge').textContent = currentUser.name;
  const isManager = currentUser.role === 'manager';
  document.getElementById('td-fab-new').style.display = isManager ? '' : 'none';
  const list = document.getElementById('td-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div> טוען...</div>';
  const q = isManager
    ? _colRef('test_drives')
    : _query(_colRef('test_drives'), _where('assignedTo','==',currentUser.name));
  // כל טעינה מחליפה את המאזין הקודם, כדי שלא ייערמו חיבורים לשרת
  if (_tdUnsub) { try { _tdUnsub(); } catch (e) {} }
  _tdUnsub = _onSnap(q, snap => {
    _tdAllForms = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // נסיעות שנמחקו בעבר סומנו כ-cancelled ונשארו במסד — הן לא מוצגות
      .filter(f => f.status !== 'cancelled')
      .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
    if (!_tdAllForms.length) { list.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--muted);font-size:15px">אין טפסים</div>'; return; }
    list.innerHTML = _tdAllForms.map(f => {
      const isDoneLike = f.status === 'done' || f.status === 'transferred' || f.status === 'no_intake';
      const statusColor = f.status === 'transferred' ? '#16a34a'
        : f.status === 'no_intake' ? '#ef4444'
        : f.status === 'done' ? '#eab308' : '#f59e0b';
      const statusLabel = f.status === 'transferred' ? '✅ הושלמה והועברה לקליטה'
        : f.status === 'no_intake' ? '🚫 רכב לא נכנס למלאי'
        : f.status === 'done' ? '⏳ ממתין' : '⏳ ממתין למילוי';
      const onClick = isDoneLike
        ? (isManager ? `_showTdResultModal('${f.id}', _tdAllForms.find(x=>x.id==='${f.id}'))` : '')
        // a manager reopens the live panel (e.g. after parking it); a driver fills the form
        : (isManager ? `openTdLivePanel('${f.id}', _tdAllForms.find(x=>x.id==='${f.id}'))` : `openFillTestDriveModal('${f.id}')`);
      // filled in and awaiting the manager's decision — offer both outcomes
      const actions = (isManager && f.status === 'done')
        ? `<button onclick="event.stopPropagation();tdSendToIntake('${f.id}')" style="background:#16a34a;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">🚗 העבר קליטה</button>
           <button onclick="event.stopPropagation();tdMarkNoIntake('${f.id}')" style="background:#ef4444;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">🚫 לא נכנס למלאי</button>` : '';
      return `<div class="vehicle-card" style="margin-bottom:10px;${onClick?'cursor:pointer;':''}border-right:5px solid ${statusColor}" onclick="${onClick}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div class="vehicle-plate">${f.plate||''}</div>
            <div class="vehicle-info">${[f.maker,f.model,f.year].filter(Boolean).join(' · ')}</div>
            <div class="vehicle-meta">
              ${f.color?`<span class="tag assignee">🎨 ${f.color}</span>`:''}
              <span class="tag assignee">👤 ${f.assignedTo||''}</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
            <span style="background:${statusColor};color:#fff;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;white-space:nowrap">${statusLabel}</span>
            ${actions}
          </div>
        </div>
      </div>`;
    }).join('');
  }, err => { list.innerHTML = `<div style="color:#ef4444;padding:20px">שגיאה: ${err?.code||err?.message}</div>`; });
}
window.openTestDriveScreen = openTestDriveScreen;

// from the test-drive list: hand the filled form over to a vehicle intake
async function tdSendToIntake(id) {
  const f = _tdAllForms.find(x => x.id === id);
  if (!f) return;
  const ok = await _tdConvertToIntake(id, f);
  if (ok) showToast('✅ נפתחה קליטת רכב עם התוצאות');
}
window.tdSendToIntake = tdSendToIntake;

// the car isn't joining the lot — close the test drive without an intake
async function tdMarkNoIntake(id) {
  const f = _tdAllForms.find(x => x.id === id);
  if (!confirm(`לסמן שהרכב ${f?.plate || ''} לא נכנס למלאי? הנסיעה תישמר לתיעוד.`)) return;
  try {
    await _updateDoc(_docRef('test_drives', id), { status: 'no_intake' });
    showToast('🚫 סומן — הרכב לא נכנס למלאי');
  } catch(e) { showToast('שגיאה: ' + (e.code || e.message)); }
}
window.tdMarkNoIntake = tdMarkNoIntake;

function openNewTestDriveModal() {
  _tdSelectedDriver = null;
  _tdVehicleData = {};
  _tdLookedUpModel = '';
  document.getElementById('td-plate').value = '';
  document.getElementById('td-maker').value = '';
  document.getElementById('td-year').value = '';
  document.getElementById('td-color').value = '';
  document.getElementById('td-fetch-status').textContent = '';
  const btns = document.getElementById('td-driver-btns');
  btns.innerHTML = _TD_DRIVERS.map(n =>
    `<button type="button" onclick="tdSelectDriver('${n}',this)" style="background:var(--surface2);color:var(--text);border:1.5px solid var(--border);border-radius:10px;padding:10px;font-family:Heebo,sans-serif;font-weight:700;font-size:14px;cursor:pointer">${n}</button>`
  ).join('');
  openModal('modal-new-test-drive');
}
window.openNewTestDriveModal = openNewTestDriveModal;

function tdSelectDriver(name, btn) {
  _tdSelectedDriver = name;
  document.querySelectorAll('#td-driver-btns button').forEach(b => { b.style.background='var(--surface2)'; b.style.color='var(--text)'; });
  btn.style.background = 'var(--dark)'; btn.style.color = '#fff';
}
window.tdSelectDriver = tdSelectDriver;

async function lookupTdPlate() {
  const plate = document.getElementById('td-plate').value.trim();
  if (!plate) return;
  const st = document.getElementById('td-fetch-status');
  st.textContent = '⏳ מחפש...';
  try {
    const res = await fetch(`https://europe-west1-anak-soharim.cloudfunctions.net/govilProxy?resource_id=053cea08-09bc-40ec-8f7a-156f0677aff3&q=${plate}&limit=5`);
    const json = await res.json();
    const rec = json?.result?.records?.find(r => String(r['mispar_rechev']) === plate) || json?.result?.records?.[0];
    if (!rec) { st.textContent = '❌ לא נמצא'; return; }
    const rawMaker = rec['tozeret_nm'] || '';
    document.getElementById('td-maker').value = _cleanMaker(rawMaker);
    document.getElementById('td-year').value = rec['shnat_yitzur'] || '';
    document.getElementById('td-color').value = rec['tzeva_rechev'] || '';
    _tdLookedUpModel = rec['kinuy_mishari'] || rec['degem_nm'] || '';
    st.textContent = '✅ פרטים נטענו';
  } catch(e) { st.textContent = '❌ שגיאה בחיפוש'; }
}
window.lookupTdPlate = lookupTdPlate;

async function submitNewTestDrive() {
  const plate = document.getElementById('td-plate').value.trim();
  if (!plate) return showToast('נא להזין לוחית רישוי');
  if (!_tdSelectedDriver) return showToast('נא לבחור נהג');
  const data = {
    plate,
    maker: document.getElementById('td-maker').value.trim(),
    model: _tdLookedUpModel || '',
    year: document.getElementById('td-year').value.trim(),
    color: document.getElementById('td-color').value.trim(),
    assignedTo: _tdSelectedDriver,
    createdBy: currentUser.name,
    createdAt: _serverTs(),
    status: 'pending'
  };
  const ref = await _addDoc(_colRef('test_drives'), data);
  _notifyDriver(_tdSelectedDriver, `🏎️ יש לך טופס נסיעת מבחן חדש לרכב ${plate}. כנס לאפליקציה למלא.`);
  showToast(`✅ נשלח ל${_tdSelectedDriver}`);
  closeModal('modal-new-test-drive');
  openTdLivePanel(ref.id, { ...data, id: ref.id });
}
window.submitNewTestDrive = submitNewTestDrive;

function openFillTestDriveModal(id) {
  const f = _tdAllForms.find(x => x.id === id);
  if (!f) return;
  document.getElementById('tdf-id').value = id;
  document.getElementById('td-form-vehicle-info').innerHTML =
    `<span style="font-size:16px;font-weight:900">${f.plate}</span> &nbsp; ${[f.maker,f.model,f.year,f.color].filter(Boolean).join(' · ')}`;
  document.getElementById('tdf-km').value = '';
  document.getElementById('tdf-code').value = '';
  document.getElementById('td-extra-yes').style.display='none';
  document.getElementById('td-extra-no').style.display='none';
  document.getElementById('td-extra-text').value='';
  // reset כן/הכל תקין button styles
  const _xtraBtns = document.querySelectorAll('#modal-fill-test-drive [onclick*="td-extra-yes"],[onclick*="td-extra-no"]');
  _xtraBtns.forEach(b => { b.style.background='var(--surface2)'; b.style.color='var(--text)'; });
  document.getElementById('td-dash-detail').style.display='none';
  document.getElementById('td-dash-other-text').value='';
  // remove any existing dynamic note divs
  document.querySelectorAll('#modal-fill-test-drive .td-note-wrap').forEach(el => el.remove());
  // reset all ci-boxes
  document.querySelectorAll('#modal-fill-test-drive .ci-box').forEach(b => { b.classList.remove('v-active','x-active'); });
  ['td-dash-engine','td-dash-tire','td-dash-service','td-dash-collision','td-dash-fuel','td-dash-istop','td-dash-other'].forEach(k => { const el=document.getElementById(k); if(el) el.checked=false; });
  openModal('modal-fill-test-drive');
  // restore draft if exists
  if (f.draft) setTimeout(() => _tdRestoreAll(f.draft), 50);
  // התמונות מוחזרות אחרי שהשורות נבנו מחדש
  setTimeout(() => _tdRestorePhotoDraft(document.getElementById('tdf-id')?.value), 120);
}
window.openFillTestDriveModal = openFillTestDriveModal;

let _tdAutoSaveTimer = null, _tdPhotoDraftTimer = null;

// התמונות נשמרות מקומית ודחוסות — יציאה מהטופס לא מאבדת אותן
async function _tdSavePhotoDraft(id) {
  if (!id) return;
  try {
    const out = {};
    for (const k of Object.keys(tdPhotoFiles)) {
      const files = tdPhotoFiles[k] || [];
      if (files.length) out[k] = await Promise.all(files.map(f => compressToBase64(f, _INTAKE_DRAFT_PX, _INTAKE_DRAFT_Q)));
    }
    if (Object.keys(out).length) localStorage.setItem('td_draft_photos_' + id, JSON.stringify(out));
    else localStorage.removeItem('td_draft_photos_' + id);
  } catch (e) { console.warn('td photo draft', e); }
}

function _tdRestorePhotoDraft(id) {
  tdPhotoFiles = {};
  let raw = null;
  try { raw = localStorage.getItem('td_draft_photos_' + id); } catch (e) {}
  if (!raw) return;
  try {
    Object.entries(JSON.parse(raw)).forEach(([key, b64s]) => {
      tdPhotoFiles[key] = [];
      b64s.forEach(b64 => {
        fetch(b64).then(r => r.blob()).then(blob => {
          tdPhotoFiles[key].push(new File([blob], 'photo.jpg', { type: blob.type }));
          tdRenderPhotoGrid(key);
        }).catch(() => {});
      });
    });
  } catch (e) {}
}

function _autoSaveTd() {
  clearTimeout(_tdAutoSaveTimer);
  clearTimeout(_tdPhotoDraftTimer);
  const pid = document.getElementById('tdf-id')?.value;
  _tdPhotoDraftTimer = setTimeout(() => _tdSavePhotoDraft(pid), 500);
  _tdAutoSaveTimer = setTimeout(async () => {
    const id = document.getElementById('tdf-id')?.value;
    if (!id) return;
    try {
      const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await updateDoc(doc(window._db, 'test_drives', id), { draft: _tdCollectAll() });
    } catch(e) { console.warn('autosave td', e); }
  }, 1500);
}
window._autoSaveTd = _autoSaveTd;

function _tdCollectAll() {
  const checks = {};
  document.querySelectorAll('#modal-fill-test-drive .ci-box.v-active,#modal-fill-test-drive .ci-box.x-active').forEach(b => {
    checks[b.dataset.key] = b.dataset.val;
  });
  const notes = {};
  document.querySelectorAll('#modal-fill-test-drive [id^="td-note-text-"]').forEach(el => {
    if (el.closest('[style*="display:none"]') || el.closest('.td-note-wrap[style*="display:none"]')) return;
    const key = el.id.replace('td-note-text-','');
    notes[key] = el.value.trim();
  });
  const dashLights = ['td-dash-engine','td-dash-tire','td-dash-service','td-dash-collision','td-dash-fuel','td-dash-istop','td-dash-other']
    .filter(k => document.getElementById(k)?.checked);
  return {
    km: document.getElementById('tdf-km')?.value.trim() || '',
    code: document.getElementById('tdf-code')?.value.trim() || '',
    checks,
    notes,
    dashLights,
    dashOtherText: document.getElementById('td-dash-other-text')?.value.trim() || '',
    extraIssues: document.getElementById('td-extra-text')?.value.trim() || '',
    extraOk: document.getElementById('td-extra-no')?.style.display !== 'none',
  };
}

function _tdRestoreAll(draft) {
  if (!draft) return;
  if (draft.km) document.getElementById('tdf-km').value = draft.km;
  if (draft.code) document.getElementById('tdf-code').value = draft.code;
  if (draft.checks) {
    Object.entries(draft.checks).forEach(([key, val]) => {
      const btn = document.querySelector(`#modal-fill-test-drive .ci-box[data-key="${key}"][data-val="${val}"]`);
      if (btn) { btn.classList.add(val === 'v' ? 'v-active' : 'x-active'); if (val === 'x') _showTdNoteFor(key, btn); }
    });
  }
  if (draft.notes) {
    Object.entries(draft.notes).forEach(([key, text]) => {
      const el = document.getElementById(`td-note-text-${key}`);
      if (el) el.value = text;
    });
  }
  if (draft.dashLights) {
    draft.dashLights.forEach(k => { const el = document.getElementById(k); if (el) el.checked = true; });
    if (draft.dashLights.length) document.getElementById('td-dash-detail').style.display = 'flex';
  }
  if (draft.dashOtherText) { const el = document.getElementById('td-dash-other-text'); if (el) { el.value = draft.dashOtherText; el.style.display = 'block'; } }
  if (draft.extraIssues) { document.getElementById('td-extra-text').value = draft.extraIssues; document.getElementById('td-extra-yes').style.display = 'block'; }
}

/* סעיפים שבקליטה דורשים תמונה — אותם סעיפים דורשים תמונה גם בנסיעת מבחן,
   והתמונות עוברות לקליטה כשמעבירים את הרכב. */
const _TD_PHOTO_KEYS = {
  'td-oil':'c-oil','td-coolant':'c-coolant','td-lights':'c-lights-break',
  'td-glass':'c-glass-break','td-lights-burnt':'c-bulbs','td-windows':'c-windows',
  'td-sunroof':'c-sunroof','td-ac':'c-ac','td-dashboard':'c-dashboard',
};
const _TD_MAX_PHOTOS = 4;
let tdPhotoFiles = {};

function tdAddPhotos(key, input) {
  if (!tdPhotoFiles[key]) tdPhotoFiles[key] = [];
  const files = [...input.files].slice(0, _TD_MAX_PHOTOS - tdPhotoFiles[key].length);
  tdPhotoFiles[key].push(...files);
  input.value = '';
  tdRenderPhotoGrid(key);
  _autoSaveTd();
}
window.tdAddPhotos = tdAddPhotos;

function tdRemovePhoto(key, idx) {
  (tdPhotoFiles[key] || []).splice(idx, 1);
  tdRenderPhotoGrid(key);
  _autoSaveTd();
}
window.tdRemovePhoto = tdRemovePhoto;

function tdRenderPhotoGrid(key) {
  const grid = document.getElementById('td-photos-' + key);
  if (!grid) return;
  const files = tdPhotoFiles[key] || [];
  let html = files.map((f, i) => `<div class="ci-photo-box">
      <img src="${URL.createObjectURL(f)}">
      <button class="rm-btn" onclick="tdRemovePhoto('${key}',${i})">✕</button>
    </div>`).join('');
  if (files.length < _TD_MAX_PHOTOS) {
    html += `<button type="button" onclick="document.getElementById('td-file-${key}').click()" style="width:100%;background:#0ea5e9;color:#fff;border:none;border-radius:10px;padding:10px;font-family:Heebo,sans-serif;font-weight:700;font-size:14px;cursor:pointer;margin-top:4px">📷 צלם תמונה</button>`;
  }
  grid.innerHTML = html;
}

/* דחיסה מדורגת עד שהתמונות נכנסות במקום המותר לרשומה — בדיוק כמו בקליטה.
   אם גם אחרי הדחיסה חורגים, השליחה נעצרת ולא נשמרת רשומה חלקית. */
async function _tdBuildPhotos() {
  const keys = Object.keys(tdPhotoFiles).filter(k => (tdPhotoFiles[k] || []).length);
  if (!keys.length) return {};
  for (const [px, q] of [[900, 0.72], [760, 0.6], [640, 0.5]]) {
    const out = {};
    for (const k of keys) {
      out[k] = await Promise.all(tdPhotoFiles[k].map(f => compressToBase64(f, px, q)));
    }
    const bytes = Object.values(out).flat().reduce((t, b) => t + _b64Size(b), 0);
    if (bytes <= _DOC_PHOTO_BUDGET) return out;
  }
  showToast('⚠️ התמונות כבדות מדי — הסר תמונה אחת ונסה שוב', 7000);
  return null;
}

function _showTdNoteFor(key, btn) {
  const item = btn?.closest('.checklist-item');
  let noteDiv = document.getElementById(`td-note-wrap-${key}`);
  if (!noteDiv) {
    noteDiv = document.createElement('div');
    noteDiv.id = `td-note-wrap-${key}`;
    noteDiv.className = 'td-note-wrap';
    noteDiv.style.cssText = 'margin-bottom:8px;';
    const photoPart = _TD_PHOTO_KEYS[key] ? `
      <div style="font-size:12px;color:#dc2626;font-weight:700;margin:6px 0 4px">חובה לצרף תמונה <span style="color:#ef4444">*</span></div>
      <div class="ci-photos" id="td-photos-${key}"></div>
      <input type="file" accept="image/*" capture="environment" id="td-file-${key}" style="display:none" onchange="tdAddPhotos('${key}',this)">` : '';
    // בלוח שעונים הפירוט כבר נעשה בתיבות הסימון — שם מבקשים רק תמונה
    const textPart = key === 'td-dashboard' ? ''
      : `<textarea class="form-textarea" id="td-note-text-${key}" placeholder="פרט את הבעיה (חובה)..." rows="2" oninput="_autoSaveTd()"></textarea>`;
    noteDiv.innerHTML = textPart + photoPart;
    if (item) item.insertAdjacentElement('afterend', noteDiv);
    if (_TD_PHOTO_KEYS[key]) tdRenderPhotoGrid(key);
  }
  noteDiv.style.display = 'block';
}

function _hideTdNoteFor(key) {
  const noteDiv = document.getElementById(`td-note-wrap-${key}`);
  if (noteDiv) noteDiv.style.display = 'none';
}

function tdCiClick(btn) {
  const key = btn.dataset.key, val = btn.dataset.val;
  const alreadyActive = btn.classList.contains(val === 'v' ? 'v-active' : 'x-active');
  document.querySelectorAll(`#modal-fill-test-drive .ci-box[data-key="${key}"]`).forEach(b => b.classList.remove('v-active','x-active'));
  if (alreadyActive) { _hideTdNoteFor(key); _autoSaveTd(); return; }
  btn.classList.add(val === 'v' ? 'v-active' : 'x-active');
  if (val === 'x') _showTdNoteFor(key, btn); else _hideTdNoteFor(key);
  _autoSaveTd();
}
window.tdCiClick = tdCiClick;

function _tdGetChecks() {
  const result = {};
  document.querySelectorAll('#modal-fill-test-drive .ci-box.v-active,#modal-fill-test-drive .ci-box.x-active').forEach(b => {
    result[b.dataset.key] = b.dataset.val;
  });
  return result;
}

const _TD_CHECK_LABELS = {
  'td-oil':'שמן מנוע','td-coolant':'נוזל קירור',
  'td-lights':'שברים בפנסים','td-glass':'שברים בשמשות',
  'td-lights-burnt':'לדים שרופים/מנורות שרופות',
  'td-windows':'מתגי חלונות','td-mirrors':'קיפול וכיוון מראות חשמליות',
  'td-sunroof':'גג נפתח',
  'td-ac':'מזגן מחמם ומקרר','td-ac-noise':'רעשי מזגן',
  'td-dashboard':'מנורות לוח שעונים',
  'td-drive':'בדיקת הרכב בנסיעה',
};

let _tdResultModalId = null, _tdResultModalData = null;
function _showTdResultModal(id, data) {
  _tdResultModalId = id;
  _tdResultModalData = data;
  const checks = data.checks || {};
  const notes = data.notes || {};
  const plate = data.plate || '';
  const driver = data.completedBy || data.assignedTo || '';
  let html = `<div style="background:var(--surface2);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:14px;font-weight:700">🚗 ${esc(plate)} &nbsp; ${esc([data.maker,data.model,data.year,data.color].filter(Boolean).join(' · '))}</div>`;
  html += `<div style="margin-bottom:8px;font-size:13px;color:var(--muted)">הוגש על ידי <strong>${esc(driver)}</strong>`;
  if (data.km) html += ` &nbsp;|&nbsp; קמ: <strong>${esc(data.km)}</strong>`;
  if (data.code) html += ` &nbsp;|&nbsp; קוד: <strong>${esc(data.code)}</strong>`;
  html += '</div>';
  html += '<div style="display:flex;flex-direction:column;gap:6px">';
  Object.entries(checks).forEach(([key, val]) => {
    const label = _TD_CHECK_LABELS[key] || key;
    const icon = val === 'v' ? '✅' : '❌';
    const note = notes[key] ? `<div style="font-size:12px;color:#dc2626;margin-top:3px;padding-right:22px">⚠️ ${esc(notes[key])}</div>` : '';
    html += `<div style="display:flex;align-items:flex-start;gap:6px;font-size:13px;font-weight:700">${icon} ${esc(label)}${note ? '' : ''}</div>${note}`;
  });
  html += '</div>';
  if (data.dashLights?.length) {
    const lbls = {'td-dash-engine':'צ׳ק אנג׳ין','td-dash-tire':'לחץ אוויר','td-dash-service':'טיפול','td-dash-collision':'התגשות','td-dash-fuel':'דלק','td-dash-istop':'iStop','td-dash-other':'אחר'};
    html += `<div style="margin-top:10px;font-size:13px;font-weight:700;color:#dc2626">🔔 מנורות לוח: ${data.dashLights.map(k=>lbls[k]||k).join(', ')}</div>`;
    if (data.dashOtherText) html += `<div style="font-size:12px;color:var(--muted)">${esc(data.dashOtherText)}</div>`;
  }
  if (data.extraIssues) html += `<div style="margin-top:10px;background:#fef2f2;border-radius:8px;padding:10px;font-size:13px;font-weight:700;color:#dc2626">⚠️ ליקויים נוספים:<br><span style="font-weight:400;color:var(--text)">${esc(data.extraIssues)}</span></div>`;
  html += `<button onclick="tdResultConvertToIntake()" style="width:100%;margin-top:14px;background:#16a34a;color:#fff;border:none;border-radius:12px;padding:13px;font-family:Heebo,sans-serif;font-weight:800;font-size:15px;cursor:pointer">🚗 העבר לקליטת רכב</button>`;
  document.getElementById('td-result-content').innerHTML = html;
  openModal('modal-td-result');
}
window._showTdResultModal = _showTdResultModal;

async function submitTestDriveForm() {
  const id = document.getElementById('tdf-id').value;
  if (!id) return;

  // validate km
  if (!document.getElementById('tdf-km').value.trim()) {
    showToast('⚠️ נא למלא קילומטראז׳');
    document.getElementById('tdf-km').focus();
    return;
  }

  // validate all ci-boxes filled
  const allCiKeys = Object.keys(_TD_CHECK_LABELS);
  const missingKeys = allCiKeys.filter(key =>
    !document.querySelector(`#modal-fill-test-drive .ci-box[data-key="${key}"].v-active`) &&
    !document.querySelector(`#modal-fill-test-drive .ci-box[data-key="${key}"].x-active`)
  );
  if (missingKeys.length) {
    const labels = missingKeys.map(k => _TD_CHECK_LABELS[k]).join(', ');
    showToast(`⚠️ נא למלא את הסעיפים החסרים: ${labels}`);
    // highlight missing and scroll to first
    missingKeys.forEach(key => {
      document.querySelectorAll(`#modal-fill-test-drive .ci-box[data-key="${key}"]`).forEach(b => {
        b.style.outline = '2px solid #ef4444';
        setTimeout(() => { b.style.outline = ''; }, 3000);
      });
    });
    const firstBtn = document.querySelector(`#modal-fill-test-drive .ci-box[data-key="${missingKeys[0]}"]`);
    firstBtn?.closest('.checklist-item')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }


  // validate extra-issues selection
  const extraYesVisible = document.getElementById('td-extra-yes').style.display !== 'none';
  const extraNoVisible = document.getElementById('td-extra-no').style.display !== 'none';
  if (!extraYesVisible && !extraNoVisible) {
    showToast('⚠️ נא לציין האם יש ליקויים נוספים');
    document.getElementById('td-extra-yes').closest('div')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // validate: x-marked fields need notes
  const xBoxes = document.querySelectorAll('#modal-fill-test-drive .ci-box.x-active');
  for (const b of xBoxes) {
    const key = b.dataset.key;
    const noteEl = document.getElementById(`td-note-text-${key}`);
    const noteWrap = document.getElementById(`td-note-wrap-${key}`);
    if (noteEl && noteWrap?.style.display !== 'none' && !noteEl.value.trim()) {
      const label = _TD_CHECK_LABELS[key] || key;
      showToast(`⚠️ חובה לפרט הערות עבור: ${label}`);
      noteEl.focus();
      return;
    }
    // אותם סעיפים שדורשים תמונה בקליטה דורשים תמונה גם כאן
    if (_TD_PHOTO_KEYS[key] && !(tdPhotoFiles[key] || []).length) {
      const label = _TD_CHECK_LABELS[key] || key;
      showToast(`⚠️ חובה לצרף תמונה עבור: ${label}`);
      document.getElementById(`td-note-wrap-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }
  if (!_requireNet('שליחת נסיעת המבחן')) return;
  const all = _tdCollectAll();

  // התמונות נשמרות בתוך הרשומה, ומועברות לקליטה כשמעבירים את הרכב
  let photos = {};
  try {
    photos = await _tdBuildPhotos();
  } catch (e) {
    console.error('td photos', e);
    showToast('⚠️ עיבוד התמונות נכשל — הטופס לא נשלח', 7000);
    return;
  }
  if (photos === null) return;   // חרגו מהמקום המותר, הודעה כבר הוצגה

  const data = {
    status: 'done',
    completedBy: currentUser.name,
    completedAt: _serverTs(),
    ...all,
    photos,
    draft: null,
  };
  try {
    const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(doc(window._db, 'test_drives', id), data);
  } catch(e) { showToast('⚠️ שגיאה בשליחה, נסה שוב'); console.error('submitTD', e); return; }
  tdPhotoFiles = {};
  try { localStorage.removeItem('td_draft_photos_' + id); } catch (e) {}
  localStorage.removeItem('anak_td_active');
  try { const done = JSON.parse(localStorage.getItem('anak_td_done')||'[]'); done.push(id); localStorage.setItem('anak_td_done', JSON.stringify(done.slice(-20))); } catch {}
  showToast('✅ הטופס נשלח בהצלחה');
  closeModal('modal-fill-test-drive');
}
window.submitTestDriveForm = submitTestDriveForm;

// ══════════════════════════════════════════
//  LIVE TEST DRIVE PANEL (manager)
// ══════════════════════════════════════════
let _tdLivePanelId = null;
let _tdLivePanelUnsub = null;
let _tdLivePanelData = null;

/* הקטנה והגדלה של פאנל השידור. המצב נשמר, כך שהוא נפתח אחרי רענון
   באותו מצב שהשארת אותו. */
function toggleTdLivePanelMin(force) {
  const panel = document.getElementById('td-live-panel');
  if (!panel) return;
  const min = force === undefined ? !panel.classList.contains('td-min') : !!force;
  panel.classList.toggle('td-min', min);
  document.body.classList.toggle('td-panel-min', min);
  const btn = document.getElementById('td-min-btn');
  if (btn) { btn.textContent = min ? '▲' : '▁'; btn.title = min ? 'הגדל' : 'הקטן'; }
  try { localStorage.setItem('anak_td_panel_min', min ? '1' : ''); } catch (e) {}
}
window.toggleTdLivePanelMin = toggleTdLivePanelMin;

function openTdLivePanel(id, initialData) {
  if (_tdLivePanelUnsub) { _tdLivePanelUnsub(); _tdLivePanelUnsub = null; }
  _tdLivePanelId = id;
  localStorage.setItem('anak_td_mgr_panel', id);
  const panel = document.getElementById('td-live-panel');
  panel.style.display = 'flex';
  document.body.classList.add('td-panel-open');
  let wasMin = '';
  try { wasMin = localStorage.getItem('anak_td_panel_min') || ''; } catch (e) {}
  toggleTdLivePanelMin(!!wasMin);
  const delBtn = document.getElementById('td-delete-btn');
  if (delBtn) delBtn.style.display = currentUser?.role === 'manager' ? '' : 'none';
  if (initialData) { _tdLivePanelData = initialData; _renderTdLivePanel(initialData); }
  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(({ onSnapshot, doc }) => {
    _tdLivePanelUnsub = onSnapshot(doc(window._db, 'test_drives', id), snap => {
      if (!snap.exists()) return;
      _tdLivePanelData = { id: snap.id, ...snap.data() };
      _renderTdLivePanel(_tdLivePanelData);
    });
  });
}
window.openTdLivePanel = openTdLivePanel;

function _renderTdLivePanel(data) {
  const isDone = data.status === 'done';
  const src = isDone ? data : (data.draft || {});
  const checks = src.checks || (isDone ? data.checks || {} : {});
  const notes = src.notes || (isDone ? data.notes || {} : {});

  const badge = document.getElementById('td-live-status-badge');
  if (badge) badge.innerHTML = isDone
    ? '<span style="background:#16a34a;border-radius:6px;padding:2px 8px">✅ הושלם</span>'
    : '<span style="background:rgba(255,255,255,.25);border-radius:6px;padding:2px 8px">⏳ ממתין</span>';

  const vi = document.getElementById('td-live-vehicle-info');
  if (vi) {
    const km = src.km || data.km || '';
    const code = src.code || data.code || '';
    vi.innerHTML = `<div style="font-size:15px;font-weight:900">${esc(data.plate||'')} &nbsp; <span style="font-weight:600;font-size:13px">${esc([data.maker,data.model,data.year,data.color].filter(Boolean).join(' · '))}</span></div>`
      + (km ? `<div style="font-size:12px;color:var(--muted);margin-top:3px">קמ: <b>${esc(km)}</b>${code ? ` &nbsp;|&nbsp; קוד: <b>${esc(code)}</b>` : ''} &nbsp;|&nbsp; נהג: <b>${esc(data.assignedTo||'')}</b></div>` : `<div style="font-size:12px;color:var(--muted);margin-top:3px">נהג: <b>${esc(data.assignedTo||'')}</b></div>`);
  }

  const cont = document.getElementById('td-live-content');
  if (!cont) return;

  const km = src.km || data.km || '';
  const code = src.code || data.code || '';
  const dashLights = src.dashLights || (isDone ? data.dashLights : []) || [];
  const dashOther  = src.dashOtherText || (isDone ? data.dashOtherText : '') || '';
  const extra = src.extraIssues || (isDone ? data.extraIssues : '') || '';
  const extraOk = src.extraOk !== undefined ? src.extraOk : (isDone ? data.extraOk : undefined);

  const RO = 'pointer-events:none;cursor:default';

  let html = '';

  // km + code — mirrored as read-only inputs
  html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div class="form-group" style="margin-bottom:0"><label>קילומטראז׳</label><input class="form-input" readonly value="${esc(km)}" style="${RO};background:var(--surface2)"></div>
    <div class="form-group" style="margin-bottom:0"><label>קוד</label><input class="form-input" readonly value="${esc(code)}" style="${RO};background:var(--surface2)"></div>
  </div>`;

  // checklist items — same structure as driver form, read-only
  Object.entries(_TD_CHECK_LABELS).forEach(([key, label]) => {
    const val = checks[key];
    const vA = val === 'v', xA = val === 'x';
    const note = notes[key] || '';
    html += `<div class="checklist-item"><span class="ci-label">${esc(label)}</span><div class="ci-btns" style="${RO}"><button type="button" class="ci-box${vA?' v-active':''}">✓</button><button type="button" class="ci-box${xA?' x-active':''}">✕</button></div></div>`;
    if (note) html += `<div style="font-size:12px;color:#dc2626;margin:-4px 0 8px;padding-right:14px">⚠️ ${esc(note)}</div>`;

    // dashboard checkboxes — shown inline when x
    if (key === 'td-dashboard' && xA) {
      const dMap = [
        ['td-dash-engine','מנורת צ׳ק אנג׳ין'],['td-dash-tire','לחץ אוויר'],['td-dash-service','טיפול'],
        ['td-dash-collision','מנורת התגשות'],['td-dash-fuel','מנורת דלק'],['td-dash-istop','iStop'],['td-dash-other','אחר'],
      ];
      html += `<div style="display:flex;flex-direction:column;gap:8px;padding:8px 14px;background:var(--surface2);border-radius:10px;margin-bottom:8px;${RO}">`;
      dMap.forEach(([id, lbl]) => {
        const chk = dashLights.includes(id) ? 'checked' : '';
        html += `<label style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;cursor:default"><input type="checkbox" ${chk} disabled style="width:18px;height:18px;accent-color:#16a34a"> ${esc(lbl)}</label>`;
      });
      if (dashOther) html += `<div style="font-size:13px;color:var(--muted);padding:4px 0">${esc(dashOther)}</div>`;
      html += `</div>`;
    }
  });

  // always show "האם יש משהו נוסף" section
  html += `<div class="section-title">האם יש משהו נוסף שלא תקין?</div>`;
  if (extraOk === true) {
    html += `<div style="color:#16a34a;font-weight:700;font-size:14px;padding:8px 0">✅ הרכב תקין</div>`;
  } else if (extra) {
    html += `<div style="background:#fef2f2;border-radius:10px;padding:10px;font-size:13px;color:#dc2626;font-weight:700">⚠️ <span style="font-weight:400;color:var(--text)">${esc(extra)}</span></div>`;
  } else {
    html += `<div style="color:var(--muted);font-size:13px;padding:6px 0">⏳ טרם נענה</div>`;
  }

  if (!isDone && !Object.keys(checks).length) {
    html = '<div style="text-align:center;padding:30px 0;color:var(--muted);font-size:13px">⏳ ממתין שהנהג יתחיל למלא...</div>' + html;
  }

  cont.innerHTML = html;

  // footer
  const footer = document.getElementById('td-live-footer');
  if (footer) {
    const parkBtn = `<button onclick="parkTdLivePanel()" style="flex:1;background:#eab308;color:#fff;border:none;border-radius:12px;padding:14px 8px;font-family:Heebo,sans-serif;font-weight:800;font-size:14px;cursor:pointer">⏳ מצב המתנה</button>`;
    if (isDone) {
      footer.innerHTML = `<div style="display:flex;gap:8px">
        <button onclick="completeTdLivePanel()" style="flex:1;background:#16a34a;color:#fff;border:none;border-radius:12px;padding:14px 8px;font-family:Heebo,sans-serif;font-weight:800;font-size:14px;cursor:pointer">✅ סיום — העבר לקליטה</button>
        ${parkBtn}
      </div>`;
    } else {
      footer.innerHTML = `<div style="font-size:12px;color:var(--muted);text-align:center;margin-bottom:10px">הנהג ממלא את הטופס • הנתונים מתעדכנים בלייב</div>
        <div style="display:flex">${parkBtn}</div>`;
    }
  }
}

let _tdLiveDriveNotesTimer = null;
async function _saveTdLiveDriveNotes(val) {
  if (!_tdLivePanelId) return;
  clearTimeout(_tdLiveDriveNotesTimer);
  _tdLiveDriveNotesTimer = setTimeout(async () => {
    try {
      const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await updateDoc(doc(window._db,'test_drives',_tdLivePanelId), { 'draft.driveNotes': val });
    } catch(e) { console.error(e); }
  }, 600);
}
window._saveTdLiveDriveNotes = _saveTdLiveDriveNotes;

async function _tdLiveCiClick(key, val, btn) {
  if (!_tdLivePanelId) return;
  const curData = _tdLivePanelData || {};
  const curChecks = curData.draft?.checks || curData.checks || {};
  const same = curChecks[key] === val;
  const { updateDoc, doc, deleteField } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const upd = {};
  if (same) upd[`draft.checks.${key}`] = deleteField();
  else upd[`draft.checks.${key}`] = val;
  try { await updateDoc(doc(window._db, 'test_drives', _tdLivePanelId), upd); } catch(e) { console.warn('lp ci update', e); }
}
window._tdLiveCiClick = _tdLiveCiClick;

// shared by the live-panel "סיים" button AND the results-popup button (used
// when the manager wasn't watching that specific test drive live)
async function _tdConvertToIntake(tdId, data) {
  data = data || {};
  console.log('[TD→INTAKE] data:', JSON.stringify(data).slice(0,500));
  if (!data.checks && !data.draft?.checks) {
    showToast('⚠️ אין נתוני נסיעה — המתן שהנהג ישלח את הטופס');
    return false;
  }
  try {
    const { addDoc, collection, updateDoc, doc, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    const tdChecks = data.checks || data.draft?.checks || {};
    const tdNotes  = data.notes  || data.draft?.notes  || {};
    const tdDashLights  = data.dashLights  || data.draft?.dashLights  || [];
    const tdDashOther   = data.dashOtherText || data.draft?.dashOtherText || '';
    console.log('[TD→INTAKE] tdChecks:', JSON.stringify(tdChecks));
    const tdToIntake = { 'td-oil':'c-oil','td-coolant':'c-coolant','td-glass':'c-glass-break','td-windows':'c-windows','td-mirrors':'c-mirrors','td-sunroof':'c-sunroof','td-lights':'c-lights-break','td-lights-burnt':'c-bulbs','td-ac':'c-ac','td-ac-noise':'c-ac-noise','td-dashboard':'c-dashboard','td-drive':'c-drive' };
    const tdDashMap  = { 'td-dash-engine':'dash-check-engine','td-dash-tire':'dash-tire-pressure','td-dash-service':'dash-service','td-dash-collision':'dash-collision','td-dash-fuel':'dash-fuel','td-dash-istop':'dash-istop','td-dash-other':'dash-other' };
    const intakeChecks = {}, intakeNotes = {}, intakeDash = {};
    Object.entries(tdChecks).forEach(([k,v]) => { const ik=tdToIntake[k]; if(ik) intakeChecks[ik]=v; });
    Object.entries(tdNotes).forEach(([k,t]) => { const ik=tdToIntake[k]; if(ik&&t) intakeNotes[ik]=t; });
    tdDashLights.forEach(k => { const ik=tdDashMap[k]; if(ik) intakeDash[ik]=true; });
    if (tdDashOther) intakeNotes['c-dashboard'] = tdDashOther;
    // הקוד שהנהג הקליד בנסיעת המבחן עובר לקליטה — אותו שדה, אותו שם.
    // גם הליקויים הנוספים שפירט עוברים, להערות הכלליות של הקליטה.
    const tdCode = data.code || data.draft?.code || '';
    const tdExtra = data.extraIssues || data.draft?.extraIssues || '';
    // התמונות שצולמו בנסיעת המבחן עוברות לסעיפים המקבילים בקליטה
    const tdPhotos = data.photos || {};
    const intakePhotos = {};
    Object.entries(tdPhotos).forEach(([k, arr]) => {
      const ik = tdToIntake[k];
      if (ik && Array.isArray(arr) && arr.length) intakePhotos[ik] = arr;
    });
    const intakeDraft = {
      checks: intakeChecks, notes: intakeNotes, dashChecks: intakeDash,
      km: data.km || data.draft?.km || '',
      code: tdCode,
      ...(Object.keys(intakePhotos).length ? { photos: intakePhotos } : {}),
      ...(tdExtra ? { general: tdExtra } : {}),
    };
    console.log('[TD→INTAKE] intakeDraft:', JSON.stringify(intakeDraft));
    if (!Object.keys(intakeChecks).length && !intakeDraft.km) {
      showToast('⚠️ לא נמצאו נתוני תשובות — בדוק שהנהג שלח את הטופס');
      return false;
    }

    const existingSnap = await getDocs(query(collection(window._db, 'intake_assignments'), where('fromTestDrive', '==', tdId)));
    if (!existingSnap.empty) {
      console.log('[TD→INTAKE] updating existing intake', existingSnap.docs[0].id);
      await updateDoc(doc(window._db, 'intake_assignments', existingSnap.docs[0].id), { draft: intakeDraft });
    } else {
      console.log('[TD→INTAKE] creating new intake');
      // pull authoritative manufacturer/model/color/year from the transport-
      // ministry registry — the test-drive form only ever fetched maker/year/
      // color (never model), so relying on the driver's saved data left the
      // model blank every time.
      let brand = data.maker || '', model = '', color = data.color || '', year = data.year || '';
      if (data.plate) {
        try {
          const govRes = await fetch(`https://europe-west1-anak-soharim.cloudfunctions.net/govilProxy?resource_id=053cea08-09bc-40ec-8f7a-156f0677aff3&q=${data.plate}&limit=5`);
          const govJson = await govRes.json();
          const rec = govJson?.result?.records?.find(r => String(r['mispar_rechev']) === data.plate) || govJson?.result?.records?.[0];
          if (rec) {
            brand = _cleanMaker(rec['tozeret_nm'] || '') || brand;
            model = rec['kinuy_mishari'] || rec['degem_nm'] || '';
            color = rec['tzeva_rechev'] || color;
            year  = rec['shnat_yitzur'] || year;
          }
        } catch(e) { console.error('[TD→INTAKE] govil lookup failed', e); }
      }
      await addDoc(collection(window._db, 'intake_assignments'), {
        plate: data.plate || '',
        brand, model, color, year,
        spot: '',
        km: data.km || data.draft?.km || '',
        assignedTo: data.assignedTo || currentUser.name,
        createdBy: currentUser.name,
        status: 'pending',
        createdAt: _serverTs(),
        fromTestDrive: tdId,
        draft: intakeDraft,
      });
    }
    await updateDoc(doc(window._db, 'test_drives', tdId), { status: 'transferred' });
    console.log('[TD→INTAKE] done ✅');
    return true;
  } catch(e) { console.error('[TD→INTAKE] ERROR:', e); return false; }
}

async function tdResultConvertToIntake() {
  if (!_tdResultModalId) return;
  const ok = await _tdConvertToIntake(_tdResultModalId, _tdResultModalData);
  if (ok) {
    showToast('✅ נפתחה קליטת רכב עם התוצאות');
    closeModal('modal-td-result');
    _tdResultModalId = null;
    _tdResultModalData = null;
  }
}
window.tdResultConvertToIntake = tdResultConvertToIntake;

async function completeTdLivePanel() {
  if (!_tdLivePanelId) return;
  await _tdConvertToIntake(_tdLivePanelId, _tdLivePanelData);
  if (_tdLivePanelUnsub) { _tdLivePanelUnsub(); _tdLivePanelUnsub = null; }
  _tdLivePanelId = null;
  _tdLivePanelData = null;
  localStorage.removeItem('anak_td_mgr_panel');
  document.getElementById('td-live-panel').style.display = 'none';
  document.body.classList.remove('td-panel-min');
  document.getElementById('td-live-panel').classList.remove('td-min');
  document.body.classList.remove('td-panel-open');
  showToast('✅ הרכב הועבר לקליטה');
}
window.completeTdLivePanel = completeTdLivePanel;

async function deleteTdLivePanel() {
  if (!_tdLivePanelId) return;
  if (!confirm('האם למחוק את נסיעת המבחן? הפעולה תסגור את הטופס גם אצל הנהג.')) return;
  if (!_updateDoc || !_docRef) { showToast('⚠️ Firebase לא מחובר'); return; }
  const id = _tdLivePanelId;
  try {
    // מחיקה אמיתית. קודם רק סומן "cancelled", והנסיעה המשיכה להופיע
    // ברשימה כאילו היא ממתינה למילוי — כלומר המחיקה לא נראתה כלל.
    const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(_docRef('test_drives', id));
  } catch(e) { console.error('deleteTdLivePanel', e); showToast('⚠️ שגיאה במחיקה'); return; }
  if (_tdLivePanelUnsub) { _tdLivePanelUnsub(); _tdLivePanelUnsub = null; }
  _tdLivePanelId = null;
  _tdLivePanelData = null;
  localStorage.removeItem('anak_td_mgr_panel');
  document.getElementById('td-live-panel').style.display = 'none';
  document.body.classList.remove('td-panel-min');
  document.getElementById('td-live-panel').classList.remove('td-min');
  document.body.classList.remove('td-panel-open');
  showToast('🗑 נסיעת המבחן נמחקה');
}
window.deleteTdLivePanel = deleteTdLivePanel;

// close the live panel WITHOUT touching the test drive itself — it stays in
// the test-drive list exactly as it is, and can be reopened from there.
function parkTdLivePanel() {
  if (_tdLivePanelUnsub) { _tdLivePanelUnsub(); _tdLivePanelUnsub = null; }
  _tdLivePanelId = null;
  _tdLivePanelData = null;
  localStorage.removeItem('anak_td_mgr_panel'); // don't auto-reopen on next load
  document.getElementById('td-live-panel').style.display = 'none';
  document.body.classList.remove('td-panel-min');
  document.getElementById('td-live-panel').classList.remove('td-min');
  document.body.classList.remove('td-panel-open');
  showToast('⏳ הנסיעה במצב המתנה — שמורה במסך נסיעות מבחן');
}
window.parkTdLivePanel = parkTdLivePanel;

// restore live panel on manager home load
function _restoreTdLivePanelIfNeeded() {
  if (currentUser?.role !== 'manager') return;
  const savedId = localStorage.getItem('anak_td_mgr_panel');
  if (!savedId) return;
  // check if form still exists and is still relevant
  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(({ getDoc, doc }) => {
    getDoc(doc(window._db, 'test_drives', savedId)).then(snap => {
      if (!snap.exists()) { localStorage.removeItem('anak_td_mgr_panel'); return; }
      const data = snap.data();
      // only restore if pending or done-but-not-yet-completed
      if (data.status === 'pending' || data.status === 'done') {
        openTdLivePanel(savedId, { id: savedId, ...data });
      } else {
        localStorage.removeItem('anak_td_mgr_panel');
      }
    }).catch(() => localStorage.removeItem('anak_td_mgr_panel'));
  });
}
