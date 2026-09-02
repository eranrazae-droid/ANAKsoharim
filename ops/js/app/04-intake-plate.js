/* משיכת פרטי רכב וטופס קליטה
   חלק 4 מתוך 13 של אפליקציית התפעול.
   הקבצים נטענים לפי הסדר ומתנהגים בדיוק כמו קובץ אחד — אין לשנות את הסדר. */
const _PLATE_DS = '053cea08-09bc-40ec-8f7a-156f0677aff3';
const _PLATE_TTL = 90 * 86400000;          // פרטי רישוי כמעט לא משתנים
const _plateMem = new Map();               // מטמון לפעילות הנוכחית
const _plateInflight = new Map();           // בקשות שרצות ברגע זה

function _plateCacheGet(plate) {
  if (_plateMem.has(plate)) return _plateMem.get(plate);
  try {
    const raw = localStorage.getItem('plate:' + plate);
    if (!raw) return undefined;
    const o = JSON.parse(raw);
    if (!o || Date.now() - (o.t || 0) > _PLATE_TTL) return undefined;
    _plateMem.set(plate, o.v);
    return o.v;
  } catch (e) { return undefined; }
}
function _plateCacheSet(plate, v) {
  _plateMem.set(plate, v);
  // "לא נמצא" נשמר רק לזיכרון הפעילות הנוכחית. לוחית עשויה להיכנס למאגר
  // מאוחר יותר, ולוחית חלקית שהוקלדה תוך כדי הקלדה אינה תשובה אמיתית —
  // חבל לנעול אותה כלא־נמצאת לתשעים יום.
  if (!v) return;
  try { localStorage.setItem('plate:' + plate, JSON.stringify({ t: Date.now(), v })); } catch (e) {}
}

// ---- מטמון מרשם משלנו (plate_cache ב-Firestore) ----
// משרד התחבורה מרוקן את המאגר בכל טעינה לילית ולפעמים הוא נשאר ריק שעות.
// סריקת הבעלויות היומית שומרת עותק של כל רכב במלאי, וכאן נופלים אליו
// כשהמרשם הממשלתי לא מחזיר כלום.
window._plateRegistryEmpty = false;
const _regCacheMem = new Map();
async function _regCacheGet(plate) {
  if (_regCacheMem.has(plate)) return _regCacheMem.get(plate);
  let rec = null;
  try {
    const s = await window._getDoc(_docRef('plate_cache', plate));
    rec = (s.exists() && s.data().rec) ? s.data().rec : null;
  } catch (e) {}
  _regCacheMem.set(plate, rec);
  return rec;
}
function _regCacheSet(plate, rec) {
  if (!plate || !rec) return;
  const slim = {};
  for (const k of ['mispar_rechev','tozeret_nm','kinuy_mishari','degem_nm','ramat_gimur',
                   'tzeva_rechev','shnat_yitzur','tokef_dt','baalut','misgeret','degem_cd','tozeret_cd']) {
    if (rec[k] !== undefined && rec[k] !== null) slim[k] = rec[k];
  }
  _regCacheMem.set(plate, slim);
  try { setDoc(_docRef('plate_cache', plate), { rec: slim, at: new Date() }, { merge: true }).catch(() => {}); } catch (e) {}
}

// null = לא נמצא. זריקת שגיאה = תקלת רשת, כדי שאפשר יהיה להבדיל ביניהן.
async function _plateLookup(plateRaw) {
  const plate = String(plateRaw || '').replace(/\D/g, '');
  if (!plate) return null;
  const hit = _plateCacheGet(plate);
  if (hit !== undefined) return hit;
  if (_plateInflight.has(plate)) return _plateInflight.get(plate);

  const p = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const filters = encodeURIComponent(JSON.stringify({ mispar_rechev: plate }));
      const res = await fetch(`https://europe-west1-anak-soharim.cloudfunctions.net/govilProxy?resource_id=${_PLATE_DS}&filters=${filters}&limit=1`, { signal: ctrl.signal });
      if (!res.ok) throw new Error('network');
      const j = await res.json();
      if (j && 'registryEmpty' in j) window._plateRegistryEmpty = !!j.registryEmpty;
      let rec = j?.result?.records?.[0];
      let fromCache = false;
      if (!rec) {
        rec = await _regCacheGet(plate);
        fromCache = !!rec;
        if (!rec) { _plateCacheSet(plate, null); return null; }
      }
      if (!fromCache) _regCacheSet(plate, rec);
      const v = {
        plate,
        maker: _cleanMaker(rec.tozeret_nm || ''),
        model: rec.kinuy_mishari || rec.degem_nm || '',
        subModel: rec.ramat_gimur || rec.degem_cd_nm || '',
        color: rec.tzeva_rechev || '',
        year: rec.shnat_yitzur || '',
        testDate: rec.tokef_dt || '',
      };
      if (fromCache) v.fromCache = true;
      _plateCacheSet(plate, v);
      return v;
    } finally {
      clearTimeout(timer);
      _plateInflight.delete(plate);
    }
  })();
  _plateInflight.set(plate, p);
  return p;
}
window._plateLookup = _plateLookup;

// תאריך טסט בפורמט שהמערכת משתמשת בו
function _plateTestDate(v) {
  if (!v?.testDate) return '';
  const d = new Date(v.testDate);
  if (isNaN(d)) return '';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

async function lookupPlate() {
  const plate = document.getElementById('req-task-plate').value.trim();
  if (!plate) return;
  const el = document.getElementById('req-plate-result');
  el.textContent = '⏳ מחפש...';
  el.style.color = 'var(--muted)';
  _reqVehicleInfo = null;
  try {
    const rec = await _plateLookup(plate);
    if (rec) {
      const year = rec.year, maker = rec.maker, model = rec.model;
      _reqVehicleInfo = { plate, maker, model, year };
      el.innerHTML = `✅ <b>${maker} ${model}</b> — שנת ${year}`;
      el.style.color = 'var(--success, #16a34a)';
    } else {
      el.textContent = '❌ לא נמצא רכב עם לוחית זו';
      el.style.color = '#ef4444';
    }
  } catch(e) {
    el.textContent = '⚠️ שגיאה בחיפוש';
    el.style.color = '#ef4444';
  }
}

function previewReqTaskPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    // compress via canvas
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      _reqTaskPhotoData = canvas.toDataURL('image/jpeg', 0.7);
      document.getElementById('req-task-photo-preview').innerHTML =
        `<img src="${_reqTaskPhotoData}" style="max-width:100%;border-radius:10px;max-height:180px;object-fit:cover">`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function submitTaskRequest() {
  const text = document.getElementById('req-task-text').value.trim();
  if (!text) return showToast('נא לכתוב תיאור משימה');
  const col = _reqTaskCol;
  if (!col) return showToast('נא לבחור עמודה');
  if (!window._CONFIG_DONE) return showToast('Firebase לא מחובר');
  const btn = document.getElementById('req-task-send-btn');
  btn.disabled = true;
  try {
    const reqCity = document.getElementById('req-task-city')?.value.trim() || '';
    const ref = await _addDoc(_colRef('task_requests'), {
      driverName: currentUser.name,
      column: col,
      text,
      photo: _reqTaskPhotoData || null,
      regionCity: reqCity,
      region: _regionOfCity(reqCity),
      vehicle: _reqVehicleInfo || (document.getElementById('req-task-plate')?.value.trim() ? { plate: document.getElementById('req-task-plate').value.trim(), maker:'', model:'', year:'' } : null),
      status: 'pending',
      createdAt: _serverTs()
    });
    closeModal('modal-request-task');
    showToast('✅ הבקשה נשלחה למנהל');
    _notifyDriver('ליאל', `📋 ${currentUser.name} מבקש להוסיף משימה לעמודת ${col}: "${text.slice(0,60)}"`);
  } catch(e) {
    showToast('שגיאה בשליחה');
    console.error(e);
  }
  btn.disabled = false;
}

let _taskReqUnsub = null;
let _pendingTaskReqs = []; // [{id, data}]
let _taskReqIndex = 0;

function _listenTaskRequests() {
  if (_taskReqUnsub) return;
  if (!window._onSnap) return;
  _taskReqUnsub = window._onSnap(
    window._query(window._colRef('task_requests'), window._where('status','==','pending')),
    snap => {
      _pendingTaskReqs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
      _renderTaskReqPills();
      // update nav if approval modal is already open
      const modal = document.getElementById('modal-approve-task-req');
      if (modal && modal.classList.contains('open')) _updateTaskReqNav();
    }
  );
}

function _updateTaskReqPill() { _renderTaskReqPills(); }

function _renderTaskReqPills() {
  const container = document.getElementById('task-req-pills');
  if (!container) return;
  const count = _pendingTaskReqs.length;
  if (count === 0) { container.style.display = 'none'; container.innerHTML = ''; return; }
  container.style.display = 'block';
  container.innerHTML = `<div onclick="expandTaskReqModal(0)" style="pointer-events:auto;background:#7c3aed;color:#fff;border-radius:999px;padding:14px 28px;font-family:Heebo,sans-serif;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 4px 20px rgba(124,58,237,.45);display:inline-flex;align-items:center;gap:10px;white-space:nowrap">
    📋 בקשות משימה <span style="background:rgba(255,255,255,.3);border-radius:12px;padding:1px 10px;font-size:15px">${count}</span>
  </div>`;
}

function _updateTaskReqNav() {
  const nav = document.getElementById('approve-req-nav');
  const prev = document.getElementById('btn-req-prev');
  const next = document.getElementById('btn-req-next');
  if (!nav) return;
  const total = _pendingTaskReqs.length;
  nav.textContent = total > 1 ? `${_taskReqIndex + 1}/${total}` : '';
  if (prev) prev.style.opacity = _taskReqIndex > 0 ? '1' : '0.3';
  if (next) next.style.opacity = _taskReqIndex < total - 1 ? '1' : '0.3';
}

function navigateTaskReq(dir) {
  const newIdx = _taskReqIndex + dir;
  if (newIdx < 0 || newIdx >= _pendingTaskReqs.length) return;
  _taskReqIndex = newIdx;
  const r = _pendingTaskReqs[_taskReqIndex];
  _showTaskReqApproval(r.id, r.data);
}

function minimizeTaskReqModal() {
  closeModal('modal-approve-task-req');
  _renderTaskReqPills();
}

function expandTaskReqModal(idx) {
  if (_pendingTaskReqs.length === 0) return;
  _taskReqIndex = (typeof idx === 'number') ? idx : 0;
  const r = _pendingTaskReqs[_taskReqIndex];
  _showTaskReqApproval(r.id, r.data);
}

// ── Shared zoom/pan for ALL image viewers (lightbox + photo-zoom overlay) ──
let _lbZoom = 1, _lbPanX = 0, _lbPanY = 0, _lbDragging = false, _lbDragStart = null, _lbDragImg = null;
function _resetZoom() { _lbZoom = 1; _lbPanX = 0; _lbPanY = 0; _lbDragging = false; }
function _applyZoom(img) { if (img) img.style.transform = `translate(${_lbPanX}px, ${_lbPanY}px) scale(${_lbZoom})`; }
// whichever image overlay is currently open and contains the event target
function _zoomImgFor(target) {
  const lb = document.getElementById('lightbox');
  if (lb && lb.style.display !== 'none' && lb.contains(target)) return { overlay: lb, img: document.getElementById('lightbox-img'), close: () => { lb.style.display = 'none'; } };
  const pz = document.getElementById('photo-zoom-overlay');
  if (pz && pz.style.display !== 'none' && pz.contains(target)) return { overlay: pz, img: document.getElementById('photo-zoom-img'), close: () => closePhotoZoom() };
  return null;
}
function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  img.src = src;
  _resetZoom();
  img.style.transform = 'scale(1)';
  lb.style.display = 'flex';
  lb.style.alignItems = 'center';
  lb.style.justifyContent = 'center';
}
// mouse-wheel zoom (0.5x–6x)
document.addEventListener('wheel', e => {
  const t = _zoomImgFor(e.target);
  if (!t) return;
  e.preventDefault();
  _lbZoom = Math.min(6, Math.max(0.5, _lbZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  if (_lbZoom <= 1) { _lbPanX = 0; _lbPanY = 0; }
  t.img.style.transition = 'transform .08s';
  _applyZoom(t.img);
}, { passive: false });
// left-button: drag the image to pan; click on the backdrop closes
document.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const t = _zoomImgFor(e.target);
  if (!t) return;
  if (e.target === t.img) {
    e.preventDefault();
    _lbDragging = true; _lbDragImg = t.img;
    _lbDragStart = { x: e.clientX - _lbPanX, y: e.clientY - _lbPanY };
    t.img.style.cursor = 'grabbing';
  } else if (e.target === t.overlay) {
    t.close();
  }
});
document.addEventListener('mousemove', e => {
  if (!_lbDragging) return;
  _lbPanX = e.clientX - _lbDragStart.x;
  _lbPanY = e.clientY - _lbDragStart.y;
  if (_lbDragImg) _lbDragImg.style.transition = 'none';
  _applyZoom(_lbDragImg);
});
document.addEventListener('mouseup', e => {
  if (e.button !== 0 || !_lbDragging) return;
  _lbDragging = false;
  if (_lbDragImg) _lbDragImg.style.cursor = 'grab';
});

