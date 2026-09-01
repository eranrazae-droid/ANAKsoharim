/* פחחות
   חלק 7 מתוך 13 של אפליקציית התפעול.
   הקבצים נטענים לפי הסדר ומתנהגים בדיוק כמו קובץ אחד — אין לשנות את הסדר. */
function _pcCopyFallback(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
  } catch (e) { showToast('לא ניתן להעתיק — סמן ידנית'); }
}

/* ─── BODY SHOP ────────────────────────────────────────
   Replaces a paper note per car. The manager sends a car with a list of parts;
   the panel beater writes a price next to each part he actually painted, since
   prices are not fixed. At the end of the month the manager settles up and the
   cycle starts over.

   A job's life: at_shop → returned → (settled: paidAt is set and it leaves both
   screens). Jobs are only ever hidden by being paid, never deleted, so the
   history of what was charged stays intact. */
// Walk-around order: the front of the car, down the right side, the back, then
// up the left side and back to the front — the circle closes. This is the order
// the panel beater sees on his screen and on the printed note.
// The same walk-around, written out as categories. Every screen that lists
// parts groups them this way; a part that is not here — one you typed in
// yourself — falls into "אחר" at the end.
const _BSHOP_GROUPS = [
  ['חזית קדמית',  ['טמבון קדמי','מכסה מנוע','שפם']],
  ['צד ימין',      ['כנף קדמי ימין','מראה ימין','דלת קדמי ימין','סף ימין','עמוד ימין','דלת אחורי ימין','כנף אחורי ימין']],
  ['חזית אחורית',  ['טמבון אחורי','דלת תא מטען','ספוילר מעל שמשה אחורית']],
  ['צד שמאל',      ['כנף אחורי שמאל','דלת אחורי שמאל','עמוד שמאל','סף שמאל','דלת קדמי שמאל','מראה שמאל','כנף קדמי שמאל']],
  ['אחר',          ['גג','פוליש','קריסטל']],
];
let _bshopCats = {};   // {part name: category} — only for parts you added yourself
const _bshopGroupOf = name =>
  _bshopCats[name] || (_BSHOP_GROUPS.find(g => g[1].includes(name)) || ['אחר'])[0];

// Splits a list of parts into [category, parts] pairs, keeping the category
// order and dropping categories with nothing in them.
function _bshopByGroup(names) {
  const out = _BSHOP_GROUPS.map(([g]) => [g, names.filter(n => _bshopGroupOf(n) === g)]);
  // a part whose saved category is not one of ours must never disappear from
  // the screen — it joins "אחר" instead
  const placed = new Set(out.flatMap(([, list]) => list));
  const left = names.filter(n => !placed.has(n));
  if (left.length) {
    const other = out.find(([g]) => g === 'אחר');
    if (other) other[1] = [...other[1], ...left];
    else out.push(['אחר', left]);
  }
  return out.filter(([, list]) => list.length);
}
const _BSHOP_GROUP_CAR = '#0f766e';   // the one colour category labels wear
const _bshopGroupTitle = (g, color) => `<div style="display:flex;align-items:center;gap:8px;margin:18px 0 8px">
  <span style="background:${color || _BSHOP_GROUP_CAR};color:#fff;border-radius:999px;padding:5px 14px;font-size:14px;font-weight:900">${esc(g)}</span>
  <span style="flex:1;height:2px;background:var(--border)"></span>
</div>`;

const _BSHOP_CATALOG_VERSION = 4;
const _BSHOP_DEFAULT_ITEMS = [
  // חזית קדמית
  'טמבון קדמי','מכסה מנוע','שפם',
  // צד ימין
  'כנף קדמי ימין','מראה ימין','דלת קדמי ימין','סף ימין','עמוד ימין',
  'דלת אחורי ימין','כנף אחורי ימין',
  // חזית אחורית
  'טמבון אחורי','דלת תא מטען','ספוילר מעל שמשה אחורית',
  // צד שמאל — סוגר את המעגל חזרה לחזית
  'כנף אחורי שמאל','דלת אחורי שמאל','עמוד שמאל','סף שמאל',
  'דלת קדמי שמאל','מראה שמאל','כנף קדמי שמאל',
  // אחר
  'גג','פוליש','קריסטל'
];

// Sort any set of part names by their position in the catalogue, so a job
// always reads in the walk-around order no matter what order they were picked.
function _bshopSortNames(names) {
  const idx = n => { const i = _bshopItems.indexOf(n); return i === -1 ? 9999 : i; };
  return [...names].sort((a, b) => idx(a) - idx(b));
}

let _bshopJobs = [];        // unpaid jobs only — the current billing cycle
let _bshopItems = [];       // the fixed catalogue of parts
let _bshopUnsubJobs = null, _bshopUnsubCfg = null, _bshopUnsubArc = null;
let _bshopArchive = [];   // one folder per payment to Ibrahim
let _bsmPicked = [];        // parts selected while composing a new job
let _bsmVladi = [];         // parts for Vladi — a separate list, never mixed
let _bsmFocus = null;       // where the number plate sits in the photo, 0..1
let _bshopFillId = null;

function _bshopListen(onChange) {
  if (_bshopUnsubJobs) _bshopUnsubJobs();
  if (_bshopUnsubCfg) _bshopUnsubCfg();
  if (_bshopUnsubArc) { _bshopUnsubArc(); _bshopUnsubArc = null; }
  // the archive is shown to the manager and to the panel beater alike — he
  // needs to see what he was already paid for
  _bshopUnsubArc = _onSnap(_colRef('bodyshop_archive'), snap => {
    _bshopArchive = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.paidAt || '').localeCompare(String(a.paidAt || '')));
    _bsmRenderArchive();
    _bshopRenderWorkerArchive();
  });
  // Only the open cycle is loaded. Paid jobs stay in the database untouched —
  // they are simply not fetched, so the screens stay fast however many notes
  // pile up over the years.
  _bshopUnsubJobs = _onSnap(_query(_colRef('bodyshop_jobs'), _where('paidAt', '==', null)), snap => {
    _bshopJobs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(j => !j.paidAt)
      // החדש למעלה בכל המסכים. פתק ישן בלי createdAt יורד לסוף במקום
      // לקפוץ לראש.
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    onChange();
  }, err => {
    console.error('bodyshop jobs listen error:', err);
    showToast('⚠️ בעיה בטעינת הרכבים — רענן את הדף');
    const c = document.getElementById('bshop-open');
    if (c) c.innerHTML = `<div class="bshop-span" style="padding:20px;text-align:center;color:#b91c1c;font-weight:800">⚠️ בעיה בטעינת הרכבים<br><span style="font-size:12px;font-weight:600">${esc(err.code || err.message || '')}</span></div>`;
  });
  _bshopUnsubCfg = _onSnap(_docRef('config', 'bodyshop'), snap => {
    const d = snap.exists() ? snap.data() : {};
    // a catalogue saved before the current part list is ignored, so the new
    // walk-around list replaces the old part names instead of merging with them
    _bshopCats = (d.cats && typeof d.cats === 'object') ? d.cats : {};
    // an empty saved list is treated as no list at all, otherwise the form
    // would offer nothing to pick
    const saved = Array.isArray(d.items)
      ? d.items.filter(n => typeof n === 'string' && n.trim())
      : [];
    const fresh = d.v === _BSHOP_CATALOG_VERSION && saved.length > 0;
    if (fresh) {
      _bshopItems = saved;   // saved by us — this is the order the manager set
    } else if (saved.length) {
      // רשימה שנשמרה בגרסה ישנה של הקטלוג — משלבים אותה ולא משליכים אותה.
      // סדר ההליכה סביב הרכב קודם, וכל מה שהוסיפו נשאר אחריו לפי הסדר שנשמר.
      _bshopItems = [
        ..._BSHOP_DEFAULT_ITEMS,
        ...saved.filter(n => !_BSHOP_DEFAULT_ITEMS.includes(n)),
      ];
    } else {
      _bshopItems = [..._BSHOP_DEFAULT_ITEMS];
    }
    onChange();
    // the parts-list modal must refresh too, otherwise add/delete looks like it did nothing
    const im = document.getElementById('modal-bsm-items');
    if (im && im.classList.contains('open')) _bsmRenderCatalog();
  });
}

const _bshopTotal = j => (j.items || []).reduce((s, it) => s + (Number(it.price) || 0), 0);

// keeps the plate inside the visible strip of the photo
const _bshopFocusCss = j => j.photoFocus
  ? `${Math.round(j.photoFocus.x * 100)}% ${Math.round(j.photoFocus.y * 100)}%`
  : '50% 50%';

/* Prices are written without VAT, the way the panel beater quotes them. The
   payment box therefore shows all three numbers: the sum, the VAT on it, and
   what is actually paid. */
function _bshopTotalsHtml(sum) {
  const vat = sum * _VAT_RATE;
  const ils = n => Math.round(n).toLocaleString('he-IL') + ' ₪';
  const line = (label, value, big) => `<div style="display:flex;justify-content:space-between;gap:10px;${big ? 'font-size:19px;padding-top:8px;margin-top:6px;border-top:1px solid rgba(255,255,255,.3)' : 'font-size:15px;margin-bottom:4px'}">
      <span>${label}</span><span>${value}</span></div>`;
  return `<div style="height:100%;border-radius:14px;padding:14px;background:var(--dark);color:#fff;font-weight:900">
    ${line('סכום לתשלום', ils(sum))}
    ${line(`מע״מ ${Math.round(_VAT_RATE * 100)}%`, ils(vat))}
    ${line('סה״כ כולל מע״מ', ils(sum + vat), true)}
  </div>`;
}

