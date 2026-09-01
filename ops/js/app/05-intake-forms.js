/* טיוטות, תמונות ושליחת טפסים
   חלק 5 מתוך 13 של אפליקציית התפעול.
   הקבצים נטענים לפי הסדר ומתנהגים בדיוק כמו קובץ אחד — אין לשנות את הסדר. */
window._requireNet = _requireNet;

/* ── העלאת תמונה לשרת הקבצים ─────────────────────────────────────────
   התמונה נראית בדיוק אותו דבר בתוך הרשומה — ההבדל הוא רק איפה היא
   שוכבת. אם ההעלאה לא זמינה, נשארים בשמירה בתוך הרשומה כמו קודם,
   ואז תקציב הגודל הוא זה ששומר עלינו.                               */
async function _uploadDataUrl(path, dataUrl) {
  if (!window._uploadBytes || !window._storageRef || !window._storage) return null;
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ref = window._storageRef(window._storage, path);
  await window._uploadBytes(ref, blob);
  return await window._getDownloadURL(ref);
}

// מעלה קבוצת תמונות ומחזירה קישורים. כישלון מחזיר null, ואז נשמר base64
async function _uploadAll(prefix, b64s) {
  try {
    const out = [];
    for (let i = 0; i < b64s.length; i++) {
      const url = await _uploadDataUrl(`${prefix}_${i}_${Date.now()}.jpg`, b64s[i]);
      if (!url) return null;
      out.push(url);
    }
    return out;
  } catch (e) { console.warn('upload failed, keeping in record', e); return null; }
}

/* ── תקציב גודל לרשומה ──────────────────────────────────────────────
   התמונות נשמרות בתוך הרשומה עצמה, ולרשומה יש תקרה של מגה־בייט אחד.
   לכן לפני השמירה בודקים את הגודל: אם חרגנו, דוחסים חזק יותר, ורק אם
   גם זה לא הספיק — עוצרים ואומרים למה. שמירה חלקית לא מתרחשת.      */
const _DOC_PHOTO_BUDGET = 750 * 1024;     // שאר השדות מקבלים את היתרה

// גודל אמיתי של מחרוזת base64 בבתים
function _b64Size(str) {
  const i = String(str || '').indexOf(',');
  const body = i >= 0 ? str.slice(i + 1) : String(str || '');
  return Math.floor(body.length * 3 / 4);
}
const _photosBytes = obj => Object.values(obj || {})
  .flat().reduce((t, b) => t + _b64Size(b), 0);

function compressToBase64(file, maxPx = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxPx || h > maxPx) {
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function uploadPhotos(key) {
  const files = ciPhotoFiles[key] || [];
  const b64s = [];
  for (let i = 0; i < files.length; i++) {
    showToast(`⏳ מעבד תמונה ${i+1}/${files.length}...`);
    const b64 = await compressToBase64(files[i]);
    b64s.push(b64);
  }
  return b64s;
}

/* ── Accessories checklist (✓ only) ──
   Unlike the ✓/✕ rows, these items are either confirmed present or not — an
   unmarked item means "missing", and a task is opened to complete it.
   One click marks; a double click clears. Clicking an already-marked box is a
   no-op, so the two clicks that precede a dblclick can't undo it by accident. */
const _SF_ITEMS = {
  'sf-jack': 'ג׳ק + מפתח גלגלים + משולש', 'sf-vest': 'אפוד זוהר', 'sf-spare': 'גלגל ספייר',
  // תת־סעיפים שנפתחים רק כשאין גלגל ספייר
  'sf-puncture-kit': 'ערכת תיקון פנצ׳ר', 'sf-air-kit': 'ערכת ניפוח אוויר',
};
// התת־סעיפים של הספייר: נשאלים רק כשהספייר חסר, ולכן גם נספרים רק אז
const _SF_SPARE_SUBS = ['sf-puncture-kit', 'sf-air-kit'];

// plain toggle — tap to mark, tap again to clear. No timing involved, so it
// behaves the same on a phone in the sun as it does on a desktop.
function sfMark(btn) {
  btn.classList.toggle('v-active');
  if (btn.dataset.sf === 'sf-spare') {
    // ✓ ו-✕ סותרים זה את זה
    if (btn.classList.contains('v-active')) document.querySelector('.sf-x[data-sfx="sf-spare"]')?.classList.remove('x-active');
    _sfSpareSub();
  }
}
window.sfMark = sfMark;

// ה-✕ של הספייר: מסמן במפורש "אין ספייר" ופותח את התת־סעיפים
function sfMarkX(btn) {
  btn.classList.toggle('x-active');
  if (btn.classList.contains('x-active')) document.querySelector('.sf-box[data-sf="sf-spare"]')?.classList.remove('v-active');
  _sfSpareSub();
}
window.sfMarkX = sfMarkX;

// רק ✕ מפורש פותח את התת־סעיפים. כשהוא נסגר הסימונים מתאפסים, כדי
// שסימון ישן לא יישאר תלוי באוויר.
function _sfSpareSub() {
  const box = document.getElementById('sf-spare-sub');
  if (!box) return;
  const x = document.querySelector('.sf-x[data-sfx="sf-spare"]');
  const noSpare = !!(x && x.classList.contains('x-active'));
  box.style.display = noSpare ? 'flex' : 'none';
  if (!noSpare) {
    for (const id of _SF_SPARE_SUBS) {
      document.querySelector(`.sf-box[data-sf="${id}"]`)?.classList.remove('v-active');
    }
  }
}

function _sfRead() {
  const out = {};
  for (const id of Object.keys(_SF_ITEMS)) {
    const b = document.querySelector(`.sf-box[data-sf="${id}"]`);
    out[id] = !!(b && b.classList.contains('v-active'));
  }
  // נשמר בנפרד כדי שטיוטה תיפתח חזרה עם התת־סעיפים במקום
  out['sf-spare-x'] = !!document.querySelector('.sf-x[data-sfx="sf-spare"].x-active');
  return out;
}

function _sfApply(state) {
  for (const id of Object.keys(_SF_ITEMS)) {
    const b = document.querySelector(`.sf-box[data-sf="${id}"]`);
    if (b) b.classList.toggle('v-active', !!(state && state[id]));
  }
  // ה-✕ נדלק כשנשמר במפורש, או כשיש סימון בתת־סעיפים (טיוטה ישנה)
  const noSpare = !!(state && (state['sf-spare-x'] || _SF_SPARE_SUBS.some(id => state[id])));
  document.querySelector('.sf-x[data-sfx="sf-spare"]')?.classList.toggle('x-active', noSpare);
  _sfSpareSub();   // טעינת טיוטה — התת־סעיפים נפתחים לפי מצב הספייר
}

function ciClick(btn) {
  const key = btn.dataset.key;
  const val = btn.dataset.val;
  const activeClass = val === 'v' ? 'v-active' : 'x-active';
  const isAlreadyActive = btn.classList.contains(activeClass);

  // deactivate all buttons for this key
  document.querySelectorAll(`.ci-box[data-key="${key}"]`).forEach(b => b.classList.remove('v-active','x-active'));

  if (isAlreadyActive) {
    // double-click: clear selection, hide note row
    const noteRow = document.getElementById('note-' + key);
    if (noteRow) {
      noteRow.style.display = 'none';
      const ta = noteRow.querySelector('textarea'); if (ta) ta.value = '';
      noteRow.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
    }
    // hide special rows for battery
    const battOrigRow = document.getElementById('battery-original-note-row');
    if (battOrigRow && key === 'c-battery-original') battOrigRow.style.display = 'none';
    const battIsOrigRow = document.getElementById('battery-is-original-note-row');
    if (battIsOrigRow && key === 'c-battery-is-original') battIsOrigRow.style.display = 'none';
    const battDateSec = document.getElementById('battery-date-section');
    if (battDateSec && key === 'c-battery-is-original') battDateSec.style.display = 'none';
    saveIntakeDraft();
    return;
  }

  btn.classList.add(activeClass);
  const noteRow = document.getElementById('note-' + key);
  if (noteRow) {
    noteRow.style.display = val === 'x' ? 'block' : 'none';
    if (val === 'v') {
      const ta = noteRow.querySelector('textarea'); if (ta) ta.value = '';
      noteRow.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
      const otherTa = document.getElementById('cn-c-dashboard'); if (otherTa) otherTa.value = '';
      const otherReq = document.getElementById('dash-other-req'); if (otherReq) otherReq.style.display = 'none';
    }
  }
  saveIntakeDraft();
}

function saveIntakeDraft() {
  if (!_currentIntakeId) return;
  const checks = {};
  // כפתורי האביזרים נשמרים בנפרד ב-safetyChecks — בלי הסינון הזה הם
  // היו נכתבים לטיוטה עם מפתח ריק
  document.querySelectorAll('#modal-driver-intake .ci-box.v-active:not(.sf-box):not(.sf-x),#modal-driver-intake .ci-box.x-active:not(.sf-box):not(.sf-x)').forEach(b => {
    checks[b.dataset.key] = b.dataset.val;
  });
  const notes = {};
  document.querySelectorAll('#modal-driver-intake textarea[id^="cn-"]').forEach(ta => {
    if (ta.value.trim()) notes[ta.id.replace('cn-','')] = ta.value;
  });
  // save dashboard checkboxes
  const dashChecks = {};
  ['dash-check-engine','dash-tire-pressure','dash-service','dash-collision','dash-fuel','dash-istop','dash-other'].forEach(id => {
    const el = document.getElementById(id); if (el) dashChecks[id] = el.checked;
  });
  const draft = {
    checks,
    notes,
    dashChecks,
    safetyChecks: _sfRead(),
    km:   document.getElementById('di-km')?.value   || '',
    code: document.getElementById('di-code')?.value || '',
    general: document.getElementById('di-notes')?.value || '',
    batteryMonth: document.getElementById('di-battery-month')?.value || '',
    isElectric: !!(document.getElementById('di-ev-v')?.classList.contains('v-active')),
evSelection: document.getElementById('di-ev-v')?.classList.contains('v-active') ? 'v' : document.getElementById('di-ev-x')?.classList.contains('x-active') ? 'x' : '',
    evCharge:   document.getElementById('di-ev-charge')?.value  || '',
    evRange:    document.getElementById('di-ev-range')?.value   || '',
  };
  draft._savedAt = Date.now();
  _diLastEdit = Date.now();          // המשתמש הזה נגע בטופס עכשיו
  _diAppliedAt = Date.now();         // ומה שהוא כתב הוא המצב העדכני
  try { localStorage.setItem('intake_draft_' + _currentIntakeId, JSON.stringify(draft)); } catch(e) {}
  // sync draft to Firestore for real-time manager view (debounced)
  clearTimeout(window._draftSyncTimer);
  window._draftSyncTimer = setTimeout(async () => {
    if (!_currentIntakeId || !_updateDoc || !_docRef) return;
    try { await _updateDoc(_docRef('intake_assignments', _currentIntakeId), { liveDraft: draft, liveUpdatedAt: new Date().toISOString() }); } catch(e) {}
  }, 1500);
}

/* A photo straight off the camera is several megabytes; the whole of local
   storage is about five. Saving them as they came meant the write failed and
   the photos were quietly lost the moment the form was reopened. The draft copy
   is therefore compressed — the photo that is actually sent is still built from
   the original file at submit time, so nothing is lost in quality. */
const _INTAKE_DRAFT_PX = 700, _INTAKE_DRAFT_Q = 0.6;

let _intakePhotoDraftTimer = null;
// photos are saved whenever one is added or removed, not only when the form is
// closed with the ✕ — leaving any other way used to lose them
function scheduleIntakePhotoDraft() {
  clearTimeout(_intakePhotoDraftTimer);
  _intakePhotoDraftTimer = setTimeout(saveIntakeDraftPhotos, 400);
}
window.scheduleIntakePhotoDraft = scheduleIntakePhotoDraft;

async function saveIntakeDraftPhotos() {
  if (!_currentIntakeId) return;
  const id = _currentIntakeId;
  const _put = (key, value) => {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);   // the last photo was removed
  };
  try {
    const batt = _batteryPhotoFiles?.length
      ? JSON.stringify(await Promise.all(_batteryPhotoFiles.map(f => compressToBase64(f, _INTAKE_DRAFT_PX, _INTAKE_DRAFT_Q))))
      : '';
    const photoData = {};
    for (const key of Object.keys(ciPhotoFiles)) {
      const files = ciPhotoFiles[key] || [];
      if (!files.length) continue;
      photoData[key] = await Promise.all(files.map(f => compressToBase64(f, _INTAKE_DRAFT_PX, _INTAKE_DRAFT_Q)));
    }
    const photos = Object.keys(photoData).length ? JSON.stringify(photoData) : '';
    if (id !== _currentIntakeId) return;   // a different intake was opened meanwhile
    _put('intake_draft_battery_' + id, batt);
    _put('intake_draft_photos_' + id, photos);
    // סנכרון לשרת: כך אותה קליטה נפתחת מלאה גם ממכשיר אחר. אם התמונות
    // כבדות מדי לרשומה — הן נשארות מקומיות בלבד ולא נשלחות חלקית.
    try {
      const bytes = [...Object.values(photoData).flat(), ...(batt ? JSON.parse(batt) : [])]
        .reduce((t, b) => t + _b64Size(b), 0);
      if (_updateDoc && _docRef && bytes <= _DOC_PHOTO_BUDGET) {
        await _updateDoc(_docRef('intake_assignments', id), {
          livePhotos: photoData, liveBatteryPhotos: batt ? JSON.parse(batt) : [],
          liveUpdatedAt: new Date().toISOString(),
        });
      }
    } catch (e) { console.warn('live photo sync', e); }
  } catch(e) {
    console.warn('photo draft save error', e);
    // the driver must know, rather than discover it when he comes back
    showToast('⚠️ התמונות לא נשמרו — סיים את הקליטה בלי לצאת');
  }
}