// ── touch: pinch-to-zoom + one-finger pan/drag + tap backdrop to close ──
let _lbTouchMode = null;   // 'pinch' | 'pan' | null
let _lbPinchStartDist = 0, _lbPinchStartZoom = 1;
let _lbPanStart = null;
let _lbTapStart = null;    // {x,y,t,target} to distinguish tap-to-close from drag
function _touchDist(t0, t1) { return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY); }
document.addEventListener('touchstart', e => {
  const t = _zoomImgFor(e.target);
  if (!t) return;
  if (e.touches.length === 2) {
    e.preventDefault();
    _lbTouchMode = 'pinch';
    _lbPinchStartDist = _touchDist(e.touches[0], e.touches[1]);
    _lbPinchStartZoom = _lbZoom;
    _lbDragImg = t.img;
  } else if (e.touches.length === 1) {
    _lbTapStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), target: e.target, overlay: t.overlay, close: t.close };
    if (e.target === t.img) {
      _lbTouchMode = 'pan';
      _lbDragImg = t.img;
      _lbPanStart = { x: e.touches[0].clientX - _lbPanX, y: e.touches[0].clientY - _lbPanY };
    }
  }
}, { passive: false });
document.addEventListener('touchmove', e => {
  if (_lbTouchMode === 'pinch' && e.touches.length === 2) {
    e.preventDefault();
    const dist = _touchDist(e.touches[0], e.touches[1]);
    _lbZoom = Math.min(6, Math.max(0.5, _lbPinchStartZoom * (dist / _lbPinchStartDist)));
    if (_lbZoom <= 1) { _lbPanX = 0; _lbPanY = 0; }
    if (_lbDragImg) _lbDragImg.style.transition = 'none';
    _applyZoom(_lbDragImg);
  } else if (_lbTouchMode === 'pan' && e.touches.length === 1) {
    e.preventDefault();
    _lbPanX = e.touches[0].clientX - _lbPanStart.x;
    _lbPanY = e.touches[0].clientY - _lbPanStart.y;
    if (_lbDragImg) _lbDragImg.style.transition = 'none';
    _applyZoom(_lbDragImg);
  }
}, { passive: false });
document.addEventListener('touchend', e => {
  // tap (no real movement, short duration) on the backdrop closes the viewer
  if (_lbTapStart && e.touches.length === 0) {
    const lastTouch = e.changedTouches[0];
    const moved = lastTouch ? Math.hypot(lastTouch.clientX - _lbTapStart.x, lastTouch.clientY - _lbTapStart.y) : 999;
    if (_lbTapStart.target === _lbTapStart.overlay && moved < 8 && Date.now() - _lbTapStart.t < 400) {
      _lbTapStart.close();
    }
  }
  _lbTouchMode = null;
  _lbTapStart = null;
});

function _showTaskReqApproval(id, req) {
  _pendingTaskReqId = id;
  const v = req.vehicle;
  const vehicleBlock = v
    ? `<div style="background:#ede9fe;border:2px solid #7c3aed;border-radius:10px;padding:12px 16px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:12px;align-items:center">
        <div style="font-size:22px;font-weight:900;letter-spacing:2px;font-family:monospace;color:#3b0764">${v.plate||''}</div>
        ${(v.maker||v.model||v.year) ? `<div style="font-size:14px;font-weight:700;color:#4c1d95">${[v.maker,v.model,v.year?'שנת '+v.year:''].filter(Boolean).join(' · ')}</div>` : ''}
       </div>`
    : '';
  const body = document.getElementById('approve-req-body');
  body.innerHTML = `
    <div style="font-size:14px;font-weight:700;margin-bottom:10px">📋 בקשה מ-<b style="color:#7c3aed">${req.driverName}</b></div>
    ${vehicleBlock}
    ${req.photo ? `<img src="${req.photo}" onclick="openLightbox(this.src)" style="max-width:100%;border-radius:10px;max-height:200px;object-fit:cover;margin-bottom:10px;cursor:zoom-in">` : ''}
    <div style="margin-bottom:10px">
      <label style="font-size:13px;color:var(--muted)">תיאור המשימה (ניתן לערוך):</label>
      <textarea id="approve-task-text" rows="3" style="width:100%;margin-top:4px;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:Heebo,sans-serif;font-size:14px;box-sizing:border-box">${req.text}</textarea>
    </div>
    <div style="margin-bottom:10px">
      <label style="font-size:13px;color:var(--muted)">בעל מקצוע (עמודה):</label>
      <select id="approve-col-select" style="width:100%;margin-top:4px;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:Heebo,sans-serif">
        ${['חביב','ולאדי','רדארים','מוסך','רפד','עופר','גיל','איתי','משימות כלליות'].map(c=>`<option value="${c}" ${c===req.column?'selected':''}>${c}</option>`).join('')}
      </select>
    </div>`;
  openModal('modal-approve-task-req');
  _updateTaskReqNav();
}

async function approveTaskRequest(approved) {
  if (!_pendingTaskReqId) return;
  const id = _pendingTaskReqId;
  // read values from modal BEFORE closing
  const col = document.getElementById('approve-col-select')?.value;
  const finalText = document.getElementById('approve-task-text')?.value.trim();
  _pendingTaskReqId = null;
  closeModal('modal-approve-task-req');
  const { deleteDoc, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const ref = doc(window._db, 'task_requests', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const req = snap.data();
  if (approved) {
    const usedCol = col || req.column;
    const usedText = finalText || req.text;
    const v = req.vehicle;
    const title = v ? `${[v.plate, v.maker, v.model, v.year ? 'שנת '+v.year : ''].filter(Boolean).join(' ')} — ${usedText}` : usedText;
    await _addDoc(_colRef('tasks'), {
      title,
      assignedTo: usedCol,
      label: usedCol,
      status: 'open',
      regionCity: req.regionCity || '',
      region: req.region || _regionOfCity(req.regionCity || ''),
      createdBy: req.driverName,
      createdAt: _serverTs()
    });
    await deleteDoc(ref);
    showToast(`✅ משימה נוספה לעמודת ${usedCol}`);
  } else {
    await deleteDoc(ref);
    showToast('הבקשה נדחתה');
  }
  // pill will update via realtime listener
}

async function importTrelloTasks() {
  if (!confirm('לייבא את כל המשימות מהטרלו? פעולה זו תוסיף 24 משימות.')) return;
  if (!window._CONFIG_DONE) return showToast('Firebase לא מחובר');
  const tasks = [
    { title: 'להוריד מגבי רוח בצרי fx וטוסון 2016 אפור', assignedTo: 'גל' },
    { title: 'מכחולים טוסון 2017', assignedTo: 'גל' },
    { title: 'CX5 2015 לכן', assignedTo: 'ולאדי' },
    { title: 'יצחק לקראו לו 0545528728 שולדרי פה', assignedTo: 'ולאדי' },
    { title: 'CX30 2021 לייסר ספולר קדמי', assignedTo: 'ולאדי' },
    { title: 'כנר אחורי ימין בי וי די סליון 5', assignedTo: 'ולאדי' },
    { title: 'קאדילק שחור', assignedTo: 'ולאדי' },
    { title: 'סוסון 879', assignedTo: 'ולאדי' },
    { title: 'מנורות שרופות q2', assignedTo: 'חביב' },
    { title: 'חלון קדמי ימין גירו לבנה לא יורד', assignedTo: 'חביב' },
    { title: 'מתג חלון בדלת קדמי ימין טוסון 17 155 לא עובד', assignedTo: 'חביב' },
    { title: 'מתג חלונות נהג מאזדה 3 2015 לא עובד', assignedTo: 'חביב' },
    { title: 'להכניס', assignedTo: 'רדארים' },
    { title: 'X4 2 מראות בשחור – גריד', assignedTo: 'כולם', label: 'שנע החוצה' },
    { title: 'שליף סבון פתח 21', assignedTo: 'כולם', label: 'שנע החוצה' },
    { title: 'GLC2023 שלייף כנפיים קדמיות ותסגורן אחורי', assignedTo: 'כולם', label: 'שנע החוצה' },
    { title: 'לבדוק קם ברגלר לכן ולסדר אותו !!!!', assignedTo: 'כולם', priority: 'high' },
    { title: 'לבדוק שמן A250 2024', assignedTo: 'כולם' },
    { title: 'אפק אילון – קנה אקספנג G6 שטיחים הבאן לו גר בדימונה 052-523-3535', assignedTo: 'כולם' },
    { title: 'לאפס מנורת טיפול במרצדס של אילינה', assignedTo: 'כולם' },
    { title: 'לקנות ציציות ממבצע סיני 9 חולון', assignedTo: 'כולם' },
    { title: 'דלק X1', assignedTo: 'כולם' },
    { title: 'מנורת טיפול צרי FX+ צק אנגי ולבדוק מצבר', assignedTo: 'כולם' },
    { title: 'כיסוי הגה מאזדה 3 2015', assignedTo: 'כולם' },
  ];
  showToast('⏳ מייבא משימות...');
  for (const t of tasks) {
    await _addDoc(_colRef('tasks'), {
      title: t.title,
      assignedTo: t.assignedTo,
      label: t.label || 'משימות כלליות',
      status: 'open',
      createdBy: currentUser.name,
      createdAt: _serverTs()
    });
  }
  showToast('✅ כל המשימות יובאו בהצלחה!');
  document.getElementById('fab-import-tasks').style.display = 'none';
}

async function submitTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) return showToast('נא להזין כותרת למשימה');
  if (!window._CONFIG_DONE) return showToast('Firebase לא מחובר');
  const btn = document.querySelector('#modal-task .btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ שומר...'; }
  try {
    const taskCity = document.getElementById('task-city').value.trim();
    await _addDoc(_colRef('tasks'), {
      title,
      assignedTo: 'כולם',
      label:      document.getElementById('task-label').value,
      color:      document.getElementById('task-color').value,
      status:     'open',
      regionCity: taskCity,
      region:     _regionOfCity(taskCity),
      createdBy:  currentUser.name,
      createdAt:  _serverTs()
    });
    const taskLabel = document.getElementById('task-label').value;
    if (taskLabel && taskLabel !== 'משימות כלליות') {
      await _addDriverNotification(taskLabel, `📋 משימה חדשה ממתינה לך: "${title}"`);
    }
    closeModal('modal-task');
    showToast('✅ משימה נפתחה!');
  } catch(e) {
    showToast('שגיאה בשמירה');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'פתח משימה'; }
}

/* ═══════════════════════════════════════════════════════
   VEHICLES SCREEN
═══════════════════════════════════════════════════════ */
function openVehiclesScreen() {
  const isManager = currentUser.role === 'manager';
  document.getElementById('vehicles-user-badge').textContent = currentUser.name;
  const fabWrap = document.getElementById('vehicle-fab-wrap');
  if (fabWrap) fabWrap.style.display = isManager ? 'flex' : 'none';
  const liveBtn = document.getElementById('btn-live-intake');
  if (liveBtn) liveBtn.style.display = isManager ? 'flex' : 'none';
  showScreen('vehicles');
  if (archiveUnsub) { archiveUnsub(); archiveUnsub = null; }
  _archiveItems = [];
  loadVehicles();
  if (isManager) loadBatteryAlerts();
}

function loadBatteryAlerts() {
  const wrap = document.getElementById('battery-alerts-wrap');
  if (!wrap) return;
  _onSnap(_query(_colRef('manager_alerts'), _where('type','==','battery_original'), _where('seen','==',false)), snap => {
    const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!alerts.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    wrap.innerHTML = alerts.map(a => `
      <div style="background:#fef9c3;border:2px solid #ca8a04;border-radius:12px;padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="font-size:13px;font-weight:700;color:#854d0e">${esc(a.message)}</div>
        <button onclick="dismissBatteryAlert('${a.id}')" style="background:#854d0e;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-family:Heebo,sans-serif;font-weight:700;font-size:12px;cursor:pointer;flex-shrink:0">✓ קיבלתי</button>
      </div>`).join('');
  });
}

async function dismissBatteryAlert(id) {
  const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await updateDoc(doc(window._db, 'manager_alerts', id), { seen: true });
}
window.dismissBatteryAlert = dismissBatteryAlert;