// Days the car has been at Ibrahim's. The clock starts when the note is sent
// and stops the moment the car is marked as finished — by him or by the yard.
function _bshopDays(j) {
  if (!j.sentAt) return null;
  const start = new Date(j.sentAt).getTime();
  if (!start) return null;
  const end = j.status === 'returned' && j.returnedAt ? new Date(j.returnedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function _bshopDaysHtml(j) {
  const d = _bshopDays(j);
  if (d === null) return '';
  const done = j.status === 'returned';
  const txt = d === 0 ? 'נשלח היום' : d === 1 ? 'יום אחד' : `${d} ימים`;
  const suffix = done ? ' · הסתיים' : d === 0 ? '' : ' אצל הפחח';
  const bg = done ? 'var(--surface2)' : d >= 7 ? '#fee2e2' : 'var(--surface2)';
  const col = done ? 'var(--muted)' : d >= 7 ? '#b91c1c' : 'var(--text)';
  return `<span style="display:inline-block;background:${bg};color:${col};border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800">⏱ ${txt}${suffix}</span>`;
}

/* The manufacturer's logo replaces the generic car emoji on every body-shop
   card. Names come from the transport ministry in Hebrew, so they are matched
   by substring; anything unknown simply stays an emoji. */
const _BRAND_SLUGS = [
  ['אאודי','audi'],['ב.מ.וו','bmw'],['במוו','bmw'],['ב מ וו','bmw'],
  ['מרצדס','mercedes'],['פולקסווגן','volkswagen'],['פולקסוואגן','volkswagen'],
  ['סקודה','skoda'],['סיאט','seat'],['קופרה','cupra'],['פורשה','porsche'],['פורש','porsche'],
  ['מיני','mini'],['אופל','opel'],['פיג׳ו','peugeot'],['פיגו','peugeot'],['פיז׳ו','peugeot'],
  ['רנו','renault'],['סיטרואן','citroen'],['דאצ׳יה','dacia'],['דאציה','dacia'],
  ['פיאט','fiat'],['אלפא','alfaromeo'],['ג׳יפ','jeep'],['גיפ','jeep'],
  ['פורד','ford'],['שברולט','chevrolet'],['טסלה','tesla'],
  ['טויוטה','toyota'],['טויטה','toyota'],['לקסוס','lexus'],['הונדה','honda'],['אקורה','acura'],
  ['ניסאן','nissan'],['ניסן','nissan'],['מאזדה','mazda'],['מזדה','mazda'],
  ['סובארו','subaru'],['סוברו','subaru'],['סוזוקי','suzuki'],
  ['מיצובישי','mitsubishi'],['מיצובושי','mitsubishi'],['דייהטסו','daihatsu'],['איסוזו','isuzu'],
  ['יונדאי','hyundai'],['הונדאי','hyundai'],['קיה','kia'],['קיא','kia'],['סאנגיונג','ssangyong'],
  ['וולוו','volvo'],['וולבו','volvo'],['יגואר','jaguar'],['לנד רובר','landrover'],['ריינג','landrover'],
  ['פרארי','ferrari'],['למבורגיני','lamborghini'],['מזראטי','maserati'],['בנטלי','bentley'],
  ['רולס','rollsroyce'],['אסטון','astonmartin'],['סמארט','smart'],
  ['ביי די','byd'],['בי.וואי.די','byd'],['צ׳רי','chery'],['גילי','geely'],['ג׳ילי','geely'],
];

function _brandSlug(maker) {
  const m = String(maker || '');
  for (const [heb, slug] of _BRAND_SLUGS) if (m.includes(heb)) return slug;
  return '';
}

// falls back to the car emoji if the logo cannot be fetched (no network, or a
// make the icon service does not carry)
function _brandIcon(maker, size) {
  const slug = _brandSlug(maker);
  const px = size || 22;
  if (!slug) return '🚗';
  return `<img src="https://cdn.simpleicons.org/${slug}" alt="" width="${px}" height="${px}"
    loading="lazy" referrerpolicy="no-referrer"
    style="vertical-align:-3px;object-fit:contain" onerror="this.outerHTML='🚗'">`;
}

/* ---- the panel beater's screen ---- */
/* Three views behind one menu button: the cars in the shop (where he starts),
   the ones he finished, and what he has been paid. */
let _bshopView = 'open';
const _BSHOP_VIEWS = { open: 'רכבים שבעבודה', done: 'מכוניות שסיימנו', arc: 'תשלומים שקיבלת' };

function toggleBshopMenu(force) {
  const m = document.getElementById('bshop-menu');
  if (!m) return;
  const show = force != null ? force : m.style.display === 'none';
  m.style.display = show ? 'block' : 'none';
}
window.toggleBshopMenu = toggleBshopMenu;

function bshopShowView(name) {
  _bshopView = _BSHOP_VIEWS[name] ? name : 'open';
  for (const k of Object.keys(_BSHOP_VIEWS)) {
    const el = document.getElementById('bshop-view-' + k);
    if (el) el.style.display = k === _bshopView ? '' : 'none';
  }
  const t = document.getElementById('bshop-view-title');
  if (t) t.textContent = 'פחחות';
  document.querySelectorAll('#bshop-menu .bshop-menu-item').forEach((b, i) => {
    b.classList.toggle('active', Object.keys(_BSHOP_VIEWS)[i] === _bshopView);
  });
  toggleBshopMenu(false);
  window.scrollTo({ top: 0 });
}
window.bshopShowView = bshopShowView;

// a tap anywhere else closes the menu
document.addEventListener('click', e => {
  const m = document.getElementById('bshop-menu');
  if (!m || m.style.display === 'none') return;
  if (!e.target.closest('#bshop-menu') && !e.target.closest('[aria-label="תפריט"]')) toggleBshopMenu(false);
});

/* Holding the logo for two seconds returns to the sign-in screen. It is the
   only way off this screen, deliberately hidden so it is not found by accident. */
let _bshopHoldTimer = null;
function _bshopLogoHold(down) {
  clearTimeout(_bshopHoldTimer);
  if (down) _bshopHoldTimer = setTimeout(() => {
    if (confirm('לצאת ולעבור למסך ההתחברות?')) goToLoginScreen();
  }, 2000);
}
window._bshopLogoHold = _bshopLogoHold;

function openBodyShopScreen() {
  showScreen('bodyshop');
  // the manager may be looking at this screen — he gets a way back
  const back = document.getElementById('bshop-back-mgr');
  if (back) back.style.display = (_realUser?.role === 'manager') ? '' : 'none';
  bshopShowView('open');   // always opens on the cars in the shop
  _bshopListen(_bshopRenderWorker);
}
window.openBodyShopScreen = openBodyShopScreen;

/* Deleting one note at a time, from anywhere it may live: waiting to be sent,
   at the shop, finished, or inside a payment folder. A folder that loses a car
   has its total corrected, so the archive keeps adding up. */
function openBsmDelete() {
  const el = document.getElementById('bsm-del-search');
  if (el) el.value = '';
  _bsmRenderDelete();
  openModal('modal-bsm-delete');
}
window.openBsmDelete = openBsmDelete;

function _bsmDeleteRows() {
  const label = { draft: 'ממתין לשליחה', at_shop: 'אצל הפחח', returned: 'סיימנו' };
  // סדר הרשימה לפי מצב הפתק: קודם מה שממתין לשליחה, אחר כך מה שאצל
  // הפחח, אחר כך מה שסיימנו, ובסוף הארכיון
  const order = { draft: 0, at_shop: 1, returned: 2 };
  const rows = _bshopJobs.map(j => ({
    key: 'job:' + j.id, plate: j.plate || '', desc: j.desc || '',
    where: label[j.status] || j.status, total: _bshopTotal(j),
    rank: order[j.status] ?? 3,
  }));
  for (const a of _bshopArchive) {
    (a.cars || []).forEach((c, i) => rows.push({
      key: `arc:${a.id}:${i}`, plate: c.plate || '', desc: c.desc || '',
      where: 'ארכיון · ' + (a.title || ''), total: Number(c.total || 0),
      rank: 4,
    }));
  }
  rows.sort((a, b) => a.rank - b.rank);
  return rows;
}

function _bsmRenderDelete() {
  const c = document.getElementById('bsm-del-list');
  if (!c) return;
  const term = (document.getElementById('bsm-del-search')?.value || '').replace(/\D/g, '');
  let rows = _bsmDeleteRows();
  if (term) rows = rows.filter(r => String(r.plate).replace(/\D/g, '').startsWith(term));
  c.innerHTML = rows.length ? rows.map(r => `
    <div style="display:flex;align-items:center;gap:10px;border:2px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:var(--card)">
      <div style="flex:1;min-width:0">
        <div style="font-weight:900;font-size:15px">${esc(r.plate)}</div>
        <div style="font-size:12px;color:var(--muted);font-weight:700">${esc(r.where)}${r.desc ? ' · ' + esc(r.desc) : ''}${r.total ? ' · ' + r.total.toLocaleString('he-IL') + ' ₪' : ''}</div>
      </div>
      <button onclick="bsmDeleteOne('${r.key}')" style="background:#ef4444;color:#fff;border:none;border-radius:8px;width:34px;height:34px;font-size:15px;cursor:pointer">🗑</button>
    </div>`).join('')
    : `<div style="padding:16px;text-align:center;color:var(--muted)">${term ? 'לא נמצא פתק במספר הזה' : 'אין פתקים'}</div>`;
}

async function bsmDeleteOne(key) {
  const [kind, a1, a2] = key.split(':');
  try {
    const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    if (kind === 'job') {
      const j = _bshopJobs.find(x => x.id === a1);
      if (!j || !confirm(`למחוק לתמיד את הפתק של ${j.plate}?`)) return;
      await deleteDoc(_docRef('bodyshop_jobs', j.id));
      await deleteDoc(_docRef('bodyshop_photos', j.id)).catch(() => {});
    } else {
      const a = _bshopArchive.find(x => x.id === a1);
      const idx = Number(a2);
      const car = a?.cars?.[idx];
      if (!a || !car || !confirm(`למחוק את ${car.plate} מהתיקייה "${a.title || ''}"?\nסכום התיקייה יעודכן בהתאם.`)) return;
      const cars = a.cars.filter((_, i) => i !== idx);
      const total = cars.reduce((t, c) => t + Number(c.total || 0), 0);
      await _updateDoc(_docRef('bodyshop_archive', a.id), { cars, total });
      // the paid note behind it goes too, so it cannot come back in a report
      if (car.id) {
        await deleteDoc(_docRef('bodyshop_jobs', car.id)).catch(() => {});
        await deleteDoc(_docRef('bodyshop_photos', car.id)).catch(() => {});
      }
    }
    showToast('🗑 נמחק');
    setTimeout(_bsmRenderDelete, 400);
  } catch (e) { showToast('שגיאה במחיקה: ' + (e.code || e.message)); }
}
window.bsmDeleteOne = bsmDeleteOne;

function _bshopJobCard(j, forWorker, held) {
  const total = _bshopTotal(j);
  const filled = (j.items || []).filter(it => Number(it.price) > 0).length;
  const desc = [j.desc].filter(Boolean).join(' ');
  return `<div class="${forWorker ? 'bshop-card-sm' : ''}" onclick="${forWorker ? `bshopOpenFill('${j.id}')` : `bsmOpenJob('${j.id}')`}"
      style="border:2px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px;background:var(--card);cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <div style="flex:1;min-width:0">
        <div class="bs-plate" style="font-weight:900;font-size:17px">${_brandIcon(j.maker)} ${
          // לחיצה על המספר מעתיקה אותו — אצל המנהל בלבד. אצל הפחח המספר
          // הוא טקסט רגיל, כדי שלחיצה לא תעתיק בטעות.
          forWorker ? esc(j.plate)
            : `<span onclick="event.stopPropagation();bsmCopyPlate('${esc(j.plate)}')" title="לחץ להעתקה"
             style="cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px">${esc(j.plate)} 📋</span>`}</div>
        ${desc ? `<div class="bs-desc" style="font-size:13px;color:var(--muted)">${esc(desc)}</div>` : ''}
      </div>
      ${total > 0 ? `<div style="text-align:left;white-space:nowrap">
        <div class="bs-total" style="font-size:18px;font-weight:900;color:var(--gold)">${total.toLocaleString('he-IL')} ₪</div>
        <div style="font-size:11px;font-weight:700;color:var(--muted)">לפני מע״מ</div>
      </div>` : ''}
    </div>
    <div class="bs-meta" style="margin-top:8px;font-size:13px;color:var(--muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span>${(j.items || []).length} חלקים${filled ? ` · מולאו ${filled}` : ''}</span>
      ${_bshopDaysHtml(j)}
    </div>
    ${j.note ? `<div class="bs-note" style="margin-top:6px;font-size:13px">📝 ${esc(j.note)}</div>` : ''}
    ${j.photoFailed ? `<div class="bs-note" style="margin-top:6px;background:#fef3c7;color:#92400e;border-right:5px solid #d97706;border-radius:8px;padding:6px 9px;font-size:12px;font-weight:900">⚠️ התמונה לא נשמרה</div>` : ''}
    ${j.reportFailed && _BSHOP_TG_BACKUP ? `<div class="bs-note" style="margin-top:6px;background:#fee2e2;color:#991b1b;border-right:5px solid #dc2626;border-radius:8px;padding:6px 9px;font-size:12px;font-weight:900">⚠️ הגיבוי לטלגרם לא נשלח</div>` : ''}
    ${(() => {
      // a price of 0 is a real answer — only an empty field is missing
      const empty = (j.items || []).filter(it => it.price == null || it.price === '').length;
      if (j.status !== 'returned' || !empty) return '';
      const all = empty === (j.items || []).length;
      return `<div class="bs-note" style="margin-top:6px;background:#fee2e2;color:#991b1b;border-right:5px solid #dc2626;border-radius:8px;padding:6px 9px;font-size:12px;font-weight:900">⚠️ ${all ? 'לא עודכן תשלום' : 'חסר מחיר לחלק בפתק'}</div>`;
    })()}
    ${(j.photoThumb || j.photo) ? `<img id="bshop-card-img-${j.id}" src="${j.photo || j.photoThumb}" alt="" loading="lazy" style="margin-top:8px;width:100%;max-height:150px;object-fit:cover;object-position:${_bshopFocusCss(j)};border-radius:10px;display:block">`
      : (!held && !forWorker ? `<button onclick="event.stopPropagation();bsmAddPhoto('${j.id}')" style="margin-top:8px;width:100%;background:#0ea5e9;color:#fff;border:none;border-radius:10px;padding:9px;font-family:'Heebo',sans-serif;font-size:13px;font-weight:800;cursor:pointer">📷 הוסף תמונה</button>` : '')}
    ${held ? `<button onclick="event.stopPropagation();bsmSetHold('${j.id}',false)"
      style="margin-top:10px;width:100%;background:var(--success);color:#fff;border:none;border-radius:10px;padding:11px;font-family:'Heebo',sans-serif;font-size:14px;font-weight:900;cursor:pointer">▶️ החזר לפעילות</button>` : ''}
    ${!held && !forWorker && j.status === 'returned' ? (j.swUpdated
      ? `<button onclick="event.stopPropagation();bsmSetSwUpdated('${j.id}',false)" title="בטל סימון"
          style="margin-top:10px;width:100%;background:var(--success);color:#fff;border:none;border-radius:10px;padding:10px;font-family:'Heebo',sans-serif;font-size:14px;font-weight:900;cursor:pointer">✅ עודכן בתוכנה</button>`
      : `<button onclick="event.stopPropagation();bsmSetSwUpdated('${j.id}',true)"
          style="margin-top:10px;width:100%;background:#b45309;color:#fff;border:none;border-radius:10px;padding:10px;font-family:'Heebo',sans-serif;font-size:14px;font-weight:900;cursor:pointer">💳 עדכנתי בתוכנה</button>`) : ''}
    ${!held && !forWorker && j.status === 'at_shop' ? `<button onclick="event.stopPropagation();bsmMarkReturned('${j.id}')"
      style="margin-top:10px;width:100%;background:var(--dark);color:#fff;border:none;border-radius:10px;padding:10px;font-family:'Heebo',sans-serif;font-size:14px;font-weight:900;cursor:pointer">✅ סיימנו עם הרכב</button>` : ''}
    ${!held && !forWorker && j.status === 'draft' ? `<div style="display:flex;gap:8px;margin-top:10px">
      <button onclick="event.stopPropagation();bsmSendToShop('${j.id}')"
        style="flex:1;background:var(--success);color:#fff;border:none;border-radius:10px;padding:11px 6px;font-family:'Heebo',sans-serif;font-size:15px;font-weight:900;cursor:pointer">📤 שלח לאיברהים</button>
      <button onclick="event.stopPropagation();bsmPrint('${j.id}')"
        style="flex:1;background:var(--dark);color:#fff;border:none;border-radius:10px;padding:11px 6px;font-family:'Heebo',sans-serif;font-size:15px;font-weight:900;cursor:pointer">🖨️ הדפס פתק</button>
    </div>` : ''}
    ${!held && !forWorker ? `<button onclick="event.stopPropagation();bsmSetHold('${j.id}',true)" title="הוצא מהמסך עד שתחזיר אותו"
      style="margin-top:8px;width:100%;background:transparent;color:var(--muted);border:2px solid var(--border);border-radius:10px;padding:7px;font-family:'Heebo',sans-serif;font-size:12.5px;font-weight:800;cursor:pointer">⏸️ העבר להמתנה</button>` : ''}
  </div>`;
}

// the same folders the manager sees, in the panel beater's own screen
function _bshopRenderWorkerArchive() {
  const c = document.getElementById('bshop-archive');
  if (!c) return;
  c.innerHTML = _bshopArchive.length
    ? _bshopArchive.map(a => `<div onclick="bsmOpenArchive('${a.id}')"
        style="display:flex;align-items:center;gap:10px;border:2px solid var(--border);border-radius:14px;padding:14px;background:var(--card);cursor:pointer">
        <div style="font-size:26px">📁</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:900;font-size:16px">${esc(a.title || '')}</div>
          <div style="font-size:13px;color:var(--muted)">${(a.cars || []).length} רכבים</div>
        </div>
        <div style="font-size:17px;font-weight:900;color:var(--gold);white-space:nowrap">${Number(a.total || 0).toLocaleString('he-IL')} ₪</div>
      </div>`).join('')
    : `<div class="bshop-span" style="padding:16px;text-align:center;color:var(--muted)">עדיין לא נסגר חשבון</div>`;
}

/* חתימה של מה שבאמת מצויר על המסך של הפחח. כל כתיבה במסד — גם כזו שלא
   נוגעת בו — הפעילה ציור מחדש, והמסך "קפץ" באמצע עבודה. עכשיו הציור רץ
   רק כשמשהו שהוא רואה השתנה באמת. */
function _bshopWorkerSig(jobs) {
  return JSON.stringify(jobs.map(j => [
    j.id, j.plate, j.desc, j.status, j.note, j.photoThumb ? 1 : 0, j.swUpdated ? 1 : 0,
    (j.items || []).map(it => `${it.name}:${it.price ?? ''}`).join('|'),
  ]));
}
let _bshopWorkerSigLast = null;
let _bshopWorkerPending = false;

function _bshopRenderWorker(force) {
  const openC = document.getElementById('bshop-open');
  const retC  = document.getElementById('bshop-returned');
  if (!openC || !retC) return;
  const open = _bshopJobs.filter(j => j.status === 'at_shop');
  const ret  = _bshopJobs.filter(j => j.status === 'returned');
  // בזמן שהפתק פתוח לעריכה לא מציירים מחדש מתחתיו — הציור מחכה לסגירה
  const fill = document.getElementById('modal-bshop-fill');
  if (!force && fill && fill.classList.contains('open')) { _bshopWorkerPending = true; return; }
  const sig = _bshopWorkerSig(_bshopJobs);
  if (!force && sig === _bshopWorkerSigLast) return;   // שום דבר לא השתנה
  _bshopWorkerSigLast = sig;
  openC.innerHTML = open.length ? open.map(j => _bshopJobCard(j, true)).join('')
    : `<div class="bshop-span" style="padding:24px;text-align:center;color:var(--muted)">${
        _bshopJobs.length ? 'אין רכבים אצלך כרגע' : 'לא התקבלו פתקים מהשרת — בדוק חיבור'}</div>`;
  const bd = document.getElementById('bshop-build');
  if (bd) bd.textContent = 'גרסה ' + APP_BUILD;
  const sum = ret.reduce((s, j) => s + _bshopTotal(j), 0);
  // the money is what he came to see — it sits above the cars, not under them
  const totC = document.getElementById('bshop-returned-total');
  if (totC) totC.innerHTML = ret.length ? _bshopTotalsHtml(sum) : '';
  retC.innerHTML = ret.length
    ? ret.map(j => _bshopJobCard(j, true)).join('')
    : `<div class="bshop-span" style="padding:16px;text-align:center;color:var(--muted)">עדיין לא סיימת רכבים</div>`;
  _bshopUpgradeCardPhotos();
  _bshopRenderWorkerArchive();
}

// הציור שנדחה בזמן שהפתק היה פתוח מתבצע ברגע שהוא נסגר
function _bshopFillClosed() {
  _bshopFillId = null;
  if (!_bshopWorkerPending) return;
  _bshopWorkerPending = false;
  _bshopRenderWorker(true);
}
window._bshopFillClosed = _bshopFillClosed;

let _bshopFillMgr = false;   // the manager edits the same note, with more freedom

function bshopOpenFill(id) {
  const j = _bshopJobs.find(x => x.id === id);
  if (!j) return;
  _bshopFillId = id;
  _bshopFillMgr = currentUser?.role === 'manager';
  const _set = (elId, txt) => { const e = document.getElementById(elId); if (e) e.textContent = txt; };
  _set('bshop-fill-hint', _bshopFillMgr
    ? 'אפשר להוסיף ולהוריד חלקים. המחירים נרשמים על ידי איברהים בלבד.'
    : 'רשום מחיר ליד כל חלק שצבעת. חלק שלא עשית — השאר ריק.');
  _set('bshop-fill-add', _bshopFillMgr ? '➕ הוסף חלק' : '➕ צבעתי עוד חלק');
  const prn = document.getElementById('bshop-fill-print');
  if (prn) prn.style.display = _bshopFillMgr ? '' : 'none';
  // גם בפתק הפתוח — העתקה בלחיצה אצל המנהל בלבד
  document.getElementById('bshop-fill-title').innerHTML =
    `${_brandIcon(j.maker)} ${_bshopFillMgr
      ? `<span onclick="bsmCopyPlate('${esc(j.plate)}')" title="לחץ להעתקה"
       style="cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px">${esc(j.plate)} 📋</span>`
      : esc(j.plate)}${j.desc ? ' · ' + esc(j.desc) : ''}`;
  if (!j.desc) _bshopFillCarDetails(id);   // an old note with no car details
  const fp = document.getElementById('bshop-fill-photo');
  const small = j.photo || j.photoThumb || '';
  if (fp) fp.innerHTML = small
    ? `<img id="bshop-fill-img" src="${small}" alt="" onclick="openLightbox(this.src)" style="width:100%;max-height:220px;object-fit:cover;object-position:${_bshopFocusCss(j)};border-radius:12px;margin-bottom:12px;cursor:zoom-in;display:block">` : '';
  if (small) _bshopLoadFullPhoto(id).then(() => _bshopFixFocus(_bshopJobs.find(x => x.id === id)));
  // the manager's note is the first thing that must be read, so it sits above
  // the parts, in large type, marked in yellow
  const noteEl = document.getElementById('bshop-fill-note');
  if (noteEl) noteEl.innerHTML = j.note
    ? `<div style="background:#fef08a;color:#000;border-right:6px solid #eab308;border-radius:12px;padding:14px 16px;margin-bottom:14px;font-size:20px;font-weight:900;line-height:1.5">📝 ${esc(j.note)}</div>`
    : '';
  // a car already marked as finished can still have its prices corrected,
  // it just does not need the green button any more
  const isDone = j.status === 'returned';
  const doneBtn = document.getElementById('bshop-fill-done');
  if (doneBtn) doneBtn.style.display = (isDone || _bshopFillMgr) ? 'none' : '';
  const doneNote = document.getElementById('bshop-fill-donenote');
  if (doneNote) doneNote.style.display = (isDone && !_bshopFillMgr) ? 'block' : 'none';
  _bshopSetSaved('');
  const _row = (it, i) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      ${(it.addedByShop || _bshopFillMgr) ? `<button type="button" onclick="bshopRemovePart(${i})" title="הורד מהרשימה" style="background:#ef4444;color:#fff;border:none;border-radius:8px;width:30px;height:30px;font-size:15px;cursor:pointer">✕</button>` : ''}
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:700">${esc(it.name)}</div>
        ${it.addedByShop ? `<div style="font-size:12px;font-weight:800;color:#b45309">➕ איברהים הוסיף</div>` : ''}
      </div>
      ${_bshopFillMgr
        ? `<div style="width:110px;text-align:center;font-size:17px;font-weight:800;color:${it.price == null || it.price === '' ? 'var(--muted)' : 'var(--text)'}">${it.price == null || it.price === '' ? '—' : Number(it.price).toLocaleString('he-IL')}</div>`
        : `<input type="text" inputmode="numeric" class="form-input bshop-price" data-i="${i}"
             value="${it.price != null && it.price !== '' ? it.price : ''}" placeholder="מחיר"
             onfocus="_bshopCaretEnd(this)" oninput="this.value=this.value.replace(/[^0-9]/g,'');_bshopRecalc();_bshopAutoSave()"
             onblur="_bshopAutoSave(true)" style="width:110px;text-align:center;font-size:17px;font-weight:800">`}
      <span style="font-size:15px;font-weight:800;color:var(--muted)">₪</span>
    </div>`;
  // the index stays the one from j.items, so grouping does not disturb saving
  const rows = (j.items || []).map((it, i) => ({ it, i }));
  // the panel beater gets a plain list of parts; the categories are the
  // manager's way of organising them and only clutter his screen
  document.getElementById('bshop-fill-items').innerHTML = _bshopFillMgr
    ? _bshopByGroup(rows.map(r => r.it.name)).map(([g, list]) =>
        _bshopGroupTitle(g, _BSHOP_GROUP_CAR) + list.map(n => {
          const r = rows.find(x => x.it.name === n && !x.used);
          if (r) r.used = true;
          return r ? _row(r.it, r.i) : '';
        }).join('')
      ).join('')
    : rows.map(r => _row(r.it, r.i)).join('');
  _bshopRecalc();
  openModal('modal-bshop-fill');
}
window.bshopOpenFill = bshopOpenFill;

/* A note written before the details were pulled shows a bare plate number. The
   car is looked up once, written onto the note, and from then on everybody sees
   it — the card, the note and the printed form. */
async function _bshopFillCarDetails(id) {
  const j = _bshopJobs.find(x => x.id === id);
  if (!j || j.desc) return;
  const plate = String(j.plate || '').replace(/\D/g, '');
  if (!plate) return;
  try {
    const rec = await _pcFilterLookup(plate, plate);
    const maker = rec ? _cleanMaker(rec['tozeret_nm'] || '') : '';
    const model = rec ? (rec['kinuy_mishari'] || rec['degem_nm'] || '') : '';
    if (!rec || !(maker || model)) return;
    const desc = [maker, model, rec['shnat_yitzur'] || '', rec['tzeva_rechev'] || ''].filter(Boolean).join(' ');
    j.desc = desc; j.maker = maker;
    const title = document.getElementById('bshop-fill-title');
    if (title && _bshopFillId === id) title.innerHTML = `${_brandIcon(maker)} ${_bshopFillMgr
      ? `<span onclick="bsmCopyPlate('${esc(j.plate)}')" title="לחץ להעתקה"
      style="cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px">${esc(j.plate)} 📋</span>`
      : esc(j.plate)} · ${esc(desc)}`;
    // only the manager writes it back, so a note is never edited from two sides
    if (currentUser?.role === 'manager') {
      await _updateDoc(_docRef('bodyshop_jobs', id), { desc, maker, updatedAt: _serverTs() });
    }
  } catch (e) { /* the note works fine without the details */ }
}

/* The panel beater paints what the car needs, not always what is written on the
   note. A part he did not paint he simply leaves empty; a part he added himself
   he picks off a list of buttons — no typing, no prices to look up. */

// prices live in the inputs until they are saved; copy them onto the job before
// the list is redrawn, otherwise what he already typed would be lost
function _bshopSyncPrices(j) {
  document.querySelectorAll('.bshop-price').forEach(el => {
    const i = Number(el.dataset.i);
    if (j.items?.[i]) j.items[i].price = el.value === '' ? null : Number(el.value);
  });
}

function openBshopAddPart() {
  const j = _bshopJobs.find(x => x.id === _bshopFillId);
  const c = document.getElementById('bshop-add-list');
  if (!j || !c) return;
  const taken = (j.items || []).map(it => it.name);
  const left = _bshopItems.filter(n => !taken.includes(n));

  const btn = n => `<button type="button" onclick="bshopAddPart(this.dataset.n)" data-n="${esc(n)}"
    style="background:var(--bg);color:var(--text);border:2px solid var(--border);border-radius:12px;padding:12px 16px;font-family:'Heebo',sans-serif;font-size:16px;font-weight:800;cursor:pointer">${esc(n)}</button>`;
  // picking a part is easier by area of the car, so the categories stay here
  // for both of them — it is only the note itself that stays plain for him
  c.innerHTML = !left.length
    ? `<div style="padding:16px;text-align:center;color:var(--muted)">כל החלקים כבר ברשימה</div>`
    : _bshopByGroup(left).map(([g, list]) =>
        _bshopGroupTitle(g, _BSHOP_GROUP_CAR) + `<div style="display:flex;flex-wrap:wrap;gap:8px">${list.map(btn).join('')}</div>`).join('');
  const other = document.getElementById('bshop-add-other');
  if (other) other.value = '';
  openModal('modal-bshop-add');
}
window.openBshopAddPart = openBshopAddPart;

function bshopAddPart(name) {
  const j = _bshopJobs.find(x => x.id === _bshopFillId);
  if (!j) return;
  _bshopSyncPrices(j);
  // only a part the panel beater added carries his name
  j.items = [...(j.items || []), { name, price: null, ...(_bshopFillMgr ? {} : { addedByShop: true }) }];
  closeModal('modal-bshop-add');
  bshopOpenFill(_bshopFillId);
  _bshopAutoSave(true);
  showToast('נוסף — רשום כמה זה עלה');
}
window.bshopAddPart = bshopAddPart;

// a part nobody thought of — typed once, for this car only
function bshopAddOtherPart() {
  const el = document.getElementById('bshop-add-other');
  const name = (el?.value || '').trim();
  if (!name) return;
  const j = _bshopJobs.find(x => x.id === _bshopFillId);
  if ((j?.items || []).some(it => it.name === name)) { el.value = ''; return showToast('החלק כבר ברשימה'); }
  el.value = '';
  bshopAddPart(name);
}
window.bshopAddOtherPart = bshopAddOtherPart;

function bshopRemovePart(i) {
  const j = _bshopJobs.find(x => x.id === _bshopFillId);
  if (!j || !j.items?.[i]) return;
  if (!confirm(`להוריד את ${j.items[i].name} מהרשימה?`)) return;
  _bshopSyncPrices(j);
  j.items = j.items.filter((_, k) => k !== i);
  bshopOpenFill(_bshopFillId);
  _bshopAutoSave(true);
}
window.bshopRemovePart = bshopRemovePart;

// swap the thumbnail for the full photo once it arrives; failing is harmless,
// the small copy stays on screen
// The full photo lives in its own document. It is fetched once per note and
// kept on the job in memory, so the card and the open note both show it sharp
// instead of a stretched thumbnail.
async function _bshopFullPhoto(id) {
  const j = _bshopJobs.find(x => x.id === id);
  if (j?.photo) return j.photo;
  if (!window._getDoc || !window._docRef) return '';
  try {
    const snap = await window._getDoc(_docRef('bodyshop_photos', id));
    const url = snap.exists() ? snap.data().photo : '';
    if (url && j) j.photo = url;
    return url;
  } catch (e) { return ''; }   // thumbnail is good enough
}

async function _bshopLoadFullPhoto(id) {
  const url = await _bshopFullPhoto(id);
  const img = document.getElementById('bshop-fill-img');
  if (url && img && _bshopFillId === id) img.src = url;
}

// after a list is drawn, upgrade every card that is still showing a thumbnail
function _bshopUpgradeCardPhotos() {
  for (const j of _bshopJobs) {
    const img = document.getElementById('bshop-card-img-' + j.id);
    if (!img) continue;
    if (j.photo) { _bshopFixFocus(j); continue; }
    _bshopFullPhoto(j.id).then(url => {
      const el = document.getElementById('bshop-card-img-' + j.id);
      if (url && el) el.src = url;
      _bshopFixFocus(j);
    });
  }
}

/* Notes written before the plate was looked for keep no focus point, so their
   picture is cropped through the middle and the plate falls out of view. The
   point is worked out here from the photo itself, once per note. */
async function _bshopFixFocus(j) {
  if (!j || j.photoFocus || j._focusTried || !j.photo) return;
  j._focusTried = true;
  const focus = await _bsmPlateFocus(j.photo).catch(() => null);
  if (!focus) return;
  j.photoFocus = focus;
  const css = _bshopFocusCss(j);
  const card = document.getElementById('bshop-card-img-' + j.id);
  if (card) card.style.objectPosition = css;
  const open = document.getElementById('bshop-fill-img');
  if (open && _bshopFillId === j.id) open.style.objectPosition = css;
  // kept on the note, so it is only worked out once and everybody sees it
  if (currentUser?.role === 'manager') {
    await _updateDoc(_docRef('bodyshop_jobs', j.id), { photoFocus: focus }).catch(() => {});
  }
}

/* Coming back to a price already written, the cursor used to land before the
   first digit — backspace then did nothing. It is put after the last digit. */
function _bshopCaretEnd(el) {
  setTimeout(() => {
    const n = el.value.length;
    try { el.setSelectionRange(n, n); } catch (e) {}
  }, 0);
}
window._bshopCaretEnd = _bshopCaretEnd;

function _bshopRecalc() {
  let t = 0;
  const fields = document.querySelectorAll('.bshop-price');
  if (fields.length) fields.forEach(el => { t += Number(el.value) || 0; });
  else {
    // the manager sees the prices as text, so the total comes from the note
    const j = _bshopJobs.find(x => x.id === _bshopFillId);
    t = _bshopTotal(j || {});
  }
  const el = document.getElementById('bshop-fill-total');
  if (el) el.textContent = t.toLocaleString('he-IL') + ' ₪';
}
window._bshopRecalc = _bshopRecalc;

// The panel beater must never have to press save. Every keystroke schedules a
// write, and leaving a field writes immediately.
let _bshopSaveTimer = null;
function _bshopSetSaved(txt) {
  const el = document.getElementById('bshop-fill-saved');
  if (el) el.textContent = txt || 'המחירים נשמרים לבד';
}
function _bshopAutoSave(now) {
  if (!_bshopFillId) return;
  clearTimeout(_bshopSaveTimer);
  _bshopSetSaved('שומר…');
  _bshopSaveTimer = setTimeout(() => bshopSave(false, true), now ? 0 : 700);
}
window._bshopAutoSave = _bshopAutoSave;

// הגיבוי בטלגרם לאיברהים מוקפא עד שיהיה לו חשבון מקושר. כל הקוד למטה
// שלם ומוכן — להחזרה מספיק להפוך את הדגל הזה ל-true ולקשר אותו במסך
// הגדרות טלגרם בשורה "איברהים".
const _BSHOP_TG_BACKUP = false;

// the whole note in one message: the car, what was painted, and the money
async function _bshopReportDone(j, id) {
  if (!_BSHOP_TG_BACKUP) return;   // מוקפא — בלי שליחה ובלי התראות כישלון
  try {
    const ils = n => Math.round(n).toLocaleString('he-IL') + ' ₪';
    const sum = (j.items || []).reduce((t, it) => t + (Number(it.price) || 0), 0);
    const vat = sum * _VAT_RATE;
    const lines = (j.items || []).map(it =>
      `• ${it.name}${it.addedByShop ? ' (הוסיף איברהים)' : ''} — ${it.price == null || it.price === '' ? 'לא תומחר' : ils(Number(it.price))}`);
    const msg = [
      '🔨 סיום עבודת פחחות',
      `🚗 ${j.plate || ''}${j.desc ? ' · ' + j.desc : ''}`,
      j.note ? `📝 ${j.note}` : '',
      j.sentAt ? `📅 נשלח: ${new Date(j.sentAt).toLocaleDateString('he-IL')}` : '',
      `✅ הסתיים: ${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
      '',
      ...lines,
      '',
      `סכום לתשלום: ${ils(sum)}`,
      `מע״מ ${Math.round(_VAT_RATE * 100)}%: ${ils(vat)}`,
      `סה״כ כולל מע״מ: ${ils(sum + vat)}`,
    ].filter(Boolean).join('\n');
    // the backup either arrived or it did not — silence would let a note be
    // finished with nobody holding a copy of it
    const contacts = await _loadDriverContacts();
    const chatId = contacts['איברהים']?.telegramId;
    let ok = chatId ? await _sendTelegram(chatId, msg) : false;
    // the car's picture belongs in the backup too, so the record outside the
    // app is the whole note and not only its words
    if (ok && chatId) {
      const photo = await _bshopFullPhoto(j.id).catch(() => '');
      if (photo) await _sendTelegramPhoto(chatId, photo, `🚗 ${j.plate || ''}`).catch(() => {});
    }
    if (id) {
      await _updateDoc(_docRef('bodyshop_jobs', id),
        ok ? { reportedAt: new Date().toISOString(), reportFailed: false }
           : { reportFailed: true }).catch(() => {});
    }
    if (!ok) {
      showToast(chatId ? '⚠️ הגיבוי לטלגרם לא נשלח — הפתק נשמר' : '⚠️ טלגרם לא מוגדר לאיברהים — לא נשלח גיבוי', 7000);
      // the manager must know too, even if the panel beater misses the toast
      _notifyDriver('ליאל', `⚠️ גיבוי טלגרם נכשל לרכב ${j.plate || ''} — הפתק נשמר במערכת בלבד`).catch(() => {});
    }
  } catch (e) {
    console.error('bodyshop telegram report', e);
    showToast('⚠️ הגיבוי לטלגרם נכשל — הפתק נשמר', 7000);
    if (id) await _updateDoc(_docRef('bodyshop_jobs', id), { reportFailed: true }).catch(() => {});
  }
}

async function bshopSave(markDone, silent) {
  const j = _bshopJobs.find(x => x.id === _bshopFillId);
  if (!j) return;
  // a car is only finished once every part carries a price — 0 is an answer,
  // an empty field is not. This is what makes the Telegram backup complete.
  if (markDone) {
    const empty = [...document.querySelectorAll('.bshop-price')].filter(el => el.value.trim() === '');
    if (empty.length) {
      empty.forEach(el => {
        el.style.borderColor = '#dc2626';
        el.style.background = '#fee2e2';
        setTimeout(() => { el.style.borderColor = ''; el.style.background = ''; }, 2500);
      });
      empty[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      empty[0].focus();
      return showToast(`נא למלא מחיר לכל החלקים — חסרים ${empty.length}. חלק שלא עשית — רשום 0`, 5000);
    }
  }
  if (markDone) clearTimeout(_bshopSaveTimer);
  const items = (j.items || []).map(it => ({ ...it }));
  document.querySelectorAll('.bshop-price').forEach(el => {
    const i = Number(el.dataset.i);
    if (items[i]) items[i].price = el.value === '' ? null : Number(el.value);
  });
  const payload = { items, updatedAt: _serverTs() };
  if (markDone) { payload.status = 'returned'; payload.returnedAt = new Date().toISOString(); }
  const wasDone = j.status === 'returned';
  try {
    await _updateDoc(_docRef('bodyshop_jobs', _bshopFillId), payload);
    // a finished car is reported to Telegram, so the note also lives outside
    // the app and nothing is lost if a phone is
    if (markDone && !wasDone) _bshopReportDone({ ...j, items }, _bshopFillId);
    // a backup that failed earlier is retried on the next save
    else if (j.reportFailed && j.status === 'returned') _bshopReportDone({ ...j, items }, _bshopFillId);
    if (silent) { _bshopSetSaved('✓ נשמר'); return; }
    closeModal('modal-bshop-fill');
    _bshopFillClosed();
    showToast(markDone ? '✅ הרכב סומן כמוכן' : '💾 נשמר');
  } catch (e) {
    if (silent) { _bshopSetSaved('⚠️ לא נשמר — בדוק חיבור'); return; }
    showToast('שגיאה בשמירה — נסה שוב');
  }
}
window.bshopSave = bshopSave;

/* ---- the manager's screen ---- */
/* The manager's screen is split the same way, behind its own menu button. */
const _BSM_VIEWS = { draft: 1, open: 1, done: 1, arc: 1, stats: 1 };
let _bsmView = 'open';
let _bsmAutoView = false;   // pick the opening screen once, on entry

// קיפול ופתיחה של ערמת הפעולות במחשב
function bsmToggleActions() {
  document.getElementById('bsm-top-actions')?.classList.toggle('open');
}
// לחיצה על אחת הפעולות סוגרת את הערמה, כדי שלא תישאר פתוחה מעל המסך
document.addEventListener('click', e => {
  const stack = document.getElementById('bsm-actions-stack');
  const wrap = document.getElementById('bsm-top-actions');
  if (!stack || !wrap || !wrap.classList.contains('open')) return;
  if (e.target.closest('#bsm-actions-stack .bsm-fab')) wrap.classList.remove('open');
});
window.bsmToggleActions = bsmToggleActions;

function toggleBsmMenu(force) {
  const m = document.getElementById('bsm-menu');
  if (!m) return;
  m.style.display = (force != null ? force : m.style.display === 'none') ? 'block' : 'none';
}
window.toggleBsmMenu = toggleBsmMenu;

/* Everything here comes from what is already stored: the payment folders and
   the open cycle. Nothing new is collected. */
function _bsmRenderStats() {
  const c = document.getElementById('bsm-stats-body');
  if (!c) return;
  // סכום מדויק — אגורות מוצגות רק כשיש, בלי עיגול
  const ils = n => (Math.round(n * 100) / 100).toLocaleString('he-IL', { maximumFractionDigits: 2 }) + ' ₪';

  // ── money ──
  const byMonth = {};
  let paidTotal = 0, paidCars = 0;
  for (const a of _bshopArchive) {
    paidTotal += Number(a.total || 0);
    paidCars += (a.cars || []).length;
    const d = a.paidAt ? new Date(a.paidAt) : null;
    if (d && !isNaN(d)) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[k] = (byMonth[k] || 0) + Number(a.total || 0);
    }
  }
  const openSum = _bshopJobs.filter(j => j.status !== 'draft').reduce((t, j) => t + _bshopTotal(j), 0);
  // the calendar year, january through december, read left to right
  const now = new Date();
  const yr = now.getFullYear();
  const months = [];
  for (let m = 1; m <= 12; m++) {
    months.push({ key: `${yr}-${String(m).padStart(2, '0')}`, label: `${m}/${String(yr).slice(2)}` });
  }
  const maxMonth = Math.max(1, ...months.map(m => byMonth[m.key] || 0));
  // הממוצע לרכב כולל גם רכבים שסיימנו וטרם שולמו — העבודה עליהם כבר
  // נגמרה והסכום שלהם ידוע, אז הם חלק מהתמונה בדיוק כמו רכב ששולם
  const doneJobs = _bshopJobs.filter(j => j.status === 'returned');
  const doneSum = doneJobs.reduce((t, j) => t + _bshopTotal(j), 0);
  const avgCars = paidCars + doneJobs.length;
  const avgPerCar = avgCars ? (paidTotal + doneSum) / avgCars : 0;
  const avgSub = doneJobs.length
    ? `${avgCars} רכבים · ${paidCars} ששולמו ו-${doneJobs.length} שסיימנו`
    : `${paidCars} רכבים ששולמו`;

  // ── parts: every note we can still read, paid or open ──
  const partStat = {};
  let addedN = 0, addedSum = 0;
  const eatItems = items => {
    for (const it of (items || [])) {
      const price = Number(it.price);
      if (it.addedByShop) { addedN++; addedSum += (price || 0); }
      if (!(price > 0)) continue;
      const p = partStat[it.name] || (partStat[it.name] = { n: 0, sum: 0 });
      p.n++; p.sum += price;
    }
  };
  let carsCounted = 0;
  for (const a of _bshopArchive) for (const car of (a.cars || [])) { if (car.items) { carsCounted++; eatItems(car.items); } }
  for (const j of _bshopJobs) { if (j.status !== 'draft') { carsCounted++; eatItems(j.items); } }
  const parts = Object.entries(partStat)
    .map(([name, p]) => ({ name, n: p.n, avg: p.sum / p.n }))
    .sort((a, b) => b.avg - a.avg);
  _bsmPartAvg = parts;

  // ── time: only notes that carry both dates ──
  const spans = _bshopJobs.map(_bshopDays).filter(d => d != null);
  const avgDays = spans.length ? spans.reduce((t, d) => t + d, 0) / spans.length : null;

  const tile = (label, value, sub) => `<div class="bsm-stat-tile" style="border:2px solid var(--border);border-radius:14px;padding:12px;background:var(--card)">
      <div class="t-lbl" style="font-size:12px;color:var(--muted);font-weight:800">${label}</div>
      <div class="t-val" style="font-size:21px;font-weight:900;margin-top:2px">${value}</div>
      ${sub ? `<div class="t-sub" style="font-size:11px;color:var(--muted);margin-top:2px">${sub}</div>` : ''}
    </div>`;

  c.innerHTML = `
   <div class="bsm-stat-split">
    <div>
    <div id="bsm-stat-tiles" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px">
      ${tile('שולם מאז ומעולם', ils(paidTotal), `${paidCars} רכבים`)}
      ${tile('פתוח כרגע', ils(openSum), 'אצל הפחח ומחכה לתשלום')}
      ${tile('ממוצע לרכב', ils(avgPerCar), avgSub)}
      ${tile('ממוצע ימים אצל הפחח', avgDays == null ? '—' : Math.round(avgDays), 'מהמחזור הפתוח')}
      ${tile('חלקים שאיברהים הוסיף', addedN, ils(addedSum))}
      ${(() => {
        // stated the way it is actually thought about: one extra part per N cars
        if (!carsCounted) return '';
        const txt = !addedN
          ? `איברהים עדיין לא הוסיף חלקים על דעת עצמו`
          : (carsCounted / addedN >= 1
              ? `בממוצע איברהים מוסיף 1 חלק לכל ${(carsCounted / addedN).toFixed(1).replace(/\.0$/, '')} מכוניות`
              : `בממוצע איברהים מוסיף ${(addedN / carsCounted).toFixed(1).replace(/\.0$/, '')} חלקים לכל מכונית`);
        return `<div class="bsm-stat-tile" style="grid-column:1/-1;border:2px solid var(--gold);border-radius:14px;padding:12px;background:#fef3c7">
          <div class="t-val" style="font-size:17px;font-weight:900;color:#78350f">➕ ${txt}</div>
          <div class="t-sub" style="font-size:11px;color:#92400e;margin-top:2px">מתוך ${carsCounted} מכוניות</div>
        </div>`;
      })()}
    </div>

    </div>
    <div>
    <div class="section-title" style="margin-top:0">תשלומים לפי חודש · ${yr}</div>
    <div id="bsm-stat-chart" style="direction:ltr;display:flex;align-items:flex-end;gap:6px;height:150px;border-bottom:2px solid var(--border);padding-bottom:4px;margin-bottom:6px;overflow-x:auto">
      ${months.map(m => {
        const v = byMonth[m.key] || 0;
        return `<div style="flex:1;min-width:26px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%">
          ${v ? `<div style="font-size:10px;font-weight:800;color:var(--muted);white-space:nowrap">${Math.round(v / 1000)}k</div>` : ''}
          <div title="${ils(v)}" class="bsm-bar" style="width:100%;height:${Math.round((v / maxMonth) * 100)}%;min-height:${v ? 3 : 0}px;background:var(--gold);border-radius:6px 6px 0 0"></div>
        </div>`;
      }).join('')}
    </div>
    <div style="direction:ltr;display:flex;gap:6px;margin-bottom:20px;overflow-x:auto">
      ${months.map(m => `<div style="flex:1;min-width:26px;text-align:center;font-size:10px;color:var(--muted);font-weight:700">${m.label}</div>`).join('')}
    </div>

    <button onclick="bsmOpenPartAvg()" class="btn-submit" style="margin-top:0;background:var(--dark);color:#fff">📐 ממוצע לכל חלק</button>
    </div>
   </div>`;
}

let _bsmPartAvg = [];   // [{name, n, avg}] — filled while the statistics are drawn

function bsmOpenPartAvg() {
  const c = document.getElementById('bsm-partavg-body');
  if (!c) return;
  const ils = n => Math.round(n).toLocaleString('he-IL') + ' ₪';
  c.innerHTML = (_bsmPartAvg.length
    ? _bsmPartAvg.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid var(--border);padding:11px 0">
        <div style="min-width:0">
          <div style="font-weight:800;font-size:15px">${esc(p.name)}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:600">${p.n} פעמים</div>
        </div>
        <div style="font-weight:900;font-size:17px;white-space:nowrap;color:var(--gold)">${ils(p.avg)}</div>
      </div>`).join('')
    : `<div style="padding:20px;text-align:center;color:var(--muted)">אין עדיין מספיק נתונים</div>`)
    + `<div style="font-size:11px;color:var(--muted);margin-top:12px">מחושב מכל הפתקים שנשמרו — פתוחים וגם ששולמו. חלק ריק או שנרשם בו 0 (עבודה שלא נעשתה בסוף) לא נספר בממוצע.</div>`;
  openModal('modal-bsm-partavg');
}
window.bsmOpenPartAvg = bsmOpenPartAvg;

function bsmShowView(name) {
  _bsmView = _BSM_VIEWS[name] ? name : 'open';
  for (const k of Object.keys(_BSM_VIEWS)) {
    const el = document.getElementById('bsm-view-' + k);
    if (el) el.style.display = k === _bsmView ? '' : 'none';
  }
  document.querySelectorAll('.bsm-tab').forEach(b => {
    b.classList.toggle('on', b.dataset.view === _bsmView);
  });
  /* Each screen carries only the header it needs: the payment box belongs to
     the finished cars, the buttons and the counter belong to the rest, and the
     statistics screen stands entirely on its own. */
  const show = {
    draft: { actions: 1, tile: 1, pay: 0, extra: 1 },
    open:  { actions: 1, tile: 1, pay: 1, extra: 1 },
    done:  { actions: 1, tile: 0, pay: 1, extra: 0 },
    arc:   { actions: 0, tile: 1, pay: 1, extra: 1 },
    stats: { actions: 0, tile: 0, pay: 0, extra: 0 },
  }[_bsmView] || { actions: 0, tile: 1, pay: 1, extra: 1 };
  const setVis = (id, on, disp) => { const el = document.getElementById(id); if (el) el.style.display = on ? (disp || '') : 'none'; };
  setVis('bsm-top-actions', show.actions, 'flex');
  setVis('bsm-summary-tile', show.tile);
  setVis('bsm-summary-pay', show.pay);
  setVis('bsm-summary-extra', show.extra);
  setVis('bsm-summary', show.tile || show.pay, 'grid');
  const sumEl = document.getElementById('bsm-summary');
  // one half alone takes the full width
  if (sumEl) sumEl.style.gridTemplateColumns = (show.tile && show.pay) ? '1fr 1fr' : '1fr';
  if (_bsmView === 'stats') _bsmRenderStats();
  toggleBsmMenu(false);
  window.scrollTo({ top: 0 });
}
window.bsmShowView = bsmShowView;

document.addEventListener('click', e => {
  const m = document.getElementById('bsm-menu');
  if (!m || m.style.display === 'none') return;
  if (!e.target.closest('#bsm-menu') && !e.target.closest('[aria-label="תפריט פחחות"]')) toggleBsmMenu(false);
});

// the floating pair belongs to this screen only
function _bsmHideActions() { const el = document.getElementById('bsm-top-actions'); if (el) el.style.display = 'none'; }

function openBodyShopMgrScreen() {
  // which screen opens is decided once the notes have loaded — see below
  _bsmAutoView = true;
  bsmShowView('draft');
  document.getElementById('bsm-user-badge').textContent = currentUser.name;
  document.getElementById('bsm-link').value = location.origin + '/ops/pahach/';
  showScreen('bodyshop-mgr');
  _bshopListen(_bshopRenderMgr);
}
window.openBodyShopMgrScreen = openBodyShopMgrScreen;

function _bshopRenderMgr() {
  const openC = document.getElementById('bsm-open');
  const retC  = document.getElementById('bsm-returned');
  const sumC  = document.getElementById('bsm-summary');
  if (!openC || !retC) return;
  // פתק בהמתנה יוצא מהמסך הרגיל עד שמחזירים אותו — הסטטוס שלו לא משתנה,
  // ולכן הוא חוזר בדיוק לאותו מקום שממנו יצא
  const live = _bshopJobs.filter(j => !j.onHold);
  const draft = live.filter(j => j.status === 'draft');
  const open = live.filter(j => j.status === 'at_shop');
  const ret  = live.filter(j => j.status === 'returned');
  const sum  = ret.reduce((s, j) => s + _bshopTotal(j), 0);
  const openSum = open.reduce((s, j) => s + _bshopTotal(j), 0);

  // the two halves live apart, so each screen can show only what belongs to it
  const tileC = document.getElementById('bsm-summary-tile');
  const payC = document.getElementById('bsm-summary-pay');
  const extraC = document.getElementById('bsm-summary-extra');
  if (tileC) tileC.innerHTML = `<div style="height:100%;display:flex;flex-direction:column;justify-content:center;border:2px solid var(--border);border-radius:14px;padding:12px;text-align:center;background:var(--card)">
      <div style="font-size:12px;color:var(--muted);font-weight:700">אצל הפחח</div>
      <div style="font-size:22px;font-weight:900">${open.length}</div>
    </div>`;
  if (payC) payC.innerHTML = _bshopTotalsHtml(sum);
  if (extraC) extraC.innerHTML = openSum ? `<div style="font-size:12px;color:var(--muted);margin:6px 0">בנוסף ${openSum.toLocaleString('he-IL')} ₪ נרשמו על רכבים שעדיין אצלו</div>` : '';

  const draftC = document.getElementById('bsm-drafts');
  // הממתינים לשליחה מוצגים מהישן לחדש — מה שמחכה הכי הרבה זמן קודם,
  // בניגוד לשאר המסכים שבהם החדש למעלה
  const draftOldFirst = [...draft].reverse();
  if (draftC) draftC.innerHTML = draft.length
    ? draftOldFirst.map(j => _bshopJobCard(j, false)).join('')
    : `<div class="bshop-span" style="padding:16px;text-align:center;color:var(--muted)">אין פתקים שממתינים לשליחה</div>`;
  openC.innerHTML = open.length ? open.map(j => _bshopJobCard(j, false)).join('')
    : `<div class="bshop-span" style="padding:16px;text-align:center;color:var(--muted)">אין רכבים אצל הפחח</div>`;
  retC.innerHTML = ret.length ? ret.map(j => _bshopJobCard(j, false)).join('')
    : `<div class="bshop-span" style="padding:16px;text-align:center;color:var(--muted)">אין רכבים שממתינים לתשלום</div>`;
  const payWrap = document.getElementById('bsm-pay-wrap');
  if (payWrap) payWrap.style.display = ret.length ? 'flex' : 'none';
  _bsmRenderHold();
  // entering the screen lands on the notes waiting to be sent; with none
  // waiting there is nothing to do there, so it lands on the cars at the shop
  if (_bsmAutoView) {
    _bsmAutoView = false;
    bsmShowView(draft.length ? 'draft' : 'open');
  }
  // how many cars sit behind each menu line
  for (const [k, n] of [['draft', draft.length], ['open', open.length], ['done', ret.length]]) {
    const el = document.getElementById('bsm-cnt-' + k);
    if (el) { el.textContent = n; el.style.display = n ? 'inline-block' : 'none'; }
  }
  _bshopUpgradeCardPhotos();
}

function bsmOpenJob(id) { bshopOpenFill(id); }
// printing from inside the open note
function bshopPrintCurrent() { if (_bshopFillId) bsmPrint(_bshopFillId); }
window.bshopPrintCurrent = bshopPrintCurrent;
window.bsmOpenJob = bsmOpenJob;

// a note stays with the manager until this is pressed — only then does the
// panel beater see the car on his screen
/* לפני שהפתק עובר לאיברהים נרשם מי לקח את הרכב. התיעוד נשמר גם על הפתק
   וגם ביומן נפרד, כדי שהוא יישאר גם אם הפתק יימחק. */
const _BSM_DRIVERS = ['עופר', 'גיל', 'איתי'];
let _bsmSendId = null;
let _bsmTripEdit = null;   // תיעוד נסיעה שנערך כרגע — במקום שליחת פתק חדש

// אותה חלונית משמשת גם לשליחה וגם לתיקון תיעוד קיים
function _bsmDriverPicker(title, carHtml, current) {
  const t = document.getElementById('bsm-driver-title');
  if (t) t.textContent = title;
  const car = document.getElementById('bsm-driver-car');
  if (car) car.innerHTML = carHtml;
  const list = document.getElementById('bsm-driver-list');
  if (list) list.innerHTML = _BSM_DRIVERS.map(n => {
    const on = current && n === current;
    return `<button onclick="bsmSendWithDriver('${esc(n)}')" style="background:${on ? 'var(--dark)' : 'var(--surface2)'};color:${on ? '#fff' : 'var(--text)'};border:2px solid ${on ? 'var(--dark)' : 'var(--border)'};border-radius:12px;padding:13px;font-family:Heebo,sans-serif;font-size:15px;font-weight:800;cursor:pointer;text-align:right">👤 ${esc(n)}${on ? ' ✓' : ''}</button>`;
  }).join('');
  const other = document.getElementById('bsm-driver-other');
  if (other) other.value = (current && !_BSM_DRIVERS.includes(current)) ? current : '';
  openModal('modal-bsm-driver');
}

function bsmSendToShop(id) {
  const j = _bshopJobs.find(x => x.id === id);
  if (!j || j.status !== 'draft') return;
  _bsmSendId = id;
  _bsmTripEdit = null;
  _bsmDriverPicker('🚗 מי לוקח את הרכב?',
    `${esc(j.plate || '')}${j.desc ? ` <span style="font-weight:700;color:var(--muted)">· ${esc(j.desc)}</span>` : ''}`, '');
}
window.bsmSendToShop = bsmSendToShop;

/* לחיצה על שם הנהג בתיעוד הנסיעות פותחת את אותה בחירה, כדי לתקן
   מי באמת לקח את הרכב. התיקון נשמר גם ביומן וגם על הפתק עצמו. */
function bsmTripEditDriver(tripId, plate, desc, driver, jobId) {
  _bsmSendId = null;
  _bsmTripEdit = { id: tripId, plate, desc, driver, jobId };
  _bsmDriverPicker('✏️ מי לקח את הרכב?',
    `${esc(plate || '')}${desc ? ` <span style="font-weight:700;color:var(--muted)">· ${esc(desc)}</span>` : ''}`, driver);
}
window.bsmTripEditDriver = bsmTripEditDriver;

async function bsmSendWithDriver(name) {
  // תיקון תיעוד קיים
  if (_bsmTripEdit) {
    const driver = String(name || document.getElementById('bsm-driver-other')?.value || '').trim();
    if (!driver) return showToast('צריך לבחור נהג או לרשום שם');
    if (driver === _bsmTripEdit.driver) { closeModal('modal-bsm-driver'); _bsmTripEdit = null; return; }
    if (!_requireNet('עדכון התיעוד')) return;
    const trip = _bsmTripEdit;
    try {
      // עדכון הנהג הוא רישום מחדש של הנסיעה — התאריך והשעה הם של רגע העדכון
      const nowIso = new Date().toISOString();
      await _updateDoc(_docRef('bodyshop_trips', trip.id), { driver, at: nowIso, editedBy: currentUser?.name || '', editedAt: nowIso });
      // הפתק עצמו מחזיק גם הוא את השם, כדי שלא ייווצר פער בין השניים
      const jobId = trip.jobId;
      if (jobId) { try { await _updateDoc(_docRef('bodyshop_jobs', jobId), { takenBy: driver }); } catch (e) { console.error('job takenBy', e); } }
      closeModal('modal-bsm-driver');
      _bsmTripEdit = null;
      showToast(`✅ עודכן — ${driver}`);
      openBsmTrips();
    } catch (e) { showToast('העדכון נכשל: ' + (e.code || e.message), 6000); }
    return;
  }
  const id = _bsmSendId;
  const j = _bshopJobs.find(x => x.id === id);
  if (!id || !j) return;
  const driver = String(name || document.getElementById('bsm-driver-other')?.value || '').trim();
  if (!driver) return showToast('צריך לבחור נהג או לרשום שם');
  if (!_requireNet('שליחת הפתק')) return;
  const at = new Date().toISOString();
  try {
    await _updateDoc(_docRef('bodyshop_jobs', id), { status: 'at_shop', sentAt: at, takenBy: driver });
    try {
      await window._addDoc(_colRef('bodyshop_trips'), {
        jobId: id, plate: j.plate || '', desc: j.desc || '',
        driver, at, by: currentUser?.name || '',
      });
    } catch (e) { console.error('trip log', e); }
    closeModal('modal-bsm-driver');
    _bsmSendId = null;
    showToast(`📤 נשלח לאיברהים · ${driver}`);
  } catch (e) { showToast('שגיאה בשליחה — נסה שוב'); }
}
window.bsmSendWithDriver = bsmSendWithDriver;

/* ── פתקים בהמתנה ──────────────────────────────────────────────────
   פתק שאין מה לעשות איתו כרגע יוצא מהמסך הרגיל בלי לאבד את הסטטוס
   שלו. הוא יושב בחלונית נפרדת, וברגע שמחזירים אותו הוא חוזר בדיוק
   לעמודה שממנה יצא. */
async function bsmSetHold(id, val) {
  const j = _bshopJobs.find(x => x.id === id);
  if (!j) return;
  if (!_requireNet(val ? 'העברה להמתנה' : 'החזרה לפעילות')) return;
  j.onHold = val;                       // תגובה מיידית על המסך
  _bshopRenderMgr();
  _bsmRenderHold();
  try {
    await _updateDoc(_docRef('bodyshop_jobs', id), { onHold: val });
    showToast(val ? '⏸️ הפתק הועבר להמתנה' : '▶️ הפתק חזר לפעילות');
  } catch (e) {
    j.onHold = !val;                    // כשל — חזרה למצב הקודם
    _bshopRenderMgr();
    _bsmRenderHold();
    showToast('הפעולה נכשלה — נסה שוב', 6000);
  }
}
window.bsmSetHold = bsmSetHold;

function _bsmRenderHold() {
  const held = _bshopJobs.filter(j => j.onHold);
  const cnt = document.getElementById('bsm-hold-cnt');
  if (cnt) cnt.textContent = held.length || '';
  const box = document.getElementById('bsm-hold-body');
  if (!box) return;
  box.innerHTML = held.length
    ? held.map(j => _bshopJobCard(j, false, true)).join('')
    : `<div class="bshop-span" style="padding:30px 16px;text-align:center;color:var(--muted);font-weight:700">אין פתקים בהמתנה</div>`;
}

function openBsmHold() { _bsmRenderHold(); openModal('modal-bsm-hold'); }
window.openBsmHold = openBsmHold;

// יומן הנסיעות — מי לקח כל רכב לאיברהים ומתי
async function openBsmTrips() {
  const box = document.getElementById('bsm-trips-body');
  if (!box) return;
  box.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px">טוען…</div>';
  openModal('modal-bsm-trips');
  let rows = [];
  try {
    const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDocs(_colRef('bodyshop_trips'));
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
  } catch (e) {
    box.innerHTML = `<div style="text-align:center;color:#ef4444;padding:30px;font-weight:700">שגיאה בטעינה: ${esc(e.code || e.message)}</div>`;
    return;
  }
  rows.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  if (!rows.length) {
    box.innerHTML = '<div style="text-align:center;color:var(--muted);padding:34px;font-weight:700">עדיין לא נרשמו נסיעות</div>';
    return;
  }
  box.innerHTML = rows.map(r => {
    const when = r.at ? new Date(r.at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    return `<div style="background:var(--card);border:2px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <div style="font-size:16px;font-weight:900">${esc(r.plate || '—')}</div>
        <button onclick="bsmTripEditDriver('${esc(r.id)}','${esc(r.plate || '')}','${esc(r.desc || '')}','${esc(r.driver || '')}','${esc(r.jobId || '')}')" title="לחץ לשינוי הנהג" style="background:var(--dark);color:#fff;border:none;border-radius:999px;padding:5px 13px;font-family:Heebo,sans-serif;font-size:12.5px;font-weight:800;white-space:nowrap;cursor:pointer">👤 ${esc(r.driver || '—')} ✏️</button>
      </div>
      ${r.desc ? `<div style="font-size:13px;font-weight:700;color:var(--muted);margin-top:3px">${esc(r.desc)}</div>` : ''}
      <div style="font-size:12px;font-weight:700;color:var(--muted);margin-top:4px">${esc(when)}</div>
    </div>`;
  }).join('');
}
window.openBsmTrips = openBsmTrips;

// the yard can close a car too — same effect as the beater pressing finish,
// and it is what stops the day counter
async function bsmMarkReturned(id) {
  const j = _bshopJobs.find(x => x.id === id);
  if (!j || j.status !== 'at_shop') return;
  if (!confirm(`לסמן שסיימנו עם הרכב ${j.plate}?`)) return;
  try {
    await _updateDoc(_docRef('bodyshop_jobs', id), { status: 'returned', returnedAt: new Date().toISOString() });
    showToast('✅ הרכב סומן כמוכן');
  } catch (e) { showToast('שגיאה — נסה שוב'); }
}
window.bsmMarkReturned = bsmMarkReturned;

// סימון "עדכנתי את העלות בתוכנה השנייה". המונה בקוביית הבית יורד מיד
// כי הוא מאזין לאותו שדה במסמך.
async function bsmSetSwUpdated(id, val) {
  const j = _bshopJobs.find(x => x.id === id);
  if (j) j.swUpdated = val;          // תגובה מיידית על הכרטיס
  _bshopRenderMgr();
  try {
    await _updateDoc(_docRef('bodyshop_jobs', id), { swUpdated: val });
  } catch (e) {
    if (j) j.swUpdated = !val;       // כשל — חזרה
    _bshopRenderMgr();
    showToast('שמירת הסימון נכשלה');
  }
}
window.bsmSetSwUpdated = bsmSetSwUpdated;

// העתקת מספר הרישוי מהכרטיס, להדבקה מהירה בתוכנה השנייה
function bsmCopyPlate(plate) {
  const done = () => showToast('📋 ' + plate + ' הועתק');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(plate).then(done).catch(() => _pcCopyFallback(plate, done));
  else _pcCopyFallback(plate, done);
}
window.bsmCopyPlate = bsmCopyPlate;

/* "טופס הזמנת תיקון" — same layout as the printed form already in use.
   The date and time are stamped at print time so a form always carries them,
   and the owner line is fixed to the yard's name. */
const _BSHOP_OWNER = 'ענק הרכבים';
const _BSHOP_FORM_ROWS = 10; // the paper form has ten numbered lines

// the note always goes to the same garage
const _BSHOP_SHOP = 'מוסך פחח איברהים';

function bsmPrint(id) {
  const j = _bshopJobs.find(x => x.id === id);
  if (!j) return;
  const now = new Date();
  const dateStr = now.toLocaleDateString('he-IL');
  const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const names = _bshopSortNames((j.items || []).map(it => it.name));
  // keep the ten numbered lines even when fewer parts were selected, so there
  // is room to add work by hand at the shop
  const rowCount = Math.max(_BSHOP_FORM_ROWS, names.length);
  let rows = '';
  for (let i = 0; i < rowCount; i++) {
    rows += `<tr><td class="d">${esc(names[i] || '')}</td><td class="n">${i + 1}.</td></tr>`;
  }
  const cell = (label, value) => `<td class="hc"><span class="hl">${label}</span> <span class="hv">${esc(value || '')}</span></td>`;

  // printed from a hidden frame, so the print dialog opens straight away
  // instead of a tab with the form in it
  _printHtml(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>טופס הזמנת תיקון ${esc(j.plate)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: Arial, "Segoe UI", sans-serif; color:#000; }
  h1 { text-align:center; font-size:26px; margin:0 0 22px; text-decoration:underline; }
  table { border-collapse:collapse; width:100%; }
  td, th { border:1.5px solid #000; }
  .hc { padding:10px 12px; text-align:right; width:50%; height:34px; }
  .hl { font-size:14px; }
  .hv { font-size:15px; font-weight:bold; }
  .title { padding:10px; text-align:center; font-size:15px; }
  .n { padding:9px 12px; width:52px; text-align:right; font-size:14px; }
  .d { padding:9px 12px; font-size:14px; }
  .sp { height:26px; border:none; }
</style></head><body>
  <h1>טופס הזמנת תיקון</h1>
  <table>
    <tr>${cell('מס רישוי :', j.plate)}${cell('שם מוסך :', _BSHOP_SHOP)}</tr>
    <tr>${cell('שייך ל:', _BSHOP_OWNER)}${cell('שם הרכב :', j.desc || '')}</tr>
    <tr>${cell('שעה :', timeStr)}${cell('תאריך :', dateStr)}</tr>
  </table>
  <table class="sp"><tr><td class="sp"></td></tr></table>
  <table>
    <tr><td class="title" colspan="2">תיאור העבודה הדרושה :</td></tr>
    ${rows}
  </table>
</body></html>`, 'bodyshop print', 'שגיאה בהדפסה');
}
window.bsmPrint = bsmPrint;

/* ── הדפסה ──────────────────────────────────────────────────────────
   מנגנון אחד לכל הטפסים: הדף נכתב למסגרת נסתרת, כך שחלון ההדפסה נפתח
   מיד ולא נפתח דף חדש. התוכן והעיצוב של כל טופס נשארים אצל הטופס עצמו —
   כאן יושבת רק הדרך להוציא אותו למדפסת.
─────────────────────────────────────────────────────────────────────── */
// onDone נקרא פעם אחת אחרי שחלון ההדפסה נסגר (או אחרי מנגנון ביטחון,
// כי בטלפון לא תמיד מגיע אירוע סיום הדפסה).
function _printHtml(html, tag, errMsg, onDone) {
  const fr = document.createElement('iframe');
  fr.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:0';
  document.body.appendChild(fr);
  const w = fr.contentWindow;
  w.document.write(html);
  w.document.close();
  let finished = false;
  const finish = () => { if (finished) return; finished = true; try { onDone && onDone(); } catch (e) {} };
  setTimeout(() => {
    try {
      w.onafterprint = finish;
      window.addEventListener('focus', finish, { once: true });
      w.focus(); w.print();
      setTimeout(finish, 4000);   // גיבוי — אם לא הגיע אירוע סיום
    }
    catch (e) { console.error(tag, e); showToast(errMsg || 'שגיאה בהדפסה'); finish(); }
    // המסגרת יורדת רק אחרי שחלון ההדפסה נסגר
    setTimeout(() => fr.remove(), 5000);
  }, 250); // רגע לפריסת העמוד לפני ההדפסה
}

/* ── בדיקת בעלויות ──────────────────────────────────────────────────
   הבדיקה בפועל נעשית ידנית מול אתר משרד התחבורה (מוגן ב-reCAPTCHA).
   המסך טוען את כל המלאי מהשרת ומנהל צ'קליסט: לכל רכב אפשר לפתוח את
   אתר גוב, להעתיק את מספר הרכב, ולסמן אם הוא רשום על החברה. הסימונים
   נשמרים ב-config/ownership כדי שאפשר יהיה לעצור ולהמשיך.
─────────────────────────────────────────────────────────────────────── */
const _OWN_FN = 'https://europe-west1-anak-soharim.cloudfunctions.net/runOwnershipScanNow';
// אתר התשלומים של משרד התחבורה — משם בודקים ידנית אם הרכב רשום עלינו
const _OWN_GOV_URL = 'https://ecom.gov.il/voucherspa/input/260?clear=true';
let _ownUnsub = null;
let _ownCars = [];            // רשימת המלאי מהשרת
let _ownIds = [];             // הח.פ/ת.ז של החברה
let _ownFilter = 'all';
let _ownUpdatedAt = '';
let _ownUpdatedRaw = null;   // מועד הבדיקה האחרונה
let _ownScanning = false;
// רכבים שממתינים לאיסוף, לפי מספר רישוי — כדי להציג את לוגו הספק
// בשורה של רכב שאין לו בעלות ונמצא באיסוף
let _ownPickupByPlate = {};
let _ownPickupUnsub = null;

/* ── תזכורת הבוקר ────────────────────────────────────────────────────
   כל בוקר ב-8:00 נפתח אצל המנהל מסך בדיקת הבעלויות, עם שני כפתורים:
   "הכל תקין" סוגר אותו עד מחר, ו"דחה" מחזיר אותו מאוחר יותר.
   הכל נשמר מקומית במכשיר, כדי שרענון דף לא יפתח את המסך שוב.     */
const _OWN_MORNING_HOUR = 8;
let _ownMorningTimer = null;
// המצב נשמר בשרת ולא במכשיר, כך שאישור מכל מכשיר תקף לכולם
let _ownMorningState = null;   // { ackDay, snoozeTo }

/* "יום" לצורך התזכורת מתחיל ב-8:00 ולא בחצות. שעה 00:30 שייכת עדיין
   ליום הקודם, כך שדחייה שנעשתה בלילה לא נמחקת בטעות.              */
const _ownToday = () => new Date(Date.now() - _OWN_MORNING_HOUR * 3600000).toLocaleDateString('sv-SE');

// תחילת המחזור הנוכחי — היום ב-8:00, או אתמול ב-8:00 אם עוד לא הגענו לשעה
function _ownCycleStart() {
  const d = new Date();
  d.setHours(_OWN_MORNING_HOUR, 0, 0, 0);
  if (Date.now() < d.getTime()) d.setDate(d.getDate() - 1);
  return d;
}

// הדוח חייב להיות עדכני: אם הבדיקה האחרונה ישנה מתחילת המחזור — מריצים שוב
function _ownEnsureFresh() {
  if (_ownScanning) return;
  if (_ownUpdatedRaw && _ownUpdatedRaw >= _ownCycleStart()) return;
  runOwnershipScan();
}

function _startOwnMorning() {
  if (_ownMorningTimer) return;
  _onSnap(_docRef('config', 'own_morning'), snap => {
    _ownMorningState = (snap.exists() ? snap.data() : {}) || {};
    _syncOwnMorningBar();
    _checkOwnMorning();
  }, () => { _ownMorningState = {}; });
  _ownMorningTimer = setInterval(() => { _checkOwnMorning(); try { _renderDailyQuote(); } catch (e) {} }, 60000);
}

async function _ownMorningSet(data) {
  _ownMorningState = { ..._ownMorningState, ...data };   // תגובה מיידית
  try { await window._setDoc(_docRef('config', 'own_morning'), data, { merge: true }); }
  catch (e) { showToast('השמירה נכשלה: ' + (e.code || e.message), 6000); }
}

// תוכן החלונית — סיכום קצר של הבדיקה האחרונה
function _renderOwnMorning() {
  const box = document.getElementById('own-morning-body');
  if (!box) return;
  const total = _ownCars.length;
  const not = _ownCars.filter(c => (c.status || 'unknown') === 'not').length;
  const unk = _ownCars.filter(c => (c.status || 'unknown') === 'unknown').length;
  if (!total || unk === total) {
    box.innerHTML = `<div style="text-align:center;background:#fef3c7;border:2px solid #d97706;border-radius:14px;padding:16px">
      <div style="font-size:34px;line-height:1">❓</div>
      <div style="font-weight:900;font-size:17px;margin-top:6px;color:#92400e">${total ? 'לא ניתן לבדוק כרגע' : 'הבדיקה עדיין רצה…'}</div>
    </div>`;
    return;
  }
  const ok = not === 0;
  box.innerHTML = `<div onclick="closeModal('modal-own-morning');openOwnershipScreen();_syncOwnMorningBar()" style="cursor:pointer;text-align:center;background:${ok ? '#dcfce7' : '#fee2e2'};border:2px solid ${ok ? '#16a34a' : '#dc2626'};border-radius:14px;padding:16px">
      <div style="font-size:34px;line-height:1">${ok ? '✅' : '⚠️'}</div>
      <div style="font-weight:900;font-size:19px;margin-top:6px;color:${ok ? '#166534' : '#991b1b'}">${ok ? 'הכל תקין' : (not === 1 ? 'רכב אחד לא על תו סחר' : not + ' רכבים לא על תו סחר')}</div>
      <div style="font-weight:700;font-size:13px;margin-top:4px;color:${ok ? '#166534' : '#991b1b'}">מתוך ${total} רכבים במלאי</div>
      ${_ownUpdatedAt ? `<div style="font-size:12px;font-weight:700;color:var(--muted);margin-top:8px">נבדק לאחרונה: ${esc(_ownUpdatedAt)}</div>` : ''}
      <div style="font-size:12px;font-weight:800;color:#0d6ab0;margin-top:8px">לחץ לפירוט המלא ▶</div>
    </div>`;
}


/* ═══════════════════════════════════════════════════════════════════════
   הנעות הבוקר
   כל בוקר מניעים שליש מהמגרש, לפי מספרי החניות. ראשון ורביעי — השליש
   הנמוך, שני וחמישי — האמצעי, שלישי ושישי — הגבוה. כך כל שליש מונע
   פעמיים בשבוע. רכב שעומד על הכביש אינו מונע.
   החלוקה בין הנהגים נעשית לפי מספר חניה רצוף, ועופר תמיד באמצע.
   כשמגיעים רק שניים — עופר לוקח את החצי הגבוה.
   ═══════════════════════════════════════════════════════════════════ */
const _MS_DRIVERS = ['גיל', 'עופר', 'איתי'];

/* סדר הנהגים בתוך אזור היום, מהחניה הנמוכה לגבוהה. עופר תמיד באמצע.
   בראשון, שני, רביעי וחמישי איתי פותח את האזור; בשלישי ושישי גיל פותח. */
const _MS_ORDER_ITAY_FIRST = ['איתי', 'עופר', 'גיל'];
const _MS_ORDER_GIL_FIRST  = ['גיל', 'עופר', 'איתי'];
const _msOrderFor = date => {
  const day = (date || new Date()).getDay();               // 0=ראשון
  return (day === 0 || day === 1 || day === 3 || day === 4) ? _MS_ORDER_ITAY_FIRST : _MS_ORDER_GIL_FIRST;
};
const _MS_HOUR = 7;            // היום מתחלף ב-07:00
const _MS_POPUP_MIN = 7 * 60 + 30;   // החלונית קופצת פעם ביום ב-07:30
/* השלישים מוגדרים לפי המראה של המגרש ולא לפי ספירת רכבים:
   1–34 הצד השמאלי · 40–67 הצד הימני ליד הכניסה · 68–93 הצד הימני בסוף. */
const _MS_ZONES = [
  { name: 'הצד השמאלי (1–34)',            min: 1,  max: 34 },
  { name: 'הצד הימני ליד הכניסה (40–67)', min: 40, max: 67 },
  { name: 'הצד הימני בסוף המגרש (68–93)', min: 68, max: 93 },
];
const _MS_THIRD_NAMES = _MS_ZONES.map(z => z.name);
const _MS_ITAY_ANCHOR = 35;   // השבוע של 25.8.2026 — שבוע שבו איתי עובד

let _msState = null;      // config/morning_roll — { itayWeek, itayAnchor, snoozeDay, snoozeTo }
let _msToday = null;      // morning_starts/<יום> — { present, byDriver, third }
let _msTimer = null;

const _msDayKey = () => new Date(Date.now() - _MS_HOUR * 3600000).toLocaleDateString('sv-SE');

// מספר השבוע בשנה — משמש לחישוב שבוע כן / שבוע לא של איתי
function _msWeekNum(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

/* איתי עובד שבוע כן שבוע לא, ראשון עד חמישי. בשישי הוא תמיד מגיע.
   העוגן נשמר פעם אחת: השבוע שבו סומן שהוא עובד, ומשם זה מתחלף לבד. */
function _msItayWorks(date) {
  const d = date || new Date();
  if (d.getDay() === 5) return true;                       // שישי — תמיד
  // ברירת המחדל נקבעה לפי השבוע של 25.8.2026, שבו איתי עובד. אם המנהל
  // לוחץ "שנה" נשמר עוגן משלו והוא גובר.
  const anchor = (_msState && _msState.itayAnchor) || _MS_ITAY_ANCHOR;
  return (_msWeekNum(d) - Number(anchor)) % 2 === 0;
}

// השליש של היום. שבת מחזירה null — אין הנעות.
function _msThirdOf(date) {
  const day = (date || new Date()).getDay();               // 0=ראשון
  if (day === 6) return null;
  return day % 3;                                          // א,ד=0 · ב,ה=1 · ג,ו=2
}

/* כל החניות שמניעים בהן: חניה תפוסה שאינה על הכביש. הצד השמאלי הוא
   שדה "כניסה", והצד הימני "בפנים"/"בחוץ". שדות "כביש" מדולגים. */
/* מספרי החניות ומיקומן קבועים במגרש ואינם תלויים במה שחונה בהן:
   1–34 בצד השמאלי, ו-40–93 בצד הימני. ההנעות מחולקות לפי החניות עצמן. */
function _msAllSpots() {
  const out = [];
  LEFT_SPOTS.forEach(n => out.push({ spot: Number(n) }));
  RIGHT_ROWS.forEach(r => { if (r) r.forEach(n => out.push({ spot: Number(n) })); });
  return out.sort((a, b) => a.spot - b.spot);
}

// חלוקה לחלקים רצופים בגודל דומה, לפי הסדר
function _msChunks(list, parts) {
  const out = Array.from({ length: parts }, () => []);
  if (!list.length) return out;
  const base = Math.floor(list.length / parts), extra = list.length % parts;
  let i = 0;
  for (let p = 0; p < parts; p++) {
    const take = base + (p < extra ? 1 : 0);
    out[p] = list.slice(i, i + take);
    i += take;
  }
  return out;
}

/* בצד הימני כל תור בנוי משתי שורות — בפנים ובחוץ — ושתיהן שייכות לאותו
   נהג. אחרת נהג אחד היה מניע רכב בשורה האחורית ונהג אחר את הרכב שחוסם
   אותו מלפנים. לכן החלוקה נעשית בתורים שלמים ולא בחניות בודדות. */
function _msUnits(spots) {
  const byRow = new Map();
  const units = [];
  spots.forEach(sp => {
    const row = RIGHT_ROWS.find(r => r && r.includes(String(sp.spot)));
    if (!row) { units.push([sp]); return; }          // צד שמאל — חניה בודדת
    const key = row.join('-');
    if (!byRow.has(key)) { const u = []; byRow.set(key, u); units.push(u); }
    byRow.get(key).push(sp);
  });
  return units;
}

/* מחלק תורים שלמים לחלקים רצופים, כך שמספר החניות בכל חלק קרוב ככל
   האפשר לשווה. החיתוך נעשה בגבול התור שהכי קרוב ליעד. */
function _msSplitUnits(units, parts) {
  const out = Array.from({ length: parts }, () => []);
  const total = units.reduce((t, u) => t + u.length, 0);
  if (!total) return out;
  let idx = 0, acc = 0;
  for (let p = 0; p < parts - 1; p++) {
    const target = total * (p + 1) / parts;
    while (idx < units.length) {
      const before = Math.abs(acc - target);
      const after = Math.abs(acc + units[idx].length - target);
      // נשארים חלקים לכל שאר הנהגים
      if (after > before && units.length - idx > parts - 1 - p) break;
      out[p].push(...units[idx]);
      acc += units[idx].length;
      idx++;
      if (units.length - idx <= parts - 1 - p) break;
    }
  }
  for (; idx < units.length; idx++) out[parts - 1].push(...units[idx]);
  return out;
}

/* מחלק את חניות היום בין הנהגים שהגיעו.
   שלושה — לפי הסדר גיל, עופר, איתי, כך שעופר תמיד באמצע.
   שניים — עופר מקבל את החצי הגבוה; בלי עופר, לפי הסדר הקבוע.
   אחד — הכול עליו.                                                  */
function _msDivide(present, spots, date) {
  const drivers = _msOrderFor(date).filter(d => present.includes(d));
  const byDriver = {};
  drivers.forEach(d => { byDriver[d] = []; });
  if (!drivers.length || !spots.length) return byDriver;

  const units = _msUnits(spots);
  if (drivers.length === 2 && drivers.includes('עופר')) {
    const other = drivers.find(d => d !== 'עופר');
    const [low, high] = _msSplitUnits(units, 2);
    byDriver[other] = low;
    byDriver['עופר'] = high;                               // עופר על החצי הגבוה
    return byDriver;
  }
  const chunks = _msSplitUnits(units, drivers.length);
  drivers.forEach((d, i) => { byDriver[d] = chunks[i]; });
  return byDriver;
}

// כל מה שצריך כדי להציג ולחלק את היום
function _msPlanFor(present, date) {
  const third = _msThirdOf(date);
  if (third === null) return { third: null, spots: [], byDriver: {} };
  const z = _MS_ZONES[third];
  const spots = _msAllSpots().filter(x => x.spot >= z.min && x.spot <= z.max);
  return { third, spots, byDriver: _msDivide(present, spots, date) };
}


/* ═══════════════════════════════════════════════════════════════════════
   ניהול התראות
   מסך אחד לשליחת הודעה לכל מי שהטלגרם שלו מקושר, ולשמירת התראות
   חוזרות שאפשר לערוך ולשלוח שוב בלחיצה.
   ═══════════════════════════════════════════════════════════════════ */
const _NM_DAYS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
let _nmTemplates = [];
let _nmTo = new Set();
let _nmDays = new Set();     // אינדקסים 0=ראשון
let _nmTimes = [];           // "HH:MM"
let _nmEditId = null;
let _nmUnsub = null;

// כל מי שיש לו טלגרם מקושר. שדות שמתחילים בקו תחתון הם הגדרות ולא אנשים.
async function _nmPeople() {
  const contacts = await _loadDriverContacts();
  return Object.entries(contacts || {})
    .filter(([k, c]) => !k.startsWith('_') && c && c.telegramId)
    .map(([k]) => k);
}

async function openNotifyMgr() {
  if (currentUser?.role !== 'manager') return;
  const badge = document.getElementById('nm-user-badge');
  if (badge) badge.textContent = currentUser.name;
  showScreen('notify-mgr');
  if (!_nmUnsub) {
    _nmUnsub = _onSnap(_colRef('notif_templates'), snap => {
      _nmTemplates = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'he'));
      _nmRenderList();
    }, () => {});
  }
  _nmRenderList();
}
window.openNotifyMgr = openNotifyMgr;