// תמונות שהגיעו עם הטיוטה (למשל מנסיעת מבחן) נטענות לטופס כקבצים,
// כך שהנהג רואה אותן ויכול להוסיף או להסיר לפני השליחה
function _applyDraftPhotos(photos) {
  if (!photos) return;
  Object.entries(photos).forEach(([key, b64s]) => {
    if (!Array.isArray(b64s) || !b64s.length) return;
    if ((ciPhotoFiles[key] || []).length) return;   // כבר יש תמונות — לא דורסים
    ciPhotoFiles[key] = [];
    b64s.forEach(b64 => {
      fetch(b64).then(r => r.blob()).then(blob => {
        ciPhotoFiles[key].push(new File([blob], 'photo.jpg', { type: blob.type }));
        renderPhotoGrid(key);
        scheduleIntakePhotoDraft();
      }).catch(() => {});
    });
  });
}

/* התמונות שסונכרנו מהשרת נטענות כקבצים, כך שהן נראות וניתנות להסרה
   בדיוק כמו תמונות שצולמו במכשיר הזה. */
function _applyLivePhotos(photos, batteryB64) {
  if (photos && typeof photos === 'object') {
    Object.entries(photos).forEach(([key, b64s]) => {
      if (!Array.isArray(b64s) || !b64s.length) return;
      ciPhotoFiles[key] = [];
      b64s.forEach(b64 => {
        fetch(b64).then(r => r.blob()).then(blob => {
          ciPhotoFiles[key].push(new File([blob], 'photo.jpg', { type: blob.type }));
          renderPhotoGrid(key);
        }).catch(() => {});
      });
    });
  }
  if (Array.isArray(batteryB64) && batteryB64.length && !(_batteryPhotoFiles || []).length) {
    _batteryPhotoFiles = [];
    batteryB64.forEach(b64 => {
      fetch(b64).then(r => r.blob()).then(blob => {
        _batteryPhotoFiles.push(new File([blob], 'battery.jpg', { type: blob.type }));
        addBatteryPhoto({ files: [] });
      }).catch(() => {});
    });
  }
}

/* ── בחירת הטיוטה הנכונה בין המכשירים ──────────────────────────────
   כמה תוכן יש בטיוטה. טיוטה ריקה לא מנצחת טיוטה מלאה רק בגלל שהיא
   נשמרה מאוחר יותר — זה בדיוק מה שגרם לטופס להיראות ריק במכשיר שני. */
function _draftWeight(d) {
  if (!d || typeof d !== 'object') return 0;
  let n = Object.keys(d.checks || {}).length;
  ['km', 'code', 'general', 'batteryMonth', 'evSelection', 'evCharge', 'evRange'].forEach(k => {
    if (String(d[k] || '').trim()) n++;
  });
  Object.values(d.notes || {}).forEach(t => { if (String(t || '').trim()) n++; });
  Object.values(d.photos || {}).forEach(a => { if (Array.isArray(a) && a.length) n++; });
  if (Object.keys(d.dashChecks || {}).length) n++;
  return n;
}

/* מי מנצח: מה שיש בו תוכן. כששניהם מלאים — המאוחר יותר. כששניהם ריקים
   אין מה להחיל. מחזיר את הטיוטה שיש להחיל, או null. */
function _pickFreshestDraft(local, localAt, remote, remoteAt) {
  const lw = _draftWeight(local), rw = _draftWeight(remote);
  if (!rw) return null;                       // אין תוכן בשרת
  if (!lw) return remote;                     // מקומי ריק — השרת מנצח תמיד
  return (remoteAt || 0) > (localAt || 0) ? remote : null;
}
window._draftWeight = _draftWeight;
window._pickFreshestDraft = _pickFreshestDraft;

function _applyIntakeDraftObj(draft) {
  _applyDraftPhotos(draft.photos);
  Object.entries(draft.checks || {}).forEach(([key, val]) => {
    document.querySelectorAll(`#modal-driver-intake .ci-box[data-key="${key}"]`).forEach(b => b.classList.remove('v-active','x-active'));
    const btn = document.querySelector(`#modal-driver-intake .ci-box[data-key="${key}"][data-val="${val}"]`);
    if (btn) {
      btn.classList.add(val === 'v' ? 'v-active' : 'x-active');
      const noteRow = document.getElementById('note-' + key);
      if (noteRow) noteRow.style.display = val === 'x' ? 'block' : 'none';
    }
  });
  Object.entries(draft.notes || {}).forEach(([key, text]) => {
    const ta = document.getElementById('cn-' + key);
    if (ta) ta.value = text;
  });
  if (draft.km)      { const el = document.getElementById('di-km');    if (el) el.value = draft.km; }
  if (draft.code)    { const el = document.getElementById('di-code');  if (el) el.value = draft.code; }
  if (draft.general) { const el = document.getElementById('di-notes'); if (el) el.value = draft.general; }
  if (draft.batteryMonth) { const el = document.getElementById('di-battery-month'); if (el) el.value = draft.batteryMonth; }
  // קביעה ישירה, לא לחיצה — אחרת סנכרון חוזר הופך את הסימון
  _evSet(draft.evSelection === 'v' || draft.isElectric === true ? 'v'
       : draft.evSelection === 'x' ? 'x' : '');
  if (draft.evCharge) { const el = document.getElementById('di-ev-charge'); if (el) el.value = draft.evCharge; }
  if (draft.evRange)  { const el = document.getElementById('di-ev-range');  if (el) el.value = draft.evRange; }
  Object.entries(draft.dashChecks || {}).forEach(([id, checked]) => {
    const el = document.getElementById(id); if (el) { el.checked = checked; }
  });
  if (draft.dashChecks?.['dash-other']) {
    const req = document.getElementById('dash-other-req'); if (req) req.style.display = 'block';
  }
  _sfApply(draft.safetyChecks);
}

let _mgLiveUnsub = null;
let _mgLiveLastEdit = 0;
let _mgLiveMode = false;

