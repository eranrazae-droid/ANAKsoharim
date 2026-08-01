/* ─────────────────────────────────────────────────────────────
   ענק הרכבים — ליבת אתר הלקוחות
   כאן נמצא כל החיבור לנתונים. שאר הדפים רק מציגים.
   ───────────────────────────────────────────────────────────── */

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ═══════════════════════════════════════════════════════════
   1. הגדרות העסק — לשנות כאן בלבד
   ═══════════════════════════════════════════════════════════ */
export const SITE = {
  name:      'ענק הרכבים',
  phone:     '972544214850',            // מספר לוואטסאפ ולחיוג (פורמט בינלאומי, בלי +)
  phoneNice: '054-4214850',
  address:   'מגרש ענק הרכבים',
  hours:     'א׳–ה׳ 09:00–19:00 · ו׳ 09:00–13:00',
};

/* ═══════════════════════════════════════════════════════════
   2. מקור המלאי — נקודת החיבור ל-CRM
   ───────────────────────────────────────────────────────────
   האתר קורא את הרכבים מ-collection אחד ב-Firestore.
   אם ה-CRM שומר בשם אחר — משנים רק את CARS_COLLECTION.
   אם שמות השדות שונים — מוסיפים אותם לרשימות ב-FIELDS.
   אין צורך לגעת בשום קובץ אחר באתר.
   ═══════════════════════════════════════════════════════════ */
const firebaseConfig = {
  apiKey:            "AIzaSyAVrNBg_EgCKc0B2YUAX9Ga6QZyOVQiiZE",
  authDomain:        "anak-soharim.firebaseapp.com",
  projectId:         "anak-soharim",
  storageBucket:     "anak-soharim.firebasestorage.app",
  messagingSenderId: "343573102369",
  appId:             "1:343573102369:web:129db37c736f10efda4860",
};

export const CARS_COLLECTION  = 'cars';    // ← שם ה-collection של הרכבים ב-CRM
export const LEADS_COLLECTION = 'leads';   // ← לכאן נכנסות הפניות מהאתר

// לכל שדה באתר — רשימת שמות אפשריים ב-CRM. הראשון שנמצא מנצח.
const FIELDS = {
  plate:  ['plate','licensePlate','mispar_rechev','carNumber','מספר_רכב','לוחית'],
  make:   ['make','manufacturer','brand','tozeret','tozeret_nm','יצרן'],
  model:  ['model','carModel','kinuy_mishari','דגם'],
  trim:   ['trim','version','level','ramat_gimur','גימור'],
  year:   ['year','modelYear','shnat_yitzur','שנה','שנת_ייצור'],
  hand:   ['hand','owners','yad','יד'],
  km:     ['km','mileage','kilometers','odometer','קילומטראז','קמ'],
  price:  ['price','askingPrice','salePrice','מחיר'],
  gearbox:['gearbox','transmission','tibat_hilufim','תיבה','תיבת_הילוכים'],
  fuel:   ['fuel','fuelType','sug_delek_nm','דלק','סוג_מנוע'],
  engine: ['engine','engineVolume','nefach_manoa','נפח_מנוע'],
  color:  ['color','carColor','tzeva_rechev','צבע'],
  test:   ['test','testDate','tokef_dt','טסט'],
  body:   ['body','bodyType','sug_rechev','סוג_רכב'],
  desc:   ['description','notes','remarks','תיאור','הערות'],
  status: ['status','saleStatus','state','סטטוס'],
};

// שמות אפשריים לשדה התמונות
const IMG_KEYS_MANY   = ['images','photos','imageUrls','gallery','pictures','תמונות'];
const IMG_KEYS_SINGLE = ['image','imageUrl','photo','photoUrl','coverImage','mainImage','תמונה'];

/* ── אתחול Firebase ── */
let db = null;
try {
  const app = initializeApp(firebaseConfig, 'site');
  db = getFirestore(app, 'default');   // אותו מסד נתונים בשם 'default' כמו במערכת התפעולית
} catch (e) {
  console.warn('Firebase init failed:', e);
}

/* ═══════════════════════════════════════════════════════════
   3. עזרים כלליים
   ═══════════════════════════════════════════════════════════ */