async function _nmRenderPeople() {
  const box = document.getElementById('nm-recipients');
  if (!box) return;
  const people = await _nmPeople();
  if (!people.length) {
    box.innerHTML = '<div style="font-size:12.5px;color:#b45309;font-weight:800">אין אף אחד עם טלגרם מקושר — חבר אנשים בהגדרות ← טלגרם</div>';
    return;
  }
  const allOn = people.every(n => _nmTo.has(n));
  box.innerHTML =
    `<button onclick="nmToggleAll()" style="background:${allOn ? 'var(--dark)' : 'var(--surface2)'};color:${allOn ? '#fff' : 'var(--text)'};border:2px solid var(--border);border-radius:999px;padding:6px 13px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer">${allOn ? '✅' : '⬜'} כולם</button>` +
    people.map(n => {
      const on = _nmTo.has(n);
      return `<button onclick="nmTogglePerson('${esc(n)}')" style="background:${on ? '#16a34a' : 'var(--surface2)'};color:${on ? '#fff' : 'var(--text)'};border:2px solid ${on ? '#16a34a' : 'var(--border)'};border-radius:999px;padding:6px 13px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer">${esc(n)}</button>`;
    }).join('');
}

function _nmRenderDays() {
  const box = document.getElementById('nm-days');
  if (!box) return;
  box.innerHTML = _NM_DAYS.map((d, i) => {
    const on = _nmDays.has(i);
    return `<button onclick="nmToggleDay(${i})" style="background:${on ? '#1d4ed8' : 'var(--surface2)'};color:${on ? '#fff' : 'var(--text)'};border:2px solid ${on ? '#1d4ed8' : 'var(--border)'};border-radius:10px;padding:6px 11px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer">${d}</button>`;
  }).join('');
}