async function openManagerIntakeLive(id) {
  clearTimeout(window._draftSyncTimer);
  if (_intakeInputController) { _intakeInputController.abort(); }
  _intakeInputController = new AbortController();
  _currentIntakeId = id;
  // clear form same as openDriverIntake
  document.querySelectorAll('#modal-driver-intake .ci-box').forEach(b => b.classList.remove('v-active','x-active'));
  document.querySelectorAll('#modal-driver-intake .ci-note-row').forEach(r => {
    if (r.querySelector('#file-battery')) return;
    if (r.id === 'battery-date-section') return;
    r.style.display = 'none';
  });
  document.querySelectorAll('#modal-driver-intake textarea, #modal-driver-intake input[type=number], #di-code').forEach(t => t.value = '');
  ['di-ev-v','di-ev-x'].forEach(eid => { const b = document.getElementById(eid); if (b) { b.classList.remove('v-active','x-active'); b.style.color='transparent'; } });
  const _evF = document.getElementById('di-ev-fields'); if (_evF) _evF.style.display = 'none';
  _photoKeys.forEach(k => { ciPhotoFiles[k] = []; renderPhotoGrid(k); });
  _sfApply({}); // opening a new intake must not carry the previous car's ticks

  // live header
  if (_diHeaderUnsub) { _diHeaderUnsub(); _diHeaderUnsub = null; }
  if (_mgLiveUnsub) { _mgLiveUnsub(); _mgLiveUnsub = null; }
  if (_diLiveUnsub) { _diLiveUnsub(); _diLiveUnsub = null; }
  _diLastEdit = 0; _diAppliedAt = 0;

  if (window._CONFIG_DONE) {
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(({ onSnapshot, doc }) => {
      _mgLiveUnsub = onSnapshot(doc(window._db, 'intake_assignments', id), snap => {
        if (!snap.exists()) return;
        const v = snap.data();
        _currentIntakeVehicle = v;
        document.getElementById('di-title').textContent = `👁️ מעקב קליטה – ${v.plate}`;
        document.getElementById('di-vehicle-info').innerHTML =
          `<strong>${esc(v.plate)}</strong> &nbsp;${[v.brand,v.model,v.color,v.year ? 'שנת '+v.year : ''].filter(Boolean).map(esc).join(' • ')}`;
        // apply liveDraft (driver typing) or the TD→intake draft, if manager hasn't edited in the last 3s
        if (Date.now() - _mgLiveLastEdit > 3000) {
          if (v.liveDraft) _applyIntakeDraftObj(v.liveDraft);
          else if (v.draft && Object.keys(v.draft.checks || {}).length) _applyIntakeDraftObj(v.draft);
        }
      });
    });
  }

  _mgLiveMode = true;
  const liveBanner = document.getElementById('di-live-banner');
  if (liveBanner) liveBanner.style.display = 'block';
  const submitBtn = document.querySelector('#modal-driver-intake .btn-submit');
  if (submitBtn) submitBtn.style.display = '';

  openModal('modal-driver-intake');
  // track manager edits — signal ensures old listeners are removed on next intake open
  document.querySelectorAll('#modal-driver-intake textarea, #di-km, #di-code, #di-notes').forEach(el => {
    el.addEventListener('input', () => {
      _mgLiveLastEdit = Date.now();
      saveIntakeDraft();
    }, { signal: _intakeInputController.signal });
  });
}
window.openManagerIntakeLive = openManagerIntakeLive;

/* מצב המאזין החי של טופס הקליטה: המנוי עצמו, מתי המשתמש הקליד לאחרונה
   ומה כבר הוחל — כדי לא לצייר את אותו עדכון פעמיים ולא לדרוס הקלדה. */
let _diLiveUnsub = null, _diLastEdit = 0, _diAppliedAt = 0;

function restoreIntakeDraft(id) {
  try {
    const raw = localStorage.getItem('intake_draft_' + id);
    if (raw) {
      _applyIntakeDraftObj(JSON.parse(raw));
      showToast('✏️ ממשיך מהמצב השמור');
    }
    // photos are restored even when nothing else was filled in — a driver who
    // only took pictures must find them waiting for him
    const batteryB64s = localStorage.getItem('intake_draft_battery_' + id);
    if (batteryB64s) {
      try {
        const b64s = JSON.parse(batteryB64s);
        _batteryPhotoFiles = [];
        window._batteryPhotoUrls = {};
        b64s.forEach(b64 => {
          fetch(b64).then(r=>r.blob()).then(blob => {
            _batteryPhotoFiles.push(new File([blob],'battery.jpg',{type:blob.type}));
            addBatteryPhoto({files:[]});
          });
        });
      } catch(e) {}
    }
    const photosB64 = localStorage.getItem('intake_draft_photos_' + id);
    if (photosB64) {
      try {
        const photoData = JSON.parse(photosB64);
        Object.entries(photoData).forEach(([key, b64s]) => {
          ciPhotoFiles[key] = [];
          b64s.forEach(b64 => {
            fetch(b64).then(r=>r.blob()).then(blob => {
              ciPhotoFiles[key].push(new File([blob],'photo.jpg',{type:blob.type}));
              renderPhotoGrid(key);
            });
          });
        });
      } catch(e) {}
    }
  } catch(e) {}
}

function clearIntakeDraft(id) {
  try {
    localStorage.removeItem('intake_draft_' + id);
    localStorage.removeItem('intake_draft_battery_' + id);
    localStorage.removeItem('intake_draft_photos_' + id);
  } catch(e) {}
}

function getChecklist() {
  const result = {};
  const modal = document.getElementById('modal-driver-intake');
  const keys = [...new Set([...modal.querySelectorAll('.ci-box')].map(b => b.dataset.key))];
  keys.forEach(key => {
    const active = modal.querySelector(`.ci-box[data-key="${key}"].v-active,.ci-box[data-key="${key}"].x-active`);
    result[key] = active ? active.dataset.val : '';
    const noteEl = document.getElementById('cn-' + key);
    if (noteEl && noteEl.value.trim()) result[key + '_note'] = noteEl.value.trim();
  });
  return result;
}