export function esc(s){
  if (s === 0) return '0';
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function fmtPrice(n){
  if (!n && n !== 0) return 'לפרטים';
  return '₪' + Number(n).toLocaleString('en-US');
}

export function fmtNum(n){
  if (!n && n !== 0) return '—';
  return Number(n).toLocaleString('en-US');
}

/** תאריך בפורמט ישראלי. אם הערך אינו תאריך — מוחזר כפי שהוא */
export function fmtDate(v){
  if (!v) return '';
  if (v && typeof v.toDate === 'function') v = v.toDate();      // Firestore Timestamp
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const p = n => String(n).padStart(2, '0');
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
}

export function waLink(text){
  return 'https://wa.me/' + SITE.phone + '?text=' + encodeURIComponent(text || '');
}

export function carTitle(c){
  return [c.make, c.model].filter(Boolean).join(' ') || 'רכב';
}

/** הודעת וואטסאפ מוכנה לרכב מסוים — הלקוח לא צריך להקליד כלום */
export function carWaLink(c){
  const t = carTitle(c) + (c.year ? ' ' + c.year : '');
  return waLink(`היי, אני מתעניין ב${t}${c.plate ? ' (מס׳ ' + c.plate + ')' : ''} שראיתי באתר. אפשר פרטים?`);
}

export function toast(msg){
  let t = document.querySelector('.toast');
  if (!t){ t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 3000);
}

/** מפעיל הופעה בגלילה גם על תוכן שנוצר דינמית (reveal.js אחראי על ההיגיון) */
export function initReveal(){
  if (typeof window.revealNow === 'function') window.revealNow();
}

/** תפריט נייד */
export function initNav(){
  const b = document.querySelector('.nav-burger');
  const l = document.querySelector('.nav-links');
  if (b && l) b.addEventListener('click', () => l.classList.toggle('open'));
}

/* ═══════════════════════════════════════════════════════════
   4. קריאת המלאי
   ═══════════════════════════════════════════════════════════ */
function pick(raw, keys){
  for (const k of keys){
    const v = raw[k];
    if (v !== undefined && v !== null && v !== '' && v !== 'None') return v;
  }
  return '';
}

function toNum(v){
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return isNaN(n) ? null : n;
}

function pickImages(raw){
  for (const k of IMG_KEYS_MANY){
    const v = raw[k];
    if (Array.isArray(v) && v.length) return v.filter(Boolean).map(x => typeof x === 'string' ? x : (x.url || x.src || '')).filter(Boolean);
    if (typeof v === 'string' && v.trim()) return v.split(',').map(s => s.trim()).filter(Boolean);
  }
  const one = pick(raw, IMG_KEYS_SINGLE);
  return one ? [one] : [];
}

function isSold(raw, status){
  if (raw.sold === true) return true;
  const s = String(status || '').toLowerCase();
  return s.includes('sold') || s.includes('נמכר');
}

function isHidden(raw, status){
  const s = String(status || '').toLowerCase();
  // רכב בטיוטה / לא לפרסום לא יופיע באתר
  return raw.published === false || raw.hidden === true
      || s.includes('draft') || s.includes('טיוטה') || s.includes('לא לפרסום');
}

/** ממיר מסמך גולמי מה-CRM למבנה אחיד שהאתר יודע להציג */
export function normalizeCar(id, raw){
  const status = pick(raw, FIELDS.status);
  return {
    id,
    plate:   pick(raw, FIELDS.plate),
    make:    pick(raw, FIELDS.make),
    model:   pick(raw, FIELDS.model),
    trim:    pick(raw, FIELDS.trim),
    year:    toNum(pick(raw, FIELDS.year)),
    hand:    toNum(pick(raw, FIELDS.hand)),
    km:      toNum(pick(raw, FIELDS.km)),
    price:   toNum(pick(raw, FIELDS.price)),
    gearbox: pick(raw, FIELDS.gearbox),
    fuel:    pick(raw, FIELDS.fuel),
    engine:  pick(raw, FIELDS.engine),
    color:   pick(raw, FIELDS.color),
    test:    pick(raw, FIELDS.test),
    body:    pick(raw, FIELDS.body),
    desc:    pick(raw, FIELDS.desc),
    images:  pickImages(raw),
    featured: raw.featured === true || raw.מומלץ === true,
    sold:    isSold(raw, status),
    hidden:  isHidden(raw, status),
  };
}

let _cache = null;

/** מחזיר את כל הרכבים שמותר להציג באתר */
export async function loadCars(){
  if (_cache) return _cache;
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, CARS_COLLECTION));
    const cars = [];
    snap.forEach(d => {
      const c = normalizeCar(d.id, d.data() || {});
      if (!c.hidden) cars.push(c);
    });
    // זמינים קודם, ואז לפי מחיר יורד
    cars.sort((a,b) => (a.sold - b.sold) || ((b.price || 0) - (a.price || 0)));
    _cache = cars;
    return cars;
  } catch (e){
    console.error('loadCars failed:', e);
    return [];
  }
}

export async function getCar(id){
  const cars = await loadCars();
  return cars.find(c => c.id === id) || null;
}

/* ═══════════════════════════════════════════════════════════
   5. שליחת ליד — נכנס ל-CRM
   ═══════════════════════════════════════════════════════════ */
export async function saveLead(data){
  if (!db) throw new Error('no-db');
  return addDoc(collection(db, LEADS_COLLECTION), {
    name:      data.name      || '',
    phone:     data.phone     || '',
    message:   data.message   || '',
    type:      data.type      || 'contact',   // contact | test_drive | trade_in
    carId:     data.carId     || '',
    carPlate:  data.carPlate  || '',
    carTitle:  data.carTitle  || '',
    source:    'website',
    status:    'new',
    createdAt: serverTimestamp(),
  });
}

/* ═══════════════════════════════════════════════════════════
   6. כרטיס רכב — סימון אחיד לכל הדפים
   ═══════════════════════════════════════════════════════════ */
export function carCard(c){
  const title = esc(carTitle(c));
  const specs = [];
  if (c.year)    specs.push(c.year);
  if (c.hand)    specs.push('יד ' + c.hand);
  if (c.km)      specs.push(fmtNum(c.km) + ' ק״מ');
  if (c.gearbox) specs.push(esc(c.gearbox));

  const media = c.images.length
    ? `<img src="${esc(c.images[0])}" alt="${title}" loading="lazy">`
    : `<div class="no-photo">${esc(SITE.name)}</div>`;

  const badge = c.sold
    ? '<span class="car-badge sold">נמכר</span>'
    : (c.featured ? '<span class="car-badge">מומלץ</span>' : '');

  return `
  <a class="car-card reveal" href="car.html?id=${encodeURIComponent(c.id)}">
    <div class="car-media">${media}${badge}</div>
    <div class="car-body">
      <div class="car-title">${title}</div>
      <div class="car-trim">${esc(c.trim || c.body || '')}&nbsp;</div>
      <div class="car-specs">${specs.map(s => `<span class="chip">${s}</span>`).join('')}</div>
      <div class="car-foot">
        <span class="car-price">${fmtPrice(c.price)}</span>
        <span class="car-go">לפרטים ←</span>
      </div>
    </div>
  </a>`;
}