function nmToggleDay(i) {
  if (_nmDays.has(i)) _nmDays.delete(i); else _nmDays.add(i);
  _nmRenderDays();
}
window.nmToggleDay = nmToggleDay;

/* השעות נוספות אחת אחת, ולא כטווח. הקלדה של 2345 הופכת ל-23:45,
   בדיוק כמו בהוספת משימה ליומן. */
function _nmRenderTimes() {
  const box = document.getElementById('nm-times');
  if (!box) return;
  box.innerHTML = _nmTimes.map((t, i) =>
    `<span style="display:inline-flex;align-items:center;gap:6px;background:var(--dark);color:#fff;border-radius:999px;padding:5px 8px 5px 12px;font-size:13.5px;font-weight:900;direction:ltr">
      ${esc(t)}
      <button onclick="nmRemoveTime(${i})" title="הסר" style="background:rgba(255,255,255,.25);border:none;color:#fff;border-radius:999px;width:19px;height:19px;line-height:1;font-size:12px;font-weight:900;cursor:pointer">✕</button>
    </span>`).join('') +
    `<input id="nm-time-input" type="text" inputmode="numeric" maxlength="5" placeholder="2345 ← 23:45"
       oninput="this.value=this.value.replace(/\D/g,'').slice(0,4)"
       onkeydown="if(event.key==='Enter'){event.preventDefault();nmAddTime();}"
       style="width:118px;padding:6px 9px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:Heebo,sans-serif;font-size:13px;direction:ltr;text-align:center">
     <button onclick="nmAddTime()" style="background:var(--gold);color:#000;border:none;border-radius:10px;padding:6px 12px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer">➕ הוסף שעה</button>`;
}