function _renderArchiveSection(archived) {
  const archiveWrap = document.getElementById('intake-archive-wrap');
  const archiveList = document.getElementById('intake-archive-list');
  if (!archiveWrap || !archiveList) return;
  archiveWrap.style.display = 'block';
  const f = window._vehicleDriverFilter;
  const filtered = archived.filter(v => !f || v.assignedTo === f);
  if (!filtered.length) {
    archiveList.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px">אין קליטות או רענונים בארכיון${f ? ' עבור ' + esc(f) : ''}</div>`;
    return;
  }
  archiveList.innerHTML = filtered.map(v => {
    const ts = v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString('he-IL') : '';
    const src = v._src || 'archive';
    const isRefresh = src === 'refresh';
    const viewFn = isRefresh ? 'openRefreshForm' : (src === 'assignments' ? 'viewIntakeForm' : 'viewArchivedIntake');
    const delFn  = isRefresh ? 'deleteRefresh'   : (src === 'assignments' ? 'deleteIntake'   : 'deleteArchivedIntake');
    const typeLabel = isRefresh
      ? `<span class="tag" style="background:#7c3aed;color:#fff">🔄 רענון</span>`
      : `<span class="tag" style="background:#0ea5e9;color:#fff">🚗 קליטה</span>`;
    const infoLine = isRefresh
      ? [v.vehicleType, v.year, v.color].filter(Boolean).map(esc).join(' · ')
      : [v.brand, v.model, v.year].filter(Boolean).map(esc).join(' ');
    const parking = v.spot || v.parking;
    return `<div class="vehicle-card" data-plate="${esc(v.plate)}" style="border-right:5px solid var(--info);margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          ${typeLabel}
          <div class="vehicle-plate">${esc(v.plate)}</div>
          <div class="vehicle-info">${infoLine}</div>
          <div class="vehicle-meta" style="margin-top:4px">
            ${v.color && !isRefresh ? `<span class="tag assignee">🎨 ${esc(v.color)}</span>` : ''}
            ${v.assignedTo ? `<span class="tag assignee">👤 ${esc(v.assignedTo)}</span>` : ''}
            ${parking ? `<span class="tag assignee">🅿️ חניה ${esc(parking)}</span>` : ''}
          </div>
          ${ts ? `<div class="task-time" style="margin-top:4px">${ts}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
          <span style="background:var(--info,#0ea5e9);color:#fff;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700">נבדק ✓</span>
          <button onclick="${viewFn}('${v.id}')" style="background:#0ea5e9;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer">👁️ צפייה</button>
          <button onclick="${delFn}('${v.id}')" style="background:#ef4444;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer">🗑️ מחיקה</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function deleteArchivedIntake(id) {
  if (!confirm('למחוק קליטה זו מהארכיון?')) return;
  const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await deleteDoc(doc(window._db, 'intake_archive', id));
  showToast('🗑️ נמחק מהארכיון');
}
window.deleteArchivedIntake = deleteArchivedIntake;

async function viewArchivedIntake(id) {
  const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const snap = await getDoc(doc(window._db, 'intake_archive', id));
  if (!snap.exists()) return showToast('לא נמצאה קליטה בארכיון');
  _renderViewIntakeModal(await _intakeLoadPhotos({ id, ...snap.data() }));
}
window.viewArchivedIntake = viewArchivedIntake;

async function archiveRefresh(id) {
  const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await updateDoc(doc(window._db, 'refreshes', id), { status: 'checked', checkedAt: _serverTs() });
  showToast('📁 הרענון הועבר לארכיון');
}
window.archiveRefresh = archiveRefresh;

function _renderIntakeList(all) {
  const isManager = currentUser.role === 'manager';
  const summary = document.getElementById('vehicle-open-summary');
  const container = document.getElementById('vehicle-list-container');

  const statusLabel = { pending: 'ממתין לקליטה', done: 'בוצע', checked: 'נבדק' };
  const statusColor = { pending: 'var(--warning)', done: 'var(--success)', checked: 'var(--info)' };

  function intakeCard(v) {
    const ts = v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString('he-IL') : '';
    const st = v.status || 'pending';
    const label = statusLabel[st] || st;
    const color = statusColor[st] || 'var(--muted)';

    if (isManager) {
      const canCheck = st === 'done';
      const cardClick = st === 'pending'
        ? `openManagerIntakeLive('${v.id}')`
        : `viewIntakeForm('${v.id}')`;
      return `<div class="vehicle-card" style="border-right:5px solid ${color}${st==='done'?';background:#f0fdf4':''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div onclick="${cardClick}" style="flex:1;cursor:pointer;min-width:0">
            <span class="tag" style="background:#0ea5e9;color:#fff;margin-bottom:4px">🚗 קליטה</span>
            <div class="vehicle-plate">${esc(v.plate)}</div>
            <div class="vehicle-info">${[v.brand,v.model,v.year].filter(Boolean).map(esc).join(' ')}</div>
            <div class="vehicle-meta" style="margin-top:4px">
              ${v.color ? `<span class="tag assignee">🎨 ${esc(v.color)}</span>` : ''}
              <span class="tag assignee">👤 ${esc(v.assignedTo)}</span>
              ${v.spot ? `<span class="tag assignee">🅿️ חניה ${esc(v.spot)}</span>` : ''}
            </div>
            ${ts ? `<div class="task-time" style="margin-top:4px">${ts}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
            <span style="background:${color};color:#fff;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;white-space:nowrap">${label}</span>
            ${st === 'pending' ? `<button onclick="resendIntakeNotify('${esc(v.assignedTo)}','${esc(v.plate)}','${esc(v.brand||'')}','${esc(v.model||'')}')" style="background:#25d366;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">📲 שלח התראה</button>` : ''}
            ${st === 'pending' ? `<button onclick="openEditIntake('${v.id}')" style="background:#6366f1;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">✏️ עריכה</button>` : ''}
            ${v.previousIntake ? `<button onclick="restorePrevIntake('${v.id}')" style="background:#0d9488;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">↩️ שחזר קליטה קודמת</button>` : ''}
            ${st === 'done' ? `<button onclick="resendIntake('${v.id}')" style="background:#f59e0b;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">🔄 שליחה מחדש</button>` : ''}
            ${canCheck ? `<button onclick="markChecked('${v.id}')" style="background:var(--dark);color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">📁 שלח לארכיון</button>` : ''}
            <button onclick="deleteIntake('${v.id}')" style="background:#ef4444;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">🗑️ מחיקה</button>
          </div>
        </div>
      </div>`;
    } else {
      if (st !== 'pending') return '';
      return `<div class="vehicle-card" style="border-right:5px solid ${color};cursor:pointer" onclick="openDriverIntake('${v.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <span class="tag" style="background:#0ea5e9;color:#fff;margin-bottom:4px">🚗 קליטה</span>
            <div class="vehicle-plate">${esc(v.plate)}</div>
            <div class="vehicle-info">${[v.brand,v.model,v.year].filter(Boolean).map(esc).join(' ')}</div>
            ${v.spot ? `<div style="font-size:13px;font-weight:700;color:var(--dark);margin-top:4px">🅿️ חניה ${esc(v.spot)}</div>` : ''}
            ${ts ? `<div class="task-time" style="margin-top:4px">${ts}</div>` : ''}
          </div>
          <span style="background:${color};color:#fff;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700">פתיחה ▶</span>
        </div>
      </div>`;
    }
  }

  const refreshes = _refreshCache || [];
  function refreshCard(r) {
    const st = r.status || 'pending';
    const done = st === 'done';
    const ts = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('he-IL') : '';
    const typeTag = `<span class="tag" style="background:#7c3aed;color:#fff;margin-bottom:4px">🔄 רענון</span>`;
    if (isManager) {
      return `<div class="vehicle-card" style="border-right:5px solid ${done?'var(--success)':'var(--warning)'}${done?';background:#f0fdf4':''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div onclick="openRefreshForm('${r.id}')" style="flex:1;cursor:pointer;min-width:0">
            ${typeTag}
            <div class="vehicle-plate">${esc(r.plate||'')}</div>
            <div class="vehicle-info">${[r.vehicleType,r.year,r.color].filter(Boolean).map(esc).join(' · ')}</div>
            <div class="vehicle-meta" style="margin-top:4px">
              ${r.assignedTo ? `<span class="tag assignee">👤 ${esc(r.assignedTo)}</span>` : ''}
              ${r.parking ? `<span class="tag assignee">🅿️ חניה ${esc(r.parking)}</span>` : ''}
              ${ts ? `<span class="tag assignee">📅 ${ts}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
            <span style="background:${done?'var(--success)':'var(--warning)'};color:#fff;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;white-space:nowrap">${done ? '✅ הושלם' : '⏳ ממתין'}</span>
            <button onclick="openEditRefresh('${r.id}')" style="background:#6366f1;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">✏️ עריכה</button>
            ${!done && r.assignedTo ? `<button onclick="notifyRefreshDriver('${esc(r.assignedTo)}','${esc(r.plate||'')}')" style="background:#16a34a;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">📲 התראה</button>` : ''}
            ${done ? `<button onclick="archiveRefresh('${r.id}')" style="background:var(--dark);color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">📁 שלח לארכיון</button>` : ''}
            <button onclick="deleteRefresh('${r.id}')" style="background:#ef4444;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">🗑️ מחיקה</button>
          </div>
        </div>
      </div>`;
    } else {
      if (st !== 'pending') return '';
      return `<div class="vehicle-card" style="border-right:5px solid var(--warning);cursor:pointer" onclick="openRefreshForm('${r.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            ${typeTag}
            <div class="vehicle-plate">${esc(r.plate||'')}</div>
            <div class="vehicle-info">${[r.vehicleType,r.year,r.color].filter(Boolean).map(esc).join(' · ')}</div>
            ${r.parking ? `<div style="font-size:13px;font-weight:700;color:var(--dark);margin-top:4px">🅿️ חניה ${esc(r.parking)}</div>` : ''}
          </div>
          <span style="background:var(--warning);color:#fff;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700">פתיחה ▶</span>
        </div>
      </div>`;
    }
  }

  if (isManager) {
    // ארכיון = collection intake_archive + קליטות ישנות שנבדקו ב-intake_assignments + רענונים שהועברו לארכיון
    const archivedFromCol = _archiveItems.map(v => ({ ...v, _src: 'archive' }));
    const checkedInAssign = all.filter(v => v.status === 'checked').map(v => ({ ...v, _src: 'assignments' }));
    const checkedRefreshes = refreshes.filter(r => r.status === 'checked').map(r => ({ ...r, _src: 'refresh', formType: 'refresh' }));
    const archivedAll = archivedFromCol.concat(checkedInAssign, checkedRefreshes);
    // The per-driver count cards were removed — they took a quarter of the
    // screen to show mostly zeros. The list itself now gets the space.
    summary.style.display = 'none';
    summary.innerHTML = '';
    window._vehicleDriverFilter = null; // nothing can set the filter any more

    const f = window._vehicleDriverFilter;
    const activeRaw = all.filter(v => (v.status === 'pending' || v.status === 'done') && (!f || v.assignedTo === f));
    const active = [...activeRaw.filter(v => v.status === 'done'), ...activeRaw.filter(v => v.status === 'pending')];
    const activeRefreshes = refreshes.filter(r => (r.status === 'pending' || r.status === 'done') && (!f || r.assignedTo === f));
    const activeRefreshSorted = [...activeRefreshes.filter(r => r.status === 'done'), ...activeRefreshes.filter(r => r.status === 'pending')];

    const listHtml = active.map(intakeCard).join('') + activeRefreshSorted.map(refreshCard).join('');
    container.innerHTML = listHtml
      ? listHtml
      : `<div class="empty-state"><div class="es-icon">🚗</div><h3>${f ? 'אין קליטות/רענונים פעילים עבור ' + f : 'אין קליטות/רענונים פעילים'}</h3><p>לחץ + קליטת רכב או + רענון רכב להוסיף</p></div>`;

    _renderArchiveSection(archivedAll);
  } else {
    summary.style.display = 'none';
    const mine = all.filter(v => v.assignedTo === currentUser.name && v.status === 'pending');
    const myRefreshes = refreshes.filter(r => r.assignedTo === currentUser.name && r.status === 'pending');
    const listHtml = mine.map(intakeCard).join('') + myRefreshes.map(refreshCard).join('');
    if (!listHtml) {
      container.innerHTML = `<div class="empty-state"><div class="es-icon">✅</div><h3>אין קליטות או רענונים ממתינים</h3><p>הכל הושלם</p></div>`;
      return;
    }
    container.innerHTML = listHtml;
  }
}

function loadVehicles() {
  if (!window._CONFIG_DONE) {
    document.getElementById('vehicle-list-container').innerHTML = '<div class="empty-state"><div class="es-icon">🔌</div><h3>Firebase לא מחובר</h3></div>';
    return;
  }
  if (vehicleUnsub) { vehicleUnsub(); vehicleUnsub = null; }
  if (currentUser.role !== 'manager') {
    // נהג: הנתונים מגיעים מ-listener הקיים של ה-badge
    if (_driverIntakeDocs !== null) {
      _intakeCache = _driverIntakeDocs;
      _renderIntakeList(_driverIntakeDocs);
    }
    // אם _driverIntakeDocs === null הספינר נשאר; ה-callback של ה-badge ירנדר בהגיע snapshot
    return;
  }
  // מנהל בלבד — הנתונים מגיעים מהמאזין החם ב-loadManagerBadges (מחמם את _intakeCache)
  if (_intakeCache !== null) {
    _renderIntakeList(_intakeCache);
  }
  // אם _intakeCache עדיין null, המאזין החם ירנדר כשה-snapshot הראשון יגיע (המסך פעיל)
  // ארכיון קליטות — מאזין חי למנהל, כדי שקופסת הארכיון ומונה "נבדק" יופיעו
  if (archiveUnsub) { archiveUnsub(); archiveUnsub = null; }
  archiveUnsub = _onSnap(_colRef('intake_archive'), snap => {
    _archiveItems = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.checkedAt?.toMillis?.()??0) - (a.checkedAt?.toMillis?.()??0));
    if (_intakeCache !== null) _renderIntakeList(_intakeCache);
    else _renderArchiveSection(_archiveItems);
  });
}

/* ── EDIT INTAKE (manager) ── */
let _eiUnsub = null;
let _eiLoaded = false;
const _eiLabels = {
  'c-battery-original':  'בדיקת מצבר',
  'c-battery-is-original':'מצבר מקורי',
  'c-oil':       'שמן מנוע',
  'c-coolant':   'נוזל קירור',
  'c-safety':    "בדיקה והשלמת אביזרים",
  'c-lights-break':'שברים בפנסים',
  'c-glass-break':'שברים בשמשות',
  'c-bulbs':     'מנורות שרופות',
  'c-frames-ext':'מסגרות',
  'c-tires':     'מצב צמיגים',
  'c-glove':     'ניקיון תא כפפות',
  'c-windows':   'מתגי חלונות',
  'c-ac':        'מזגן',
  'c-dashboard': 'מנורות לוח שעונים',
  'c-sunroof':   'גג נפתח',
  'c-upholstery':'ריפודים (חורים/קרעים)',
  'c-mats':      'שטיחים',
  'c-steering':  'הגה – קילופים'
};
const _eiDashLabels = {
  'dash-check-engine':"צ'ק אנג'ין",
  'dash-tire-pressure':'לחץ אוויר',
  'dash-service':'טיפול',
  'dash-collision':'התגשות',
  'dash-fuel':'דלק',
  'dash-other':'אחר'
};
function _renderEiChecklist(draft) {
  const checks = draft.checks || {};
  const notes  = draft.notes  || {};
  const dashChecks = draft.dashChecks || {};
  const cl = document.getElementById('ei-checklist');
  cl.innerHTML = Object.entries(_eiLabels).map(([key, label]) => {
    const val = checks[key] || '';
    const note = notes[key] || '';
    let extraHTML = '';
    if (key === 'c-battery-is-original') {
      const bMonth = draft.batteryMonth || '';
      const bNoDate = draft.batteryNoDate || false;
      extraHTML = `<div style="margin-top:6px;font-size:12px;display:flex;align-items:center;gap:8px">
        <label style="font-size:12px"><input type="checkbox" id="ei-bnodate" ${bNoDate?'checked':''}> לא רואים תאריך</label>
        <input type="month" id="ei-bmonth" class="form-input" style="font-size:12px;padding:3px 6px;height:auto;width:140px" value="${bMonth}">
      </div>`;
    }
    if (key === 'c-dashboard') {
      extraHTML = `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">` +
        Object.entries(_eiDashLabels).map(([dk, dl]) =>
          `<label style="font-size:12px;display:flex;align-items:center;gap:3px"><input type="checkbox" data-dash="${dk}" ${dashChecks[dk]?'checked':''}> ${dl}</label>`
        ).join('') + '</div>';
    }
    return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span style="font-size:13px;font-weight:600">${label}</span>
        <div style="display:flex;gap:6px">
          <button onclick="_eiToggle(this,'v')" data-key="${key}" data-state="${val==='v'?'v':''}" style="padding:4px 12px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:700;background:${val==='v'?'#16a34a':'#e2e8f0'};color:${val==='v'?'#fff':'#475569'}">✅</button>
          <button onclick="_eiToggle(this,'x')" data-key="${key}" data-state="${val==='x'?'x':''}" style="padding:4px 12px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:700;background:${val==='x'?'#dc2626':'#e2e8f0'};color:${val==='x'?'#fff':'#475569'}">❌</button>
        </div>
      </div>
      ${extraHTML}
      <input type="text" data-note-key="${key}" class="form-input" style="margin-top:6px;font-size:12px;padding:4px 8px;height:auto" placeholder="הערה..." value="${esc(note)}">
    </div>`;
  }).join('');
}
function openEditIntake(id) {
  if (_eiUnsub) { _eiUnsub(); _eiUnsub = null; }
  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(({getDoc, doc}) => {
    getDoc(doc(window._db, 'intake_assignments', id)).then(snap => {
      if (!snap.exists()) return showToast('לא נמצאה קליטה');
      const v = snap.data();
      document.getElementById('ei-id').value     = id;
      document.getElementById('ei-plate').value  = v.plate       || '';
      document.getElementById('ei-brand').value  = v.brand       || '';
      document.getElementById('ei-model').value  = v.model       || '';
      document.getElementById('ei-color').value  = v.color       || '';
      document.getElementById('ei-year').value   = v.year        || '';
      document.getElementById('ei-spot').value   = v.spot        || '';
      document.getElementById('ei-driver').value = v.assignedTo  || 'עופר';
      // the intake-results section (checklist / ק"מ / קוד / הערה) was built but
      // never wired up — populate and show it once the driver has submitted
      const cl = v.checklist || {};
      const hasResults = Object.keys(cl).length > 0;
      const eiForm = document.getElementById('ei-intake-form');
      eiForm.style.display = hasResults ? 'block' : 'none';
      if (hasResults) {
        const checks = {}, notes = {};
        Object.entries(cl).forEach(([k, val]) => {
          if (k.endsWith('_note')) notes[k.slice(0, -5)] = val;
          else checks[k] = val;
        });
        document.getElementById('ei-km').value      = v.km    || '';
        document.getElementById('ei-code').value    = v.code  || '';
        document.getElementById('ei-general').value = v.notes || '';
        _renderEiChecklist({ checks, notes, dashChecks: v.dashChecks || {},
                             batteryMonth: v.batteryMonth || '', batteryNoDate: !!v.batteryNoDate });
      }
      openModal('modal-edit-intake');
    });
  });
}
function _eiToggle(btn, state) {
  const key = btn.dataset.key;
  const row = btn.closest('div[style*="background:var(--card-bg)"]');
  const [vBtn, xBtn] = row.querySelectorAll('button[data-key]');
  const isActive = btn.dataset.state === state;
  // toggle
  vBtn.dataset.state = ''; xBtn.dataset.state = '';
  vBtn.style.background = '#e2e8f0'; vBtn.style.color = '#475569';
  xBtn.style.background = '#e2e8f0'; xBtn.style.color = '#475569';
  if (!isActive) {
    btn.dataset.state = state;
    if (state === 'v') { btn.style.background = '#16a34a'; btn.style.color = '#fff'; }
    else               { btn.style.background = '#dc2626'; btn.style.color = '#fff'; }
  }
}

async function saveEditIntake() {
  const id = document.getElementById('ei-id').value;
  if (!id) return;
  try {
    const payload = {
      plate:      document.getElementById('ei-plate').value.trim(),
      brand:      document.getElementById('ei-brand').value.trim(),
      model:      document.getElementById('ei-model').value.trim(),
      color:      document.getElementById('ei-color').value.trim(),
      year:       document.getElementById('ei-year').value,
      spot:       document.getElementById('ei-spot').value.trim(),
      assignedTo: document.getElementById('ei-driver').value,
    };
    // results section is only present once the driver submitted — otherwise
    // saving would wipe the checklist with empty values
    if (document.getElementById('ei-intake-form')?.style.display !== 'none') {
      const checklist = {};
      document.querySelectorAll('#ei-checklist button[data-key]').forEach(b => {
        if (b.dataset.state) checklist[b.dataset.key] = b.dataset.state;
      });
      document.querySelectorAll('#ei-checklist input[data-note-key]').forEach(inp => {
        const t = inp.value.trim();
        if (t) checklist[inp.dataset.noteKey + '_note'] = t;
      });
      const dashChecks = {};
      document.querySelectorAll('#ei-checklist input[data-dash]').forEach(cb => {
        dashChecks[cb.dataset.dash] = cb.checked;
      });
      payload.checklist  = checklist;
      payload.dashChecks = dashChecks;
      payload.km         = document.getElementById('ei-km').value.trim();
      payload.code       = document.getElementById('ei-code').value.trim();
      payload.notes      = document.getElementById('ei-general').value.trim();
      const bMonth  = document.getElementById('ei-bmonth');
      const bNoDate = document.getElementById('ei-bnodate');
      if (bMonth)  payload.batteryMonth  = bMonth.value;
      if (bNoDate) payload.batteryNoDate = bNoDate.checked;
    }
    await _updateDoc(_docRef('intake_assignments', id), payload);
    if (_eiUnsub) { _eiUnsub(); _eiUnsub = null; }
    closeModal('modal-edit-intake');
    showToast('✅ הקליטה עודכנה!');
  } catch(e) {
    showToast('שגיאה: ' + (e.code || e.message));
  }
}

/* ── DRIVER INTAKE ── */
let _currentIntakeId = null;
let _currentIntakeVehicle = null;
let _diHeaderUnsub = null;
let _intakeSubmitting = false;
let _intakeInputController = null;

function openDriverIntake(id) {
  clearTimeout(window._draftSyncTimer);
  if (_intakeInputController) { _intakeInputController.abort(); }
  _intakeInputController = new AbortController();
  _currentIntakeId = id;
  if (_mgLiveUnsub) { _mgLiveUnsub(); _mgLiveUnsub = null; }
  if (_diLiveUnsub) { _diLiveUnsub(); _diLiveUnsub = null; }
  _diLastEdit = 0; _diAppliedAt = 0;
  const _lb = document.getElementById('di-live-banner'); if (_lb) _lb.style.display = 'none';
  const _sb = document.querySelector('#modal-driver-intake .btn-submit'); if (_sb) _sb.style.display = '';
  // clear checklist
  document.querySelectorAll('#modal-driver-intake .ci-box').forEach(b => b.classList.remove('v-active','x-active'));
  document.querySelectorAll('#modal-driver-intake .ci-note-row').forEach(r => {
    if (r.querySelector('#file-battery')) return; // keep battery photo row always visible
    if (r.id === 'battery-date-section') return;  // keep battery date row always visible
    r.style.display = 'none';
  });
  document.querySelectorAll('#modal-driver-intake textarea, #modal-driver-intake input[type=number], #di-code').forEach(t => t.value = '');
  ['di-ev-v','di-ev-x'].forEach(id=>{const b=document.getElementById(id);if(b){b.classList.remove('v-active','x-active');b.style.color='transparent';}});const _evF=document.getElementById('di-ev-fields');if(_evF)_evF.style.display='none';
  // use the single source of truth — a duplicated list here once meant a new
  // photo section opened with no camera button at all
  _photoKeys.forEach(k => {
    ciPhotoFiles[k] = [];
    renderPhotoGrid(k);
  });
  _sfApply({});
  // live header — updates when manager edits basic fields
  if (_diHeaderUnsub) { _diHeaderUnsub(); _diHeaderUnsub = null; }
  if (window._CONFIG_DONE) {
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(({onSnapshot, doc}) => {
      _diHeaderUnsub = onSnapshot(doc(window._db, 'intake_assignments', id), snap => {
        if (!snap.exists()) return;
        const v = snap.data();
        _currentIntakeVehicle = v;
        document.getElementById('di-title').textContent = `קליטת רכב – ${v.plate}`;
        document.getElementById('di-vehicle-info').innerHTML =
          `<strong>${esc(v.plate)}</strong> &nbsp;${[v.brand,v.model,v.color,v.year ? 'שנת '+v.year : ''].filter(Boolean).map(esc).join(' • ')}`;
      });
    });
  }
  // restore localStorage draft BEFORE opening modal (sync — no flicker)
  const localDraftStr = localStorage.getItem('intake_draft_' + id);
  const localChecks = localDraftStr ? (JSON.parse(localDraftStr).checks || {}) : {};
  const hasLocalChecks = Object.keys(localChecks).length > 0;
  restoreIntakeDraft(id);
  openModal('modal-driver-intake');
  /* סנכרון בין מכשירים: מה שנשמר בשרת מנצח כשהוא חדש יותר ממה שיש
     במכשיר הזה. כך קליטה שנהג התחיל בטלפון שלו נפתחת מלאה — כולל
     התמונות — גם כשנכנסים אליה ממכשיר אחר. */
  if (window._CONFIG_DONE) {
    const localAt = localDraftStr ? (JSON.parse(localDraftStr)._savedAt || 0) : 0;
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(({ getDoc, doc }) => {
      getDoc(doc(window._db, 'intake_assignments', id)).then(snap => {
        if (!snap.exists()) return;
        const v = snap.data();
        const remoteAt = v.liveUpdatedAt ? Date.parse(v.liveUpdatedAt) : 0;
        const localObj = localDraftStr ? (() => { try { return JSON.parse(localDraftStr); } catch (e) { return null; } })() : null;
        const remote = _pickFreshestDraft(localObj, localAt, v.liveDraft, remoteAt);
        const fd = remote || ((!hasLocalChecks && v.draft && Object.keys(v.draft.checks || {}).length) ? v.draft : null);
        if (!fd) return;
        _applyIntakeDraftObj(fd);
        if (fd.dashChecks?.['dash-other']) {
          const req = document.getElementById('dash-other-req'); if (req) req.style.display = 'block';
        }
        if (remote) _applyLivePhotos(v.livePhotos, v.liveBatteryPhotos);
        try { localStorage.setItem('intake_draft_' + id, JSON.stringify({ ...fd, _savedAt: remoteAt || Date.now() })); } catch {}
      }).catch(()=>{});
    });
  }
  /* מאזין חי: מה שממלאים במכשיר אחד מופיע בשני בזמן אמת. מה שהמשתמש
     הזה הקליד בשלוש השניות האחרונות מנצח, כדי שלא נדרוס לו את ההקלדה. */
  if (window._CONFIG_DONE) {
    if (_diLiveUnsub) { _diLiveUnsub(); _diLiveUnsub = null; }
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(({ onSnapshot, doc }) => {
      if (_currentIntakeId !== id) return;      // נפתחה קליטה אחרת בינתיים
      _diLiveUnsub = onSnapshot(doc(window._db, 'intake_assignments', id), snap => {
        if (!snap.exists() || _currentIntakeId !== id) return;
        if (Date.now() - _diLastEdit < 3000) return;       // המשתמש מקליד עכשיו
        const v = snap.data();
        const remoteAt = v.liveUpdatedAt ? Date.parse(v.liveUpdatedAt) : 0;
        if (!remoteAt || remoteAt <= _diAppliedAt) return;  // כבר הוחל
        if (!_draftWeight(v.liveDraft)) return;
        _diAppliedAt = remoteAt;
        _applyIntakeDraftObj(v.liveDraft);
        _applyLivePhotos(v.livePhotos, v.liveBatteryPhotos);
      }, () => {});
    });
  }
  // auto-save on any text input — signal ensures old listeners are removed on next intake open
  document.querySelectorAll('#modal-driver-intake textarea, #di-km, #di-code, #di-notes').forEach(el => {
    el.addEventListener('input', saveIntakeDraft, { signal: _intakeInputController.signal });
  });
}

const _ciLabels = {
  'c-battery-original':'בדיקת מצבר','c-battery-is-original':'מצבר מקורי',
  'c-oil':'שמן מנוע','c-coolant':'נוזל קירור','c-safety':'בדיקה והשלמת אביזרים',
  'c-lights-break':'שברים בפנסים','c-glass-break':'שברים בשמשות','c-bulbs':'לדים שרופים / מנורות שרופות',
  'c-frames-ext':'מסגרות','c-tires':'מצב צמיגים','c-glove':'ניקיון תא כפפות',
  'c-windows':'מתגי חלונות','c-mirrors':'קיפול וכיוון מראות חשמליות',
  'c-ac':'מזגן','c-ac-noise':'רעשי מזגן','c-dashboard':'מנורות לוח שעונים',
  'c-sunroof':'גג נפתח','c-upholstery':'ריפודים','c-mats':'סט שטיחים מלא ותקין','c-steering':'הגה – קילופים'
};
const _photoKeys = ['c-battery-original','c-oil','c-coolant','c-safety','c-safety-jack','c-lights-break','c-glass-break','c-bulbs','c-tires','c-glove','c-windows','c-mirrors','c-ac','c-ac-noise','c-dashboard','c-sunroof','c-upholstery','c-mats','c-steering'];

async function submitDriverIntake() {
  if (!_currentIntakeId) { showToast('שגיאה: אין קליטה פתוחה'); return; }
  if (!window._CONFIG_DONE) { showToast('Firebase לא מחובר'); return; }
  if (_intakeSubmitting) { showToast('⏳ שולח, אנא המתן...'); return; }
  _intakeSubmitting = true;
  const _submitBtn = document.querySelector('#modal-driver-intake .btn-submit');
  if (_submitBtn) { _submitBtn.disabled = true; _submitBtn.style.opacity = '0.6'; }
  try {
  // Build dashboard note from checkboxes
  const dashX = document.querySelector('.ci-box[data-key="c-dashboard"].x-active');
  if (dashX) {
    const dashCheckIds = ['dash-check-engine','dash-tire-pressure','dash-service','dash-collision','dash-fuel','dash-istop','dash-other'];
    const anyChecked = dashCheckIds.some(id => document.getElementById(id)?.checked);
    if (!anyChecked) {
      document.getElementById('note-c-dashboard')?.scrollIntoView({ behavior:'smooth', block:'center' });
      showToast('⚠️ נא לסמן לפחות מנורה אחת ממנורות לוח שעונים');
      return;
    }
  }

  // validate electric vehicle selection
  const evVActive = document.getElementById('di-ev-v')?.classList.contains('v-active');
  const evXActive = document.getElementById('di-ev-x')?.classList.contains('x-active');
  if (!evVActive && !evXActive) {
    document.getElementById('di-ev-section')?.scrollIntoView({ behavior:'smooth', block:'center' });
    showToast('⚠️ נא לסמן אם הרכב חשמלי');
    return;
  }
  if (evVActive) {
    const charge = document.getElementById('di-ev-charge')?.value;
    const range  = document.getElementById('di-ev-range')?.value;
    if (charge === '' || charge === null || charge === undefined) {
      document.getElementById('di-ev-charge')?.scrollIntoView({ behavior:'smooth', block:'center' });
      showToast('⚠️ נא למלא אחוז טעינה');
      return;
    }
    if (!range) {
      document.getElementById('di-ev-range')?.scrollIntoView({ behavior:'smooth', block:'center' });
      showToast('⚠️ נא למלא טווח טעינה');
      return;
    }
  }

  // The accessories section has no ✓/✕ row of its own — its state is derived
  // from the three sub-items — so it must be skipped here or it always fails.
  // It is validated on its own terms just below.
  if (!(ciPhotoFiles['c-safety-jack'] || []).length) {
    document.getElementById('sf-jack-photo-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('⚠️ חסרה תמונה בסעיף: ג׳ק + מפתח גלגלים + משולש', 4500);
    return;
  }

  // validate all checklist items are marked
  for (const [key, label] of Object.entries(_ciLabels)) {
    if (key === 'c-safety') continue;
    const active = document.querySelector(`#modal-driver-intake .ci-box[data-key="${key}"].v-active,#modal-driver-intake .ci-box[data-key="${key}"].x-active`);
    if (!active) {
      document.querySelector(`#modal-driver-intake .ci-box[data-key="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(`⚠️ חסר סימון בסעיף: ${label}`, 4500);
      return;
    }
  }

  // notes on x-marked items are optional — do not block submission

  const checklist = getChecklist();
  // לוח שעונים: אסוף את המנורות שסומנו כדי שיישמרו ויוצגו למנהל
  const _dashLabels = {
    'dash-check-engine':'מנורת צ׳ק אנג׳ין','dash-tire-pressure':'לחץ אוויר','dash-service':'טיפול',
    'dash-collision':'מנורת התגשות','dash-fuel':'מנורת דלק','dash-istop':'iStop'
  };
  const dashChecks = {};
  ['dash-check-engine','dash-tire-pressure','dash-service','dash-collision','dash-fuel','dash-istop','dash-other'].forEach(id => {
    const el = document.getElementById(id); if (el) dashChecks[id] = el.checked;
  });
  if (checklist['c-dashboard'] === 'x' && dashChecks['dash-other']) {
    const _otherTxt = document.getElementById('cn-c-dashboard')?.value.trim() || '';
    const _otherPhotos = (ciPhotoFiles['c-dashboard'] || []).length;
    if (!_otherTxt && !_otherPhotos) {
      document.getElementById('dash-other-req')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('⚠️ סומן "אחר" במנורות לוח שעונים — חובה לצלם תמונה או לכתוב פירוט');
      return;
    }
  }
  if (checklist['c-dashboard'] === 'x') {
    const dashOtherText = document.getElementById('cn-c-dashboard')?.value.trim() || '';
    const parts = Object.keys(_dashLabels).filter(id => dashChecks[id]).map(id => _dashLabels[id]);
    if (dashChecks['dash-other']) parts.push(dashOtherText ? ('אחר: ' + dashOtherText) : 'אחר');
    if (parts.length) checklist['c-dashboard_note'] = parts.join(' · ');
  }
  // accessories checklist — the jack row must carry a photo either way, so the
  // manager can see what is actually in the boot
  const safetyChecks = _sfRead();
  // an unmarked accessory is a missing one — that is what opens the task.
  // A missing spare wheel is not one of them: it is written on the intake for
  // the record, but it does not become a job for anybody.
  // התת־סעיפים של הספייר נשאלים רק כשהוא חסר, ולכן כשהוא קיים הם אינם
  // "חסרים" אלא פשוט לא רלוונטיים
  const _spareOk = !!safetyChecks['sf-spare'];
  const _sfMissing = Object.keys(_SF_ITEMS)
    .filter(id => !(_spareOk && _SF_SPARE_SUBS.includes(id)))
    .filter(id => !safetyChecks[id]);
  const _sfForTask = _sfMissing.filter(id => id !== 'sf-spare' && !_SF_SPARE_SUBS.includes(id));
  checklist['c-safety'] = _sfForTask.length ? 'x' : 'v';
  if (_sfMissing.length) checklist['c-safety_note'] = 'חסר: ' + _sfMissing.map(id => _SF_ITEMS[id]).join(', ');
  // מה שכן יש ברכב במקום הספייר — נרשם בקליטה לצד מה שחסר
  const _spareHas = _spareOk ? [] : _SF_SPARE_SUBS.filter(id => safetyChecks[id]).map(id => _SF_ITEMS[id]);
  if (_spareHas.length) {
    checklist['c-safety_note'] = (checklist['c-safety_note'] ? checklist['c-safety_note'] + ' · ' : '') + 'יש ברכב: ' + _spareHas.join(', ');
  }

  const notes     = document.getElementById('di-notes').value.trim();
  const km        = document.getElementById('di-km').value.trim();
  const code      = document.getElementById('di-code').value.trim();

  if (!km) {
    document.getElementById('di-km')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('di-km')?.focus();
    showToast('⚠️ נא למלא קילומטראז׳');
    return;
  }
  if (!code) {
    document.getElementById('di-code')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('di-code')?.focus();
    showToast('⚠️ נא למלא קוד רכב');
    return;
  }
  // תמונת מצבר תקפה = "צלם מצבר" הייעודי או תמונה שצולמה תחת "בדיקת מצבר"
  const _hasBatteryPhoto = (_batteryPhotoFiles && _batteryPhotoFiles.length) ||
                           (ciPhotoFiles['c-battery-original'] && ciPhotoFiles['c-battery-original'].length);
  // כשסומן "לא רואים תאריך מצבר" — אין מה לצלם, ולכן התמונה אינה חובה
  const _noBatteryDate = !!document.getElementById('battery-no-date-cb')?.checked;
  if (!_hasBatteryPhoto && !_noBatteryDate) {
    document.getElementById('file-battery')?.closest('.ci-note-row')?.scrollIntoView({ behavior:'smooth', block:'center' });
    showToast('⚠️ נא לצלם תמונה של המצבר');
    return;
  }
  const batteryMonth = document.getElementById('di-battery-month').value;
  const batteryDateVisible = document.getElementById('battery-date-section')?.style.display !== 'none';
  if (batteryDateVisible && !batteryMonth) {
    document.getElementById('di-battery-month')?.scrollIntoView({ behavior:'smooth', block:'center' });
    showToast('⚠️ נא למלא חודש מצבר');
    return;
  }
  const now = new Date();
  const intakeDateTime = now.toLocaleDateString('he-IL', { day:'numeric', month:'numeric', year:'numeric' }) +
    ' · ' + now.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' });

  if (!_updateDoc || !_docRef) { showToast('שגיאה: Firebase לא אותחל'); return; }
  // בלי חיבור אין שליחה — אבל הטופס נשמר במלואו וממשיכים ממנו אחר כך
  if (!_netOnline()) { try { saveIntakeDraft(); saveIntakeDraftPhotos(); } catch (e) {} 
    _requireNet('הקליטה'); return; }
  showToast('⏳ שולח טופס...');

  // עיבוד התמונות. אם הכל יחד חורג מהתקציב — מנסים שוב בדחיסה חזקה
  // יותר, ורק אם גם זה לא הספיק עוצרים בלי לשמור כלום.
  const _steps = [[900, 0.72], [760, 0.6], [640, 0.5]];
  let photoUrls = {}, batteryB64 = [], _photoCount = 0;
  for (let si = 0; si < _steps.length; si++) {
    const [px, q] = _steps[si];
    photoUrls = {}; batteryB64 = []; _photoCount = 0;
    try {
      for (const key of _photoKeys) {
        const files = ciPhotoFiles[key] || [];
        if (!files.length) continue;
        const b64s = [];
        for (let i = 0; i < files.length; i++) {
          showToast(`⏳ מעבד תמונה ${i + 1}/${files.length}...`);
          b64s.push(await compressToBase64(files[i], px, q));
        }
        photoUrls[key] = b64s; _photoCount += b64s.length;
      }
      for (let i = 0; i < (_batteryPhotoFiles || []).length; i++) {
        showToast(`⏳ מעבד תמונת מצבר ${i + 1}/${_batteryPhotoFiles.length}...`);
        batteryB64.push(await compressToBase64(_batteryPhotoFiles[i], px, q));
        _photoCount++;
      }
    } catch (pe) {
      console.warn('photo processing failed', pe);
      showToast('⚠️ שגיאה בעיבוד התמונות — נסה שוב', 5000);
      return;
    }
    const bytes = _photosBytes(photoUrls) + batteryB64.reduce((t, b) => t + _b64Size(b), 0);
    if (bytes <= _DOC_PHOTO_BUDGET) break;
    if (si === _steps.length - 1) {
      showToast(`⚠️ יש יותר מדי תמונות בטופס (${_photoCount}). הטופס לא נשלח — מחק כמה תמונות ונסה שוב. כל מה שמילאת נשמר.`, 12000);
      return;
    }
    showToast('⏳ מקטין את התמונות…', 2000);
  }
  // מעלים לשרת הקבצים. אם זה לא זמין — נשארים עם התמונות בתוך הרשומה
  const _base = `intake/${_currentIntakeId}`;
  for (const key of Object.keys(photoUrls)) {
    showToast('⏳ מעלה תמונות…', 1500);
    const urls = await _uploadAll(`${_base}/${key}`, photoUrls[key]);
    if (urls) photoUrls[key] = urls;
  }
  if (batteryB64.length) {
    const urls = await _uploadAll(`${_base}/battery`, batteryB64);
    if (urls) batteryB64 = urls;
  }
  window._batteryPhotoUrls = batteryB64.length ? { battery: batteryB64 } : {};

  try {
    await _updateDoc(_docRef('intake_assignments', _currentIntakeId), {
      checklist,
      dashChecks,
      safetyChecks,
      // the EV answers were validated on submit but never persisted — without
      // these the manager's view had no way to show them
      isElectric: !!evVActive,
      evCharge: evVActive ? (document.getElementById('di-ev-charge')?.value || '') : '',
      evRange:  evVActive ? (document.getElementById('di-ev-range')?.value  || '') : '',
      notes,
      km,
      code,
      photoUrls,
      intakeDateTime,
      batteryMonth,
      batteryNoDate: !!(document.getElementById('battery-no-date-cb')?.checked),
      batteryPhotoUrls: window._batteryPhotoUrls || {},
      status: 'done',
      completedBy: currentUser.name,
      completedAt: _serverTs()
    });
  } catch(e) {
    console.error('submitDriverIntake error', e);
    showToast('שגיאה בשליחה: ' + (e.code || e.message));
    return;
  }


  // auto-create tasks for X-marked items
  try {
    await createIntakeTasks(checklist, notes, _currentIntakeVehicle, photoUrls);
  } catch(te) {
    console.warn('createIntakeTasks partial error:', te);
    // tasks may be partially created — Firestore write already succeeded, continue closing
  }

  const _donePlate = _currentIntakeVehicle?.plate || '';
  const _doneDriver = currentUser.name;
  const _doneId = _currentIntakeId;
  const _wasManagerMode = _mgLiveMode;
  clearIntakeDraft(_currentIntakeId);
  _currentIntakeId = null;
  _currentIntakeVehicle = null;
  _batteryPhotoFiles = [];
  window._batteryPhotoUrls = {};
  const bpGrid = document.getElementById('battery-photos');
  if (bpGrid) bpGrid.innerHTML = '';
  const bpCount = document.getElementById('battery-photo-count');
  if (bpCount) bpCount.textContent = '';
  const bm = document.getElementById('di-battery-month'); if (bm) bm.value = '';
  const bds = document.getElementById('battery-date-section'); if (bds) bds.style.display = 'none';
  const bndcb = document.getElementById('battery-no-date-cb'); if (bndcb) bndcb.checked = false;
  if (_diHeaderUnsub) { _diHeaderUnsub(); _diHeaderUnsub = null; }
  if (_mgLiveUnsub) { _mgLiveUnsub(); _mgLiveUnsub = null; }
  if (_diLiveUnsub) { _diLiveUnsub(); _diLiveUnsub = null; }
  _diLastEdit = 0; _diAppliedAt = 0;
  _mgLiveMode = false;
  showToast('✅ הטופס נשלח בהצלחה!');
  _notifyDriver('ליאל', `✅ ${_doneDriver} סיים קליטת רכב — ${_donePlate}`);
  if (_wasManagerMode && _doneId) {
    const lb = document.getElementById('di-live-banner'); if (lb) lb.style.display = 'none';
    viewIntakeForm(_doneId);
  } else {
    closeModal('modal-driver-intake');
    openVehiclesScreen();
  }
  } finally {
    _intakeSubmitting = false;
    if (_submitBtn) { _submitBtn.disabled = false; _submitBtn.style.opacity = ''; }
  }
}

async function createIntakeTasks(checklist, allNotes, vehicle, photoUrls) {
  if (!vehicle) return;
  // safety guard: only create tasks when intake is confirmed done
  if (!_currentIntakeId) return;
  try {
    const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDoc(doc(window._db, 'intake_assignments', _currentIntakeId));
    if (!snap.exists() || snap.data().status !== 'done') return;
  } catch(e) { return; }
  const driverName = currentUser.name;
  const plate = vehicle.plate || '';
  const carDesc = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');
  // כותרת המשימה: מספר הרכב, היצרן והדגם, ואז הליקוי וההערה.
  // שם הנהג הקולט נשמר בשדה createdBy ולכן אינו חוזר בכותרת.
  const prefix = [plate, carDesc].filter(Boolean).join(' ');

  const rules = [
    { key: 'c-steering',    col: 'רפד',              title: 'קילופים בהגה' },
    { key: 'c-upholstery',  col: 'רפד',              title: 'ריפודים (חורים/קרעים)' },
    { key: 'c-mats',        col: 'משימות כלליות',    title: 'שטיחים' },
    { key: 'c-sunroof',     col: 'זגג',              title: 'גג נפתח' },
    { key: 'c-ac',          col: 'משימות כלליות',    title: 'מזגן' },
    { key: 'c-windows',     col: 'חביב',             title: 'מתגי חלונות' },
    { key: 'c-glove',       col: driverName,         title: 'ניקיון תא כפפות' },
    { key: 'c-tires',       col: 'משימות כלליות',    title: 'מצב צמיגים' },
    // { key: 'c-frames-ext' } — no task created for frames
    { key: 'c-bulbs',       col: 'גיל',              title: 'מנורות שרופות' },
    { key: 'c-glass-break', col: 'משימות כלליות',    title: 'שברים בשמשות' },
    { key: 'c-lights-break',col: 'משימות כלליות',    title: 'שברים בפנסים' },
    { key: 'c-safety',      col: driverName,         title: 'השלמת אביזרים' },
    { key: 'c-oil',         col: 'משימות כלליות',    title: 'שמן מנוע' },
    { key: 'c-coolant',     col: 'משימות כלליות',    title: 'נוזל קירור' },
  ];

  const getNoteForKey = (key) => {
    const el = document.getElementById('cn-' + key);
    return el ? el.value.trim() : '';
  };

  // Map column name → assignedTo value
  const colToAssigned = {
    'רפד': 'רפד', 'זגג': 'זגג', 'חביב': 'חביב', 'גיל': 'גיל',
    'משימות כלליות': 'כולם',
  };

  // The photos the driver took for a faulty item belong on the task itself —
  // otherwise they stay buried in the intake and whoever works off the task
  // board never sees what the fault actually looks like.
  const photosForKey = (key) => {
    const arr = (photoUrls && photoUrls[key]) || [];
    return Array.isArray(arr) ? arr.slice(0, 2) : []; // cap: a task doc must stay well under 1MB
  };

  for (const rule of rules) {
    if (checklist[rule.key] !== 'x') continue;
    // accessories have no free-text field — the note is the derived list of
    // exactly which items were missing
    const note = rule.key === 'c-safety'
      ? (checklist['c-safety_note'] || '')
      : getNoteForKey(rule.key);
    const taskTitle = `${prefix} – ${rule.title}${note ? ': ' + note : ''}`;
    const isDriverCol = !colToAssigned[rule.col];
    const label      = rule.col;
    const assignedTo = isDriverCol ? rule.col : colToAssigned[rule.col];
    const photos     = photosForKey(rule.key);
    await _addDoc(_colRef('tasks'), {
      title: taskTitle, assignedTo, label, status: 'open',
      createdBy: driverName, createdAt: _serverTs(),
      ...(photos.length ? { photos } : {}),
    });
  }

  // Dashboard checkboxes — each sends to its own column
  if (checklist['c-dashboard'] === 'x') {
    const dashChecks = [
      { id: 'dash-check-engine',  col: 'משימות כלליות', title: 'מנורת צ׳ק אנג׳ין' },
      { id: 'dash-tire-pressure', col: driverName,        title: 'לחץ אוויר' },
      { id: 'dash-service',       col: 'משימות כלליות', title: 'מנורת טיפול' },
      { id: 'dash-collision',     col: 'רדארים',          title: 'מנורת התגשות' },
      { id: 'dash-fuel',          col: driverName,        title: 'מנורת דלק' },
      { id: 'dash-istop',         col: 'משימות כלליות', title: 'iStop' },
      { id: 'dash-other',         col: 'משימות כלליות', title: 'מנורות לוח שעונים – אחר' },
    ];
    for (const dc of dashChecks) {
      const el = document.getElementById(dc.id);
      if (!el?.checked) continue;
      const extraText = dc.id === 'dash-other' ? (document.getElementById('cn-c-dashboard')?.value.trim() || '') : '';
      const taskTitle = `${prefix} – ${dc.title}${extraText ? ': ' + extraText : ''}`;
      const isDriverCol = !colToAssigned[dc.col];
      const label      = dc.col;
      const assignedTo = isDriverCol ? dc.col : colToAssigned[dc.col];
      await _addDoc(_colRef('tasks'), { title: taskTitle, assignedTo, label, status: 'open', createdBy: driverName, createdAt: _serverTs() });
    }
  }
}

// שליחה מחדש מרוקנת את מה שהנהג מילא. לפני שמוחקים — שומרים עותק
// בתוך אותו מסמך, כדי שאפשר יהיה לשחזר בלחיצה אם זה היה בטעות.
async function resendIntake(id) {
  const v = ((typeof _intakeCache !== 'undefined' && _intakeCache) || []).find(x => x.id === id) || {};
  if (!confirm(`לשלוח מחדש לנהג את הקליטה של ${v.plate || 'הרכב'}?\n\nכל מה שהנהג מילא — צ׳קליסט, הערות, קילומטראז׳ ותמונות — יימחק מהמסך והטופס יחזור ריק.\nנשמור עותק, ותוכל לשחזר בלחיצה.`)) return;
  const { getDoc, updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const ref = doc(window._db, 'intake_assignments', id);
  const snap = await getDoc(ref);
  // התמונות עשויות לשבת במסמך הנפרד — טוענים אותן לפני שמכינים את
  // העותק לשחזור, אחרת השחזור היה מחזיר קליטה בלי תמונות
  const d = await _intakeLoadPhotos({ id, ...(snap.exists() ? snap.data() : {}) });
  const previousIntake = {
    checklist: d.checklist || {}, notes: d.notes || '', km: d.km || '', code: d.code || '',
    photoUrls: d.photoUrls || {}, batteryPhotoUrls: d.batteryPhotoUrls || {},
    dashChecks: d.dashChecks || {}, safetyChecks: d.safetyChecks || {},
    intakeDateTime: d.intakeDateTime || '', completedBy: d.completedBy || '',
    isElectric: !!d.isElectric, evCharge: d.evCharge || '', evRange: d.evRange || '',
    batteryMonth: d.batteryMonth || '', batteryNoDate: !!d.batteryNoDate,
    savedAt: new Date().toISOString(),
  };
  await updateDoc(ref, {
    status: 'pending', checklist: {}, notes: '', km: '', code: '',
    photoUrls: {}, intakeDateTime: '', completedBy: '', completedAt: null,
    previousIntake,
  });
  showToast('🔄 הקליטה נשלחה מחדש לנהג — העותק הקודם נשמר', 5000);
}

// שחזור הקליטה שנמחקה בשליחה מחדש
async function restorePrevIntake(id) {
  const { getDoc, updateDoc, doc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const ref = doc(window._db, 'intake_assignments', id);
  const snap = await getDoc(ref);
  const p = snap.exists() ? snap.data().previousIntake : null;
  if (!p) return showToast('אין עותק קודם לשחזור');
  const when = p.savedAt ? new Date(p.savedAt).toLocaleString('he-IL') : '';
  if (!confirm(`לשחזר את הקליטה כפי שהייתה${when ? ' לפני ' + when : ''}?`)) return;
  await updateDoc(ref, {
    status: 'done',
    checklist: p.checklist || {}, notes: p.notes || '', km: p.km || '', code: p.code || '',
    photoUrls: p.photoUrls || {}, batteryPhotoUrls: p.batteryPhotoUrls || {},
    dashChecks: p.dashChecks || {}, safetyChecks: p.safetyChecks || {},
    intakeDateTime: p.intakeDateTime || '', completedBy: p.completedBy || '',
    isElectric: !!p.isElectric, evCharge: p.evCharge || '', evRange: p.evRange || '',
    batteryMonth: p.batteryMonth || '', batteryNoDate: !!p.batteryNoDate,
    completedAt: serverTimestamp(),
  });
  showToast('↩️ הקליטה שוחזרה');
}
window.restorePrevIntake = restorePrevIntake;

async function deleteIntake(id) {
  if (!confirm('למחוק את הקליטה? הפעולה תימחק גם אצל הנהג.')) return;
  const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await deleteDoc(doc(window._db, 'intake_assignments', id));
  showToast('✅ הקליטה נמחקה');
}

async function markChecked(id) {
  if (!window._CONFIG_DONE) return;
  const { getDoc, doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const snap = await getDoc(doc(window._db, 'intake_assignments', id));
  if (!snap.exists()) return;
  // התמונות עוברות למסמך נפרד לפי המזהה המקורי, כדי שרשימת הארכיון
  // לא תמשוך אותן. אם ההפרדה נכשלה הן פשוט נשמרות כמו קודם.
  const raw = { ...snap.data(), status: 'checked', checkedAt: _serverTs(), originalId: id };
  const data = await _intakeSplitPhotos(id, raw);
  await _addDoc(_colRef('intake_archive'), data);
  await deleteDoc(doc(window._db, 'intake_assignments', id));
  showToast('✅ הועבר לארכיון');
}

/* העברה לארכיון מתוך חלונית הצפייה. אותה פעולה בדיוק של הכפתור ברשימה,
   רק שהיא גם סוגרת את החלונית כשהיא מסתיימת בהצלחה. */
async function archiveIntakeFromView(id) {
  const btn = document.getElementById('view-intake-archive-btn');
  if (btn?.disabled) return;
  if (!confirm('להעביר את הקליטה לארכיון?')) return;
  if (!_requireNet('העברה לארכיון')) return;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ מעביר לארכיון...'; }
  try {
    await markChecked(id);
    closeModal('modal-view-intake');
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '📁 העבר לארכיון'; }
    showToast('ההעברה נכשלה — נסה שוב', 6000);
  }
}
window.archiveIntakeFromView = archiveIntakeFromView;

/* ── תמונות הקליטה יושבות במסמך נפרד ─────────────────────────────────
   רשימת הקליטות והארכיון אינן מציגות תמונות בכלל, ולכן אין סיבה שהן
   יירדו יחד עם הרשימה. התמונות נשמרות ב-intake_photos ונטענות רק
   כשפותחים קליטה אחת לצפייה.
   מסמכים ישנים עדיין מחזיקים את התמונות בתוכם — הקריאה מעדיפה תמיד את
   מה שנמצא במסמך עצמו, ורק אם אין שם כלום פונה למסמך הנפרד. כך שום
   קליטה לא מאבדת את התמונות שלה, לא לפני המעבר ולא אחריו.           */
const _intakePhotoCache = new Map();
const _hasPhotos = v => Object.keys(v?.photoUrls || {}).length
                     || Object.keys(v?.batteryPhotoUrls || {}).length;

async function _intakeLoadPhotos(v) {
  if (!v || _hasPhotos(v)) return v;                 // התמונות כבר כאן
  const key = v.photosId || v.originalId || v.id;
  if (!key || !window._getDoc) return v;
  if (_intakePhotoCache.has(key)) return { ...v, ...(_intakePhotoCache.get(key)) };
  try {
    const snap = await window._getDoc(_docRef('intake_photos', key));
    const d = snap.exists() ? snap.data() : null;
    const got = d ? { photoUrls: d.photoUrls || {}, batteryPhotoUrls: d.batteryPhotoUrls || {} } : {};
    _intakePhotoCache.set(key, got);
    return { ...v, ...got };
  } catch (e) { console.warn('intake photos', e); return v; }
}

/* מפריד את התמונות מהמסמך: כותב אותן למסמך הנפרד ומחזיר את הנתונים
   בלעדיהן. אם הכתיבה נכשלה — מוחזרים הנתונים המקוריים עם התמונות,
   כדי שלא תיווצר קליטה בלי תמונות בשום מצב. */
async function _intakeSplitPhotos(photoKey, data) {
  if (!_hasPhotos(data)) return data;
  try {
    await window._setDoc(_docRef('intake_photos', photoKey), {
      photoUrls: data.photoUrls || {},
      batteryPhotoUrls: data.batteryPhotoUrls || {},
      movedAt: new Date().toISOString(),
    }, { merge: true });
    _intakePhotoCache.delete(photoKey);
    const out = { ...data, photosId: photoKey };
    delete out.photoUrls;
    delete out.batteryPhotoUrls;
    return out;
  } catch (e) {
    console.warn('intake photo split failed', e);
    return data;                                     // נשמר כמו קודם
  }
}

async function viewIntakeForm(id) {
  // פתיחה מיידית מהרשימה שכבר בזיכרון — בלי לחכות לרשת
  const hit = (_intakeCache || []).find(v => v.id === id);
  if (hit) return _renderViewIntakeModal(await _intakeLoadPhotos(hit));
  const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const snap = await getDoc(doc(window._db, 'intake_assignments', id));
  if (!snap.exists()) return showToast('לא נמצאה קליטה');
  _renderViewIntakeModal(await _intakeLoadPhotos({ id, ...snap.data() }));
}
window.viewIntakeForm = viewIntakeForm;

function _renderViewIntakeModal(v) {
  const checklistLabels = {
    'c-battery-original': 'בדיקת מצבר','c-battery-is-original': 'מצבר מקורי',
    'c-oil': 'שמן מנוע','c-coolant': 'נוזל קירור','c-safety': 'בדיקה והשלמת אביזרים',
    'c-lights-break': 'שברים בפנסים','c-glass-break': 'שברים בשמשות','c-bulbs': 'מנורות שרופות',
    'c-frames-ext': 'מסגרות','c-tires': 'מצב צמיגים','c-glove': 'ניקיון תא כפפות',
    'c-windows': 'מתגי חלונות','c-ac': 'מזגן','c-dashboard': 'מנורות לוח שעונים',
    'c-sunroof': 'גג נפתח','c-upholstery': 'ריפודים','c-mats': 'שטיחים','c-steering': 'הגה – קילופים'
  };
  const cl = v.checklist || {};
  const photos = v.photoUrls || {};
  console.log('RAW photoUrls:', JSON.stringify(photos));
  console.log('ALL doc keys:', Object.keys(v));
  const ts = v.completedAt?.toDate ? v.completedAt.toDate().toLocaleString('he-IL') : '';

  // Show ALL urls/base64 from photoUrls regardless of structure
  const allUrls = [];
  const collectUrls = (obj) => {
    if (!obj) return;
    if (typeof obj === 'string' && (obj.startsWith('http') || obj.startsWith('data:'))) { allUrls.push(obj); return; }
    if (Array.isArray(obj)) { obj.forEach(collectUrls); return; }
    if (typeof obj === 'object') { Object.values(obj).forEach(collectUrls); }
  };
  collectUrls(photos);
  // also check top-level photos field
  if (v.photos) collectUrls(v.photos);
  // remove battery photos from top gallery (they show in checklist row only)
  const batteryUrls = new Set(Object.values(v.batteryPhotoUrls || {}).flat());
  const filteredUrls = allUrls.filter(u => !batteryUrls.has(u));

  let rows = '';
  for (const [key, label] of Object.entries(checklistLabels)) {
    const val = cl[key];
    if (!val) continue;
    const icon = val === 'v' ? '✅' : '❌';
    const bg = val === 'v' ? '#f0fff4' : '#fff0f0';
    let noteText = cl[key+'_note'] || '';
    // special: מצבר מקורי ✕ — show battery month or "לא ניתן לראות תאריך"
    if (key === 'c-battery-is-original' && val === 'x') {
      if (v.batteryNoDate) {
        noteText = noteText ? noteText + ' · לא ניתן לראות תאריך מצבר' : 'לא ניתן לראות תאריך מצבר';
      } else if (v.batteryMonth) {
        const formatted = (() => { try { const [y,m] = v.batteryMonth.split('-'); return `${m}/${y}`; } catch(e) { return v.batteryMonth; } })();
        noteText = noteText ? noteText + ` · חודש מצבר: ${formatted}` : `חודש מצבר: ${formatted}`;
      }
    }
    // dashboard ✕ — spell out exactly which warning lights were ticked
    if (key === 'c-dashboard' && val === 'x') {
      const dashLabels = {
        'dash-check-engine':'מנורת צ׳ק אנג׳ין','dash-tire-pressure':'לחץ אוויר','dash-service':'טיפול',
        'dash-collision':'מנורת התגשות','dash-fuel':'מנורת דלק','dash-istop':'iStop','dash-other':'אחר'
      };
      const lit = Object.entries(v.dashChecks || {}).filter(([,on]) => on).map(([k]) => dashLabels[k] || k);
      if (lit.length && !noteText) noteText = lit.join(' · ');
    }
    // accessories — list each item and whether it was confirmed present
    let sfRows = '';
    if (key === 'c-safety' && v.safetyChecks) {
      const sfLabels = { 'sf-jack': 'ג׳ק + מפתח גלגלים + משולש', 'sf-vest': 'אפוד זוהר', 'sf-spare': 'גלגל ספייר' };
      // תת־סעיפי הספייר מוצגים רק כשהוא חסר — אחרת הם לא נשאלו בכלל
      const sfSubLabels = { 'sf-puncture-kit': 'ערכת תיקון פנצ׳ר', 'sf-air-kit': 'ערכת ניפוח אוויר' };
      const subRows = v.safetyChecks['sf-spare'] ? '' :
        Object.entries(sfSubLabels).map(([id, lbl]) =>
          `<div style="padding-right:20px">${v.safetyChecks[id] ? '✅' : '❌'} ${esc(lbl)}</div>`).join('');
      sfRows = `<div style="margin-top:6px;font-size:13px;line-height:1.9">` +
        Object.entries(sfLabels).map(([id, lbl]) =>
          `<div>${v.safetyChecks[id] ? '✅' : '❌'} ${esc(lbl)}</div>` +
          (id === 'sf-spare' ? subRows : '')).join('') + `</div>`;
    }
    const note = noteText ? `<div style="font-size:12px;color:#555;margin-top:4px">📝 ${esc(noteText)}</div>` : '';
    // match photos by exact key or any key that starts with the same prefix
    const keyPhotos = key === 'c-battery-original'
      ? [...Object.values(v.batteryPhotoUrls || {}).flat(), ...(photos['c-battery-original'] || [])]
      // the jack photo is stored under its own key so it can never be mixed up
      // with another section — surface it on the accessories row
      : key === 'c-safety'
      ? [...(photos['c-safety'] || []), ...(photos['c-safety-jack'] || [])]
      : (photos[key]||[]).length ? photos[key]
        // legacy fallback for numbered keys like "c-oil-1" only — a loose
        // prefix match would leak photos between sections (e.g. c-ac → c-ac-noise)
        : Object.entries(photos).filter(([k]) => k === key || /^-?\d+$/.test(k.slice(key.length))).flatMap(([,v]) => v);
    const plate = esc(v.plate || '');
    const imgs = keyPhotos.length
      ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${keyPhotos.map(url =>
          `<img src="${url}" onclick="openPhotoZoom('${url}','${plate}')" style="width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid #ccc">`
        ).join('')}</div>` : '';
    rows += `<div style="background:${bg};border-radius:10px;padding:10px 14px;margin-bottom:8px">
      <div style="font-weight:700;font-size:14px">${icon} ${label}</div>${sfRows}${note}${imgs}
    </div>`;
  }


  const km = v.km ? `<span style="margin-left:16px;background:#fef08a;padding:2px 8px;border-radius:6px;font-weight:700"><strong>ק"מ:</strong> ${esc(v.km)}</span>` : '';
  const code = v.code ? `<span style="background:#fef08a;padding:2px 8px;border-radius:6px;font-weight:700"><strong>קוד:</strong> ${esc(v.code)}</span>` : '';
  const notes = v.notes ? `<div style="background:#f8f8ff;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:14px">📝 <strong>הערות:</strong> ${esc(v.notes)}</div>` : '';
  const evRow = v.isElectric === undefined ? ''
    : v.isElectric
      ? `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:14px;font-weight:700;color:#15803d">⚡ רכב חשמלי${v.evCharge !== '' && v.evCharge != null ? ` · אחוז טעינה: ${esc(String(v.evCharge))}%` : ''}${v.evRange ? ` · טווח נסיעה: ${esc(String(v.evRange))} ק״מ` : ''}</div>`
      : `<div style="background:var(--surface2);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:14px;font-weight:700;color:var(--muted)">⚡ רכב חשמלי: לא</div>`;

  // הקליטה כבר בארכיון מגיעה עם status 'checked' — אז הכפתור לא מוצג שוב
  const arcBtn = (v.status === 'done' && currentUser?.role === 'manager')
    ? `<button id="view-intake-archive-btn" onclick="archiveIntakeFromView('${v.id}')"
        style="width:100%;background:var(--dark);color:#fff;border:none;border-radius:12px;padding:12px;margin-bottom:14px;font-family:Heebo,sans-serif;font-size:15px;font-weight:900;cursor:pointer">📁 העבר לארכיון</button>`
    : '';

  document.getElementById('view-intake-content').innerHTML = `
    ${arcBtn}
    <div style="background:#f0f2ff;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:13px;line-height:2">
      <strong>${esc(v.plate)}</strong> · ${esc(v.brand||'')} ${esc(v.model||'')} ${esc(v.year||'')}<br>
      צבע: ${esc(v.color||'')} · חניה: ${esc(v.spot||'')}${km ? '<br>' + km + code : ''}<br>
      נהג קולט: <strong>${esc(v.completedBy||v.assignedTo||'')}</strong> · ${ts}${v.intakeDateTime ? '<br>תאריך קליטה: <strong>' + esc(v.intakeDateTime) + '</strong>' : ''}
    </div>
    ${evRow}
    ${notes}
    <div style="font-weight:900;font-size:13px;color:var(--muted);margin-bottom:8px">🔍 ממצאי בדיקה</div>
    ${rows || '<div style="color:var(--muted);text-align:center;padding:20px">אין נתוני צ׳קליסט</div>'}
  `;
  window._viewIntakeData = v;
  openModal('modal-view-intake');
}

function generateIntakePDF(v) {
  const checklistLabels = {
    'c-battery-original': 'בדיקת מצבר','c-battery-is-original': 'מצבר מקורי',
    'c-oil': 'שמן מנוע','c-coolant': 'נוזל קירור','c-safety': 'בדיקה והשלמת אביזרים',
    'c-lights-break': 'שברים בפנסים','c-glass-break': 'שברים בשמשות','c-bulbs': 'מנורות שרופות',
    'c-frames-ext': 'מסגרות','c-tires': 'מצב צמיגים','c-glove': 'ניקיון תא כפפות',
    'c-windows': 'מתגי חלונות','c-ac': 'מזגן','c-dashboard': 'מנורות לוח שעונים',
    'c-sunroof': 'גג נפתח','c-upholstery': 'ריפודים','c-mats': 'שטיחים','c-steering': 'הגה - קילופים'
  };
  const cl = v.checklist || {};
  const photos = v.photoUrls || {};
  const ts = v.completedAt?.toDate ? v.completedAt.toDate().toLocaleString('he-IL') : '';

  let rows = '';
  for (const [key, label] of Object.entries(checklistLabels)) {
    const val = cl[key];
    if (!val) continue;
    const icon = val === 'v' ? '✓' : '✕';
    const color = val === 'v' ? '#166534' : '#991b1b';
    const bg = val === 'v' ? '#f0fff4' : '#fff0f0';
    const note = cl[key+'_note'] ? `<div style="font-size:12px;color:#555;margin-top:4px">הערה: ${cl[key+'_note']}</div>` : '';
    const keyUrls = (photos[key]||[]);
    const imgs = keyUrls.map(url => `<img src="${url}" onclick="openPhotoZoom('${url}')" style="width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid #ccc;margin:3px">`).join('');
    rows += `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;background:${bg};border-radius:6px;margin-bottom:6px">
      <span style="font-size:16px;font-weight:900;color:${color};min-width:18px">${icon}</span>
      <div style="flex:1"><div style="font-size:13px;font-weight:700">${label}</div>${note}${imgs ? `<div style="display:flex;flex-wrap:wrap;margin-top:6px">${imgs}</div>` : ''}</div>
    </div>`;
  }

  const el = document.createElement('div');
  el.style.cssText = 'font-family:Arial,sans-serif;direction:rtl;padding:20px;color:#1a1a2e;width:700px';
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:3px solid #1a1a2e;padding-bottom:12px">
      <div>
        <div style="font-size:22px;font-weight:900">טופס קליטת רכב</div>
        <div style="font-size:14px;color:#666">ענק הרכבים</div>
      </div>
      <div style="font-size:28px;font-weight:900;letter-spacing:2px">${esc(v.plate)}</div>
    </div>
    <div style="background:#f0f2ff;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;line-height:2">
      <strong>יצרן/דגם:</strong> ${esc((v.brand||'')+' '+(v.model||''))} &nbsp;
      <strong>שנה:</strong> ${esc(v.year||'')} &nbsp;
      <strong>צבע:</strong> ${esc(v.color||'')} &nbsp;
      <strong>חניה:</strong> ${esc(v.spot||'')} &nbsp;
      <strong>ק"מ:</strong> ${esc(v.km||'')}<br>
      <strong>נהג קולט:</strong> ${esc(v.completedBy||v.assignedTo||'')} &nbsp;
      <strong>תאריך:</strong> ${ts}${v.intakeDateTime ? ' &nbsp; <strong>תאריך קליטה:</strong> ' + esc(v.intakeDateTime) : ''}
    </div>
    <div style="font-size:14px;font-weight:900;margin-bottom:8px">ממצאי בדיקה</div>
    ${rows || '<div style="color:#999;font-size:13px">אין נתוני צ\'קליסט</div>'}
    ${v.notes ? `<div style="margin-top:14px;background:#fffbe6;border-radius:6px;padding:10px 14px;font-size:13px"><strong>הערות נוספות:</strong> ${esc(v.notes)}</div>` : ''}
  `;

  showToast('מכין PDF...');
  html2pdf().set({
    margin: 10,
    filename: `קליטה-${v.plate}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(el).save().then(() => showToast('✅ PDF הורד בהצלחה'));
}

/* ── PHOTO UPLOAD ── */
const ciPhotoFiles = {}; // { 'c-upholstery': [File,...], ... }

let _batteryPhotoFiles = [];
window._batteryPhotoUrls = {};

function batteryOriginalToggle(btn) {
  const noteRow = document.getElementById('battery-original-note-row');
  if (noteRow) noteRow.style.display = btn.dataset.val === 'x' ? 'block' : 'none';
  if (btn.dataset.val === 'v') { const t = document.getElementById('cn-c-battery-original'); if (t) t.value = ''; }
}
window.batteryOriginalToggle = batteryOriginalToggle;
function batteryIsOriginalToggle(btn) {
  const cb = document.getElementById('battery-no-date-cb');
  const noDate = cb && cb.checked;
  const sec = document.getElementById('battery-date-section');
  if (sec) sec.style.display = (btn.dataset.val === 'x' && !noDate) ? 'block' : 'none';
}
window.batteryIsOriginalToggle = batteryIsOriginalToggle;

function batteryNoDateToggle(cb) {
  // בלי תאריך על המצבר אין מה לצלם — הכוכבית של החובה יורדת
  const req = document.getElementById('battery-photo-req');
  if (req) req.style.display = cb.checked ? 'none' : '';
  const sec = document.getElementById('battery-date-section');
  if (!sec) return;
  if (cb.checked) {
    sec.style.display = 'none';
    const m = document.getElementById('di-battery-month'); if (m) m.value = '';
  } else {
    // only show if מצבר מקורי is ✕
    const xActive = document.querySelector('#modal-driver-intake .ci-box[data-key="c-battery-is-original"].x-active');
    if (xActive) sec.style.display = 'block';
  }
}
window.batteryNoDateToggle = batteryNoDateToggle;

// המצב הנוכחי של סימון הרכב החשמלי: 'v' / 'x' / '' (לא סומן)
function _evGet() {
  if (document.getElementById('di-ev-v')?.classList.contains('v-active')) return 'v';
  if (document.getElementById('di-ev-x')?.classList.contains('x-active')) return 'x';
  return '';
}

/* קביעת מצב מוחלטת — לא החלפה. שחזור טיוטה חייב *לקבוע* את הסימון ולא
   "ללחוץ" עליו: לחיצה על סימון שכבר פעיל מבטלת אותו, ולכן שחזור שחוזר
   על עצמו (סנכרון חי בין מכשירים) היה מכבה את ה-✕ שהנהג הרגע סימן. */
function _evSet(val) {
  const vBtn = document.getElementById('di-ev-v');
  const xBtn = document.getElementById('di-ev-x');
  const fields = document.getElementById('di-ev-fields');
  if (!vBtn || !xBtn) return;
  vBtn.classList.remove('v-active','x-active'); vBtn.style.color = 'transparent';
  xBtn.classList.remove('v-active','x-active'); xBtn.style.color = 'transparent';
  if (val === 'v') { vBtn.classList.add('v-active'); vBtn.style.color = ''; }
  else if (val === 'x') { xBtn.classList.add('x-active'); xBtn.style.color = ''; }
  if (fields) fields.style.display = (val === 'v') ? 'block' : 'none';
}
window._evSet = _evSet;

function evClick(val) {
  // לחיצה חוזרת על אותה תיבה מבטלת את הבחירה
  _evSet(_evGet() === val ? '' : val);
  saveIntakeDraft();
}
window.evClick = evClick;
// kept for draft restore
function evToggle(cb) {}
window.evToggle = evToggle;

function addBatteryPhoto(input) {
  const files = [...input.files];
  _batteryPhotoFiles.push(...files.slice(0, 4 - _batteryPhotoFiles.length));
  input.value = '';
  const grid = document.getElementById('battery-photos');
  const count = document.getElementById('battery-photo-count');
  if (count) count.textContent = _batteryPhotoFiles.length ? `${_batteryPhotoFiles.length} תמונה נבחרה` : '';
  if (!grid) return;
  grid.innerHTML = _batteryPhotoFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div class="ci-photo-box"><img src="${url}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" style="width:100%;height:100%;object-fit:cover"><span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:12px;font-weight:700;color:#166534;background:#dcfce7;border-radius:8px">✓ נבחרה</span><button class="rm-btn" onclick="_batteryPhotoFiles.splice(${i},1);addBatteryPhoto({files:[]})">✕</button></div>`;
  }).join('');
  scheduleIntakePhotoDraft();
}
window.addBatteryPhoto = addBatteryPhoto;

function addPhotos(key, input) {
  if (!ciPhotoFiles[key]) ciPhotoFiles[key] = [];
  const remaining = 4 - ciPhotoFiles[key].length;
  const files = [...input.files].slice(0, remaining);
  ciPhotoFiles[key].push(...files);
  input.value = '';
  renderPhotoGrid(key);
  scheduleIntakePhotoDraft();
}

function removePhoto(key, idx) {
  ciPhotoFiles[key].splice(idx, 1);
  renderPhotoGrid(key);
  scheduleIntakePhotoDraft();
}

function renderPhotoGrid(key) {
  const grid = document.getElementById('photos-' + key);
  if (!grid) return;
  const files = ciPhotoFiles[key] || [];
  let html = files.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div class="ci-photo-box">
      <img src="${url}">
      <button class="rm-btn" onclick="removePhoto('${key}',${i})">✕</button>
    </div>`;
  }).join('');
  if (files.length < 4) {
    html += `<button type="button" onclick="document.getElementById('file-${key}').click()" style="width:100%;background:#0ea5e9;color:#fff;border:none;border-radius:10px;padding:10px;font-family:Heebo,sans-serif;font-weight:700;font-size:14px;cursor:pointer;margin-top:4px">📷 צלם תמונה</button>`;
  }
  grid.innerHTML = html;
}

/* ── מצב חיבור ───────────────────────────────────────────────────────
   בלי אינטרנט פעולות שמירה לא מתבצעות. במקום להיכשל בשקט, הן נחסמות
   מראש עם הודעה ברורה, וכל מה שמולא נשמר מקומית כדי להמשיך מאותה
   נקודה כשהחיבור חוזר.                                              */
function _netOnline() { return navigator.onLine !== false; }

function _netSyncBar() {
  const bar = document.getElementById('net-bar');
  if (bar) bar.style.display = _netOnline() ? 'none' : 'block';
}
window.addEventListener('online', () => { _netSyncBar(); showToast('🟢 החיבור חזר — אפשר להמשיך', 4000); });
window.addEventListener('offline', _netSyncBar);
document.addEventListener('DOMContentLoaded', _netSyncBar);
_netSyncBar();

// שומר הסף לכל פעולה ששומרת נתונים
function _requireNet(what) {
  if (_netOnline()) return true;
  _netSyncBar();
  showToast(`📴 אין חיבור לאינטרנט — ${what || 'הפעולה'} לא בוצעה. כל מה שמילאת נשמר, אפשר להמשיך מאותה נקודה כשהחיבור יחזור.`, 9000);
  return false;
}