function openNewVehicleModal() {
  ['v-plate','v-brand','v-model','v-color','v-year','v-spot'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('v-fetch-status').textContent = '';
  document.querySelectorAll('.driver-pick-btn').forEach(b => b.classList.remove('selected'));
  openModal('modal-vehicle');
}

function pickDriver(btn) {
  document.querySelectorAll('.driver-pick-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

async function fetchVehicleData() {
  const raw = document.getElementById('v-plate').value.trim().replace(/[^0-9]/g, '');
  if (!raw) return showToast('נא להזין מספר לוחית');
  const status = document.getElementById('v-fetch-status');
  const btn = document.getElementById('btn-fetch-vehicle');
  status.textContent = '⏳ מחפש...';
  btn.disabled = true;
  try {
    const rec = await _plateLookup(raw);
    if (!rec) { status.style.color='var(--danger)'; status.textContent = window._plateRegistryEmpty ? '⏳ מאגר משרד התחבורה בעדכון כרגע — נסו שוב מאוחר יותר או מלאו ידנית' : '❌ לא נמצא רכב עם מספר זה'; return; }
    document.getElementById('v-brand').value = rec.maker;
    document.getElementById('v-model').value = rec.model;
    document.getElementById('v-color').value = rec.color;
    document.getElementById('v-year').value  = rec.year;
    status.style.color = 'var(--success)';
    status.textContent = '✅ פרטים נטענו בהצלחה';
  } catch(e) {
    status.style.color = 'var(--danger)';
    status.textContent = '❌ שגיאה בחיבור לשרת';
  } finally {
    btn.disabled = false;
  }
}

/* ── מגן על כפתורי שליחה ─────────────────────────────────────────────
   פעולה שכותבת לשרת נמשכת כמה שניות ברשת סלולרית. בלי מגן, לחיצה נוספת
   מפעילה אותה שוב ונוצרות כפילויות. הכפתור ננעל, מראה שהוא עובד, ומשתחרר
   בסוף — גם כשהפעולה נכשלת.                                        */
/* פתיחת טופס שנכשלת ברשת נראית למשתמש כאילו הלחיצה לא נקלטה — כלום לא קורה.
   העטיפה נותנת חיווי, מודיעה על תקלה במקום להיעלם בשקט, ומונעת פתיחות כפולות. */
const _openBusy = new Set();
function _wrapOpen(name, label) {
  const fn = window[name];
  if (typeof fn !== 'function' || fn._openWrapped) return;
  const w = async function (...args) {
    const key = name + '|' + String(args[0] ?? '');
    if (_openBusy.has(key)) return;
    _openBusy.add(key);
    const slow = setTimeout(() => showToast('⏳ פותח ' + label + '…', 4000), 600);
    try { return await fn.apply(this, args); }
    catch (e) {
      console.error('open failed', name, e);
      showToast('❌ ' + label + ' לא נפתח (' + (e.code || e.message) + ') — אפשר לנסות שוב', 7000);
    }
    finally { clearTimeout(slow); _openBusy.delete(key); }
  };
  w._openWrapped = true;
  window[name] = w;
}
const _OPEN_GUARDED = [
  ['viewIntakeForm', 'טופס הקליטה'],
  ['viewArchivedIntake', 'הקליטה מהארכיון'],
  ['openManagerIntakeLive', 'צפייה בזמן אמת'],
  ['openDriverIntake', 'טופס הקליטה'],
  ['openEditIntake', 'עריכת הקליטה'],
  ['openRefreshForm', 'טופס הרענון'],
  ['openEditRefresh', 'עריכת הרענון'],
  ['openEditTask', 'עריכת המשימה'],
  ['restorePrevIntake', 'שחזור הקליטה הקודמת'],
  ['resendIntake', 'שליחה מחדש'],
];
window.addEventListener('load', () => _OPEN_GUARDED.forEach(([n, l]) => _wrapOpen(n, l)));

const _busyActions = new Set();
async function _runOnce(key, btn, busyText, fn) {
  if (_busyActions.has(key)) return;
  _busyActions.add(key);
  const el = typeof btn === 'string' ? document.querySelector(btn) : btn;
  const orig = el ? el.innerHTML : '';
  if (el) { el.disabled = true; el.style.opacity = '.6'; if (busyText) el.textContent = busyText; }
  try { return await fn(); }
  catch (e) { console.error('action failed', key, e); showToast('שגיאה: ' + (e.code || e.message), 6000); }
  finally {
    _busyActions.delete(key);
    if (el) { el.disabled = false; el.style.opacity = ''; if (busyText) el.innerHTML = orig; }
  }
}
window._runOnce = _runOnce;

async function submitVehicle() {
  return _runOnce('submitVehicle', '#modal-vehicle .btn-submit', '⏳ שולח...', _submitVehicleInner);
}
window.submitVehicle = submitVehicle;

async function _submitVehicleInner() {
  const plate = document.getElementById('v-plate').value.trim();
  if (!plate) return showToast('נא להזין מספר לוחית');
  const spot = document.getElementById('v-spot').value.trim();
  if (!spot) {
    document.getElementById('v-spot').focus();
    return showToast('נא להזין מספר חניה');
  }
  if (!window._CONFIG_DONE) return showToast('Firebase לא מחובר');
  const driverBtn = document.querySelector('.driver-pick-btn.selected');
  if (!driverBtn) return showToast('נא לבחור נהג קולט');
  const driver = driverBtn.dataset.driver;

  const { getDocs, query, collection, where } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

  // a test drive still awaiting the manager's decision owns this car — the
  // intake must be opened from there so the drive's findings carry over
  const tdSnap = await getDocs(
    query(collection(window._db, 'test_drives'), where('plate','==', plate))
  );
  const openTd = tdSnap.docs.map(d => d.data()).find(d => d.status === 'done');
  if (openTd) {
    return showToast(`⚠️ הרכב ${plate} נמצא במסך נסיעת מבחן בסטטוס "ממתין" — יש לפתוח את הקליטה משם`, 6000);
  }

  // check for duplicate intake (any status) — fetch by plate only, filter client-side
  const snap = await getDocs(
    query(collection(window._db, 'intake_assignments'), where('plate','==', plate))
  );
  const conflict = snap.docs.map(d => d.data()).find(d => ['pending','done','checked'].includes(d.status));
  if (conflict) {
    const stLabel = conflict.status === 'pending' ? 'בתהליך קליטה' : conflict.status === 'done' ? 'בוצעה — ממתינה לבדיקה' : 'נבדקה';
    const driver = conflict.completedBy || conflict.assignedTo || '';
    const ts = conflict.completedAt?.toDate
      ? conflict.completedAt.toDate().toLocaleString('he-IL', { day:'numeric', month:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : conflict.createdAt?.toDate
        ? conflict.createdAt.toDate().toLocaleString('he-IL', { day:'numeric', month:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })
        : '';
    return showToast(`⚠️ לרכב ${plate} כבר נעשתה קליטה (${stLabel})${driver ? ' ע"י ' + driver : ''}${ts ? ' · ' + ts : ''}`, 5000);
  }

  closeModal('modal-vehicle');
  showToast('✅ נשלח לנהג!');

  const _brand = document.getElementById('v-brand').value.trim();
  const _model = document.getElementById('v-model').value.trim();
  await _addDoc(_colRef('intake_assignments'), {
    plate,
    brand:      _brand,
    model:      _model,
    color:      document.getElementById('v-color').value.trim(),
    year:       document.getElementById('v-year').value,
    spot:       document.getElementById('v-spot').value.trim(),
    assignedTo: driver,
    createdBy:  currentUser.name,
    status:     'pending',
    createdAt:  _serverTs()
  });
  _notifyDriver(driver, `🚗 קליטת רכב חדשה ממתינה לך — ${plate} ${_brand} ${_model}. כנס לאפליקציה ענק הרכבים.`);
}

/* ═══════════════════════════════════════════════════════
   PARTS SCREEN
═══════════════════════════════════════════════════════ */
function openPartsScreen() {
  const isManager = currentUser.role === 'manager';
  document.getElementById('parts-user-badge').textContent = currentUser.name;
  document.getElementById('fab-new-part').style.display = isManager ? 'flex' : 'none';
  showScreen('parts');
  loadParts();
}

function filterParts(f, el) {
  partsFilter = f;
  document.querySelectorAll('#screen-parts .ftab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderPartsFromCache();
}

let partsCache = [];

function loadParts() {
  if (!window._CONFIG_DONE) {
    document.getElementById('parts-list-container').innerHTML = demoPartsHTML();
    return;
  }
  if (partsUnsub) partsUnsub();
  const q = _query(_colRef('parts'), _orderBy('requestedAt','desc'));
  partsUnsub = _onSnap(q, snap => {
    partsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPartsFromCache();
  });
}

function renderPartsFromCache() {
  let parts = partsCache;
  if (partsFilter !== 'all') parts = parts.filter(p => p.status === partsFilter);
  const container = document.getElementById('parts-list-container');
  if (!parts.length) {
    container.innerHTML = `<div class="empty-state"><div class="es-icon">🔧</div><h3>אין הזמנות</h3><p>עדיין לא הוגשו בקשות חלקים</p></div>`;
    return;
  }
  const statusLabel = { pending:'ממתין לאישור', ordered:'הוזמן', arrived:'הגיע' };
  container.innerHTML = parts.map(p => {
    const ts = p.requestedAt?.toDate ? p.requestedAt.toDate().toLocaleString('he-IL') : '';
    return `
    <div class="part-card">
      <div class="part-top">
        <div class="part-name">${esc(p.name)}</div>
        <span class="part-status ${p.status}">${statusLabel[p.status]||p.status}</span>
      </div>
      <div class="part-meta">
        ${p.plate ? `<span>🚗 ${esc(p.plate)}</span>` : ''}
        ${p.qty   ? `<span>כמות: ${p.qty}</span>` : ''}
        ${p.supplier ? `<span>ספק: ${esc(p.supplier)}</span>` : ''}
        <span>בוקש ע"י ${esc(p.requestedBy)}</span>
      </div>
      ${p.notes ? `<div class="task-notes" style="margin-top:8px">${esc(p.notes)}</div>` : ''}
      ${ts ? `<div class="task-time">${ts}</div>` : ''}
      ${currentUser.role==='manager' ? `
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button onclick="updatePartStatus('${p.id}','ordered')" style="flex:1;padding:8px;background:#dbeafe;border:none;border-radius:10px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;color:#1e40af">✓ סמן הוזמן</button>
        <button onclick="updatePartStatus('${p.id}','arrived')" style="flex:1;padding:8px;background:#dcfce7;border:none;border-radius:10px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;color:#166534">✓ הגיע</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

function updatePartStatus(id, status) {
  if (!window._CONFIG_DONE) return;
  _updateDoc(_docRef('parts', id), { status });
  showToast(status === 'ordered' ? '📦 סומן כ"הוזמן"' : '✅ סומן כ"הגיע"');
}

function openNewPartModal() {
  ['p-name','p-plate','p-supplier','p-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('p-qty').value = '1';
  openModal('modal-part');
}

async function submitPart() {
  const name = document.getElementById('p-name').value.trim();
  if (!name) return showToast('נא להזין שם חלק');
  if (!window._CONFIG_DONE) return showToast('Firebase לא מחובר');
  await _addDoc(_colRef('parts'), {
    name,
    plate:       document.getElementById('p-plate').value.trim(),
    qty:         document.getElementById('p-qty').value,
    supplier:    document.getElementById('p-supplier').value.trim(),
    notes:       document.getElementById('p-notes').value.trim(),
    status:      'pending',
    requestedBy: currentUser.name,
    requestedAt: _serverTs()
  });
  closeModal('modal-part');
  showToast('✅ בקשה נשלחה!');
}

/* ═══════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════ */
/* ── DEMO HTML (when Firebase not configured) ── */
function demoTasksHTML() {
  return `
  <div class="task-card priority-high">
    <div class="task-top"><div class="task-title">הכנת רכב ללקוח VIP</div><button class="task-done-btn"></button></div>
    <div class="task-meta"><span class="tag assignee">👤 נהג 1</span><span class="tag status-open">פתוחה</span><span class="tag prio-high">גבוהה 🔴</span></div>
  </div>
  <div class="task-card priority-med">
    <div class="task-top"><div class="task-title">שטיפת הרכבים בשורה ג׳</div><button class="task-done-btn"></button></div>
    <div class="task-notes">כל 8 הרכבים בשורה</div>
    <div class="task-meta"><span class="tag assignee">👤 כולם</span><span class="tag status-inprog">בביצוע</span><span class="tag prio-med">בינונית</span></div>
  </div>
  <div class="task-card priority-low done">
    <div class="task-top"><div class="task-title">סידור מגרש קטע ב׳</div><button class="task-done-btn done">✓</button></div>
    <div class="task-meta"><span class="tag assignee">👤 נהג 2</span><span class="tag status-done">הושלמה</span><span class="tag prio-low">נמוכה</span></div>
  </div>`;
}
function demoVehiclesHTML() {
  return `
  <div class="vehicle-card">
    <div class="vehicle-plate">123-45-678</div>
    <div class="vehicle-info">טויוטה קורולה 2022</div>
    <div class="vehicle-meta"><span class="cond-badge cond-תקין">תקין</span><span class="tag assignee">צ׳קליסט: 7/9</span><span>נקלט ע"י מנהל תפעול</span></div>
  </div>
  <div class="vehicle-card">
    <div class="vehicle-plate">987-65-432</div>
    <div class="vehicle-info">קיה ספורטז׳ 2023</div>
    <div class="vehicle-meta"><span class="cond-badge cond-לבדיקה">דרוש בדיקה</span></div>
    <div class="task-notes" style="margin-top:8px">רעש מהמנוע בהנעה</div>
  </div>`;
}
function demoPartsHTML() {
  return `
  <div class="part-card">
    <div class="part-top"><div class="part-name">פילטר שמן</div><span class="part-status pending">ממתין לאישור</span></div>
    <div class="part-meta"><span>🚗 123-45-678</span><span>כמות: 2</span><span>בוקש ע"י מנהל תפעול</span></div>
  </div>
  <div class="part-card">
    <div class="part-top"><div class="part-name">רפידות בלם קדמי</div><span class="part-status ordered">הוזמן</span></div>
    <div class="part-meta"><span>🚗 987-65-432</span><span>ספק: חלקי ענק</span></div>
  </div>`;
}

// expose functions needed by inline onclick
/* ═══════════════════════════════════════════════════════
   INVENTORY SCREEN
═══════════════════════════════════════════════════════ */
let inventoryRows    = []; // [{cells, status}] — preview of newly uploaded file
let inventoryHeaders = [];
let _invUnsub        = null;
let _invMode         = 'live'; // 'live' = showing Firestore data | 'preview' = new upload

function openInventoryScreen() {
  document.getElementById('inventory-user-badge').textContent = currentUser.name;
  inventoryRows = [];
  inventoryHeaders = [];
  _invMode = 'live';
  document.getElementById('inv-file-input').value = '';
  document.getElementById('inv-submit-wrap').style.display = 'none';
  showScreen('inventory');
  loadLastInventoryAssignment();
}

function loadLastInventoryAssignment() {
  if (!window._CONFIG_DONE) return;
  if (_invUnsub) _invUnsub();
  const container  = document.getElementById('inv-list');
  const banner     = document.getElementById('inv-status-banner');
  const doneBanner = document.getElementById('inv-done-banner');
  container.innerHTML = '<div class="loading"><div class="spinner"></div> טוען...</div>';

  // restore saved last-check banner immediately
  const savedBanner = localStorage.getItem('_lastInvBanner');
  if (savedBanner) { doneBanner.style.display = 'block'; doneBanner.innerHTML = savedBanner; }

  // if Firestore doesn't respond in 8s, stop showing an endless spinner
  const _invTimeout = setTimeout(() => {
    if (container.querySelector('.loading')) {
      container.innerHTML = `<div class="empty-state" style="padding:40px 20px;text-align:center;color:#ef4444">⚠️ הטעינה נכשלה — בדוק חיבור ונסה לרענן את הדף</div>`;
    }
  }, 8000);

  _invUnsub = _onSnap(_colRef('inventory_assignments'), snap => {
    clearTimeout(_invTimeout);
    if (_invMode === 'preview') return; // user uploaded new file — don't overwrite
    const mine = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.sentBy === currentUser.name)
      .sort((a,b) => {
        const ta = a.createdAt?.toMillis?.() ?? (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tb = b.createdAt?.toMillis?.() ?? (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tb - ta;
      });

    const last = mine[0];
    if (!last) {
      container.innerHTML = '<div class="empty-state" style="padding:40px 20px;text-align:center;color:var(--muted)">טרם נשלחה בדיקת מלאי</div>';
      banner.style.display = 'none';
      return;
    }

    // Shrink upload zone to a small button
    document.getElementById('inv-upload-zone').style.padding = '10px 16px';
    document.getElementById('inv-delete-btn').dataset.docId = last.id;
    // כפתור הסיום מופיע רק כשהנהג כבר החזיר את הבדיקה
    const finBtn = document.getElementById('inv-finish-btn');
    if (finBtn) { finBtn.dataset.docId = last.id; finBtn.style.display = last.status === 'done' ? '' : 'none'; }

    const rows = last.rowsJson ? JSON.parse(last.rowsJson) : (last.rows || []);
    const headers = last.headers || [];

    if (last.status === 'done') {
      const completedDate = last.completedAt?.toDate ? last.completedAt.toDate() : null;
      const tsDate = completedDate ? completedDate.toLocaleDateString('he-IL') : '';
      const tsTime = completedDate ? completedDate.toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit'}) : '';
      const tsStr = tsDate + (tsTime ? ' · ' + tsTime : '');
      const bannerText = `✅ הבדיקה הושלמה ע"י <strong>${esc(last.completedBy||last.assignedTo)}</strong> · ${tsStr}`;
      doneBanner.style.display = 'block';
      doneBanner.innerHTML = bannerText;
      localStorage.setItem('_lastInvBanner', bannerText);
      banner.style.display = 'none';
      renderInvResult(headers, rows, last.present||[], last.absent||[]);
      // notify manager if this just changed to done
      if (window._lastInvStatus && window._lastInvStatus !== 'done') {
        showToast(`🔔 ${esc(last.completedBy||last.assignedTo)} סיים את בדיקת המלאי — לחץ לצפייה בתוצאות`, 6000);
      }
      window._lastInvStatus = 'done';
    } else {
      const sentDate = last.createdAt?.toDate ? last.createdAt.toDate() : null;
      const ts = sentDate ? sentDate.toLocaleDateString('he-IL') + ' · ' + sentDate.toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit'}) : '';
      banner.style.display = 'block';
      banner.style.background = '#dcfce7';
      banner.style.border = '2px solid #22c55e';
      banner.style.color = '#166534';
      banner.innerHTML = `✅ נשלח לבדיקה ע"י <strong>${esc(last.assignedTo)}</strong> · ${ts} — ממתין לסיום הבדיקה`;
      renderInvPending(headers, rows);
      window._lastInvStatus = 'pending';
    }
  }, err => {
    clearTimeout(_invTimeout);
    console.error('[INVENTORY] listener error', err.code, err.message);
    container.innerHTML = `<div class="empty-state" style="padding:40px 20px;text-align:center;color:#ef4444">⚠️ שגיאת חיבור: ${esc(err.code||err.message)}</div>`;
  });
}

function _clearInventoryUI() {
  document.getElementById('inv-delete-btn').dataset.docId = '';
  const _finBtn = document.getElementById('inv-finish-btn');
  if (_finBtn) { _finBtn.dataset.docId = ''; _finBtn.style.display = 'none'; }
  document.getElementById('inv-list').innerHTML = '';
  document.getElementById('inv-status-banner').style.display = 'none';
  document.getElementById('inv-upload-zone').style.padding = '28px 20px';
  document.getElementById('inv-submit-wrap').style.display = 'none';
  inventoryHeaders = [];
  inventoryRows = [];
  _invMode = 'live';
  window._lastInvStatus = null;
}

/* סיום הבדיקה: הליקויים טופלו, הטבלה מתאפסת, ובמסך הבית נרשם שהבדיקה
   בוצעה היום והכל תקין — גם אחרי שהטבלה עצמה נמחקת. */
async function finishInventoryCheck() {
  const btn = document.getElementById('inv-finish-btn');
  const docId = btn?.dataset.docId;
  if (!docId) return;
  if (!confirm('לסיים את בדיקת המלאי? הטבלה תימחק ובמסך הבית יירשם שהבדיקה בוצעה היום.')) return;
  if (!_requireNet('סיום הבדיקה')) return;
  btn.disabled = true;
  try {
    await window._setDoc(_docRef('config', 'daily_checks'), {
      invDay: _todayKey(), invMissing: 0, invBy: currentUser.name, invFinishedAt: new Date().toISOString(),
    }, { merge: true });
    const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(doc(window._db, 'inventory_assignments', docId));
    _clearInventoryUI();
    showToast('✅ הבדיקה הסתיימה — נרשם שבוצעה היום');
  } catch (e) {
    showToast('שגיאה בסיום הבדיקה: ' + (e.code || e.message), 6000);
  }
  btn.disabled = false;
}
window.finishInventoryCheck = finishInventoryCheck;

async function deleteInventoryTable() {
  const btn = document.getElementById('inv-delete-btn');
  const docId = btn.dataset.docId;
  if (!docId) return;
  if (!confirm('למחוק את טבלת המלאי הנוכחית?')) return;
  const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await deleteDoc(doc(window._db, 'inventory_assignments', docId));
  _clearInventoryUI();
  showToast('🗑️ הטבלה נמחקה');
}

function renderInvPending(headers, rows) {
  const colCount = headers.length || (rows[0]?.length || 1);
  let html = `<div style="font-weight:700;font-size:14px;color:var(--muted);margin-bottom:10px">${rows.length} שורות — ממתין לנהג</div>`;
  if (headers.length) {
    html += `<div style="display:grid;grid-template-columns:48px repeat(${colCount},1fr);gap:4px;background:var(--dark);color:#fff;border-radius:10px 10px 0 0;padding:8px 10px;font-size:12px;font-weight:700;direction:rtl"><div style="text-align:center">סטטוס</div>${headers.map(h=>`<div>${esc(h)}</div>`).join('')}</div>`;
  }
  html += rows.map((cells,i) => `<div style="display:grid;grid-template-columns:48px repeat(${colCount},1fr);gap:4px;align-items:center;background:#fff;border:2px solid var(--border);border-radius:${headers.length&&i===0?'0':'8px'};padding:8px 10px;margin-bottom:4px;direction:rtl"><div style="text-align:center;color:#aaa;font-size:18px">—</div>${cells.map(c=>`<div style="font-size:14px;font-weight:600">${esc(c)}</div>`).join('')}</div>`).join('');
  document.getElementById('inv-list').innerHTML = html;
}

let _invResultData = null; // cache for filter

function renderInvResult(headers, rows, present, absent) {
  _invResultData = { headers, rows, present, absent };
  _renderInvResultFiltered('all');
}

function filterInvResult(filter) {
  _renderInvResultFiltered(filter);
}

function _renderInvResultFiltered(filter) {
  if (!_invResultData) return;
  const { headers, rows, present, absent } = _invResultData;
  const presentSet = new Set(present);
  const colCount = headers.length || (rows[0]?.length || 1);

  const activeStyle = 'cursor:pointer;border-radius:8px;padding:6px 12px;font-weight:700;font-size:13px;border:2px solid transparent';
  const presentActive = filter === 'present' ? 'border-color:#166534' : '';
  const absentActive  = filter === 'absent'  ? 'border-color:#991b1b' : '';
  const allActive     = filter === 'all'     ? 'text-decoration:underline' : '';

  let html = `<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap">
    <span onclick="filterInvResult('present')" style="${activeStyle};background:#dcfce7;color:#166534;${presentActive}">✓ נמצאו: ${present.length}</span>
    <span onclick="filterInvResult('absent')"  style="${activeStyle};background:#fee2e2;color:#991b1b;${absentActive}">✕ חסרים: ${absent.length}</span>
    <span onclick="filterInvResult('all')"     style="${activeStyle};background:#f1f5f9;color:#333;${allActive}">הכל</span>
  </div>`;

  const filtered = rows.filter(cells => {
    const key = cells.join(' | ');
    if (filter === 'present') return presentSet.has(key);
    if (filter === 'absent')  return !presentSet.has(key);
    return true;
  });

  if (headers.length) {
    html += `<div style="display:grid;grid-template-columns:48px repeat(${colCount},1fr);gap:4px;background:var(--dark);color:#fff;border-radius:10px 10px 0 0;padding:8px 10px;font-size:12px;font-weight:700;direction:rtl"><div style="text-align:center">סטטוס</div>${headers.map(h=>`<div>${esc(h)}</div>`).join('')}</div>`;
  }
  html += filtered.map((cells,i) => {
    const key = cells.join(' | ');
    const st = presentSet.has(key) ? 'v' : 'x';
    const bg = st==='v' ? '#f0fff4' : '#fff0f0';
    const border = st==='v' ? '#22c55e' : '#ef4444';
    const icon = st==='v' ? '<span style="color:#22c55e;font-size:20px;font-weight:900">✓</span>' : '<span style="color:#ef4444;font-size:20px;font-weight:900">✕</span>';
    return `<div style="display:grid;grid-template-columns:48px repeat(${colCount},1fr);gap:4px;align-items:center;background:${bg};border:2px solid ${border};border-radius:${headers.length&&i===0?'0':'8px'};padding:8px 10px;margin-bottom:4px;direction:rtl"><div style="text-align:center">${icon}</div>${cells.map(c=>`<div style="font-size:14px;font-weight:600">${esc(c)}</div>`).join('')}</div>`;
  }).join('');
  document.getElementById('inv-list').innerHTML = html;
}

// הטבלה תמיד מסודרת לפי א-ב של היצרן, ובתוך כל יצרן לפי הדגם — לא משנה
// אם השורות הגיעו מקובץ אקסל או מהדבקת מלל
function sortInventoryRows() {
  const mfrIdx = inventoryHeaders.findIndex(h => String(h).includes('יצרן'));
  // "דגם" בלבד, כדי שלא ייתפס "תת דגם" במקומו
  const mdlIdx = inventoryHeaders.findIndex(h => {
    const s = String(h).trim();
    return s.includes('דגם') && !s.includes('תת');
  });
  if (mfrIdx < 0 && mdlIdx < 0) return;
  inventoryRows.sort((a, b) => {
    const get = (r, i) => (i >= 0 ? (r.cells[i] || '') : '');
    const cmp = get(a, mfrIdx).localeCompare(get(b, mfrIdx), 'he');
    if (cmp !== 0) return cmp;
    return get(a, mdlIdx).localeCompare(get(b, mdlIdx), 'he');
  });
}

function handleInventoryFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    showToast('⏳ טוען ספריית Excel, נסה שוב...');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      // filter out completely empty rows
      const nonEmpty = rows.map(r => r.map(c => String(c).trim())).filter(r => r.some(c => c !== ''));
      if (!nonEmpty.length) { showToast('הקובץ ריק'); return; }
      // check if first row is a header (no cell looks like a plate number)
      const firstRow = nonEmpty[0];
      if (firstRow.some(v => /\d/.test(v))) {
        inventoryHeaders = [];
        inventoryRows = nonEmpty.map(r => ({ cells: r, status: null }));
      } else {
        inventoryHeaders = firstRow;
        inventoryRows = nonEmpty.slice(1).map(r => ({ cells: r, status: null }));
      }
      if (!inventoryRows.length) { showToast('לא נמצאו שורות בקובץ'); return; }
      sortInventoryRows();
      renderInventoryList();
    } catch(err) {
      console.error('handleInventoryFile error', err);
      showToast('שגיאה בקריאת הקובץ: ' + (err.message || err));
    }
  };
  reader.onerror = e => showToast('שגיאה בפתיחת הקובץ');
  reader.readAsArrayBuffer(file);
}

/* ── הוספת מלאי לפי מלל ─────────────────────────────────────────── */
// העמודות שהמערכת עובדת איתן. כל מה שמודבק מתורגם אליהן, ומה שלא מתאים
// (למשל עמודת "פתח כרטיס") פשוט נזרק.
const _INV_COLS = ['רישוי', 'יצרן', 'דגם', 'תת דגם', 'שנה', 'צבע', 'סטטוס'];
// סדר החיפוש חשוב: "תת דגם" נבדק לפני "דגם", אחרת הוא ייתפס בטעות
const _INV_SYN = [
  ['תת דגם', ['תת דגם', 'תת-דגם', 'רמת גימור', 'גימור']],
  ['רישוי',  ['רישוי', 'מספר רכב', 'מס רכב', 'מס. רכב', 'לוחית', 'מספר רישוי']],
  ['יצרן',   ['יצרן', 'תוצר', 'מותג', 'יצרן רכב']],
  ['דגם',    ['דגם', 'מודל']],
  ['שנה',    ['שנה', 'שנת ייצור', 'שנתון']],
  ['צבע',    ['צבע']],
  ['סטטוס',  ['סטטוס', 'מיקום', 'מצב']],
];

// גרשיים עוטפות מגיעות מהעתקה של קובץ; גרש בתוך מילה הוא חלק מהשם
// עצמו (ג'יפ, סח'נין) ואסור למחוק אותו
const _invNorm = s => String(s == null ? '' : s).trim().replace(/^["']+|["']+$/g, '').trim();
const _invIsPlate = s => /^\d[\d-]{4,10}$/.test(_invNorm(s));
const _invIsYear  = s => /^(19|20)\d{2}$/.test(_invNorm(s));
const _invJunk    = s => /^(פתח כרטיס|כרטיס|צפייה|עריכה)$/.test(_invNorm(s));

function _invSplitRow(line) {
  if (line.includes('\t')) return line.split('\t');
  if (/\s{2,}/.test(line)) return line.split(/\s{2,}/);
  if (line.includes('|'))  return line.split('|');
  if (line.includes(','))  return line.split(',');
  return [line];
}

// מחזיר, לכל עמודה שלנו, את מיקומה בשורה שהודבקה — או null אם אין כותרות
function _invMapHeader(cells) {
  const norm = cells.map(_invNorm);
  const map = {}; const used = new Set();
  for (const [col, words] of _INV_SYN) {
    const i = norm.findIndex((c, idx) => !used.has(idx) && c && words.some(w => c === w || c.includes(w)));
    if (i >= 0) { map[col] = i; used.add(i); }
  }
  return Object.keys(map).length >= 2 ? map : null;
}

// בלי כותרות: מזהים רישוי ושנה לפי הצורה שלהם, והשאר לפי הסדר שבטבלה
function _invRowByShape(cells) {
  const rest = cells.filter(c => !_invJunk(c));
  const out = {};
  let pi = rest.findIndex(_invIsPlate);
  if (pi >= 0) { out['רישוי'] = rest[pi]; rest.splice(pi, 1); }
  let yi = rest.findIndex(_invIsYear);
  if (yi >= 0) { out['שנה'] = rest[yi]; rest.splice(yi, 1); }
  const order = ['יצרן', 'דגם', 'תת דגם', 'צבע'];
  order.forEach((col, i) => { if (rest[i] != null) out[col] = _invNorm(rest[i]); });
  return out;
}

function parseInventoryText(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [] };

  let map = _invMapHeader(_invSplitRow(lines[0]));
  const body = map ? lines.slice(1) : lines;

  const rows = [];
  let pendingStatus = '';
  for (const line of body) {
    const cells = _invSplitRow(line).map(_invNorm);
    const clean = cells.filter(c => c !== '' && !_invJunk(c));
    if (!clean.length) continue;
    // בהעתקה מטבלה הסטטוס ("במגרש" וכדומה) נופל לשורה נפרדת מעל הרכב.
    // שורת רכב אמיתית נושאת מספר רישוי, או לפחות שלושה שדות; שורה בודדת
    // בלי מספר רישוי היא הסטטוס של הרכב שמופיע אחריה.
    if (!clean.some(_invIsPlate) && clean.length < 3) { pendingStatus = clean.join(' '); continue; }
    const got = map
      ? Object.fromEntries(_INV_COLS.map(c => [c, map[c] != null ? (cells[map[c]] || '') : '']))
      : _invRowByShape(cells);
    if (!got['סטטוס'] && pendingStatus) got['סטטוס'] = pendingStatus;
    pendingStatus = '';
    // שורה בלי שום זיהוי אינה שורת רכב
    if (!_INV_COLS.some(c => got[c])) continue;
    rows.push(_INV_COLS.map(c => got[c] || ''));
  }
  return { rows };
}
window.parseInventoryText = parseInventoryText;

function openInvPaste() {
  const t = document.getElementById('inv-paste-text');
  if (t) t.value = '';
  const st = document.getElementById('inv-paste-status');
  if (st) st.textContent = '';
  openModal('modal-inv-paste');
}
window.openInvPaste = openInvPaste;

function applyInvPaste() {
  const st = document.getElementById('inv-paste-status');
  const say = (t, ok) => { if (st) { st.textContent = t; st.style.color = ok ? 'var(--success)' : '#b91c1c'; } };
  const { rows } = parseInventoryText(document.getElementById('inv-paste-text').value);
  if (!rows.length) return say('לא זוהו שורות רכב במלל שהודבק', false);

  // מצטרף לטבלה הקיימת אם היא באותן עמודות, אחרת פותח טבלה חדשה
  const same = inventoryHeaders.length === _INV_COLS.length
    && inventoryHeaders.every((h, i) => _invNorm(h) === _INV_COLS[i]);
  if (!same) { inventoryHeaders = [..._INV_COLS]; inventoryRows = []; }
  rows.forEach(cells => inventoryRows.push({ cells, status: null }));
  sortInventoryRows();

  closeModal('modal-inv-paste');
  renderInventoryList();
  showToast(`✅ נוספו ${rows.length} רכבים`);
}
window.applyInvPaste = applyInvPaste;

function renderInventoryList() {
  _invMode = 'preview';
  const container = document.getElementById('inv-list');
  const hasCols = inventoryHeaders.length > 0;
  const colCount = hasCols ? inventoryHeaders.length : (inventoryRows[0]?.cells.length || 1);
  const banner = document.getElementById('inv-status-banner');
  banner.style.display = 'block';
  banner.style.background = '#f0f2ff';
  banner.style.border = '2px solid var(--primary, #6366f1)';
  banner.style.color = '#3730a3';
  banner.innerHTML = `📋 טבלה חדשה מוכנה לשליחה — ${inventoryRows.length} שורות`;
  // restore last-completed banner so manager can still see who ran the last check
  const savedBanner = localStorage.getItem('_lastInvBanner');
  const doneBanner = document.getElementById('inv-done-banner');
  if (doneBanner && savedBanner) { doneBanner.style.display = 'block'; doneBanner.innerHTML = savedBanner; }

  let html = '';
  if (hasCols) {
    html += `<div style="display:grid;grid-template-columns:repeat(${colCount},1fr);gap:4px;background:var(--dark);color:#fff;border-radius:10px 10px 0 0;padding:8px 10px;font-size:12px;font-weight:700;direction:rtl">${inventoryHeaders.map(h=>`<div>${esc(h)}</div>`).join('')}</div>`;
  }
  html += inventoryRows.map((item,i) => `<div style="display:grid;grid-template-columns:repeat(${colCount},1fr);gap:4px;align-items:center;background:#fff;border:2px solid var(--border);border-radius:${hasCols&&i===0?'0':'8px'};padding:8px 10px;margin-bottom:4px;direction:rtl">${item.cells.map(c=>`<div style="font-size:14px;font-weight:600">${esc(c)}</div>`).join('')}</div>`).join('');

  container.innerHTML = html;
  document.getElementById('inv-submit-wrap').style.display = 'block';
}

async function submitInventory() {
  if (!inventoryRows.length) { showToast('טען קובץ תחילה'); return; }
  const driver = document.getElementById('inv-driver-select').value;
  if (!driver) { showToast('בחר נהג לפני שליחה'); return; }
  if (!window._CONFIG_DONE) { showToast('Firebase לא מחובר'); return; }
  if (!_addDoc || !_colRef) { showToast('שגיאה: Firebase לא אותחל'); return; }
  showToast('⏳ שולח...');
  try {
    // deep-clean: convert everything to plain strings, strip undefined/null/special Excel values
    const safeHeaders = (inventoryHeaders||[]).map(h => (h == null ? '' : String(h)));
    // Firestore doesn't support nested arrays — serialize rows as JSON string
    const rowsJson = JSON.stringify(
      (inventoryRows||[]).map(r => (r.cells||[]).map(c => (c == null ? '' : String(c))))
    );
    const writeP = _addDoc(_colRef('inventory_assignments'), {
      assignedTo: driver,
      sentBy:     currentUser.name,
      createdAt:  _serverTs(),
      headers:    safeHeaders,
      rowsJson,
      status:     'pending'
    });
    await Promise.race([
      writeP,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))
    ]);
    _invMode = 'live';
    document.getElementById('inv-submit-wrap').style.display = 'none';
    showToast(`✅ נשלח ל${driver} לבדיקה!`);
    _notifyDriver(driver, `📦 נשלחה אליך בדיקת מלאי חדשה. כנס לאפליקציה ענק הרכבים.`);
  } catch(e) {
    console.error('submitInventory error', e);
    showToast('שגיאה: ' + (e.code || e.message));
  }
}

/* ── DRIVER INVENTORY ── */
let _driverInvRows = [];   // [{cells, status}] for current open assignment
let _driverInvDocId = null;

function openDriverInventoryScreen() {
  showScreen('driver-inventory');
  document.getElementById('dinv-user-badge').textContent = currentUser.name;
  loadDriverInventoryAssignments();
}

let _dinvUnsub = null;
function loadDriverInventoryAssignments() {
  if (_dinvUnsub) _dinvUnsub();
  const container = document.getElementById('dinv-list');
  container.innerHTML = '<div class="loading"><div class="spinner"></div> טוען...</div>';
  const _dinvTimeout = setTimeout(() => {
    if (container.querySelector('.loading')) {
      container.innerHTML = `<div class="empty-state" style="padding:40px 20px;text-align:center;color:#ef4444">⚠️ הטעינה נכשלה — בדוק חיבור ונסה לרענן את הדף</div>`;
    }
  }, 8000);
  _dinvUnsub = _onSnap(_colRef('inventory_assignments'), snap => {
    clearTimeout(_dinvTimeout);
    const docs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.assignedTo === currentUser.name && d.status === 'pending');
    if (!docs.length) {
      container.innerHTML = '<div class="empty-state" style="padding:40px 20px;text-align:center;color:var(--muted)">אין בדיקות מלאי ממתינות 👍</div>';
      return;
    }
    container.innerHTML = docs.map(d => {
      const ts = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString('he-IL') : '';
      return `<div class="vehicle-card" onclick="openDriverInvModal('${d.id}')" style="cursor:pointer;margin-bottom:12px">
        <div class="vehicle-plate" style="font-size:16px">📦 בדיקת מלאי</div>
        <div class="vehicle-info">נשלח ע"י ${esc(d.sentBy||'')} · ${ts}</div>
        <div class="vehicle-meta"><span class="cond-badge" style="background:#fef3c7;color:#92400e">${d.rowsJson ? JSON.parse(d.rowsJson).length : (d.rows?.length||0)} שורות לבדיקה</span></div>
      </div>`;
    }).join('');
  }, err => {
    clearTimeout(_dinvTimeout);
    console.error('[DRIVER INVENTORY] listener error', err.code, err.message);
    container.innerHTML = `<div class="empty-state" style="padding:40px 20px;text-align:center;color:#ef4444">⚠️ שגיאת חיבור: ${esc(err.code||err.message)}</div>`;
  });
}

function _dinvSaveProgress() {
  if (!_driverInvDocId) return;
  const statuses = _driverInvRows.map(r => r.status);
  localStorage.setItem('_dinvProgress_' + _driverInvDocId, JSON.stringify(statuses));
}

function openDriverInvModal(docId) {
  _onSnap(_docRef('inventory_assignments', docId), snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    _driverInvDocId = docId;
    const parsedRows = data.rowsJson ? JSON.parse(data.rowsJson) : (data.rows || []);
    // restore saved progress if exists
    const saved = localStorage.getItem('_dinvProgress_' + docId);
    const savedStatuses = saved ? JSON.parse(saved) : null;
    _driverInvRows = parsedRows.map((cells, i) => ({ cells, status: savedStatuses?.[i] ?? null }));
    _dinvSortMode = 0;
    _dinvOrder = null;
    const sortBtn = document.getElementById('dinv-sort-btn');
    if (sortBtn) sortBtn.textContent = '↕️ סדר הכל';
    renderDriverInvModal(data.headers || []);
    openModal('modal-driver-inv');
  });
}

// 0 = original order, 1 = unmarked first, 2 = marked first
let _dinvSortMode = 0;
let _dinvOrder = null; // frozen row order — recomputed only when the sort button is pressed, so marking a row mid-list doesn't jump it around
function _dinvComputeOrder() {
  let order2 = _driverInvRows.map((_, i) => i);
  if (_dinvSortMode === 1) order2.sort((a, b) => (_driverInvRows[a].status ? 1 : 0) - (_driverInvRows[b].status ? 1 : 0));
  else if (_dinvSortMode === 2) order2.sort((a, b) => (_driverInvRows[b].status ? 1 : 0) - (_driverInvRows[a].status ? 1 : 0));
  _dinvOrder = order2;
}
function cycleDinvSort() {
  _dinvSortMode = (_dinvSortMode + 1) % 3;
  const btn = document.getElementById('dinv-sort-btn');
  const labels = ['↕️ סדר הכל', '⬜ לא סומנו קודם', '✅ סומנו קודם'];
  if (btn) btn.textContent = labels[_dinvSortMode];
  _dinvComputeOrder();
  const headers = JSON.parse(document.getElementById('dinv-headers-cache').value || '[]');
  renderDriverInvModal(headers);
}
window.cycleDinvSort = cycleDinvSort;

function renderDriverInvModal(headers) {
  // Reorder columns: buttons | plate | vehicle-status | rest
  // הטבלה מגיעה גם מקובץ אקסל ("מספר רכב") וגם מהדבקת מלל ("רישוי"),
  // ושני השמות צריכים להיתפס — אחרת עמודת הרישוי נשארת צרה ונחתכת
  const plateIdx  = headers.findIndex(h => /מספר|רישוי|לוחית/.test(String(h)));
  const statusIdx = headers.findIndex(h => /סטטוס|מיקום/.test(String(h)));
  const order = [];
  if (plateIdx  >= 0) order.push(plateIdx);
  if (statusIdx >= 0) order.push(statusIdx);
  headers.forEach((_, i) => { if (i !== plateIdx && i !== statusIdx) order.push(i); });
  // עמודה שכל תאיה ריקים רק מצרה את השורה בטלפון — היא לא מוצגת
  const keep = i => i === plateIdx || i === statusIdx
    || _driverInvRows.some(r => String(r.cells[i] ?? '').trim() !== '');
  const shown = order.filter(keep);
  order.length = 0; order.push(...shown);

  const reorder = arr => order.map(i => arr[i] ?? '');
  const orderedHeaders = reorder(headers);
  const colCount = orderedHeaders.length || (_driverInvRows[0]?.cells.length || 1);
  // give wide columns to דגם and צבע, narrow to the rest
  const _cw = h => (/דגם|צבע/.test(h) ? 100 : /מספר|רישוי|לוחית/.test(h) ? 90 : 48);
  const colWidths = ['80px', ...orderedHeaders.map(h => `minmax(${_cw(h)}px,${_cw(h) >= 90 ? 1.4 : 1}fr)`)];
  const colW = colWidths.join(' ');
  const minW = (80 + orderedHeaders.reduce((s, h) => s + _cw(h), 0)) + 'px';
  let html = '';
  if (orderedHeaders.length) {
    html += `<div style="display:grid;grid-template-columns:${colW};min-width:${minW};gap:2px;background:var(--dark);color:#fff;border-radius:10px 10px 0 0;padding:5px 6px;font-size:10px;font-weight:700;direction:rtl">
      <div style="text-align:center">סימון</div>${orderedHeaders.map(h => `<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h)}</div>`).join('')}
    </div>`;
  }
  if (!_dinvOrder || _dinvOrder.length !== _driverInvRows.length) _dinvComputeOrder();
  const order2 = _dinvOrder;
  html += order2.map(i => {
    const item = _driverInvRows[i];
    const orderedCells = reorder(item.cells);
    // highlight non-מגרש rows (check original statusIdx cell)
    const vehicleStatus = statusIdx >= 0 ? String(item.cells[statusIdx] || '').trim() : '';
    // "מגרש" ו-"במגרש" הם אותו דבר — רק רכב שאיננו במגרש נצבע בכתום
    const notInLot = vehicleStatus && !/^ב?מגרש$/.test(vehicleStatus);
    const border = item.status ? (item.status==='v'?'#22c55e':'#ef4444') : (notInLot ? '#f59e0b' : 'var(--border)');
    const bg = item.status==='v' ? '#f0fff4' : item.status==='x' ? '#fff0f0' : (notInLot ? '#fffbeb' : '#fff');
    return `<div id="dinv-row-${i}" style="display:grid;grid-template-columns:${colW};min-width:${minW};gap:2px;align-items:center;background:${bg};border:2px solid ${border};border-radius:8px;padding:4px 5px;margin-bottom:2px;direction:rtl">
      <div style="display:flex;gap:2px;justify-content:center">
        <button onclick="dinvClick(${i},'v')" style="width:34px;height:34px;border-radius:7px;border:2px solid ${item.status==='v'?'#22c55e':'#ccc'};background:${item.status==='v'?'#22c55e':'#f9f9f9'};font-size:16px;cursor:pointer;font-weight:900;color:${item.status==='v'?'#fff':'#555'}">✓</button>
        <button onclick="dinvClick(${i},'x')" style="width:34px;height:34px;border-radius:7px;border:2px solid ${item.status==='x'?'#ef4444':'#ccc'};background:${item.status==='x'?'#ef4444':'#f9f9f9'};font-size:16px;cursor:pointer;font-weight:900;color:${item.status==='x'?'#fff':'#555'}">✕</button>
      </div>
      ${orderedCells.map(c => `<div style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c)}</div>`).join('')}
    </div>`;
  }).join('');
  document.getElementById('dinv-rows-container').innerHTML = html;
  document.getElementById('dinv-headers-cache').value = JSON.stringify(headers);
}

function dinvClick(idx, val) {
  _driverInvRows[idx].status = _driverInvRows[idx].status === val ? null : val;
  _dinvSaveProgress();
  const headers = JSON.parse(document.getElementById('dinv-headers-cache').value || '[]');
  renderDriverInvModal(headers);
  document.getElementById(`dinv-row-${idx}`)?.scrollIntoView({ block: 'nearest' });
}

function dinvMarkAll(val) {
  _driverInvRows.forEach(r => r.status = val);
  const headers = JSON.parse(document.getElementById('dinv-headers-cache').value || '[]');
  renderDriverInvModal(headers);
}

async function submitDriverInv() {
  const missing = _driverInvRows.filter(r => !r.status);
  if (missing.length) {
    showToast(`נותרו ${missing.length} שורות ללא סימון`);
    const idx = _driverInvRows.indexOf(missing[0]);
    document.getElementById(`dinv-row-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (!window._CONFIG_DONE) { showToast('Firebase לא מחובר'); return; }
  if (!_driverInvDocId) { showToast('שגיאה: אין מסמך פתוח'); return; }
  showToast('⏳ שולח...');
  try {
    const present = _driverInvRows.filter(r => r.status === 'v').map(r => r.cells.join(' | '));
    const absent  = _driverInvRows.filter(r => r.status === 'x').map(r => r.cells.join(' | '));
    const notes = (document.getElementById('dinv-notes')?.value || '').trim();
    await _updateDoc(_docRef('inventory_assignments', _driverInvDocId), {
      status: 'done', completedBy: currentUser.name, completedAt: _serverTs(), present, absent,
      ...(notes ? { notes } : {})
    });
    // סימון יומי נפרד מהבדיקה עצמה — כדי שהמנהל יראה "נבדק הבוקר"
    // במסך הבית גם אחרי שהוא מוחק את הבדיקה שהנהג שלח
    try {
      await window._setDoc(_docRef('config', 'daily_checks'), {
        invDay: _todayKey(), invMissing: absent.length, invBy: currentUser.name,
      }, { merge: true });
    } catch (e) { console.warn('daily_checks mark failed', e); }
    localStorage.removeItem('_dinvProgress_' + _driverInvDocId);
    _setCardBadge('driver-inventory', 0);
    _driverInvDocId = null;
    _driverInvRows = [];
    const notesEl = document.getElementById('dinv-notes');
    if (notesEl) notesEl.value = '';
    _notifyDriver('ליאל', `📦 ${currentUser.name} סיים בדיקת מלאי`);
    const btn = document.getElementById('dinv-submit-btn');
    if (btn) {
      btn.textContent = '🏠 חזור למסך הבית';
      btn.style.background = '#22c55e';
      btn.onclick = () => { closeModal('modal-driver-inv'); goHome(); };
    }
  } catch(e) {
    console.error('submitDriverInv error', e);
    showToast('שגיאה: ' + (e.code || e.message));
  }
}

/* ═══════════════════════════════════════════════════════
   CAR TYPE MODAL (after vehicle submit)
═══════════════════════════════════════════════════════ */
const CAR_TYPES = [
  { icon: '🚗', label: 'פרטית' },
  { icon: '🚙', label: 'שטח' },
  { icon: '🚐', label: 'מסחרית' },
  { icon: '🚌', label: 'ואן' },
];

function openCarTypeModal() {
  document.getElementById('car-type-grid').innerHTML = CAR_TYPES.map(t => `
    <button onclick="selectCarType('${t.label}')"
      style="background:#f0f2ff;border:2px solid var(--border);border-radius:14px;padding:18px 10px;
             font-family:Heebo,sans-serif;font-size:15px;font-weight:700;cursor:pointer;
             display:flex;flex-direction:column;align-items:center;gap:6px">
      <span style="font-size:32px">${t.icon}</span>${t.label}
    </button>
  `).join('');
  openModal('modal-car-type');
}

async function selectCarType(type) {
  closeModal('modal-car-type');
  if (window._CONFIG_DONE && window._lastVehicleDocRef) {
    await _updateDoc(window._lastVehicleDocRef, { carType: type });
  }
  showToast(`✅ רכב נקלט! סוג: ${type}`);
}

function filterVehiclesByDriver(name) {
  window._vehicleDriverFilter = (window._vehicleDriverFilter === name) ? null : name;
  if (_intakeCache !== null) _renderIntakeList(_intakeCache);
}

window.filterVehiclesByDriver = filterVehiclesByDriver;

let _zoomPlate = '';

function openPhotoZoom(url, plate) {
  _zoomPlate = plate || '';
  const img = document.getElementById('photo-zoom-img');
  img.src = url;
  _resetZoom();
  img.style.transform = 'scale(1)';
  document.getElementById('photo-zoom-overlay').style.display = 'flex';
}
function closePhotoZoom() {
  document.getElementById('photo-zoom-overlay').style.display = 'none';
}

async function downloadWithWatermark() {
  const img = document.getElementById('photo-zoom-img');
  const plate = _zoomPlate;
  const canvas = document.createElement('canvas');
  // Wait for image to be loaded
  await new Promise(res => { if (img.complete) res(); else img.onload = res; });
  canvas.width  = img.naturalWidth  || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  if (plate) {
    const fontSize = Math.max(28, Math.round(canvas.width * 0.06));
    ctx.font = `900 ${fontSize}px Heebo, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    // shadow for readability
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(plate, canvas.width / 2, canvas.height - 18);
    // draw again for crisp look
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText(plate, canvas.width / 2, canvas.height - 20);
  }

  const a = document.createElement('a');
  a.download = plate ? `קליטה-${plate}.jpg` : 'תמונת-קליטה.jpg';
  a.href = canvas.toDataURL('image/jpeg', 0.95);
  a.click();
}

window.openPhotoZoom = openPhotoZoom;
window.closePhotoZoom = closePhotoZoom;
window.downloadWithWatermark = downloadWithWatermark;

function toggleIntakeArchive() {
  const body = document.getElementById('intake-archive-body');
  const icon = document.getElementById('archive-toggle-icon');
  const open = body.style.display === 'none';
  body.style.display = open ? 'block' : 'none';
  icon.style.transform = open ? 'rotate(180deg)' : '';
}
window.toggleIntakeArchive = toggleIntakeArchive;

function filterArchive() {
  const q = document.getElementById('archive-search').value.trim();
  document.querySelectorAll('#intake-archive-list [data-plate]').forEach(card => {
    card.style.display = (!q || card.dataset.plate.includes(q)) ? 'block' : 'none';
  });
}
window.filterArchive = filterArchive;
window.viewIntakeForm = viewIntakeForm;
window.deleteIntake = deleteIntake;
window.openEditIntake = openEditIntake;
window.saveEditIntake = saveEditIntake;
window._eiToggle = _eiToggle;
function eiEvToggle(cb) {
  const f = document.getElementById('ei-ev-fields');
  if (f) f.style.display = cb.checked ? 'block' : 'none';
  saveEiLive();
}
window.eiEvToggle = eiEvToggle;

function saveEiLive() {
  const id = document.getElementById('ei-id')?.value;
  if (!id) return;
  clearTimeout(window._eiLiveTimer);
  window._eiLiveTimer = setTimeout(async () => {
    try {
      const snap = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
        .then(({getDoc, doc}) => getDoc(doc(window._db, 'intake_assignments', id)));
      const existing = snap.exists() ? (snap.data().liveDraft || {}) : {};
      const merged = Object.assign({}, existing, {
        isElectric: !!(document.getElementById('ei-is-electric')?.checked),
        evCharge:   document.getElementById('ei-ev-charge')?.value  || '',
        evRange:    document.getElementById('ei-ev-range')?.value   || '',
      });
      await _updateDoc(_docRef('intake_assignments', id), { liveDraft: merged, liveUpdatedAt: new Date().toISOString() });
    } catch(e) { console.warn('saveEiLive error', e); }
  }, 800);
}
window.saveEiLive = saveEiLive;
window.openDriverIntake = openDriverIntake;
window.submitDriverIntake = submitDriverIntake;
window.ciClick = ciClick;