function nmAddTime() {
  const inp = document.getElementById('nm-time-input');
  const t = _normalizeTime(inp?.value || '');
  if (!t) return showToast('שעה לא תקינה — לדוגמה 2345');
  if (_nmTimes.includes(t)) { inp.value = ''; return showToast('השעה כבר ברשימה'); }
  _nmTimes = [..._nmTimes, t].sort();
  _nmRenderTimes();
  document.getElementById('nm-time-input')?.focus();
}
window.nmAddTime = nmAddTime;

function nmRemoveTime(i) {
  _nmTimes.splice(i, 1);
  _nmRenderTimes();
}
window.nmRemoveTime = nmRemoveTime;

async function nmToggleAll() {
  const people = await _nmPeople();
  if (people.every(n => _nmTo.has(n))) _nmTo.clear();
  else people.forEach(n => _nmTo.add(n));
  _nmRenderPeople();
}
window.nmToggleAll = nmToggleAll;

function nmTogglePerson(name) {
  if (_nmTo.has(name)) _nmTo.delete(name); else _nmTo.add(name);
  _nmRenderPeople();
}
window.nmTogglePerson = nmTogglePerson;

/* חלונית ההתראה — אותה חלונית לחדשה ולעריכה. */
async function nmOpenNew() {
  _nmEditId = null;
  _nmTo.clear(); _nmDays.clear(); _nmTimes = [];
  document.getElementById('nm-msg').value = '';
  document.getElementById('nm-modal-title').textContent = '✉️ התראה חדשה';
  await _nmRenderPeople();
  _nmRenderDays(); _nmRenderTimes();
  openModal('modal-notify-edit');
}
window.nmOpenNew = nmOpenNew;

/* הקפאה: ההתראה נשארת ברשימה אבל לא נשלחת. אפשר להקפיא עד תאריך
   מסוים או ללא הגבלת זמן, ולהפשיר בלחיצה. */
function _nmFrozen(t) {
  if (!t.frozen) return false;
  if (!t.frozenUntil) return true;                       // ללא הגבלת זמן
  return _todayKey() <= t.frozenUntil;                   // עד התאריך כולל
}

let _nmFreezeId = null;

async function nmToggleFreeze(id) {
  const t = _nmTemplates.find(x => x.id === id);
  if (!t) return;
  if (!_requireNet('עדכון ההתראה')) return;
  if (_nmFrozen(t)) {
    try {
      await _updateDoc(_docRef('notif_templates', id), { frozen: false, frozenUntil: '' });
      showToast('☀️ ההתראה הופשרה');
    } catch (e) { showToast('העדכון נכשל: ' + (e.code || e.message), 6000); }
    return;
  }
  _nmFreezeId = id;
  const name = document.getElementById('nm-freeze-name');
  if (name) name.textContent = t.title || 'ההתראה';
  const inp = document.getElementById('nm-freeze-date');
  if (inp) {
    const d = new Date(); d.setDate(d.getDate() + 7);      // ברירת מחדל: שבוע קדימה
    inp.value = d.toLocaleDateString('sv-SE');
    inp.min = _todayKey();
  }
  openModal('modal-nm-freeze');
}
window.nmToggleFreeze = nmToggleFreeze;

async function nmFreezeApply(forever) {
  const id = _nmFreezeId;
  if (!id) return;
  const until = forever ? '' : (document.getElementById('nm-freeze-date')?.value || '');
  if (!forever && !until) return showToast('נא לבחור תאריך');
  try {
    await _updateDoc(_docRef('notif_templates', id), { frozen: true, frozenUntil: until });
    closeModal('modal-nm-freeze');
    _nmFreezeId = null;
    showToast(until ? `❄️ מוקפאת עד ${until}` : '❄️ ההתראה מוקפאת ללא הגבלת זמן');
  } catch (e) { showToast('העדכון נכשל: ' + (e.code || e.message), 6000); }
}
window.nmFreezeApply = nmFreezeApply;

function _nmRenderList() {
  const box = document.getElementById('nm-list');
  const cnt = document.getElementById('nm-count');
  if (!box) return;
  if (cnt) cnt.textContent = _nmTemplates.length ? `${_nmTemplates.length} התראות` : '';
  if (!_nmTemplates.length) {
    box.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:26px 16px;font-weight:700;font-size:13px">אין עדיין התראות. לחץ "➕ התראה חדשה" כדי ליצור אחת.</div>';
    return;
  }
  box.innerHTML = _nmTemplates.map(t => {
    const frozen = _nmFrozen(t);
    return `
    <div style="background:var(--card);border:2px solid ${frozen ? '#94a3b8' : 'var(--border)'};border-radius:14px;padding:12px 13px;${frozen ? 'opacity:.72' : ''}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:900;font-size:14.5px">${esc(t.title || 'התראה')}${frozen ? `<span style="font-size:11.5px;font-weight:800;color:#fff;background:#64748b;border-radius:7px;padding:2px 8px;margin-right:7px">❄️ מוקפאת${t.frozenUntil ? ' עד ' + esc(t.frozenUntil) : ''}</span>` : ''}</div>
          <div style="font-size:13px;color:var(--text);margin-top:3px;white-space:pre-wrap">${esc(t.message || '')}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:700;margin-top:5px">👤 ${esc((t.to || []).join(' · ')) || 'לא נבחרו נמענים'}</div>
          ${(t.days || []).length || (t.times || []).length
            ? `<div style="font-size:12px;color:#1d4ed8;font-weight:800;margin-top:3px">🕒 ${esc((t.days || []).map(d => _NM_DAYS[d]).join(', ') || 'כל יום')}${(t.times || []).length ? ' · ' + esc(t.times.join(' · ')) : ''}</div>`
            : '<div style="font-size:12px;color:var(--muted);font-weight:700;margin-top:3px">🕒 שליחה ידנית בלבד</div>'}
        </div>
      </div>
      <div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap">
        <button onclick="_runOnce('nmSendT-${t.id}', this, '⏳ שולח...', () => nmSendTemplate('${t.id}'))" style="flex:1;min-width:110px;background:#16a34a;color:#fff;border:none;border-radius:10px;padding:9px;font-family:Heebo,sans-serif;font-weight:800;font-size:13px;cursor:pointer">📨 שלח</button>
        <button onclick="nmEditTemplate('${t.id}')" style="background:var(--surface2);color:var(--text);border:2px solid var(--border);border-radius:10px;padding:9px 14px;font-family:Heebo,sans-serif;font-weight:800;font-size:13px;cursor:pointer">✏️ ערוך</button>
        <button onclick="nmToggleFreeze('${t.id}')" style="background:${frozen ? '#bae6fd' : 'var(--surface2)'};color:${frozen ? '#075985' : 'var(--text)'};border:2px solid ${frozen ? '#38bdf8' : 'var(--border)'};border-radius:10px;padding:9px 14px;font-family:Heebo,sans-serif;font-weight:800;font-size:13px;cursor:pointer">${frozen ? '☀️ הפשר' : '❄️ הקפא'}</button>
        <button onclick="nmDeleteTemplate('${t.id}')" style="background:#fff0f0;color:#dc2626;border:2px solid #ef4444;border-radius:10px;padding:9px 14px;font-family:Heebo,sans-serif;font-weight:800;font-size:13px;cursor:pointer">🗑</button>
      </div>
    </div>`; }).join('');
}

// שליחה בפועל — רק למי שיש לו טלגרם מקושר
async function _nmDeliver(message, to) {
  const contacts = await _loadDriverContacts();
  let ok = 0, fail = 0;
  for (const name of to) {
    const id = contacts[name]?.telegramId;
    if (!id) { fail++; continue; }
    const sent = await _sendTelegram(id, message);
    sent ? ok++ : fail++;
  }
  return { ok, fail };
}

async function nmSendNow() {
  const message = (document.getElementById('nm-msg')?.value || '').trim();
  if (!message) return showToast('נא לכתוב הודעה');
  if (!_nmTo.size) return showToast('נא לבחור למי לשלוח');
  if (!_requireNet('שליחת ההתראה')) return;
  const { ok, fail } = await _nmDeliver(message, [..._nmTo]);
  showToast(fail ? `📨 נשלח ל-${ok} · ${fail} נכשלו` : `✅ ההתראה נשלחה ל-${ok}`, 6000);
}
window.nmSendNow = nmSendNow;

async function nmSendTemplate(id) {
  const t = _nmTemplates.find(x => x.id === id);
  if (!t) return;
  if (!(t.to || []).length) return showToast('להתראה הזו אין נמענים — ערוך אותה');
  if (!_requireNet('שליחת ההתראה')) return;
  const { ok, fail } = await _nmDeliver(t.message || '', t.to);
  showToast(fail ? `📨 נשלח ל-${ok} · ${fail} נכשלו` : `✅ "${t.title || 'התראה'}" נשלחה ל-${ok}`, 6000);
}
window.nmSendTemplate = nmSendTemplate;

async function nmSaveTemplate() {
  const message = (document.getElementById('nm-msg')?.value || '').trim();
  if (!message) return showToast('נא לכתוב הודעה');
  const title = prompt('שם ההתראה (כדי למצוא אותה אחר כך):', _nmEditId ? (_nmTemplates.find(t => t.id === _nmEditId)?.title || '') : '');
  if (title === null) return;
  if (!_requireNet('שמירת ההתראה')) return;
  // אם ההתראה שנערכה נמחקה בינתיים — נשמרת חדשה במקום לקרוס
  if (_nmEditId && !_nmTemplates.some(t => t.id === _nmEditId)) _nmEditId = null;
  const data = { title: title.trim() || 'התראה', message, to: [..._nmTo],
    days: [..._nmDays].sort((a, b) => a - b), times: [..._nmTimes],
    updatedAt: new Date().toISOString(), updatedBy: currentUser.name };
  try {
    if (_nmEditId) {
      await _updateDoc(_docRef('notif_templates', _nmEditId), data);
      showToast('✅ ההתראה עודכנה');
    } else {
      await _addDoc(_colRef('notif_templates'), { ...data, createdAt: _serverTs() });
      showToast('✅ ההתראה נשמרה');
    }
  } catch (e) { return showToast('שמירה נכשלה: ' + (e.code || e.message), 6000); }
  _nmEditId = null;
  document.getElementById('nm-msg').value = '';
  _nmTo.clear(); _nmDays.clear(); _nmTimes = [];
  closeModal('modal-notify-edit');
}
window.nmSaveTemplate = nmSaveTemplate;

async function nmEditTemplate(id) {
  const t = _nmTemplates.find(x => x.id === id);
  if (!t) return;
  _nmEditId = id;
  document.getElementById('nm-msg').value = t.message || '';
  document.getElementById('nm-modal-title').textContent = '✏️ עריכת התראה';
  _nmTo = new Set(t.to || []);
  _nmDays = new Set(t.days || []);
  _nmTimes = [...(t.times || [])];
  await _nmRenderPeople();
  _nmRenderDays(); _nmRenderTimes();
  openModal('modal-notify-edit');
}
window.nmEditTemplate = nmEditTemplate;

async function nmDeleteTemplate(id) {
  const t = _nmTemplates.find(x => x.id === id);
  if (!t) return;
  if (!confirm(`למחוק את ההתראה "${t.title || ''}"?`)) return;
  try {
    const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(_docRef('notif_templates', id));
    if (_nmEditId === id) _nmEditId = null;
    showToast('🗑 ההתראה נמחקה');
  } catch (e) { showToast('מחיקה נכשלה: ' + (e.code || e.message), 6000); }
}
window.nmDeleteTemplate = nmDeleteTemplate;

/* מציג רשימת חניות כטווחים: 1,2,3,...,12 הופך ל-"1–12", ורצפים נפרדים
   מופרדים בפסיק. זה מה שהנהג צריך לראות בבוקר. */
function _msRange(list) {
  const nums = [...new Set((list || []).map(x => Number(x.spot ?? x)))].sort((a, b) => a - b);
  if (!nums.length) return '';
  const runs = [];
  let start = nums[0], prev = nums[0];
  for (let i = 1; i <= nums.length; i++) {
    const n = nums[i];
    if (n === prev + 1) { prev = n; continue; }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = n;
  }
  return runs.join(', ');
}

function _msListen() {
  if (_msTimer) return;
  _onSnap(_docRef('config', 'morning_roll'), snap => {
    _msState = (snap.exists() ? snap.data() : {}) || {};
    _msCheck();
  }, () => { _msState = {}; });
  _onSnap(_docRef('morning_starts', _msDayKey()), snap => {
    _msToday = snap.exists() ? snap.data() : null;
    _msSyncCard();
    _msRenderHome();
    _msSyncHomeAlert();
    try { _renderDailyQuote(); } catch (e) {}
    if (document.getElementById('screen-morning-starts')?.classList.contains('active')) _msRenderScreen();
  }, () => {});
  _msSyncHomeAlert();
  _msTimer = setInterval(() => {
    _msCheck();
    _msSyncHomeAlert();
    try { _renderDailyQuote(); } catch (e) {}
  }, 60000);
}

// החלונית קופצת למנהל פעם ביום מ-07:30, עד שהחלוקה של היום נשמרה
function _msCheck() {
  if (currentUser?.role !== 'manager') return;
  if (!_msState) return;
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < _MS_POPUP_MIN) return;
  if (_msThirdOf() === null) return;                        // שבת
  if (_msToday && _msToday.day === _msDayKey()) return;     // כבר חולק היום
  const snooze = _msState.snoozeDay === _msDayKey() ? Number(_msState.snoozeTo || 0) : 0;
  if (snooze && Date.now() < snooze) return;                // נדחתה
  if (_msState.handledDay === _msDayKey()) return;           // כבר טופלה היום
  const modal = document.getElementById('modal-morning-roll');
  if (modal && modal.classList.contains('open')) return;
  // רק חלונית בדיקת הבעלויות נעולה גם היא ולכן תכסה את זו — מחכים שתיסגר.
  // כל שאר החלוניות נפתחו ביוזמת המנהל ואפשר להיפתח מעליהן.
  const own = document.getElementById('modal-own-morning');
  if (own && own.classList.contains('open')) return;
  _msRenderRoll();
  openModal('modal-morning-roll');
}

/* רשת ביטחון: גם אם החלונית לא קפצה מסיבה כלשהי, הכפתור במסך הבית
   מופיע כל עוד ההנעות של היום לא חולקו — כך תמיד יש דרך לחלק. */
function _msSyncHomeAlert() {
  const el = document.getElementById('ms-home-alert');
  if (!el) return;
  const now = new Date();
  const show = currentUser?.role === 'manager'
    && _msThirdOf() !== null
    && now.getHours() * 60 + now.getMinutes() >= _MS_POPUP_MIN
    && !(_msToday && _msToday.day === _msDayKey());
  el.style.display = show ? 'block' : 'none';
}
window._msSyncHomeAlert = _msSyncHomeAlert;

let _msPresent = null;

function _msRenderRoll() {
  const box = document.getElementById('ms-roll-body');
  if (!box) return;
  const now = new Date();
  if (!_msPresent) {
    // ברירת מחדל: כולם, פרט לאיתי בשבוע שהוא לא עובד
    _msPresent = _MS_DRIVERS.filter(d => d !== 'איתי' || _msItayWorks(now));
  }
  const third = _msThirdOf(now);
  const plan = _msPlanFor(_msPresent, now);
  const dayName = now.toLocaleDateString('he-IL', { weekday: 'long' });
  box.innerHTML = `
    <div style="text-align:center;font-size:13.5px;font-weight:800;color:var(--muted);margin-bottom:10px">
      ${esc(dayName)} · ${esc(_MS_THIRD_NAMES[third] || '')} · ${plan.spots.length} חניות
    </div>
    <div style="font-size:13px;font-weight:800;margin-bottom:7px">מי הגיע היום?</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${_MS_DRIVERS.map(d => {
        const on = _msPresent.includes(d);
        const cnt = (plan.byDriver[d] || []).length;
        const rng = _msRange(plan.byDriver[d]);
        return `<button onclick="msTogglePresent('${d}')" style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:${on ? '#dcfce7' : 'var(--surface2)'};border:2px solid ${on ? '#16a34a' : 'var(--border)'};border-radius:12px;padding:11px 13px;font-family:Heebo,sans-serif;font-size:15px;font-weight:800;cursor:pointer;color:var(--text);text-align:right">
          <span>${on ? '✅' : '⬜'} ${d}</span>
          <span style="font-size:13.5px;font-weight:900;color:${on && rng ? 'var(--text)' : 'var(--muted)'};direction:ltr">${on ? (rng || '—') : 'לא הגיע'}</span>
        </button>`;
      }).join('')}
    </div>
    <div style="margin-top:10px;font-size:12px;color:var(--muted);font-weight:700;text-align:center">
      ${_msItayWorks(now) ? 'לפי הסבב — השבוע איתי עובד' : 'לפי הסבב — השבוע איתי לא עובד'}
      · <a href="#" onclick="event.preventDefault();msFlipItayWeek()" style="color:#1d4ed8;font-weight:800">שנה</a>
    </div>`;
}

function msTogglePresent(name) {
  if (!_msPresent) _msPresent = [];
  _msPresent = _msPresent.includes(name) ? _msPresent.filter(d => d !== name) : [..._msPresent, name];
  _msRenderRoll();
}
window.msTogglePresent = msTogglePresent;

// מתקן את הסבב של איתי: השבוע הנוכחי נשמר כעוגן וממנו מתחלף לבד
async function msFlipItayWeek() {
  const w = _msWeekNum(new Date());
  const anchor = _msItayWorks(new Date()) ? w + 1 : w;
  _msState = { ...(_msState || {}), itayAnchor: anchor };
  try { await window._setDoc(_docRef('config', 'morning_roll'), { itayAnchor: anchor }, { merge: true }); } catch (e) {}
  _msPresent = null;
  _msRenderRoll();
}
window.msFlipItayWeek = msFlipItayWeek;

async function msRollConfirm() {
  if (!_requireNet('חלוקת ההנעות')) return;
  const present = (_msPresent || []).slice();
  if (!present.length) return showToast('נא לסמן לפחות נהג אחד');
  const now = new Date();
  const plan = _msPlanFor(present, now);
  const payload = {
    day: _msDayKey(), third: plan.third, present,
    // נשמרים מספרי החניות בלבד — אין שדה נוסף, ולכן גם אין ערך undefined
    byDriver: Object.fromEntries(Object.entries(plan.byDriver).map(([d, list]) =>
      [d, list.map(x => ({ spot: x.spot }))])),
    createdAt: new Date().toISOString(), createdBy: currentUser.name,
  };
  await window._setDoc(_docRef('morning_starts', payload.day), payload, { merge: true });
  _msToday = payload;
  closeModal('modal-morning-roll');
  present.forEach(d => {
    const n = (plan.byDriver[d] || []).length;
    if (n) _notifyDriver(d, `🔑 הנעות הבוקר — חניות ${_msRange(plan.byDriver[d])}`);
  });
  showToast(`✅ ההנעות חולקו ל-${present.length} נהגים`);
  _msMarkHandled();
  _msSyncHomeAlert();
  _msSyncCard();
}
window.msRollConfirm = msRollConfirm;

// אחרי שהמנהל חילק — החלונית לא חוזרת היום
async function _msMarkHandled() {
  const day = _msDayKey();
  const data = { handledDay: day, snoozeDay: '', snoozeTo: 0 };
  if (_msState && _msState.handledDay === day) return;
  _msState = { ...(_msState || {}), ...data };
  try { await window._setDoc(_docRef('config', 'morning_roll'), data, { merge: true }); } catch (e) {}
}

async function msRollSnooze() {
  const data = { snoozeDay: _msDayKey(), snoozeTo: Date.now() + 30 * 60000 };
  _msState = { ...(_msState || {}), ...data };
  closeModal('modal-morning-roll');
  try { await window._setDoc(_docRef('config', 'morning_roll'), data, { merge: true }); } catch (e) {}
}
window.msRollSnooze = msRollSnooze;

/* פתיחה ידנית של חלונית החלוקה — לבדיקה, או כשמישהו עזב באמצע היום
   וצריך לחלק מחדש. אותה חלונית שקופצת לבד ב-08:00. */
function msOpenRoll() {
  if (currentUser?.role !== 'manager') return;
  if (_msThirdOf() === null) return showToast('שבת — אין הנעות היום');
  _msPresent = null;
  _msRenderRoll();
  openModal('modal-morning-roll');
}
window.msOpenRoll = msOpenRoll;

// ── מסך ההנעות ──
function openMorningStartsScreen() {
  const badge = document.getElementById('ms-user-badge');
  if (badge) badge.textContent = currentUser.name;
  showScreen('morning-starts');
  _msRenderScreen();
}
window.openMorningStartsScreen = openMorningStartsScreen;

function _msRenderScreen() {
  const head = document.getElementById('ms-head');
  const body = document.getElementById('ms-body');
  if (!head || !body) return;
  const isManager = currentUser?.role === 'manager';
  const third = _msThirdOf();
  if (third === null) {
    head.innerHTML = '';
    body.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px 20px;font-weight:700">שבת — אין הנעות היום</div>';
    return;
  }
  const dayName = new Date().toLocaleDateString('he-IL', { weekday: 'long' });
  head.innerHTML = `<div style="background:var(--card);border:2px solid var(--border);border-radius:14px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="font-weight:800;font-size:14px">${esc(dayName)} · ${esc(_MS_THIRD_NAMES[third])}</div>
      ${isManager ? `<button onclick="msOpenRoll()" style="background:var(--gold);color:#000;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap">🔁 חלק מחדש</button>` : ''}
    </div>`;
  if (!_msToday || _msToday.day !== _msDayKey()) {
    body.innerHTML = `<div style="text-align:center;color:var(--muted);padding:40px 20px;font-weight:700">
      ${isManager ? 'עוד לא חולקו ההנעות של היום' : 'המנהל עדיין לא חילק את ההנעות של הבוקר'}</div>`;
    return;
  }
  const by = _msToday.byDriver || {};
  const names = isManager ? Object.keys(by) : [currentUser.name].filter(n => by[n]);
  if (!names.length) {
    body.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px 20px;font-weight:700">אין לך רכבים להנעה הבוקר</div>';
    return;
  }
  body.innerHTML = names.map(name => {
    const list = by[name] || [];
    return `<div style="background:var(--card);border:2px solid var(--border);border-radius:14px;padding:12px 14px;margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-weight:900;font-size:16px">${esc(name)}</div>
        <div style="font-size:13.5px;font-weight:900;direction:ltr">${esc(_msRange(list))}<span style="font-size:12px;font-weight:800;color:var(--muted);margin-right:6px">${list.length} חניות</span></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:6px">
        ${list.map(x => `<div style="background:var(--dark);color:#fff;border-radius:10px;padding:8px 4px;text-align:center;font-size:16px;font-weight:900">${x.spot}</div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

/* רשימת ההנעות במסך הבית של הנהג — במקום קובייה נפרדת. מוצגת בקצרה:
   מספר חניה ולוחית, בשורות צפופות שנכנסות למסך. */
function _msRenderHome() {
  const box = document.getElementById('home-morning');
  if (!box) return;
  if (currentUser?.role === 'manager') { box.innerHTML = ''; return; }
  const third = _msThirdOf();
  const ok = _msToday && _msToday.day === _msDayKey();
  const list = (ok && _msToday.byDriver && _msToday.byDriver[currentUser?.name]) || [];
  if (third === null) {
    box.innerHTML = `<div class="drv-morning"><div class="drv-morning-head">🔑 הנעות הבוקר</div>
      <div class="drv-morning-empty">שבת — אין הנעות היום</div></div>`;
    return;
  }
  if (!ok) {
    box.innerHTML = `<div class="drv-morning"><div class="drv-morning-head">🔑 הנעות הבוקר</div>
      <div class="drv-morning-empty">המנהל עדיין לא חילק את ההנעות</div></div>`;
    return;
  }
  if (!list.length) {
    box.innerHTML = `<div class="drv-morning"><div class="drv-morning-head">🔑 הנעות הבוקר</div>
      <div class="drv-morning-empty">אין לך רכבים להנעה הבוקר</div></div>`;
    return;
  }
  box.innerHTML = `<div class="drv-morning">
    <div class="drv-morning-head">🔑 בוקר טוב, ${esc(currentUser.name)}
      <span style="font-weight:800;color:var(--muted);font-size:12px">${list.length} חניות</span>
    </div>
    <div style="font-size:13px;font-weight:700;color:var(--muted);margin-bottom:4px">החניות שלך להיום הן</div>
    <div class="drv-morning-range">${esc(_msRange(list))}</div>
    <div class="drv-morning-grid">
      ${list.map(x => `<div class="drv-morning-cell">${x.spot}</div>`).join('')}
    </div>
  </div>`;
}

// המונה על הקוביה במסך הבית — כמה רכבים נשארו לנהג הזה הבוקר
function _msSyncCard() {
  const isManager = currentUser?.role === 'manager';
  const ok = _msToday && _msToday.day === _msDayKey();
  const by = (ok && _msToday.byDriver) || {};
  const count = isManager
    ? Object.values(by).reduce((t, l) => t + l.length, 0)
    : (by[currentUser?.name] || []).length;
  _setCardBadge('morning-starts', count);
}

function _checkOwnMorning() {
  if (!_ownMorningState) return;                                  // עוד לא נטען מהשרת
  if (_hostName === 'ownership') return;                          // נמצאים בתוך הבדיקה
  const now = new Date();
  if (now.getHours() < _OWN_MORNING_HOUR) return;                 // עוד לא הגיע הזמן
  const today = _ownToday();
  if (_ownMorningState.ackDay === today) return;                 // כבר אושר היום
  // דחייה תקפה רק ליום שבו נעשתה. אם התחלף היום — היא כבר לא סופרת,
  // וכך גם אם לא נכנסת יום שלם, בכניסה הבאה תראה את התזכורת.
  const snooze = _ownMorningState.snoozeDay === today ? Number(_ownMorningState.snoozeTo || 0) : 0;
  if (snooze && Date.now() < snooze) return;                      // נדחה
  const modal = document.getElementById('modal-own-morning');
  if (modal && modal.classList.contains('open')) return;          // כבר פתוח
  _ownStartWatch();
  _renderOwnMorning();
  openModal('modal-own-morning');
  // אין סגירה אוטומטית ואין דחייה מאחורי הקלעים — רק שני הכפתורים
  // סוגרים את החלונית. אם היא נסגרה בכל זאת, היא תחזור תוך דקה.
  _ownEnsureFresh();
}

function _ownMorningClose() {
  closeModal('modal-own-morning');
  _syncOwnMorningBar();
}

// הפס במסך הפירוט מופיע כל עוד לא אישרת את הבדיקה של היום
function _syncOwnMorningBar() {
  const bar = document.getElementById('own-morning-bar');
  if (!bar) return;
  const due = (currentUser?.role === 'manager')
    && new Date().getHours() >= _OWN_MORNING_HOUR
    && _ownMorningState && _ownMorningState.ackDay !== _ownToday();
  bar.style.display = due ? 'block' : 'none';
}
window._syncOwnMorningBar = _syncOwnMorningBar;

function ownMorningDone() {
  _ownMorningSet({ ackDay: _ownToday(), snoozeTo: 0, snoozeDay: '' });
  _ownMorningClose();
  showToast('✅ נסגר עד מחר בבוקר');
}
window.ownMorningDone = ownMorningDone;

function ownMorningSnooze() {
  _ownMorningSet({ snoozeTo: Date.now() + 60 * 60 * 1000, snoozeDay: _ownToday() });
  _ownMorningClose();
  showToast('⏰ נחזור אליך בעוד שעה');
}
window.ownMorningSnooze = ownMorningSnooze;

/* רכבים שאינם נסרקים כלל (רכבי "לפי הזמנה"). הרשימה זהה לזו שבשרת,
   והיא כאן כדי שלא יוצגו התראות על רכבים שממילא לא נבדקים.        */
const _SCAN_SKIP_PLATES = new Set([
  '36805104', '36872304', '41772304', '42339704', '47519104', '49245604',
  '52807804', '53864404', '55054904', '55378904', '56514104', '56514304',
  '58684704', '59634904', '60039604', '60727804', '60802504', '61731604',
  '64244204', '64255104', '64263604', '65805904', '65816904', '65942904',
  '67148404', '67294504', '67297604', '71544204', '72279204', '72382504',
  '73093704', '73858803', '74232304', '75278804',
]);

/* ── רכבים שירדו מהמלאי ──────────────────────────────────────────────
   זה המצב היחיד שדורש אישור שלך. אחרי אישור הרכב לא מוצג שוב.
   כל שאר שינויי הבעלות מוצגים כרגיל ואינם דורשים כלום.            */
