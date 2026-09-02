/* ולאדי, סרטון, ארון מצברים ובדיקה חודשית
   חלק 9 מתוך 13 של אפליקציית התפעול.
   הקבצים נטענים לפי הסדר ומתנהגים בדיוק כמו קובץ אחד — אין לשנות את הסדר. */
window.bsmAddPhotoPicked = bsmAddPhotoPicked;

/* ── סרטון תיעוד לפחחות ─────────────────────────────────────────────
   שני מסלולים לקבלת סרטון:
   1. המצלמה הפנימית (הראשי) — הזרם הגולמי מהחיישן מוקלט אצלנו,
      ברזולוציה המקסימלית שהמכשיר נותן ובקצב סיביות גבוה. iOS דוחס רק
      סרטונים שעוברים דרך המנגנונים שלו (צילום דפדפן / בחירת גלריה);
      קובץ שנוצר כאן לא עובר דרכם, ולכן שומר על האיכות.
   2. בחירה מהגלריה (משני) — iOS ידחוס. הרזולוציה שמתקבלת מוצגת.
   הקובץ נשלח לקבוצה כ-document — בייט-בבייט, טלגרם לא נוגע בו.       */
let _bsmVideoFile = null, _bsmVideoInfo = null;

function _bsmRenderVideo() {
  const w = document.getElementById('bsm-video-wrap');
  if (!w) return;
  if (_bsmVideoFile) {
    const mb = (_bsmVideoFile.size / 1048576).toFixed(1);
    const i = _bsmVideoInfo || {};
    const meta = [i.w ? `${i.w}×${i.h}` : '', i.sec ? `${Math.round(i.sec)} שנ׳` : '', mb + 'MB'].filter(Boolean).join(' · ');
    w.innerHTML = `<div style="display:flex;align-items:center;gap:10px;border:2px solid #16a34a;border-radius:12px;padding:10px 12px;background:#f0fdf4">
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:13px">🎥 סרטון מוכן לשליחה</div>
          <div style="font-size:12px;font-weight:700;color:var(--muted);direction:ltr;text-align:right">${meta}</div>
        </div>
        <button type="button" onclick="bsmClearVideo()" style="background:#ef4444;color:#fff;border:none;border-radius:8px;width:30px;height:30px;cursor:pointer;flex-shrink:0">🗑</button>
      </div>`;
  } else {
    w.innerHTML = `
      <button type="button" onclick="bsrOpen()" style="width:100%;background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:12px;font-family:Heebo,sans-serif;font-weight:800;font-size:15px;cursor:pointer">🎥 צלם סרטון (איכות גבוהה)</button>
      <button type="button" onclick="document.getElementById('bsm-video-file').click()" style="width:100%;margin-top:6px;background:var(--surface2);color:var(--muted);border:1.5px dashed var(--border);border-radius:10px;padding:8px;font-family:Heebo,sans-serif;font-weight:700;font-size:12px;cursor:pointer">🖼 או בחר מהגלריה (iOS מוריד איכות)</button>`;
  }
}

function _videoDims(file) {
  return new Promise(resolve => {
    try {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => { resolve({ w: v.videoWidth, h: v.videoHeight, sec: v.duration }); URL.revokeObjectURL(v.src); };
      v.onerror = () => resolve(null);
      v.src = URL.createObjectURL(file);
      setTimeout(() => resolve(null), 4000);
    } catch (e) { resolve(null); }
  });
}

async function bsmPickVideo(input) {
  const f = input.files[0];
  input.value = '';
  if (!f) return;
  if (f.size > 50 * 1048576) { showToast('⚠️ הסרטון גדול מ-50MB ולא יישלח בטלגרם. צלם קצר יותר.', 7000); return; }
  _bsmVideoFile = f;
  _bsmVideoInfo = await _videoDims(f);
  _bsmRenderVideo();
  _bsmStartVideoUpload();
}
window.bsmPickVideo = bsmPickVideo;
function bsmClearVideo() { _bsmVideoFile = null; _bsmVideoInfo = null; _bsmUpl = null; _bsmRenderVideo(); }
window.bsmClearVideo = bsmClearVideo;

/* המקליט הפנימי */
let _bsrStream = null, _bsrRec = null, _bsrChunks = [], _bsrBlob = null, _bsrMime = '';
let _bsrTick = null, _bsrT0 = 0, _bsrLastFrame = 0, _bsrElapsedSec = 0;
// השוואת פיקסלים: שעון הפריימים של הדפדפן לא תמיד מדווח אמת ב-iOS,
// אז בודקים את התמונה עצמה — מצלמה אמיתית אף פעם לא מחזירה שני צילומים
// זהים בית-בבית (רעש חיישן), ולכן זהות מוחלטת = תמונה קפואה
let _bsrPixPrev = null, _bsrPixSame = 0;
function _bsrGrabPix(videoEl) {
  try {
    if (!videoEl.videoWidth) return null;
    const c = _bsrGrabPix._c || (_bsrGrabPix._c = document.createElement('canvas'));
    c.width = 48; c.height = 27;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(videoEl, 0, 0, 48, 27);
    return ctx.getImageData(0, 0, 48, 27).data;
  } catch (e) { return null; }
}
function _bsrPixEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 8) if (a[i] !== b[i]) return false;
  return true;
}
// ‎1080p/8Mbps הפיל את מקודד הווידאו של iOS באופן עקבי סביב שנייה 17 —
// הפריימים פשוט מפסיקים להגיע בעוד השמע ממשיך (מגבלת משאבים מתועדת של
// ספארי). ‎720p זה פחות מחצי מהעומס, ואם גם זה נחנק — יורדים עוד שלב,
// והבחירה נשמרת במכשיר כדי שהכישלון לא יחזור בהקלטה הבאה.
const _BSR_LEVELS = [
  { w: 1280, h: 720, bps: 5_000_000, label: '720p' },
  { w: 960,  h: 540, bps: 3_000_000, label: '540p' },
];
let _bsrLvl = _BSR_LEVELS[0];
// אזהרות השווא של הבודק הישן הורידו איכות שלא בצדק — איפוס חד-פעמי
if (!localStorage.getItem('bsrQfix1')) { localStorage.removeItem('bsrQ'); localStorage.setItem('bsrQfix1', '1'); }
function _bsrPickLevel() {
  const n = Math.min(+(localStorage.getItem('bsrQ') || 0), _BSR_LEVELS.length - 1);
  _bsrLvl = _BSR_LEVELS[n];
  return _bsrLvl;
}
function _bsrStepDown() {
  const n = +(localStorage.getItem('bsrQ') || 0);
  if (n < _BSR_LEVELS.length - 1) localStorage.setItem('bsrQ', String(n + 1));
}
const _BSR_MAX_BYTES = 45 * 1048576;         // עצירה אוטומטית לפני תקרת טלגרם

async function bsrOpen() {
  _bsrBlob = null; _bsrChunks = [];
  try {
    const lvl = _bsrPickLevel();
    // בלי מיקרופון כלל — הסרטונים לתיעוד נשלחים ללא קול
    _bsrStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: lvl.w }, height: { ideal: lvl.h }, frameRate: { ideal: 30 } },
    });
  } catch (e) {
    return showToast('אין גישה למצלמה: ' + (e.message || e.name), 6000);
  }
  const set = _bsrStream.getVideoTracks()[0]?.getSettings?.() || {};
  const q = document.getElementById('bsr-quality');
  if (q) q.textContent = set.width ? `${set.width}×${set.height} · ${Math.round(_bsrLvl.bps / 1e6)}Mbps` : '';
  const prev = document.getElementById('bsr-preview');
  prev.srcObject = _bsrStream;
  prev.style.display = 'block';
  // שעון-פריימים: כל פריים חדש מהמצלמה מעדכן חותמת. אם החותמת מפסיקה
  // להתקדם תוך כדי הקלטה — המצלמה קפאה (iOS עושה את זה בלי להודיע),
  // והמעקב בלולאת הטיימר עוצר את ההקלטה מיד במקום להמשיך עם פריים קפוא.
  _bsrLastFrame = Date.now();
  if (prev.requestVideoFrameCallback) {
    const onFrame = () => { _bsrLastFrame = Date.now(); if (_bsrStream) prev.requestVideoFrameCallback(onFrame); };
    prev.requestVideoFrameCallback(onFrame);
  }
  const vTrack = _bsrStream.getVideoTracks()[0];
  if (vTrack) vTrack.onended = vTrack.onmute = () => {
    if (_bsrRec?.state === 'recording') { showToast('⚠️ המצלמה נעצרה ע״י המכשיר — הסרטון נשמר עד כאן', 6000); _bsrStepDown(); _bsrRec.stop(); }
  };
  document.getElementById('bsr-review').style.display = 'none';
  document.getElementById('bsr-controls').style.display = 'flex';
  document.getElementById('bsr-review-controls').style.display = 'none';
  const t = document.getElementById('bsr-timer'); if (t) t.textContent = '';
  const m = document.getElementById('bsr-scan-msg'); if (m) m.innerHTML = '';
  // מנעול מסך: בלי זה iOS מעמעם ונועל את המסך באמצע צילום — נעילה
  // אוטומטית של 30 שניות חותכת כל סרטון ארוך ממנה
  try { _bsrWake = await navigator.wakeLock?.request('screen'); } catch (e) { _bsrWake = null; }
  openModal('modal-bsr');
}
window.bsrOpen = bsrOpen;
let _bsrWake = null;

function _bsrPickMime() {
  // וידאו בלבד — בלי רכיב שמע בהגדרת הפורמט
  const opts = ['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=h264', 'video/webm'];
  for (const m of opts) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
  return '';
}

function bsrToggleRec() {
  if (_bsrRec && _bsrRec.state === 'recording') { _bsrRec.stop(); return; }
  if (!_bsrStream) return;
  _bsrChunks = [];
  _bsrMime = _bsrPickMime();
  try {
    _bsrRec = new MediaRecorder(_bsrStream, {
      ...(_bsrMime ? { mimeType: _bsrMime } : {}),
      videoBitsPerSecond: _bsrLvl.bps,
    });
  } catch (e) { return showToast('המכשיר לא תומך בהקלטה: ' + e.message, 6000); }
  _bsrRec.ondataavailable = ev => { if (ev.data && ev.data.size) _bsrChunks.push(ev.data); };
  _bsrRec.onstop = _bsrOnStop;
  // ריקון הבאפר כל שנייה: בהקלטה רציפה לבאפר אחד ספארי מפסיק לכתוב
  // פריימים אחרי ~20 שניות (השמע ממשיך והסרטון קופא) — נמדד בשטח בכל
  // רמות האיכות. עם ריקון קבוע הכתיבה לא נתקעת. הגודל מוערך לפי זמן.
  _bsrRec.start(1000);
  _bsrT0 = Date.now();
  _bsrPixPrev = null; _bsrPixSame = 0;
  const btn = document.getElementById('bsr-rec-btn');
  if (btn) { btn.textContent = '⏹'; btn.style.background = '#111'; }
  _bsrTick = setInterval(() => {
    const sec = (Date.now() - _bsrT0) / 1000;
    const estBytes = _bsrLvl.bps / 8 * sec;
    const t = document.getElementById('bsr-timer');
    const si = Math.floor(sec);
    if (t) t.textContent = `● ${Math.floor(si / 60)}:${String(si % 60).padStart(2, '0')} · ~${(estBytes / 1048576).toFixed(0)}MB`;
    // עצירה לפני מגבלת ה-50MB של טלגרם, שלא יילך סרטון לפח
    if (estBytes > _BSR_MAX_BYTES && _bsrRec?.state === 'recording') {
      showToast('הגעת לגבול הגודל — ההקלטה נעצרה ונשמרה', 5000);
      _bsrRec.stop();
    }
    // המצלמה קפאה — אין פריים חדש כבר 1.5 שניות תוך כדי הקלטה
    if (_bsrLastFrame && Date.now() - _bsrLastFrame > 1500 && _bsrRec?.state === 'recording') {
      showToast('⚠️ המצלמה קפאה — הסרטון נשמר עד רגע הקפיאה. צלם המשך אם צריך.', 7000);
      _bsrStepDown();
      _bsrRec.stop();
    }
    // שכבה שנייה: התמונה בתצוגה זהה לחלוטין 2 שניות ברצף = קפואה,
    // גם אם שעון הפריימים ממשיך לדווח כאילו הכל תקין
    const pix = _bsrGrabPix(document.getElementById('bsr-preview'));
    if (pix) {
      _bsrPixSame = _bsrPixEqual(pix, _bsrPixPrev) ? _bsrPixSame + 1 : 0;
      _bsrPixPrev = pix;
      if (_bsrPixSame >= 4 && _bsrRec?.state === 'recording') {
        showToast('⚠️ המצלמה קפאה — הסרטון נשמר עד רגע הקפיאה. צלם המשך אם צריך.', 7000);
        _bsrStepDown();
        _bsrRec.stop();
      }
    }
  }, 500);
}
window.bsrToggleRec = bsrToggleRec;

/* סריקת קפיאה על הקובץ המוקלט: התקלה האמיתית היא שהפריימים נגמרים
   באמצע בעוד השמע ממשיך. לכן שואלים את הנגן מהי חותמת הזמן של הפריים
   שמוצג כשקופצים לסוף הסרטון — אם הוא רחוק מהסוף ביותר מ-2.5 שניות,
   הווידאו קטוע. בלי השוואת פיקסלים: ב-iOS קפיצה בסרטון מציירת לפעמים
   את הפריים הקודם, והשוואת פיקסלים שם מזייפת אזהרות על סרטון תקין. */
async function _bsrScanFreeze(url, fallbackSec) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  // חייב להיות בעמוד (לא display:none) כדי שהנגן יציג פריימים; שקוף ומחוץ למסך
  v.style.cssText = 'position:fixed;left:-9999px;top:0;width:4px;height:4px;opacity:0';
  document.body.appendChild(v);
  try {
    await new Promise(res => { v.onloadedmetadata = res; v.onerror = res; setTimeout(res, 3000); });
    const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : fallbackSec;
    if (!dur || dur < 4 || !v.requestVideoFrameCallback) return null;
    let frames = 0, live = true;
    const onF = () => { frames++; if (live) v.requestVideoFrameCallback(onF); };
    v.requestVideoFrameCallback(onF);
    // בכל נקודת בדיקה מנגנים ~0.7 שנייה וסופרים פריימים שהוצגו בפועל.
    // בקובץ קטוע השמע מריץ את הנגן קדימה אבל אפס פריימים מגיעים.
    const probe = async t => {
      await new Promise(res => {
        let d = false; const f = () => { if (!d) { d = true; res(); } };
        v.onseeked = f; setTimeout(f, 1500);
        try { v.currentTime = t; } catch (e) { f(); }
      });
      const c0 = frames, t0 = v.currentTime;
      try { await v.play(); } catch (e) { return null; }
      await new Promise(r => setTimeout(r, 700));
      v.pause();
      if (v.currentTime - t0 < 0.25) return null;   // הנגן לא רץ — אין מדידה
      // הקפיצה עצמה מציגה פריים אחד גם באזור קפוא; ניגון תקין (30fps)
      // מציג עשרות ב-0.7 שנייה. פחות מ-3 = אין וידאו חי בנקודה הזאת.
      return frames - c0 >= 3;
    };
    let lastOk = 0;
    for (const t of [dur * 0.2, dur * 0.45, dur * 0.7, Math.max(0, dur - 3)]) {
      const ok = await probe(t);
      if (ok === false) {
        // צמצום לנקודת הקפיאה: חיפוש בין הנקודה התקינה האחרונה לקפואה
        let lo = lastOk, hi = t;
        for (let i = 0; i < 3 && hi - lo > 2; i++) {
          const mid = (lo + hi) / 2;
          if (await probe(mid) === false) hi = mid; else lo = mid;
        }
        live = false;
        return hi;
      }
      if (ok === true) lastOk = t;
    }
    live = false;
    return null;
  } finally { try { v.pause(); } catch (e) {} v.remove(); v.removeAttribute('src'); }
}

function _bsrOnStop() {
  clearInterval(_bsrTick); _bsrTick = null;
  _bsrElapsedSec = _bsrT0 ? (Date.now() - _bsrT0) / 1000 : 0;
  const btn = document.getElementById('bsr-rec-btn');
  if (btn) { btn.textContent = '⏺'; btn.style.background = '#dc2626'; }
  // בספארי הנתחים האחרונים מגיעים לפעמים רק אחרי אירוע העצירה —
  // ממתינים עד שמספר הנתחים מתייצב, אחרת החלק האחרון של הסרטון נחתך
  let waited = 0, lastCount = -1;
  const finalize = () => {
    if (waited < 2000 && (_bsrChunks.length === 0 || _bsrChunks.length !== lastCount)) {
      lastCount = _bsrChunks.length;
      waited += 250;
      return setTimeout(finalize, 250);
    }
    _bsrFinish();
  };
  finalize();
}

function _bsrFinish() {
  _bsrBlob = new Blob(_bsrChunks, { type: _bsrMime || 'video/mp4' });
  if (!_bsrBlob.size) return showToast('ההקלטה יצאה ריקה — נסה שוב');
  // תצוגה מקדימה לאישור לפני שימוש
  const rv = document.getElementById('bsr-review');
  rv.src = URL.createObjectURL(_bsrBlob);
  document.getElementById('bsr-preview').style.display = 'none';
  rv.style.display = 'block';
  document.getElementById('bsr-controls').style.display = 'none';
  document.getElementById('bsr-review-controls').style.display = 'flex';
  // בדיקה אוטומטית של הקובץ שהוקלט, לפני שבוחרים להשתמש בו
  const msg = document.getElementById('bsr-scan-msg');
  if (msg) msg.innerHTML = '<div style="color:#9ca3af;font-size:13px;font-weight:700;text-align:center">🔍 בודק שהסרטון תקין…</div>';
  _bsrScanFreeze(rv.src, _bsrElapsedSec).then(fz => {
    if (!msg) return;
    if (fz != null) _bsrStepDown();   // הצילום הבא ירוץ באיכות שהמכשיר עומד בה
    msg.innerHTML = fz != null
      ? `<div style="background:#7f1d1d;color:#fff;border-radius:10px;padding:10px 12px;font-size:14px;font-weight:900;text-align:center">⚠️ הסרטון קפוא בערך משנייה ${Math.round(fz)} — צלם שוב, האיכות הותאמה אוטומטית למכשיר</div>`
      : '<div style="color:#4ade80;font-size:13px;font-weight:800;text-align:center">✅ הסרטון נבדק — תקין לכל האורך</div>';
  }).catch(() => { if (msg) msg.innerHTML = ''; });
}

function bsrRetake() {
  // האיכות ירדה בעקבות קפיאה — הזרם הפתוח עדיין ברמה הישנה, ולכן
  // פותחים את המצלמה מחדש ברמה החדשה במקום להמשיך עם אותו זרם
  const stored = Math.min(+(localStorage.getItem('bsrQ') || 0), _BSR_LEVELS.length - 1);
  if (_BSR_LEVELS[stored] !== _bsrLvl) { bsrClose(); bsrOpen(); return; }
  const rv = document.getElementById('bsr-review');
  if (rv.src) { URL.revokeObjectURL(rv.src); rv.removeAttribute('src'); }
  _bsrBlob = null;
  rv.style.display = 'none';
  document.getElementById('bsr-preview').style.display = 'block';
  document.getElementById('bsr-controls').style.display = 'flex';
  document.getElementById('bsr-review-controls').style.display = 'none';
  const t = document.getElementById('bsr-timer'); if (t) t.textContent = '';
  const m = document.getElementById('bsr-scan-msg'); if (m) m.innerHTML = '';
}
window.bsrRetake = bsrRetake;

async function bsrUse() {
  if (!_bsrBlob) return;
  const ext = (_bsrMime || '').includes('webm') ? 'webm' : 'mp4';
  _bsmVideoFile = new File([_bsrBlob], `car-${Date.now()}.${ext}`, { type: _bsrBlob.type });
  _bsmVideoInfo = await _videoDims(_bsmVideoFile);
  bsrClose();
  _bsmRenderVideo();
  _bsmStartVideoUpload();
}
window.bsrUse = bsrUse;

// מסך כבה / מעבר אפליקציה — הזרם ימות ממילא; עצירה שומרת את מה שצולם
document.addEventListener('visibilitychange', () => {
  if (document.hidden && _bsrRec?.state === 'recording') {
    showToast('ההקלטה נעצרה כי המסך נסגר — הסרטון נשמר', 5000);
    try { _bsrRec.stop(); } catch (e) {}
  }
});

function bsrClose() {
  try { if (_bsrRec && _bsrRec.state === 'recording') _bsrRec.stop(); } catch (e) {}
  try { _bsrWake?.release(); } catch (e) {}
  _bsrWake = null;
  clearInterval(_bsrTick); _bsrTick = null;
  if (_bsrStream) { _bsrStream.getTracks().forEach(t => t.stop()); _bsrStream = null; }
  const rv = document.getElementById('bsr-review');
  if (rv?.src) { URL.revokeObjectURL(rv.src); rv.removeAttribute('src'); }
  const pv = document.getElementById('bsr-preview'); if (pv) pv.srcObject = null;
  closeModal('modal-bsr');
}
window.bsrClose = bsrClose;

// השליחה לקבוצה — כ-document, בייט-בבייט, בלי דחיסה של טלגרם
async function _bsmSendVideoToGroup(file, plate, desc) {
  const contacts = await _loadDriverContacts();
  const chatId = (contacts['_pahachVideoChat']?.value || '').trim();
  if (!chatId) throw new Error('לא נבחרה קבוצת פחחות בהגדרות');
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', [plate, desc].filter(Boolean).join(' · '));
  // sendVideo של ה-Bot API לא דוחס — הדחיסה המפורסמת של טלגרם קורית רק
  // באפליקציה כששולחים "כמדיה". דרך הבוט הקובץ עולה כמו שהוא, ומוצג
  // בקבוצה כסרטון שמתנגן במקום, לא ככרטיס קובץ.
  form.append('video', file, file.name || 'video.mp4');
  form.append('supports_streaming', 'true');
  const i = _bsmVideoInfo;
  if (i?.w) { form.append('width', String(i.w)); form.append('height', String(i.h)); }
  if (i?.sec && isFinite(i.sec)) form.append('duration', String(Math.round(i.sec)));
  const data = await _telegramApi('sendVideo', form);
  if (data._noToken) throw new Error('אין טוקן טלגרם');
  if (!data.ok) throw new Error(data.description || 'שליחה נכשלה');
}

// העלאה ברקע: הסרטון מתחיל לעלות לקבוצה ברגע שהוא מצורף, בזמן שממלאים
// את שאר הפתק. "צור פתק" רק מחכה לסיום — לרוב זה כבר מוכן, בלי המתנה.
let _bsmUpl = null;
function _bsmStartVideoUpload() {
  if (!_bsmVideoFile) return;
  const plate = document.getElementById('bsm-plate')?.value.replace(/\D/g, '') || '';
  const desc = document.getElementById('bsm-desc')?.value.trim() || '';
  const u = { key: plate + '|' + desc };
  u.promise = _bsmSendVideoToGroup(_bsmVideoFile, plate, desc);
  u.promise.catch(() => {});   // הכשל מטופל בעת יצירת הפתק, עם ניסיון חוזר
  _bsmUpl = u;
}

window.bsmClearPhoto = bsmClearPhoto;

async function submitBsmSend() {
  const plate = document.getElementById('bsm-plate').value.replace(/\D/g, '');
  const desc = document.getElementById('bsm-desc').value.trim();
  const note = document.getElementById('bsm-note').value.trim();
  if (!plate) return showToast('נא להזין מספר רישוי');
  if (!_bsmPicked.length) return showToast('נא לבחור לפחות חלק אחד');
  if (!_bsmVideoFile) return showToast('חובה לצרף סרטון תיעוד לפני יצירת הפתק');

  // הסרטון חייב להגיע לקבוצה לפני שהפתק נוצר. אם ההעלאה שהתחילה ברקע
  // הסתיימה — אין המתנה בכלל; אם נכשלה — ניסיון שני כאן.
  const btn = document.getElementById('bsm-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '🎥 שולח סרטון…'; }
  try {
    if (_bsmUpl) {
      try { await _bsmUpl.promise; } catch (e) { await _bsmSendVideoToGroup(_bsmVideoFile, plate, desc); _bsmUpl.key = plate + '|' + desc; }
      if (_bsmUpl.key !== plate + '|' + desc) {
        // הפרטים שונו אחרי שהסרטון כבר עלה — הודעת שיוך במקום העלאה כפולה
        const contacts = await _loadDriverContacts();
        const chatId = (contacts['_pahachVideoChat']?.value || '').trim();
        const fd = new FormData();
        fd.append('chat_id', chatId);
        fd.append('text', '↑ הסרטון שייך לרכב: ' + [plate, desc].filter(Boolean).join(' · '));
        await _telegramApi('sendMessage', fd);
      }
    } else {
      await _bsmSendVideoToGroup(_bsmVideoFile, plate, desc);
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '📝 צור פתק'; }
    return showToast('⚠️ הפתק לא נוצר — הסרטון לא נשלח: ' + e.message, 9000);
  }
  _bsmUpl = null;
  _bsmVideoFile = null; _bsmVideoInfo = null;
  if (btn) { btn.disabled = false; btn.textContent = '📝 צור פתק'; }

  // תמונת מצב של הטופס, סגירה מיידית, וכתיבה ברקע — בלי דיליי
  const snap = {
    plate, desc, note, maker: _bsmMaker,
    thumb: _bsmThumb, focus: _bsmFocus, photo: _bsmPhoto,
    items: _bshopSortNames(_bsmPicked).map(name => ({ name, price: null })),
    // רשימה נפרדת לגמרי — היא לא נכנסת ל-items של הפחח
    vladi: _bshopSortNames(_bsmVladi),
  };
  _bsmVladi = [];
  closeModal('modal-bsm-send');
  showToast('✅ הסרטון נשלח והפתק נוצר');

  // כתיבת הפתק ברקע
  try {
    const ref = await _addDoc(_colRef('bodyshop_jobs'), {
      plate: snap.plate, desc: snap.desc, note: snap.note, maker: snap.maker,
      ...(snap.thumb ? { photoThumb: snap.thumb } : {}),
      ...(snap.focus ? { photoFocus: snap.focus } : {}),
      items: snap.items,
      ...(snap.vladi.length ? { vladiItems: snap.vladi } : {}),
      status: 'draft', paidAt: null, sentAt: null,
      createdBy: currentUser.name, createdAt: _serverTs()
    });
    // משימה לולאדי — נפתחת רק כשסומנו חלקים, ואינה נוגעת בפתק של הפחח
    if (snap.vladi.length) {
      try {
        await _addDoc(_colRef('tasks'), {
          title: [snap.plate, snap.desc].filter(Boolean).join(' · '),
          notes: 'חלקים לולאדי: ' + snap.vladi.join(', '),
          assignedTo: 'ולאדי',
          label: 'ולאדי',
          status: 'open',
          fromBodyshop: ref?.id || '',
          createdBy: currentUser.name,
          createdAt: _serverTs(),
        });
        showToast('🧰 נפתחה משימה לולאדי');
      } catch (e) {
        console.error('vladi task', e);
        showToast('⚠️ הפתק נוצר אבל המשימה לולאדי נכשלה — אפשר לפתוח אותה ידנית', 8000);
      }
    }
    // התמונה המלאה במסמך נפרד, נטענת רק כשפותחים רכב
    if (snap.photo && ref?.id) {
      const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      try { await setDoc(_docRef('bodyshop_photos', ref.id), { photo: snap.photo }); }
      catch (e) {
        console.error('bodyshop photo save', e);
        await _updateDoc(_docRef('bodyshop_jobs', ref.id), { photoFailed: true }).catch(() => {});
        showToast('⚠️ הפתק נשמר אבל התמונה לא נשמרה — אפשר לצרף שוב', 7000);
      }
    }
  } catch (e) { showToast('⚠️ שגיאה בשמירת הפתק: ' + (e.code || e.message), 8000); }
}
window.submitBsmSend = submitBsmSend;

// Settling marks every returned job as paid, which is what clears both screens
// and starts the next cycle. Cars still at the shop are deliberately untouched.
/* The whole open account on one page: every car, every part and the totals.
   It is printed the same way the repair form is, so "save as PDF" in the print
   window produces the file. */
function bsmExportPdf() {
  const ret = _bshopJobs.filter(j => j.status === 'returned');
  if (!ret.length) return showToast('אין רכבים לייצוא');
  const ils = n => Math.round(n).toLocaleString('he-IL') + ' ₪';
  const sum = ret.reduce((t, j) => t + _bshopTotal(j), 0);
  const vat = sum * _VAT_RATE;
  const today = new Date().toLocaleDateString('he-IL');

  const cars = ret.map(j => {
    const rows = (j.items || []).map(it => `<tr>
        <td>${esc(it.name)}${it.addedByShop ? ' <span class="add">(הוסיף איברהים)</span>' : ''}</td>
        <td class="p">${it.price == null || it.price === '' ? '—' : ils(Number(it.price))}</td>
      </tr>`).join('');
    // the parts first, the car's total under them — the way the page is read
    return `<div class="car">
      <div class="ch"><span>${esc(j.plate || '')}${j.desc ? ' · ' + esc(j.desc) : ''}</span></div>
      ${j.note ? `<div class="note">📝 ${esc(j.note)}</div>` : ''}
      <table>${rows}</table>
      <div class="csum"><span>סה״כ לרכב</span><span>${ils(_bshopTotal(j))}</span></div>
    </div>`;
  }).join('');

  _printHtml(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>חשבון פחחות ${today}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: Arial, "Segoe UI", sans-serif; color:#000; }
  h1 { font-size:22px; margin:0 0 4px; }
  .sub { font-size:13px; color:#444; margin-bottom:16px; }
  .car { border:1.5px solid #000; border-radius:6px; padding:8px 10px; margin-bottom:10px; page-break-inside:avoid; }
  .ch { display:flex; justify-content:space-between; font-weight:bold; font-size:15px; margin-bottom:4px; }
  .note { font-size:12px; background:#fff3c4; padding:3px 6px; margin-bottom:4px; }
  table { width:100%; border-collapse:collapse; }
  td { font-size:13px; padding:3px 0; border-bottom:1px solid #ddd; }
  td.p { text-align:left; white-space:nowrap; font-weight:bold; width:90px; }
  .add { font-size:11px; color:#92400e; }
  .csum { display:flex; justify-content:space-between; font-weight:bold; font-size:15px; margin-top:6px; padding-top:5px; border-top:1.5px solid #000; }
  .tot { margin-top:14px; border-top:2px solid #000; padding-top:8px; page-break-inside:avoid; }
  .tot div { display:flex; justify-content:space-between; font-size:14px; padding:2px 0; }
  .tot .big { font-size:18px; font-weight:bold; border-top:1px solid #000; margin-top:6px; padding-top:6px; }
</style></head><body>
  <h1>חשבון פחחות — ${esc(_BSHOP_SHOP)}</h1>
  <div class="sub">${esc(_BSHOP_OWNER)} · הופק ב-${today} · ${ret.length} רכבים</div>
  ${cars}
  <div class="tot">
    <div><span>סכום לתשלום</span><span>${ils(sum)}</span></div>
    <div><span>מע״מ ${Math.round(_VAT_RATE * 100)}%</span><span>${ils(vat)}</span></div>
    <div class="big"><span>סה״כ כולל מע״מ</span><span>${ils(sum + vat)}</span></div>
  </div>
</body></html>`, 'bodyshop pdf', 'שגיאה בייצוא');
}
window.bsmExportPdf = bsmExportPdf;

async function bsmSettle() {
  const ret = _bshopJobs.filter(j => j.status === 'returned');
  if (!ret.length) return;
  const sum = ret.reduce((s, j) => s + _bshopTotal(j), 0);
  if (!confirm(`לסגור חשבון על ${ret.length} רכבים בסך ${sum.toLocaleString('he-IL')} ₪?\n\nהם ייעלמו מהמסך של הפחח וממסך זה.`)) return;
  const stamp = new Date().toISOString();
  const dateStr = new Date().toLocaleDateString('he-IL');
  try {
    // the folder is written first, so a payment is never lost even if marking
    // the jobs as paid fails half way through
    await _addDoc(_colRef('bodyshop_archive'), {
      title: 'עד ' + dateStr,
      paidAt: stamp,
      total: sum,
      // the parts ride along, so the repair card can be reopened years later
      cars: ret.map(j => ({ id: j.id, plate: j.plate, desc: j.desc || '', note: j.note || '',
                            items: (j.items || []).map(it => ({ name: it.name, price: it.price ?? null, ...(it.addedByShop ? { addedByShop: true } : {}) })),
                            total: _bshopTotal(j) })),
      createdBy: currentUser.name, createdAt: _serverTs()
    });
    // batched so closing a month with hundreds of cars is one short round trip
    // per chunk instead of hundreds of separate writes
    const { writeBatch } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    for (let i = 0; i < ret.length; i += 400) {
      const batch = writeBatch(window._db);
      for (const j of ret.slice(i, i + 400)) {
        batch.update(_docRef('bodyshop_jobs', j.id), { paidAt: stamp, paidTotal: _bshopTotal(j) });
      }
      await batch.commit();
    }
    showToast(`💰 נסגר חשבון על ${sum.toLocaleString('he-IL')} ₪`);
  } catch (e) { showToast('שגיאה: ' + (e.code || e.message)); }
}
window.bsmSettle = bsmSettle;

/* הסכום כמשוואה אחת בשורה: לפני מע״מ + מע״מ = כולל מע״מ.
   כל מספר עם התווית שלו מתחתיו, כדי שברור מה כל אחד מהם. */
function _bsmVatEquation(total) {
  const base = Number(total) || 0, vat = base * _VAT_RATE;
  const part = (val, label, gold) => `<div style="text-align:center">
      <div style="font-size:15.5px;font-weight:900${gold ? ';color:var(--gold)' : ''}">${_fmtIls(val)}</div>
      <div style="font-size:10px;font-weight:700;color:var(--muted);margin-top:-1px">${label}</div>
    </div>`;
  const sign = op => `<div style="font-size:15px;font-weight:900;color:var(--muted)">${op}</div>`;
  return `<div style="display:flex;align-items:flex-start;justify-content:flex-start;gap:6px;white-space:nowrap;flex:0 0 auto;margin-inline-start:auto">
    ${part(base, 'לפני מע״מ', true)}${sign('+')}${part(vat, `מע״מ ${Math.round(_VAT_RATE * 100)}%`, false)}${sign('=')}${part(base + vat, 'כולל מע״מ', true)}
  </div>`;
}

/* ---- payment archive: one folder per payment, each holding the cars ---- */
function _bsmRenderArchive() {
  const c = document.getElementById('bsm-archive');
  if (!c) return;
  if (!_bshopArchive.length) {
    c.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted)">עדיין לא נסגר חשבון</div>`;
    return;
  }
  c.innerHTML = _bshopArchive.map(a => `<div onclick="bsmOpenArchive('${a.id}')"
      style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;border:2px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px;background:var(--card);cursor:pointer">
    <div style="font-size:26px">📁</div>
    <div style="flex:1 1 110px;min-width:0">
      <div style="font-weight:900;font-size:16px">${esc(a.title || '')}</div>
      <div style="font-size:13px;color:var(--muted)">${(a.cars || []).length} רכבים</div>
    </div>
    ${_bsmVatEquation(a.total)}
    <button onclick="event.stopPropagation();bsmDeleteArchive('${a.id}')" title="מחק תיקייה" style="background:#ef4444;color:#fff;border:none;border-radius:8px;width:30px;height:30px;font-size:14px;cursor:pointer">🗑</button>
  </div>`).join('');
}

/* Removes a payment folder. The notes themselves are not touched — they stay
   marked as paid and hidden, exactly as they were before the folder existed. */
async function bsmDeleteArchive(id) {
  const a = _bshopArchive.find(x => x.id === id);
  if (!a) return;
  if (!confirm(`למחוק את התיקייה "${a.title || ''}"?\n\n${(a.cars || []).length} רכבים · ${Number(a.total || 0).toLocaleString('he-IL')} ₪\nהפעולה אינה הפיכה.`)) return;
  try {
    const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(_docRef('bodyshop_archive', id));
    showToast('🗑 התיקייה נמחקה');
  } catch (e) { showToast('שגיאה: ' + (e.code || e.message)); }
}
window.bsmDeleteArchive = bsmDeleteArchive;

function bsmOpenArchive(id) {
  const a = _bshopArchive.find(x => x.id === id);
  if (!a) return;
  document.getElementById('bsm-arc-title').textContent = '📁 ' + (a.title || '');
  const isMgr = currentUser?.role === 'manager';
  const rows = (a.cars || []).map((c, i) => `<div class="bsm-arc-row" data-plate="${esc(c.plate || '')}" onclick="bsmOpenArchiveCar('${a.id}',${i})" style="display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid var(--border);padding:9px 0;cursor:pointer">
      <div style="font-weight:800">🚗 ${esc(c.plate)}${c.desc ? `<span style="font-weight:600;color:var(--muted);font-size:13px"> · ${esc(c.desc)}</span>` : ''}</div>
      <div style="text-align:left;white-space:nowrap">
        <div style="font-weight:900">${Number(c.total || 0).toLocaleString('he-IL')} ₪</div>
        ${isMgr ? `<div style="font-size:11.5px;font-weight:700;color:var(--muted)">${_fmtIls(_incVat(c.total || 0))} כולל מע״מ</div>` : ''}
      </div>
    </div>`).join('');
  const search = `<div style="display:flex;gap:8px;margin-bottom:12px">
      <input class="form-input" id="bsm-arc-search" placeholder="🔎 חפש מספר רכב" oninput="bsmArcFilter(this.value)" style="flex:1;margin:0">
      ${currentUser?.role === 'manager' ? `<button onclick="bsmExportArchive('${a.id}')" style="background:var(--dark);color:#fff;border:none;border-radius:10px;padding:0 16px;font-family:'Heebo',sans-serif;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap">📤 ייצוא</button>` : ''}
    </div>`;
  document.getElementById('bsm-arc-body').innerHTML = search + rows +
    `<div style="padding-top:12px;margin-top:6px;border-top:2px solid var(--border)">
       <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;font-size:17px;font-weight:900">
         <span>סה״כ ששולם לאיברהים${isMgr ? ' · לפני מע״מ' : ''}</span>
         <span style="color:var(--gold);white-space:nowrap">${Number(a.total || 0).toLocaleString('he-IL')} ₪</span></div>
       ${isMgr ? `<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;font-size:13.5px;font-weight:800;color:var(--muted);margin-top:6px">
         <span>מע״מ ${Math.round(_VAT_RATE * 100)}%</span>
         <span style="white-space:nowrap">${_fmtIls((Number(a.total) || 0) * _VAT_RATE)}</span></div>
       <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;font-size:17px;font-weight:900;margin-top:6px">
         <span>סה״כ כולל מע״מ</span>
         <span style="color:var(--gold);white-space:nowrap">${_fmtIls(_incVat(a.total || 0))}</span></div>` : ''}
     </div>`;
  openModal('modal-bsm-arc');
}
window.bsmOpenArchive = bsmOpenArchive;

// hides the lines that do not match; the total at the bottom is left alone
function bsmArcFilter(term) {
  const t = String(term || '').replace(/\D/g, '');
  document.querySelectorAll('#bsm-arc-body .bsm-arc-row').forEach(row => {
    const plate = String(row.dataset.plate || '').replace(/\D/g, '');
    row.style.display = (!t || plate.includes(t)) ? '' : 'none';
  });
}
window.bsmArcFilter = bsmArcFilter;

/* The repair card of a car that was already paid for. Folders closed from now
   on carry the parts with them; for older folders the note is fetched from the
   jobs themselves, which are kept forever and only hidden once paid. */
const _bsmArcJobs = {};   // {paidAt: [job, ...]} — fetched once per folder

async function _bsmArcCarsOf(a) {
  if (_bsmArcJobs[a.paidAt]) return _bsmArcJobs[a.paidAt];
  if (!a.paidAt) return [];
  try {
    const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDocs(_query(_colRef('bodyshop_jobs'), _where('paidAt', '==', a.paidAt)));
    _bsmArcJobs[a.paidAt] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error('archive car fetch', e); _bsmArcJobs[a.paidAt] = []; }
  return _bsmArcJobs[a.paidAt];
}

async function bsmOpenArchiveCar(archiveId, idx) {
  const a = _bshopArchive.find(x => x.id === archiveId);
  const c = a?.cars?.[idx];
  if (!c) return;
  let items = c.items, note = c.note;
  if (!items) {
    const jobs = await _bsmArcCarsOf(a);
    const j = jobs.find(x => x.id === c.id) || jobs.find(x => x.plate === c.plate);
    items = j?.items || [];
    note = j?.note || '';
  }
  document.getElementById('bsm-arccar-title').textContent = '🚗 ' + c.plate + (c.desc ? ' · ' + c.desc : '');
  const lines = items.length
    ? items.map(it => `<div style="display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid var(--border);padding:9px 0">
        <div style="font-weight:700">${esc(it.name)}${it.addedByShop ? `<span style="font-size:12px;font-weight:800;color:#b45309"> · ➕ איברהים הוסיף</span>` : ''}</div>
        <div style="font-weight:900;white-space:nowrap">${it.price ? Number(it.price).toLocaleString('he-IL') + ' ₪' : '—'}</div>
      </div>`).join('')
    : `<div style="padding:16px;text-align:center;color:var(--muted)">פירוט החלקים לא נשמר בפתק הזה</div>`;
  document.getElementById('bsm-arccar-body').innerHTML =
    (note ? `<div style="background:#fef08a;color:#000;border-right:6px solid #eab308;border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:16px;font-weight:800">📝 ${esc(note)}</div>` : '') +
    lines +
    `<div style="display:flex;justify-content:space-between;padding-top:12px;margin-top:6px;border-top:2px solid var(--border);font-size:17px;font-weight:900">
       <span>סה״כ</span><span style="color:var(--gold)">${Number(c.total || 0).toLocaleString('he-IL')} ₪</span></div>`;
  openModal('modal-bsm-arccar');
}
window.bsmOpenArchiveCar = bsmOpenArchiveCar;

// One folder as one file, a line per car — opens straight in Excel.
function bsmExportArchive(archiveId) {
  const a = _bshopArchive.find(x => x.id === archiveId);
  if (!a || !(a.cars || []).length) return showToast('אין מה לייצא');
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['מספר רישוי', 'רכב', 'סכום']];
  for (const c of a.cars) rows.push([c.plate || '', c.desc || '', Number(c.total || 0)]);
  const sum = Number(a.total || 0), vat = sum * _VAT_RATE;
  rows.push([]);
  rows.push(['סה״כ ששולם לפני מע״מ', '', sum]);
  rows.push([`מע״מ ${Math.round(_VAT_RATE * 100)}%`, '', Math.round(vat)]);
  rows.push(['סה״כ ששולם כולל מע״מ', '', Math.round(sum + vat)]);
  // the BOM is what makes Excel read the Hebrew correctly
  const csv = '\uFEFF' + rows.map(r => r.map(q).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const el = document.createElement('a');
  el.href = url;
  el.download = `פחחות-${String(a.title || 'חשבון').replace(/[\\/:*?"<>|]/g, '-')}.csv`;
  document.body.appendChild(el); el.click(); el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('📤 הקובץ הורד');
}
window.bsmExportArchive = bsmExportArchive;

// copied straight from the menu — there is nothing to read on that screen,
// only a link to hand over once
function bsmCopyLink(fromMenu) {
  const el = document.getElementById('bsm-link');
  const link = (el?.value || '').trim() || (location.origin + '/ops/pahach/');
  if (fromMenu) toggleBsmMenu(false);
  _pcCopyFallback(link, () => showToast('📋 הקישור לפחח הועתק'));
}
window.bsmCopyLink = bsmCopyLink;

function openBsmItemsModal() { _bsmRenderCatalog(); openModal('modal-bsm-items'); }
window.openBsmItemsModal = openBsmItemsModal;

function _bsmRenderCatalog() {
  const c = document.getElementById('bsm-items-list');
  if (!c) return;
  const row = name => `<div class="bsm-cat-row" data-n="${esc(name)}" style="display:flex;align-items:center;gap:8px;border:2px solid var(--border);border-radius:10px;padding:8px 12px;margin-bottom:6px;background:var(--card)">
      <span onpointerdown="_bsmDragStart(event)" style="cursor:grab;color:var(--muted);font-size:20px;font-weight:900;padding:6px 8px;margin:-6px -4px;user-select:none;touch-action:none;flex:0 0 auto">⣿</span>
      <div style="flex:1;font-size:14px;font-weight:700">${esc(name)}</div>
      <button onclick="bsmRemoveCatalogItem(this.dataset.i)" data-i="${_bshopItems.indexOf(name)}" style="background:#ef4444;color:#fff;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer">🗑</button>
    </div>`;
  c.innerHTML = _bshopItems.length
    ? _bshopByGroup(_bshopItems).map(([g, list]) =>
        _bshopGroupTitle(g) + `<div class="bsm-cat-box">${list.map(row).join('')}</div>`).join('')
    : `<div style="text-align:center;padding:18px 10px">
        <div style="color:var(--muted);font-size:14px;font-weight:700;margin-bottom:12px">הרשימה ריקה</div>
        <button onclick="bsmRestoreDefaultItems()" class="btn-submit" style="margin-top:0;background:var(--dark);color:#fff">↩️ שחזר את רשימת החלקים המקורית</button>
      </div>`;
  // the category picker — filled once, keeps whatever was chosen
  const sel = document.getElementById('bsm-new-cat');
  if (sel && !sel.options.length) {
    sel.innerHTML = _BSHOP_GROUPS.map(([g]) => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
    sel.value = 'אחר';
  }
}

/* Dragging a part by its handle moves it inside its own category only — the
   order of the categories themselves is fixed. Uses pointer events so it works
   the same with a finger and with a mouse. */
let _bsmDrag = null;

function _bsmDragStart(ev) {
  const el = ev.target.closest('.bsm-cat-row');
  const box = el?.parentElement;
  if (!el || !box) return;
  ev.preventDefault();
  _bsmDrag = { el, box, y: ev.clientY };
  el.style.opacity = '.6';
  el.style.boxShadow = '0 4px 14px rgba(0,0,0,.2)';
  ev.target.setPointerCapture(ev.pointerId);
  ev.target.onpointermove = _bsmDragMove;
  ev.target.onpointerup = ev.target.onpointercancel = _bsmDragEnd;
}
window._bsmDragStart = _bsmDragStart;

function _bsmDragMove(ev) {
  if (!_bsmDrag) return;
  const { el, box } = _bsmDrag;
  const rows = [...box.children];
  for (const other of rows) {
    if (other === el) continue;
    const r = other.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    // crossing another row's middle swaps the two
    if (ev.clientY < mid && other.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
      box.insertBefore(el, other); break;
    }
    if (ev.clientY > mid && other.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) {
      box.insertBefore(el, other.nextSibling); break;
    }
  }
}

async function _bsmDragEnd(ev) {
  if (!_bsmDrag) return;
  const { el } = _bsmDrag;
  el.style.opacity = '';
  el.style.boxShadow = '';
  if (ev.target.onpointermove) ev.target.onpointermove = ev.target.onpointerup = ev.target.onpointercancel = null;
  _bsmDrag = null;
  // read the new order straight off the screen, category by category
  const order = [...document.querySelectorAll('#bsm-items-list .bsm-cat-row')].map(r => r.dataset.n);
  const next = order.filter(n => _bshopItems.includes(n));
  if (next.length !== _bshopItems.length) return _bsmRenderCatalog();  // something is off — redraw
  if (next.every((n, i) => n === _bshopItems[i])) return;              // nothing moved
  const prev = _bshopItems;
  _bshopItems = next;
  _bsmRenderCatalog();
  try { await _bsmSaveCatalog(next); }
  catch (e) { console.error('bodyshop order save', e); showToast('שגיאה בשמירת הסדר'); _bshopItems = prev; _bsmRenderCatalog(); }
}

async function _bsmSaveCatalog(items, cats) {
  const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const payload = { items, v: _BSHOP_CATALOG_VERSION };
  if (cats) payload.cats = cats;
  await setDoc(_docRef('config', 'bodyshop'), payload, { merge: true });
}

// puts the walk-around list back, for when the saved list was emptied
async function bsmRestoreDefaultItems() {
  if (!confirm('לשחזר את רשימת החלקים המקורית?')) return;
  try {
    await _bsmSaveCatalog([..._BSHOP_DEFAULT_ITEMS], {});
    _bshopItems = [..._BSHOP_DEFAULT_ITEMS];
    _bshopCats = {};
    _bsmRenderCatalog();
    showToast('✅ הרשימה שוחזרה');
  } catch (e) { console.error('restore parts', e); showToast('שגיאה בשחזור'); }
}
window.bsmRestoreDefaultItems = bsmRestoreDefaultItems;

/* שמות החלקים נשמרים גם בתוך כל פתק ובכל תיקיית ארכיון. הסריקה מציעה את מה
   שחסר ברשימה הקבועה — ואתה בוחר, כדי שחלק חד־פעמי לא ייכנס לרשימה. */
async function bsmScanOldItems() {
  if (!_requireNet('סריקת הפתקים')) return;
  const box = document.getElementById('bsm-oldparts-list');
  if (!box) return;
  box.innerHTML = '<div style="text-align:center;color:var(--muted);padding:26px;font-weight:700">⏳ סורק…</div>';
  openModal('modal-bsm-oldparts');
  const tally = {};
  const add = n => { const v = String(n || '').trim(); if (v) tally[v] = (tally[v] || 0) + 1; };
  try {
    const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const jobs = await getDocs(_colRef('bodyshop_jobs'));
    jobs.forEach(d => (d.data().items || []).forEach(it => add(it?.name)));
    const arc = await getDocs(_colRef('bodyshop_archive'));
    arc.forEach(d => (d.data().cars || []).forEach(c => (c?.items || []).forEach(it => add(it?.name))));
  } catch (e) {
    console.error('scan parts', e);
    box.innerHTML = `<div style="text-align:center;color:#ef4444;padding:26px;font-weight:700">שגיאה בסריקה: ${esc(e.code || e.message)}</div>`;
    return;
  }
  const rows = Object.entries(tally)
    .filter(([n]) => !_bshopItems.includes(n))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he'));
  if (!rows.length) {
    box.innerHTML = '<div style="text-align:center;color:var(--muted);padding:26px;font-weight:700">כל החלקים שמופיעים בפתקים כבר ברשימה</div>';
    return;
  }
  box.innerHTML = rows.map(([n, c]) => `<label style="display:flex;align-items:center;gap:10px;border:2px solid var(--border);border-radius:10px;padding:9px 12px;margin-bottom:6px;background:var(--card);cursor:pointer">
      <input type="checkbox" class="bsm-oldpart" value="${esc(n)}" ${c > 1 ? 'checked' : ''} style="width:18px;height:18px">
      <span style="flex:1;font-size:14px;font-weight:700">${esc(n)}</span>
      <span style="font-size:12px;font-weight:800;color:var(--muted);white-space:nowrap">${c} ${c === 1 ? 'פעם' : 'פעמים'}</span>
    </label>`).join('');
}
window.bsmScanOldItems = bsmScanOldItems;

async function bsmAddPickedOldItems() {
  const picked = [...document.querySelectorAll('.bsm-oldpart:checked')].map(x => x.value);
  if (!picked.length) return showToast('לא סומן אף חלק');
  if (!_requireNet('הוספת החלקים')) return;
  const next = [..._bshopItems, ...picked.filter(n => !_bshopItems.includes(n))];
  try {
    await _bsmSaveCatalog(next);
    _bshopItems = next;
    closeModal('modal-bsm-oldparts');
    _bsmRenderCatalog();
    showToast(`✅ נוספו ${picked.length} חלקים`);
  } catch (e) { console.error('add old parts', e); showToast('שגיאה בשמירה'); }
}
window.bsmAddPickedOldItems = bsmAddPickedOldItems;

async function bsmAddCatalogItem() {
  const el = document.getElementById('bsm-new-item');
  const v = el.value.trim();
  if (!v) return;
  if (_bshopItems.includes(v)) { el.value = ''; return showToast('החלק כבר ברשימה'); }
  const next = [..._bshopItems, v];
  const cat = document.getElementById('bsm-new-cat')?.value || 'אחר';
  const cats = { ..._bshopCats, [v]: cat };
  try { await _bsmSaveCatalog(next, cats); el.value = ''; _bshopItems = next; _bshopCats = cats; _bsmRenderCatalog(); }
  catch (e) { console.error('bodyshop catalog add', e); showToast('שגיאה בשמירה'); }
}
window.bsmAddCatalogItem = bsmAddCatalogItem;

async function bsmRemoveCatalogItem(idx) {
  const i = Number(idx);
  if (!Number.isInteger(i) || i < 0 || i >= _bshopItems.length) return;
  const gone = _bshopItems[i];
  const next = _bshopItems.filter((_, k) => k !== i);
  const cats = { ..._bshopCats }; delete cats[gone];
  try { await _bsmSaveCatalog(next, cats); _bshopItems = next; _bshopCats = cats; _bsmRenderCatalog(); }
  catch (e) { console.error('bodyshop catalog delete', e); showToast('שגיאה בשמירה'); }
}
window.bsmRemoveCatalogItem = bsmRemoveCatalogItem;

/* ─── BATTERY CABINET (manager) ────────────────────────
   Two collections: battery_stock holds one document per battery model with its
   current quantity, battery_installs is the log of every battery that left the
   cabinet and went into a car. Stock is derived from the log where possible, so
   the two can be reconciled rather than silently drifting apart. */
let _bsStock = [];      // [{id, model, qty, updatedAt}]
let _bsInstalls = [];   // [{id, model, plate, installedAt, note}]
let _bsUnsubStock = null, _bsUnsubInstalls = null, _bsUnsubCatalog = null, _bsUnsubDeliv = null;
let _bsDeliveries = [];   // one entry per delivery — the order history
let _bsCatalog = [];    // [{id: sku, sku, model, price}] — a SKU is entered once
const _bsCatFind = sku => _bsCatalog.find(c => c.sku === String(sku || '').trim());
/* The SKU list is the single source of truth for what a battery is called and
   what it costs. Every list shows the name from there, so renaming a SKU once
   renames it everywhere — the cabinet, the order list and the fitting form. */
const _bsModelOf = row => _bsCatFind(row?.sku)?.model || row?.model || '';
const _bsPriceOf = row => {
  const c = _bsCatFind(row?.sku);
  return c?.price != null ? c.price : row?.price;
};
// A SKU is written by hand and may contain "/" or "." — both illegal in a
// Firestore document id. The id is therefore an encoded, prefixed form of the
// SKU, while the readable value stays in the sku field.
// Prices are entered the way the supplier quotes them — before VAT. The figure
// including VAT is derived, never stored, so there is only one number to keep
// correct.
const _VAT_RATE = 0.18;
const _incVat = p => (Number(p) || 0) * (1 + _VAT_RATE);
const _fmtIls = n => Math.round(n).toLocaleString('he-IL') + ' ₪';
function _bsVatHint(inputId, hintId) {
  const el = document.getElementById(hintId);
  const v = document.getElementById(inputId)?.value;
  if (!el) return;
  el.textContent = v === '' || v == null || !Number(v)
    ? '' : `כולל מע״מ: ${_fmtIls(_incVat(v))}  (מע״מ ${Math.round(_VAT_RATE * 100)}%)`;
}
window._bsVatHint = _bsVatHint;

const _bsSkuId = sku => 's_' + encodeURIComponent(String(sku || '').trim()).replace(/\./g, '%2E');

// The cabinet, the statistics and the order list all read the same data, so the
// listeners live in one place. Opening the statistics screen directly — which is
// what happens after a refresh — must start them too, otherwise the screen has
// nothing to show and looks empty.
// the driver's entry point: no cabinet screen, only the form for recording a
// battery that went into a car
// the driver sees the shelf as it is, and fits a battery from the button below
function openDriverBatteryInstall() {
  const badge = document.getElementById('dbs-user-badge');
  if (badge) badge.textContent = currentUser?.name || '';
  showScreen('driver-battery-stock');
  _bsListen();
  _bsAuditListen();
  _bsRenderDriverStock();
  // הבדיקה החודשית קופצת אחרי שהארון נטען
  setTimeout(_bsMaybeOpenAudit, 900);
  setTimeout(_bsMaybeOpenAudit, 2500);
}
window.openDriverBatteryInstall = openDriverBatteryInstall;
const openDriverBatteryStockScreen = openDriverBatteryInstall;
window.openDriverBatteryStockScreen = openDriverBatteryStockScreen;

// the same shelf as the manager's, without prices, invoices or buttons
function _bsRenderDriverStock() {
  const c = document.getElementById('dbs-stock');
  if (!c) return;
  const rows = _bsStock.filter(r => (r.qty || 0) > 0)
    .sort((a, b) => _bsAmpOf(a) - _bsAmpOf(b) || String(a.model || '').localeCompare(String(b.model || ''), 'he'));
  if (!rows.length) {
    c.innerHTML = `<div style="padding:30px 20px;text-align:center;color:var(--muted)">הארון ריק כרגע</div>`;
    return;
  }
  const total = rows.reduce((s, r) => s + (r.qty || 0), 0);
  c.innerHTML = `<div style="font-size:13px;font-weight:800;color:var(--muted);margin-bottom:8px">סה״כ בארון: ${total}</div>` +
    rows.map(r => {
      const q = r.qty || 0;
      const color = q <= 2 ? '#f59e0b' : 'var(--success)';
      return `<div style="display:flex;align-items:center;gap:10px;border:2px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:8px;background:var(--card)">
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:16px">${esc(_bsModelOf(r))}</div>
          ${r.sku ? `<div style="font-size:12px;color:var(--muted);font-weight:700">מק״ט ${esc(r.sku)}</div>` : ''}
        </div>
        <div style="font-size:22px;font-weight:900;color:${color};min-width:34px;text-align:center">${q}</div>
      </div>`;
    }).join('');
}


/* ── בדיקת ארון מצברים חודשית ────────────────────────────────────────
   מה-1 בכל חודש, בכל כניסה של גיל למסך המצברים קופצת חלונית עם כל
   המצברים שבארון. הוא מסמן לכל שורה "קיים" או "חסר" ושולח. גיל יכול
   לסגור את החלונית, והיא תחזור בכניסה הבאה עד שהבדיקה נשלחת.
   התיעוד נשמר ב-battery_audits: תאריך ושעה, המלאי שהיה, והסימונים. */
const _BS_AUDIT_USER = 'גיל';
let _bsAudits = [], _bsAuditUnsub = null, _bsAuditMarks = {};
// כשיש כמה יחידות מאותו סוג ורק חלקן חסרות — כאן נשמר כמה חסרים
let _bsAuditShort = {};

const _bsAuditMonth = () => new Date().toLocaleDateString('sv-SE').slice(0, 7);   // YYYY-MM
const _bsMonthLabel = m => {
  const [y, mm] = String(m || '').split('-');
  return mm ? `${mm}/${y}` : m || '';
};

function _bsAuditListen() {
  if (_bsAuditUnsub) return;
  _bsAuditUnsub = _onSnap(_colRef('battery_audits'), snap => {
    _bsAudits = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.month || '').localeCompare(String(a.month || '')));
    _bsRenderAudits();
    _bsAuditHomeSync();
  }, () => {});
}

// שורות הארון כפי שהן עכשיו — אותה מיון כמו במסך
function _bsAuditRows() {
  return _bsStock.filter(r => (r.qty || 0) > 0)
    .sort((a, b) => _bsAmpOf(a) - _bsAmpOf(b) || String(a.model || '').localeCompare(String(b.model || ''), 'he'));
}

// האם צריך לבקש מגיל בדיקה החודש
function _bsAuditDue() {
  if ((currentUser?.name || '') !== _BS_AUDIT_USER) return false;
  const m = _bsAuditMonth();
  return !_bsAudits.some(a => a.month === m && a.status === 'done');
}

/* הקובייה של המצברים אצל גיל נצבעת אדום כל עוד בדיקת הארון של החודש
   לא נשלחה, ומתנקה מעצמה ברגע שהיא נשלחת — המאזין מצייר מחדש. */
function _bsAuditHomeSync() {
  const card = document.getElementById('menu-card-driver-battery-install');
  if (!card) return;
  const due = _bsAuditDue();
  card.classList.toggle('bs-audit-due', due);
  const sub = document.getElementById('sub-driver-battery-install');
  if (sub) sub.textContent = due
    ? `בדיקת ארון ${_bsMonthLabel(_bsAuditMonth())} ממתינה`
    : 'רישום מצבר שהורכב לרכב';
}

/* הסימונים נשמרים במכשיר עד לשליחה, כדי שיציאה מהטופס וחזרה אליו
   לא תמחק עבודה של חצי ארון. המפתח הוא לפי חודש, ולכן בדיקה של חודש
   חדש תמיד מתחילה נקייה. */
const _bsAuditKey = () => '_bsAuditProgress2_' + _bsAuditMonth();
function _bsAuditSave() {
  try { localStorage.setItem(_bsAuditKey(), JSON.stringify({ marks: _bsAuditMarks, short: _bsAuditShort })); }
  catch (e) {}
}
function _bsAuditRestore() {
  _bsAuditMarks = {};
  _bsAuditShort = {};
  try {
    const raw = localStorage.getItem(_bsAuditKey());
    if (!raw) return;
    const d = JSON.parse(raw);
    _bsAuditMarks = d?.marks || {};
    _bsAuditShort = d?.short || {};
  } catch (e) {}
}

function _bsMaybeOpenAudit() {
  if (!_bsAuditDue()) return;
  if (!_bsAuditRows().length) return;                 // הארון עוד לא נטען
  const modal = document.getElementById('modal-bs-audit');
  if (modal && modal.classList.contains('open')) return;
  _bsAuditRestore();
  _bsRenderAuditForm();
  openModal('modal-bs-audit');
}

function _bsRenderAuditForm() {
  const box = document.getElementById('bs-audit-list');
  const sub = document.getElementById('bs-audit-sub');
  if (!box) return;
  const rows = _bsAuditRows();
  const total = rows.reduce((t, r) => t + (r.qty || 0), 0);
  if (sub) sub.textContent = `בדיקת ${_bsMonthLabel(_bsAuditMonth())} · ${rows.length} סוגים · ${total} יחידות בארון`;
  box.innerHTML = rows.map(r => {
    const mark = _bsAuditMarks[r.id];
    const btn = (val, label, color) => `<button onclick="bsAuditMark('${r.id}','${val}')" style="flex:1;background:${mark === val ? color : 'var(--surface2)'};color:${mark === val ? '#fff' : 'var(--muted)'};border:2px solid ${mark === val ? color : 'var(--border)'};border-radius:10px;padding:9px 0;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer">${label}</button>`;
    const qty = r.qty || 0;
    const many = qty > 1;                       // בורר הכמות רלוונטי רק מיותר מאחד
    const short = _bsAuditShort[r.id] ?? 1;     // ברירת המחדל: חסר אחד
    const all = mark === 'missing' && short >= qty;
    // חסר חלקי נצבע כתום, וחסר מלא נשאר אדום — כדי שההבדל בולט לעין
    const brd = mark === 'ok' ? '#16a34a' : mark === 'missing' ? (all ? '#dc2626' : '#f59e0b') : 'var(--border)';
    const step = `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:8px;background:${all ? '#fef2f2' : '#fffbeb'};border:2px solid ${all ? '#dc2626' : '#f59e0b'};border-radius:10px;padding:7px">
        <button onclick="bsAuditShort('${r.id}',-1)" ${short <= 1 ? 'disabled' : ''} style="width:34px;height:34px;border-radius:8px;border:2px solid ${all ? '#dc2626' : '#f59e0b'};background:#fff;font-size:19px;font-weight:900;color:${all ? '#991b1b' : '#b45309'};cursor:pointer;opacity:${short <= 1 ? .4 : 1}">−</button>
        <div style="font-size:14px;font-weight:900;color:${all ? '#991b1b' : '#92400e'};min-width:104px;text-align:center">חסרים ${short} מתוך ${qty}</div>
        <button onclick="bsAuditShort('${r.id}',1)" ${short >= qty ? 'disabled' : ''} style="width:34px;height:34px;border-radius:8px;border:2px solid ${all ? '#dc2626' : '#f59e0b'};background:#fff;font-size:19px;font-weight:900;color:${all ? '#991b1b' : '#b45309'};cursor:pointer;opacity:${short >= qty ? .4 : 1}">+</button>
      </div>`;
    return `<div style="border:2px solid ${brd};border-radius:12px;padding:10px 12px;margin-bottom:8px;background:var(--card)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:14px">${esc(_bsModelOf(r))}</div>
          ${r.sku ? `<div style="font-size:11.5px;color:var(--muted);font-weight:700">מק״ט ${esc(r.sku)}</div>` : ''}
        </div>
        <div style="font-size:19px;font-weight:900;min-width:32px;text-align:center">${r.qty || 0}</div>
      </div>
      <div style="display:flex;gap:8px">${btn('ok', '✅ קיים', '#16a34a')}${btn('missing', '❌ חסר', all ? '#dc2626' : '#f59e0b')}</div>
      ${mark === 'missing' && many ? step : ''}
    </div>`;
  }).join('');
  const send = document.getElementById('bs-audit-send');
  const left = rows.filter(r => !_bsAuditMarks[r.id]).length;
  if (send) {
    send.disabled = left > 0;
    send.style.opacity = left > 0 ? .5 : 1;
    send.textContent = left > 0 ? `נותרו ${left} שורות לסימון` : '✅ שלח את הבדיקה';
  }
}

function bsAuditMark(id, val) {
  // לחיצה על סימון שכבר נבחר מבטלת אותו
  if (_bsAuditMarks[id] === val) {
    delete _bsAuditMarks[id];
    delete _bsAuditShort[id];
  } else {
    _bsAuditMarks[id] = val;
    if (val === 'missing') {
      const row = _bsAuditRows().find(r => r.id === id);
      // בארון של יחידה אחת אין מה לחלק; ביותר מאחת מתחילים מ"חסר אחד"
      if (_bsAuditShort[id] == null) _bsAuditShort[id] = (row?.qty || 0) > 1 ? 1 : (row?.qty || 0);
    } else {
      delete _bsAuditShort[id];
    }
  }
  _bsAuditSave();
  _bsRenderAuditForm();
}
window.bsAuditMark = bsAuditMark;

// כמה יחידות חסרות מתוך מה שאמור להיות בארון — בין אחת לכמות המלאה.
function bsAuditShort(id, delta) {
  const row = _bsAuditRows().find(r => r.id === id);
  const max = Math.max(1, row?.qty || 0);
  const cur = _bsAuditShort[id] ?? 1;
  _bsAuditShort[id] = Math.min(max, Math.max(1, cur + delta));
  _bsAuditSave();
  _bsRenderAuditForm();
}
window.bsAuditShort = bsAuditShort;

async function bsAuditSubmit() {
  const rows = _bsAuditRows();
  if (rows.some(r => !_bsAuditMarks[r.id])) return showToast('נא לסמן את כל השורות');
  // הסימונים נשארים על המסך, אפשר לשלוח שוב כשיהיה חיבור
  if (!_requireNet('שליחת הבדיקה')) return;
  const btn = document.getElementById('bs-audit-send');
  if (btn) btn.disabled = true;
  const month = _bsAuditMonth();
  const lines = rows.map(r => {
    const m = _bsAuditMarks[r.id], qty = r.qty || 0;
    const short = m === 'ok' ? 0 : Math.min(Math.max(1, _bsAuditShort[r.id] ?? 1), Math.max(1, qty));
    return {
      model: _bsModelOf(r) || '', sku: r.sku || '', qty,
      mark: m === 'ok' ? 'קיים' : 'חסר',
      have: qty - short, short,
    };
  });
  const data = {
    month, status: 'done',
    submittedBy: currentUser?.name || '', submittedAt: new Date().toISOString(),
    totalTypes: lines.length,
    totalUnits: lines.reduce((t, l) => t + l.qty, 0),
    missingCount: lines.filter(l => (l.short || 0) > 0).length,
    shortUnits: lines.reduce((t, l) => t + (l.short || 0), 0),
    lines,
  };
  try {
    await window._setDoc(_docRef('battery_audits', month), data, { merge: true });
    try { localStorage.removeItem(_bsAuditKey()); } catch (e) {}
    _bsAuditMarks = {}; _bsAuditShort = {};
    closeModal('modal-bs-audit');
    showToast('✅ הבדיקה נשלחה — תודה', 4000);
  } catch (e) {
    showToast('השליחה נכשלה: ' + (e.code || e.message), 6000);
    if (btn) btn.disabled = false;
  }
}
window.bsAuditSubmit = bsAuditSubmit;

// ── תיעוד הבדיקות אצל המנהל ──
function openBsAudits() { _bsAuditListen(); _bsRenderAudits(); openModal('modal-bs-audits'); }
window.openBsAudits = openBsAudits;

function _bsRenderAudits() {
  const boxes = ['bs-audits-list', 'bs-audits-inline'].map(id => document.getElementById(id)).filter(Boolean);
  if (!boxes.length) return;
  const box = { set innerHTML(v) { boxes.forEach(b => b.innerHTML = v); } };
  const done = _bsAudits.filter(a => a.status === 'done');
  if (!done.length) {
    box.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted);font-weight:700">עדיין לא נשלחו בדיקות</div>`;
    return;
  }
  box.innerHTML = done.map(a => {
    const when = a.submittedAt ? new Date(a.submittedAt).toLocaleString('he-IL',
      { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const bad = a.missingCount || 0;
    return `<details style="border:2px solid ${bad ? '#dc2626' : '#16a34a'};border-radius:12px;margin-bottom:8px;background:var(--card)">
      <summary style="cursor:pointer;padding:11px 13px;font-weight:900;font-size:14px">
        ${esc(_bsMonthLabel(a.month))} · ${esc(a.submittedBy || '')}
        <span style="font-weight:700;font-size:12px;color:var(--muted)"> · ${esc(when)}</span>
        <div style="font-size:12.5px;font-weight:800;color:${bad ? '#dc2626' : '#16a34a'};margin-top:3px">
          ${bad ? `${bad} שורות חסרות${a.shortUnits ? ` · ${a.shortUnits} יחידות` : ''}` : 'הכל נמצא'} · ${a.totalTypes || 0} סוגים · ${a.totalUnits || 0} יחידות</div>
      </summary>
      <div style="padding:0 13px 12px">
        ${(a.lines || []).map(l => `<div style="display:flex;align-items:center;gap:8px;border-top:1px solid var(--border);padding:7px 0">
          <div style="flex:1;min-width:0;font-size:13px;font-weight:700">${esc(l.model)}${l.sku ? `<span style="color:var(--muted);font-weight:600"> · ${esc(l.sku)}</span>` : ''}</div>
          <div style="font-size:13px;font-weight:900;min-width:26px;text-align:center">${l.qty}</div>
          ${(() => {
            const sh = l.short != null ? l.short : (l.mark === 'קיים' ? 0 : l.qty);
            const part = sh > 0 && sh < l.qty;   // חסר חלקי — כתום, ומראה כמה מתוך כמה
            const col = sh === 0 ? '#16a34a' : part ? '#b45309' : '#dc2626';
            return `<div style="font-size:12px;font-weight:900;color:${col};min-width:52px;text-align:center">${sh === 0 ? 'קיים' : 'חסר'}${part ? `<div style="font-size:10.5px;font-weight:800">${sh} מתוך ${l.qty}</div>` : ''}</div>`;
          })()}
        </div>`).join('')}
      </div>
    </details>`;
  }).join('');
}

function _bsListen() {
  if (_bsUnsubStock) _bsUnsubStock();
  if (_bsUnsubInstalls) _bsUnsubInstalls();
  _bsUnsubStock = _onSnap(_colRef('battery_stock'), snap => {
    _bsStock = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _bsRenderAll();
    // a driver who tapped the battery cube waits here until the cabinet is
    // loaded, otherwise the form would open and claim the cabinet is empty
  });
  _bsUnsubInstalls = _onSnap(_colRef('battery_installs'), snap => {
    _bsInstalls = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _bsRenderAll();
  });
  if (_bsUnsubDeliv) _bsUnsubDeliv();
  _bsUnsubDeliv = _onSnap(_colRef('battery_deliveries'), snap => {
    _bsDeliveries = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    _bsRenderDeliveries();
    _bsRenderAll();
  });
  if (_bsUnsubCatalog) _bsUnsubCatalog();
  _bsUnsubCatalog = _onSnap(_colRef('battery_catalog'), snap => {
    _bsCatalog = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.sku).localeCompare(String(b.sku), 'he', { numeric: true }));
    _bsRenderCatalog();
    _bsRenderTypes();
    _bsRenderAll();
  });
}

/* לשוניות הארון: רואים דבר אחד בכל פעם, ו"צריך להזמין" נשאר מול העיניים */
let _bsTab = 'stock';
function bsTab(name) {
  _bsTab = name;
  ['stock', 'history', 'audits'].forEach(t => {
    const pane = document.getElementById('bs-pane-' + t);
    if (pane) pane.style.display = t === name ? '' : 'none';
  });
  document.querySelectorAll('.bs-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  if (name === 'audits') { _bsAuditListen(); _bsRenderAudits(); }
}
window.bsTab = bsTab;

function openBatteryStockScreen() {
  document.getElementById('bs-user-badge').textContent = currentUser.name;
  showScreen('battery-stock');
  _bsListen();
  _bsAuditListen();
  bsTab(_bsTab);
}
window.openBatteryStockScreen = openBatteryStockScreen;

function _bsRenderAll() { _bsRenderStock(); _bsRenderDriverStock(); _bsRenderOrders(); _bsRenderStats(); _bsRenderHistory(); }

/* Order list: every battery that leaves the cabinet lands here by itself, so
   what went out is exactly what needs buying back. Pressing "הזמנתי" clears the
   list by marking those installations as ordered — nothing is deleted. */
function _bsOrderLines() {
  const pending = _bsInstalls.filter(r => !r.ordered);
  const by = {};
  for (const r of pending) {
    const key = r.sku || r.model || '—';
    if (!by[key]) {
      const cat = _bsCatFind(r.sku);
      by[key] = { sku: r.sku || '', model: r.model || cat?.model || '', price: r.price ?? cat?.price ?? null, qty: 0 };
    }
    by[key].qty++;
  }
  return Object.values(by).sort((a, b) => b.qty - a.qty);
}

function _bsRenderOrders() {
  const c = document.getElementById('bs-orders');
  if (!c) return;
  const lines = _bsOrderLines();
  const sum = document.getElementById('bs-orders-sum');
  if (!lines.length) {
    if (sum) sum.textContent = '';
    c.innerHTML = `<div style="padding:22px 16px;text-align:center;color:var(--muted);font-weight:700">אין מה להזמין</div>`;
    return;
  }
  const total = lines.reduce((s, l) => s + (l.price ? l.price * l.qty : 0), 0);
  const units = lines.reduce((s, l) => s + l.qty, 0);
  if (sum) sum.textContent = `${units} יחידות${total ? ` · ${total.toLocaleString('he-IL')} ₪` : ''}`;
  c.innerHTML = lines.map(l => `<div class="bs-row">
      <div class="bs-qty" style="background:#f59e0b;width:36px;height:36px;font-size:17px">${l.qty}</div>
      <div style="flex:1;min-width:0">
        <div class="bs-name" style="font-size:14px">${esc(l.model || '')}</div>
        ${l.sku ? `<div class="bs-sub">מק״ט ${esc(l.sku)}${l.price ? ` · ${Number(l.price).toLocaleString('he-IL')} ₪ ליחידה` : ''}</div>` : ''}
      </div>
      ${l.price ? `<div style="font-weight:900;white-space:nowrap;color:var(--muted);font-size:13.5px">${(l.price * l.qty).toLocaleString('he-IL')} ₪</div>` : ''}
    </div>`).join('') +
    (total ? `<div style="padding:10px 14px;background:var(--surface2);font-size:12.5px;font-weight:800;color:var(--muted);text-align:center">
       ${total.toLocaleString('he-IL')} ₪ לפני מע״מ · ${_fmtIls(_incVat(total))} כולל מע״מ</div>` : '') +
    `<div style="display:flex;gap:8px;padding:12px 14px">
       <button class="b-main" onclick="bsMarkOrdered()" style="background:var(--success);color:#fff">✅ הזמנתי</button>
       <button class="b-main" onclick="bsCopyOrderText()" style="background:var(--dark);color:#fff">📋 העתק מלל</button>
     </div>`;
}

// the text a supplier can be sent as is — SKU and how many of each
function bsOrderText() {
  const lines = _bsOrderLines();
  if (!lines.length) return '';
  const body = lines.map(l => `${l.sku || l.model} — ${l.qty} ${l.qty === 1 ? 'יחידה' : 'יחידות'}${l.model && l.sku ? ` (${l.model})` : ''}`).join('\n');
  const units = lines.reduce((s, l) => s + l.qty, 0);
  return `מה קורה?\n\nתשלחו לי בבקשה את המצברים האלה :\n\n${body}\n\nסה״כ ${units} ${units === 1 ? 'יחידה' : 'יחידות'}\n\nמתי המצברים יגיעו בערך?`;
}

function bsCopyOrderText() {
  const txt = bsOrderText();
  if (!txt) return showToast('אין מה להזמין');
  const done = () => showToast('📋 המלל הועתק');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(txt).then(done).catch(() => _pcCopyFallback(txt, done));
  } else {
    _pcCopyFallback(txt, done);
  }
}
window.bsCopyOrderText = bsCopyOrderText;

async function bsMarkOrdered() {
  const pending = _bsInstalls.filter(r => !r.ordered);
  if (!pending.length) return;
  const lines = _bsOrderLines();
  const total = lines.reduce((s, l) => s + (l.price ? l.price * l.qty : 0), 0);
  const units = lines.reduce((s, l) => s + l.qty, 0);
  if (!confirm(`לסמן שהזמנת ${units} מצברים?\n\nהרשימה תתאפס ותתחיל להתמלא מחדש בכל מצבר שיצא מהארון.`)) return;
  try {
    // the order is filed first, so a record of what was ordered survives even
    // if marking the installations fails half way
    await _addDoc(_colRef('battery_orders'), {
      lines, units, total, at: new Date().toISOString(),
      createdBy: currentUser.name, createdAt: _serverTs()
    });
    const { writeBatch } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    for (let i = 0; i < pending.length; i += 400) {
      const batch = writeBatch(window._db);
      for (const r of pending.slice(i, i + 400)) batch.update(_docRef('battery_installs', r.id), { ordered: true });
      await batch.commit();
    }
    showToast(`🧾 נרשמה הזמנה על ${units} מצברים`);
  } catch (e) { showToast('שגיאה: ' + (e.code || e.message)); }
}
window.bsMarkOrdered = bsMarkOrdered;

function _bsRenderStock() {
  const c = document.getElementById('bs-stock');
  if (!c) return;
  // a battery that was fitted to a car is no longer in the cabinet — its row
  // leaves this list and lives on in "צריך להזמין" until it is reordered
  // ordered by amperage, the small ones on top — the way the shelf is arranged
  const rows = _bsStock.filter(r => (r.qty || 0) > 0)
    .sort((a, b) => _bsAmpOf(a) - _bsAmpOf(b) || String(a.model || '').localeCompare(String(b.model || ''), 'he'));
  if (!rows.length) {
    const cnt0 = document.getElementById('bs-tab-count');
    if (cnt0) cnt0.textContent = '0';
    c.innerHTML = `<div class="bs-box"><div class="bs-box-head"><span>🔋 יש בארון</span></div>
      <div style="padding:30px 20px;text-align:center;color:var(--muted);font-weight:700">הארון ריק — הוסף מצברים כדי להתחיל</div></div>`;
    return;
  }
  const total = rows.reduce((s, r) => s + (r.qty || 0), 0);
  const cnt = document.getElementById('bs-tab-count');
  if (cnt) cnt.textContent = total;
  c.innerHTML = `<div class="bs-box">
      <div class="bs-box-head"><span>🔋 יש בארון</span>
        <span style="font-size:12.5px;font-weight:800;color:var(--muted)">${total} יחידות · ${rows.length} סוגים</span></div>` +
    rows.map(r => {
      const q = r.qty || 0;
      // ארון שמתרוקן הוא מה שחשוב לראות מיד
      const color = q === 0 ? '#ef4444' : q <= 1 ? '#f59e0b' : '#16a34a';
      return `<div class="bs-row">
        <div class="bs-qty" style="background:${color}">${q}</div>
        <div style="flex:1;min-width:0">
          <div class="bs-name">${esc(_bsModelOf(r))}</div>
          ${(() => {
            // העלות מוצגת תמיד: מחיר ליחידה, ובכמות גדולה מאחת גם הסכום הכולל
            const price = Number(_bsPriceOf(r) || 0);
            const money = price
              ? `${price.toLocaleString('he-IL')} ₪ ליחידה${q > 1 ? ` · סה״כ ${(price * q).toLocaleString('he-IL')} ₪` : ''}`
              : '<span style="color:#b45309">מחיר לא הוגדר</span>';
            return `<div class="bs-sub">${r.sku ? `מק״ט ${esc(r.sku)} · ` : ''}${money}</div>`;
          })()}
        </div>
        <button onclick="bsRemoveStock('${r.id}')" title="הורד מהארון" class="bs-icon-btn">🗑</button>
      </div>`;
    }).join('') + `</div>`;
}

// Empties the cabinet in one go — for starting a count from scratch. Only the
// stock rows go; the SKU catalogue, the installation history and the order list
// are untouched.
async function bsResetStock() {
  if (!_bsStock.length) return showToast('הארון כבר ריק');
  const units = _bsStock.reduce((s, r) => s + (r.qty || 0), 0);
  if (!confirm(`לאפס את הארון?\n\n${_bsStock.length} שורות (${units} יחידות) יימחקו.\nרשימת המק״טים, ההרכבות וההזמנות לא ייפגעו.`)) return;
  try {
    const { writeBatch } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const rows = [..._bsStock];
    for (let i = 0; i < rows.length; i += 400) {
      const batch = writeBatch(window._db);
      for (const r of rows.slice(i, i + 400)) batch.delete(_docRef('battery_stock', r.id));
      await batch.commit();
    }
    showToast('🧹 הארון אופס');
  } catch (e) { showToast('שגיאה: ' + (e.code || e.message)); }
}
window.bsResetStock = bsResetStock;

/* Taking batteries off the shelf by hand — one that was damaged, miscounted or
   returned to the supplier. With more than one in the cabinet you say how many;
   the row itself is kept even at zero, so the model stays in "צריך להזמין". */
async function bsRemoveStock(id) {
  const row = _bsStock.find(r => r.id === id);
  if (!row) return;
  const have = row.qty || 0;
  if (have <= 0) return;
  let n = 1;
  if (have > 1) {
    const ans = prompt(`כמה יחידות להוריד מ-${row.model}?\n\nיש בארון ${have}.`, '1');
    if (ans === null) return;
    n = Math.floor(Number(ans));
    if (!Number.isFinite(n) || n < 1 || n > have) return showToast(`יש להזין מספר בין 1 ל-${have}`);
  } else if (!confirm(`להוריד את ${row.model} מהארון?`)) return;
  try {
    await _updateDoc(_docRef('battery_stock', id), { qty: have - n, updatedAt: _serverTs() });
    showToast(`🗑 ירדו ${n} מהארון`);
  } catch (e) { showToast('שגיאה: ' + (e.code || e.message)); }
}
window.bsRemoveStock = bsRemoveStock;

// Quantities are never edited by hand any more — the only two things that
// move stock are adding a delivery and fitting a battery to a car.

function openBatteryStatsScreen() {
  document.getElementById('bstat-user-badge').textContent = currentUser.name;
  showScreen('battery-stats');
  _bsListen();
  _bsRenderStats();
}
window.openBatteryStatsScreen = openBatteryStatsScreen;

// Wipes the history the statistics are built from. The cabinet contents and the
// SKU list are left alone — only what happened until now is cleared.
async function bsResetStats() {
  const n = _bsInstalls.length, d = _bsDeliveries.length;
  if (!n && !d) return showToast('אין מה לאפס');
  if (!confirm(`לאפס את הסטטיסטיקה?\n\n${n} הרכבות ו-${d} הזמנות יימחקו, וגם רשימת ההזמנות תתאפס.\nהמלאי בארון ורשימת המק״טים לא ייפגעו.`)) return;
  try {
    const { writeBatch } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const jobs = [..._bsInstalls.map(r => ['battery_installs', r.id]), ..._bsDeliveries.map(r => ['battery_deliveries', r.id])];
    for (let i = 0; i < jobs.length; i += 400) {
      const batch = writeBatch(window._db);
      for (const [col, id] of jobs.slice(i, i + 400)) batch.delete(_docRef(col, id));
      await batch.commit();
    }
    showToast('🧹 הסטטיסטיקה אופסה');
  } catch (e) { showToast('שגיאה: ' + (e.code || e.message)); }
}
window.bsResetStats = bsResetStats;

const _bsCard = (label, value, sub, color) => `<div style="border:2px solid var(--border);border-radius:14px;padding:12px;background:var(--card)">
  <div style="font-size:12px;color:var(--muted);font-weight:800">${label}</div>
  <div style="font-size:22px;font-weight:900;margin-top:2px${color ? `;color:${color}` : ''}">${value}</div>
  ${sub ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${sub}</div>` : ''}</div>`;

const _bsBox = (title, inner) => `<div style="border:2px solid var(--border);border-radius:14px;padding:14px;background:var(--card);margin-bottom:12px">
  <div style="font-size:14px;font-weight:900;margin-bottom:10px">${title}</div>${inner}</div>`;

function _bsRenderStats() {
  const c = document.getElementById('bs-stats');
  if (!c) return;
  const installs = _bsInstalls.map(i => ({ ...i, d: new Date(i.installedAt) })).filter(i => !isNaN(i.d));
  const now = new Date();
  const since = days => new Date(now.getTime() - days * 86400000);
  const inLast = days => installs.filter(i => i.d >= since(days));
  const priceOf = i => Number(i.price ?? _bsCatFind(i.sku)?.price ?? 0);
  const money = n => Math.round(n).toLocaleString('he-IL') + ' ₪';

  const dates = installs.map(i => i.d).sort((a, b) => a - b);
  const spanDays = dates.length ? Math.max(1, (dates[dates.length - 1] - dates[0]) / 86400000) : 1;
  const perDay = installs.length > 1 ? (installs.length - 1) / spanDays : 0;
  const everyDays = perDay > 0 ? 1 / perDay : 0;
  const inCabinet = _bsStock.reduce((t, r) => t + (r.qty || 0), 0);

  // ── 1. headline numbers ────────────────────────────────────────────────
  let html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    ${_bsCard('הורכבו החודש', inLast(30).length, `${inLast(90).length} ב-3 חודשים · ${inLast(365).length} בשנה`)}
    ${_bsCard('קצב החלפה', everyDays ? `כל ${everyDays.toFixed(1)} ימים` : '—', everyDays ? `כ-${(30 * perDay).toFixed(1)} בחודש` : 'צריך שתי הרכבות לפחות')}
    ${_bsCard('עלות החודש', money(inLast(30).reduce((t, i) => t + priceOf(i), 0)), 'לפני מע״מ · לפי מחיר הקנייה')}
    ${_bsCard('יש בארון עכשיו', inCabinet, perDay > 0 ? `מספיק לכ-${Math.round(inCabinet / perDay)} ימים` : '', inCabinet === 0 ? '#ef4444' : inCabinet <= 2 ? '#f59e0b' : 'var(--success)')}
  </div>`;

  // ── 2. which type goes the most, and will it run out ───────────────────
  const byKey = {};
  for (const i of installs) {
    const k = i.sku || i.model || '—';
    if (!byKey[k]) byKey[k] = { sku: i.sku || '', model: i.model || _bsCatFind(i.sku)?.model || k, n: 0, cost: 0, last: null };
    byKey[k].n++; byKey[k].cost += priceOf(i);
    if (!byKey[k].last || i.d > byKey[k].last) byKey[k].last = i.d;
  }
  const ranked = Object.values(byKey).sort((a, b) => b.n - a.n);
  const stockOf = sku => _bsStock.filter(r => r.sku === sku).reduce((t, r) => t + (r.qty || 0), 0);
  const rMax = Math.max(1, ...ranked.map(r => r.n));
  // ── 3. month by month ──────────────────────────────────────────────────
  // a full calendar year — January through December of the current year
  const year = now.getFullYear();
  const months = [];
  for (let mo = 0; mo < 12; mo++) {
    const n = installs.filter(i => i.d.getFullYear() === year && i.d.getMonth() === mo).length;
    months.push({ label: (mo + 1) + '/' + String(year).slice(-2), n });
  }
  const mMax = Math.max(1, ...months.map(m => m.n));

  // the two charts sit side by side — the year on the right, the types on the left
  html += `<div class="bs-split" style="margin-bottom:12px">
    ${_bsBox(`הרכבות לפי חודש · ${year}`, `<div style="display:flex;align-items:flex-end;justify-content:center;gap:4px;height:110px;direction:ltr">
      ${months.map(m => `<div style="flex:1;max-width:90px;text-align:center">
        <div style="font-size:11px;font-weight:800;margin-bottom:2px">${m.n || ''}</div>
        <div style="background:${m.n ? 'var(--gold)' : 'var(--border)'};border-radius:4px 4px 0 0;height:${Math.max(3, Math.round(m.n / mMax * 70))}px"></div>
        <div style="font-size:10px;color:var(--muted);margin-top:3px">${m.label}</div>
      </div>`).join('')}
    </div>`)}
    ${_bsBox('הסוגים המבוקשים ביותר', (ranked.length ? '' : `<div style="font-size:13px;color:var(--muted);margin-bottom:8px">עדיין לא הורכבו מצברים</div>`) +
    `<div style="display:flex;align-items:flex-end;justify-content:center;gap:10px;height:130px;direction:rtl;margin-bottom:10px">
      ${(ranked.length ? ranked : [{ sku: '', model: '', n: 0, empty: true }]).map(r => `<div style="flex:1;max-width:110px;text-align:center;min-width:0">
        <div style="font-size:11px;font-weight:800;margin-bottom:2px">${r.n || ''}</div>
        <div style="background:${r.n ? 'var(--gold)' : 'var(--border)'};border-radius:4px 4px 0 0;height:${Math.max(4, Math.round(r.n / rMax * 80))}px"></div>
        <div style="font-size:10px;color:var(--muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.sku || r.model)}</div>
      </div>`).join('')}
    </div>` +
    ranked.map(r => {
      const rate = r.n / spanDays;                    // units per day for this type
      const q = stockOf(r.sku);
      const daysLeft = rate > 0 ? Math.round(q / rate) : null;
      const warn = q === 0 ? '#ef4444' : (daysLeft !== null && daysLeft < 14) ? '#f59e0b' : 'var(--muted)';
      return `<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid var(--border);padding:6px 0;font-size:12px">
        <span style="font-weight:800;min-width:0">${esc(_bsModelOf(r))}${r.sku ? ` · ${esc(r.sku)}` : ''}</span>
        <span style="color:${warn};font-weight:700;white-space:nowrap">${r.n} · ${Math.round(r.n / Math.max(1, installs.length) * 100)}% · בארון ${q}${daysLeft !== null ? ` · ל-${daysLeft} ימים` : ''}</span>
      </div>`;
    }).join(''))}
  </div>`;

  // ── 4. what was bought against what went out ───────────────────────────
  const bought = _bsDeliveries.reduce((t, d) => t + (d.units || 0), 0);
  const boughtCost = _bsDeliveries.reduce((t, d) => t + (Number(d.total) || 0), 0);
  const outCost = installs.reduce((t, i) => t + priceOf(i), 0);
  html += _bsBox('קניות מול יציאות', `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    ${_bsCard('נקנו', bought, boughtCost ? money(boughtCost) + ' לפני מע״מ' : '')}
    ${_bsCard('הורכבו', installs.length, outCost ? money(outCost) + ' לפני מע״מ' : '')}
  </div>${bought ? `<div style="font-size:12px;color:var(--muted);margin-top:8px">מחיר ממוצע ליחידה שנקנתה: ${money(boughtCost / bought)}</div>` : ''}`);

  c.innerHTML = html;
}

function _bsRenderHistory() {
  const c = document.getElementById('bs-history');
  // מונה על הלשונית: כמה הרכבות עדיין לא סומנו כעודכנו בתוכנה
  const pending = _bsInstalls.filter(r => !r.paidSw).length;
  const nb = document.getElementById('bs-tab-installs');
  if (nb) { nb.textContent = pending; nb.style.display = pending ? '' : 'none'; }
  if (!c) return;
  const rows = [..._bsInstalls].sort((a, b) => String(b.installedAt).localeCompare(String(a.installedAt))).slice(0, 25);
  if (!rows.length) { c.innerHTML = `<div style="font-size:13px;color:var(--muted)">אין עדיין הרכבות</div>`; return; }
  c.innerHTML = rows.map(r => {
    const d = new Date(r.installedAt);
    const ds = isNaN(d) ? '' : d.toLocaleDateString('he-IL');
    // רכב שטרם עודכן תשלום בתוכנה — מסומן בצהוב עד שלוחצים
    const paid = !!r.paidSw;
    const rowStyle = paid ? 'border:2px solid var(--border);background:var(--card)' : 'border:2px solid #eab308;background:#fef9c3';
    const payBtn = paid
      ? `<button onclick="bsSetSwPaid('${r.id}',false)" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap" title="בטל סימון">✅ עודכן בתוכנה</button>`
      : `<button onclick="bsSetSwPaid('${r.id}',true)" style="background:#0d6ab0;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap">💳 עדכנתי תשלום בתוכנה</button>`;
    return `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;border-radius:12px;padding:10px 14px;margin-bottom:8px;${rowStyle}">
      <div style="flex:1 1 150px;min-width:0">
        <div style="font-weight:800;font-size:14px">🚗 <span onclick="bsmCopyPlate('${esc(r.plate)}')" title="העתק מספר רכב" style="cursor:pointer;border-bottom:1px dashed var(--border)">${esc(r.plate)}</span>${r.car ? ` <span style="font-weight:700;color:var(--muted);font-size:12px">· ${esc(r.car)}</span>` : ''}</div>
        <div style="font-size:12px;color:var(--muted)">${esc(_bsModelOf(r))}${r.note ? ' · ' + esc(r.note) : ''}</div>
      </div>
      ${(() => {
        // המחיר מגיע מהקטלוג לפי המק״ט, ואם אין שם — מהמחיר שנשמר על ההרכבה
        const pr = Number(_bsPriceOf(r));
        return pr ? `<div style="text-align:center;white-space:nowrap;flex-shrink:0">
            <div style="font-size:17px;font-weight:900;color:var(--gold);line-height:1.1">${pr.toLocaleString('he-IL')} ₪</div>
            <div style="font-size:10px;font-weight:700;color:var(--muted)">לפני מע״מ</div>
          </div>`
        : `<div style="font-size:12px;font-weight:800;color:var(--muted);white-space:nowrap;flex-shrink:0">אין מחיר</div>`;
      })()}
      <div style="font-size:12px;color:var(--muted);white-space:nowrap">${esc(ds)}</div>
      ${payBtn}
      <button onclick="bsDeleteInstall('${r.id}')" style="background:#ef4444;color:#fff;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer;flex-shrink:0" title="מחק">🗑</button>
    </div>`;
  }).join('');
}

// מסמן/מבטל "עודכן תשלום בתוכנה" על הרכבה. נשמר על המסמך.
async function bsSetSwPaid(id, val) {
  const r = _bsInstalls.find(x => x.id === id);
  if (r) r.paidSw = val;            // תגובה מיידית
  _bsRenderHistory();
  try {
    await _updateDoc(_docRef('battery_installs', id), { paidSw: val });
  } catch (e) {
    if (r) r.paidSw = !val;         // כשל — חזרה
    _bsRenderHistory();
    showToast('שמירת הסימון נכשלה');
  }
}
window.bsSetSwPaid = bsSetSwPaid;

/* One delivery can contain several battery types under a single invoice, so
   the form is a list of lines. Each line is a SKU, a type, a price and a
   quantity; the invoice and the note are shared by all of them. */
let _bsLines = [];
let _bsLineSeq = 0;

function openBsAddModal() {
  _bsImportFile = null;
  _bsImportBanner(true, '');
  _bsLines = [];
  bsAddLine();
  ['bs-invoice', 'bs-add-note'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  openModal('modal-bs-add');
}
window.openBsAddModal = openBsAddModal;

function bsAddLine() {
  _bsLines.push({ key: ++_bsLineSeq });
  _bsRenderLines();
}
window.bsAddLine = bsAddLine;

function bsRemoveLine(key) {
  if (_bsLines.length <= 1) return;
  _bsReadLines();
  _bsLines = _bsLines.filter(l => String(l.key) !== String(key));
  _bsRenderLines();
}
window.bsRemoveLine = bsRemoveLine;

// keep what is already typed when the list is redrawn
function _bsReadLines() {
  for (const l of _bsLines) {
    l.sku = document.getElementById(`bs-sku-${l.key}`)?.value ?? l.sku ?? '';
    l.model = document.getElementById(`bs-model-${l.key}`)?.value ?? l.model ?? '';
    l.price = document.getElementById(`bs-price-${l.key}`)?.value ?? l.price ?? '';
    l.qty = document.getElementById(`bs-qty-${l.key}`)?.value ?? l.qty ?? '';
  }
}

function _bsRenderLines() {
  const c = document.getElementById('bs-lines');
  if (!c) return;
  c.innerHTML = _bsLines.map((l, i) => `<div style="border:2px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px;background:var(--surface2)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-weight:900;font-size:13px;color:var(--muted)">סוג מצבר ${i + 1}</div>
        ${_bsLines.length > 1 ? `<button type="button" onclick="bsRemoveLine('${l.key}')" style="background:#ef4444;color:#fff;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer">✕</button>` : ''}
      </div>
      <div class="form-group" style="position:relative"><label>מק״ט <span style="color:#ef4444">*</span></label>
        <input class="form-input" id="bs-sku-${l.key}" autocomplete="off" placeholder="הקלד מק״ט" value="${esc(l.sku || '')}" oninput="_bsSkuInput('${l.key}')">
        <div id="bs-sku-dd-${l.key}" style="display:none;position:absolute;left:0;right:0;background:var(--card);border:2px solid var(--border);border-radius:10px;max-height:180px;overflow-y:auto;z-index:20"></div>
        <div id="bs-sku-msg-${l.key}" style="font-size:13px;font-weight:800;margin-top:6px"></div>
      </div>
      <div class="form-group"><label>סוג מצבר <span style="color:#ef4444">*</span></label>
        <input class="form-input" id="bs-model-${l.key}" autocomplete="off" placeholder="לדוגמה: 72Ah רגיל" value="${esc(l.model || '')}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label>מחיר ליחידה (לפני מע״מ)</label>
          <input class="form-input" id="bs-price-${l.key}" type="number" min="0" inputmode="numeric" placeholder="₪" value="${esc(l.price || '')}" oninput="_bsVatHint('bs-price-${l.key}','bs-price-vat-${l.key}')">
          <div id="bs-price-vat-${l.key}" style="font-size:12px;color:var(--muted);font-weight:700;margin-top:5px"></div></div>
        <div class="form-group"><label>כמות <span style="color:#ef4444">*</span></label>
          <input class="form-input" id="bs-qty-${l.key}" type="number" min="1" inputmode="numeric" placeholder="לדוגמה: 10" value="${esc(l.qty || '')}"></div>
      </div>
    </div>`).join('');
  for (const l of _bsLines) _bsVatHint(`bs-price-${l.key}`, `bs-price-vat-${l.key}`);
}

function _bsSkuInput(key) {
  const input = document.getElementById(`bs-sku-${key}`);
  const dd = document.getElementById(`bs-sku-dd-${key}`);
  const msg = document.getElementById(`bs-sku-msg-${key}`);
  if (!input || !dd) return;
  const v = input.value.trim();
  const hit = _bsCatFind(v);
  if (hit) {
    // a known SKU fills in the type and the price by itself
    document.getElementById(`bs-model-${key}`).value = hit.model || '';
    document.getElementById(`bs-price-${key}`).value = hit.price != null ? hit.price : '';
    _bsVatHint(`bs-price-${key}`, `bs-price-vat-${key}`);
    if (msg) { msg.style.color = '#166534'; msg.textContent = `✅ ${hit.model || ''}${hit.price ? ' · ' + Number(hit.price).toLocaleString('he-IL') + ' ₪' : ''}`; }
    dd.style.display = 'none';
    return;
  }
  if (msg) {
    msg.style.color = v ? '#92400e' : 'var(--muted)';
    msg.textContent = v ? 'מק״ט חדש — מלא סוג ומחיר והוא יישמר לפעם הבאה' : '';
  }
  const matches = _bsCatalog.filter(c => !v || String(c.sku).includes(v) || String(c.model || '').includes(v)).slice(0, 12);
  if (!matches.length) { dd.style.display = 'none'; return; }
  dd.innerHTML = matches.map(c => `<div onclick="_bsPickSku('${key}',this.dataset.s)" data-s="${esc(c.sku)}" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:14px">
      <b>${esc(c.sku)}</b> · ${esc(c.model || '')}${c.price ? ` · ${Number(c.price).toLocaleString('he-IL')} ₪` : ''}</div>`).join('');
  dd.style.display = 'block';
}
window._bsSkuInput = _bsSkuInput;

function _bsPickSku(key, sku) {
  document.getElementById(`bs-sku-${key}`).value = sku;
  document.getElementById(`bs-sku-dd-${key}`).style.display = 'none';
  _bsSkuInput(key);
}
window._bsPickSku = _bsPickSku;

async function submitBsAdd() {
  _bsReadLines();
  const invoice = document.getElementById('bs-invoice').value.trim();
  const note = document.getElementById('bs-add-note').value.trim();
  const lines = [];
  for (const [i, l] of _bsLines.entries()) {
    const sku = String(l.sku || '').trim();
    const model = String(l.model || '').trim();
    const qty = parseInt(l.qty, 10);
    if (!sku && !model && !l.qty) continue;   // an untouched line is simply skipped
    if (!sku) return showToast(`שורה ${i + 1}: נא להזין מק״ט`);
    if (!model) return showToast(`שורה ${i + 1}: נא להזין סוג מצבר`);
    if (!qty || qty < 1) return showToast(`שורה ${i + 1}: נא להזין כמות`);
    lines.push({ sku, model, price: l.price === '' || l.price == null ? null : Number(l.price), qty });
  }
  if (!lines.length) return showToast('נא למלא לפחות סוג מצבר אחד');
  const dup = _bsInvoiceUsed(invoice);
  if (dup) {
    const when = dup.invoiceDate || (dup.at ? new Date(dup.at).toLocaleDateString('he-IL') : '');
    _bsImportBanner(false, `⚠️ המצברים מההזמנה הזאת כבר עלו.<br>חשבונית ${esc(invoice)} נקלטה${when ? ' ב-' + esc(when) : ''} · ${dup.units || 0} יחידות.`);
    return showToast(`⚠️ המצברים מההזמנה הזאת כבר עלו — חשבונית ${invoice}`, 8000);
  }
  try {
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    let added = 0;
    for (const ln of lines) {
      // a SKU typed here for the first time is learned, so next time it fills in
      await setDoc(_docRef('battery_catalog', _bsSkuId(ln.sku)), { sku: ln.sku, model: ln.model, price: ln.price, updatedAt: _serverTs() }, { merge: true });
      // stock is grouped by SKU; rows saved before SKUs existed are matched by type
      const existing = _bsStock.find(r => r.sku === ln.sku) || _bsStock.find(r => !r.sku && r.model === ln.model);
      if (existing) {
        await _updateDoc(_docRef('battery_stock', existing.id), {
          qty: (existing.qty || 0) + ln.qty, sku: ln.sku, model: ln.model, price: ln.price,
          ...(invoice ? { invoice } : {}), updatedAt: _serverTs()
        });
      } else {
        await _addDoc(_colRef('battery_stock'), { ...ln, invoice, note, createdBy: currentUser.name, createdAt: _serverTs(), updatedAt: _serverTs() });
      }
      // every delivery is also logged on its own, so an invoice is tied to the
      // exact quantity that came in and is never overwritten by the next one
      await _addDoc(_colRef('battery_purchases'), {
        ...ln, invoice, note, at: new Date().toISOString(), createdBy: currentUser.name, createdAt: _serverTs()
      });
      added += ln.qty;
    }
    // one row per delivery for the order history — the invoice file rides along
    // when the delivery came from a file
    const fromFile = _bsImportFile?.lines?.length ? _bsImportFile : null;
    await _addDoc(_colRef('battery_deliveries'), {
      at: new Date().toISOString(),
      invoice: invoice || _bsImportFile?.invoice || '',
      invoiceDate: _bsImportFile?.date || '',
      // what the invoice said, even if a line was taken off the form
      lines: fromFile ? fromFile.lines : lines,
      units: fromFile ? fromFile.units : added,
      total: fromFile ? fromFile.total : lines.reduce((t, l) => t + (l.price || 0) * l.qty, 0),
      // and what actually went into the cabinet
      addedLines: lines, addedUnits: added,
      note,
      ...(_bsImportFile?.data ? { fileName: _bsImportFile.name, file: _bsImportFile.data } : {}),
      ...(_bsImportFile?.url ? { fileName: _bsImportFile.name, fileUrl: _bsImportFile.url } : {}),
      createdBy: currentUser.name, createdAt: _serverTs()
    });
    _bsImportFile = null;
    closeModal('modal-bs-add');
    showToast(`✅ נוספו ${added} מצברים לארון${lines.length > 1 ? ` (${lines.length} סוגים)` : ''}`);
  } catch (e) { showToast('שגיאה בשמירה: ' + (e.code || e.message)); }
}
window.submitBsAdd = submitBsAdd;

/* ═══ reading a supplier invoice (PDF) ═══════════════════════════════
   The supplier's file carries a broken character table — the codes inside it
   are the real characters shifted by a fixed amount, and only every other
   entry is listed. Both blocks are recovered below. Nothing is trusted on
   faith: the quantities and prices read out must satisfy the invoice's own
   arithmetic before a single field is filled in. */
async function _bsInflate(bytes) {
  const ds = new DecompressionStream('deflate');
  const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}
function _bsLatin(bytes) { let s = ''; const CH = 8192;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return s; }
// The supplier's file carries a broken character table: the codes in it are the
// real characters shifted by a fixed amount, and only every other entry is
// listed. Both blocks are recovered here.
function _bsFixChar(c) {
  if (c >= 3 && c <= 130) return String.fromCharCode(c + 0x1d);
  if (c >= 640 && c <= 800) return String.fromCharCode(c + 0x330);
  if (c >= 1488 && c <= 1514) return String.fromCharCode(c);
  return '';
}
// Every piece of text with the position it is printed at, so the invoice can be
// read by its columns instead of by guesswork.
async function _bsPdfCells(buf) {
  const bytes = new Uint8Array(buf);
  const raw = _bsLatin(bytes);
  let best = '';
  let pos = 0;
  while (true) {
    const i = raw.indexOf('stream', pos);
    if (i < 0) break;
    let st = i + 6;
    if (raw[st] === '\r') st++;
    if (raw[st] === '\n') st++;
    const en = raw.indexOf('endstream', st);
    if (en < 0) break;
    pos = en + 9;
    let end = en;
    while (end > st && (raw[end - 1] === '\n' || raw[end - 1] === '\r')) end--;
    for (const e2 of [end, en]) {
      try {
        const inf = _bsLatin(await _bsInflate(bytes.subarray(st, e2)));
        if (inf.indexOf('Tj') >= 0 && inf.length > best.length) best = inf;
        break;
      } catch (e) { /* not a deflate stream, or a different trim — try next */ }
    }
  }
  if (!best) return [];
  const cells = [];
  let tm = null, tlm = null;
  const re = /BT|ET|(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm|(-?[\d.]+)\s+(-?[\d.]+)\s+T[dD]|\((.*?)\)\s*Tj/gs;
  let m;
  while ((m = re.exec(best))) {
    if (m[0] === 'BT') { tm = tlm = [0, 0]; continue; }
    if (m[0] === 'ET') continue;
    if (m[1] !== undefined) { tlm = [Number(m[5]), Number(m[6])]; tm = tlm.slice(); continue; }
    if (m[7] !== undefined) { if (!tlm) tlm = [0, 0]; tlm = [tlm[0] + Number(m[7]), tlm[1] + Number(m[8])]; tm = tlm.slice(); continue; }
    const s = m[9].replace(/\\([()\\])/g, '$1').replace(/\\r/g, '\x00\r').replace(/\\n/g, '\x00\n');
    let t = '';
    for (let i = 0; i + 1 < s.length; i += 2) t += _bsFixChar((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1));
    t = t.trim();
    if (t && tm) cells.push({ y: Math.round(tm[1] * 10) / 10, x: Math.round(tm[0] * 10) / 10, t });
  }
  return cells;
}
const _bsIsNum = t => /^\d{1,3}(,\d{3})*(\.\d+)?$/.test(t);
const _bsNum = t => Number(String(t).replace(/,/g, ''));

/* The item table is read by its own column headings — מק"ט, מחיר ליחידה, כמות
   and so on — so a value is taken from the field it is printed in and never
   inferred from how the number looks. */
function _bsParseInvoice(cells) {
  const all = cells.map(c => c.t).join(' ');
  const invoice = (all.match(/SI\d{6,}/) || [''])[0];
  const date = (all.match(/\d{2}\/\d{2}\/\d{2}/) || [''])[0];

  const rows = new Map();
  for (const c of cells) {
    if (!rows.has(c.y)) rows.set(c.y, []);
    rows.get(c.y).push(c);
  }
  for (const r of rows.values()) r.sort((a, b) => b.x - a.x);   // right to left

  const ys = [...rows.keys()].sort((a, b) => b - a);
  const headY = ys.find(y => rows.get(y).some(c => c.t.includes('ט"קמ')));
  if (headY === undefined) return { error: 'לא זוהתה טבלת הפריטים' };
  const head = rows.get(headY);
  const colX = name => head.find(c => c.t.includes(name))?.x;
  const cols = {
    sku:      colX('ט"קמ'),
    consumer: colX('ןכרצל ריחמ'),
    unit:     colX('הדיחיל ריחמ'),
    qty:      colX('תומכ'),
    total:    colX('כ"הס'),
  };
  if (cols.unit === undefined || cols.qty === undefined || cols.sku === undefined) {
    return { error: 'לא זוהו העמודות בטבלה' };
  }
  const numCols = [['consumer', cols.consumer], ['unit', cols.unit], ['qty', cols.qty], ['total', cols.total]]
    .filter(([, x]) => x !== undefined);
  const colOf = x => numCols.reduce((best, c) => Math.abs(x - c[1]) < Math.abs(x - best[1]) ? c : best)[0];

  const endY = ys.find(y => y < headY && rows.get(y).some(c => c.t.includes('תומכ כ"הס')));
  const items = [];
  for (const y of ys) {
    if (y >= headY || (endY !== undefined && y <= endY)) continue;
    const row = rows.get(y);
    // a number counts only if it is printed inside one of the price columns —
    // a bare number in the description is not a price
    const nums = row.filter(c => _bsIsNum(c.t) &&
      numCols.some(([, x]) => Math.abs(c.x - x) <= 70));
    if (nums.length < 3) continue;
    const f = {};
    for (const c of nums) { const k = colOf(c.x); if (f[k] === undefined) f[k] = _bsNum(c.t); }
    if (f.unit === undefined || f.qty === undefined) continue;
    // the SKU column is the right-hand edge of the table
    const skuCell = row[0];
    const sku = skuCell ? skuCell.t : '';
    // the description occupies the space between the SKU column and the first
    // price printed on the row — including any bare number inside it, which is
    // usually the amperage
    const priceEdge = Math.max(...nums.map(c => c.x));
    const descCells = row.filter(c => c !== skuCell && c.x > priceEdge + 20);
    items.push({
      sku,
      descCells: descCells.map(c => c.t),
      desc: descCells.map(c => /[֐-׿]/.test(c.t) ? c.t.split('').reverse().join('') : c.t).join(' ').replace(/\s+/g, ' ').trim(),
      qty: f.qty, unit: f.unit, total: f.total ?? f.unit * f.qty,
    });
  }
  const sum = items.reduce((s, it) => s + it.total, 0);
  const tail = cells.filter(c => endY !== undefined && c.y <= endY && _bsIsNum(c.t)).map(c => _bsNum(c.t));
  const checks = {
    lines: items.length > 0 && items.every(it => Math.abs(it.unit * it.qty - it.total) < 0.02),
    total: tail.some(v => Math.abs(v - sum) < 0.02),
  };
  return { invoice, date, items, checks, sum };
}

/* The amperage is taken from the words around it — the figure next to "אמפר",
   or the one written after the battery technology (EFB / AGM) — never from a
   number that merely looks like an amperage. */
const _BS_ORIGINS = ['אירופאי', 'יפני', 'קוריאני', 'אמריקאי', 'סיני'];

function _bsCleanModel(item) {
  const cells = (item.descCells || []).map(t => /[֐-׿]/.test(t) ? t.split('').reverse().join('') : t);
  const text = cells.join(' ');
  let amp = null;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    let m = c.match(/(?:EFB|AGM|MF)\s*(\d{2,3})/i) || c.match(/(\d{2,3})\s*(?:AH|אמפר)/i) || c.match(/אמפר\s*(\d{2,3})/);
    if (m) { amp = Number(m[1]); break; }
    // the figure printed in the cell next to the word אמפר
    if (/^אמפר$/.test(c.trim())) {
      for (const nb of [cells[i - 1], cells[i + 1]]) {
        const n = String(nb || '').match(/^\d{2,3}$/);
        if (n) { amp = Number(n[0]); break; }
      }
      if (amp) break;
    }
  }
  if (!amp) return text.replace(/\s+/g, ' ').trim();
  const parts = [amp + ' אמפר'];
  const tech = (text.match(/\b(EFB|AGM)\b/i) || [])[1];
  if (tech) parts.push(tech.toUpperCase());
  if (/סטרט\s*סטופ|start\s*stop/i.test(text)) parts.push('סטרט סטופ');
  const origin = _BS_ORIGINS.find(o => text.includes(o));
  if (origin) parts.push(origin);
  return parts.join(' ');
}

function _bsImportBanner(ok, html) {
  const el = document.getElementById('bs-import-banner');
  if (!el) return;
  el.style.display = html ? 'block' : 'none';
  el.style.background = ok ? '#dcfce7' : '#fee2e2';
  el.style.color = ok ? '#166534' : '#991b1b';
  el.innerHTML = html || '';
}

let _bsImportFile = null;   // the invoice PDF that filled the form, kept for the archive

async function bsImportInvoice(input) {
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  _bsImportFile = null;
  showToast('📄 קורא את החשבונית...');
  let r;
  try {
    const cells = await _bsPdfCells(await f.arrayBuffer());
    if (!cells.length) return showToast('⚠️ לא הצלחנו לקרוא טקסט מהקובץ — אפשר להוסיף ידנית', 6000);
    r = _bsParseInvoice(cells);
  } catch (e) {
    console.error('invoice import', e);
    return showToast('⚠️ שגיאה בקריאת הקובץ — אפשר להוסיף ידנית', 6000);
  }
  if (r.error || !r.items?.length) return showToast('⚠️ לא זוהו שורות מוצר בקובץ — אפשר להוסיף ידנית', 6000);
  if (!r.checks.lines || !r.checks.total) {
    // the numbers do not add up, so they are not offered at all
    return showToast('⚠️ הסכומים בקובץ לא הסתדרו בבדיקה — נא להוסיף ידנית', 7000);
  }
  // fill the manual form instead of writing anything, so every line is seen
  // and confirmed before it touches the cabinet
  const dup = _bsInvoiceUsed(r.invoice);
  if (dup) {
    const when = dup.invoiceDate || (dup.at ? new Date(dup.at).toLocaleDateString('he-IL') : '');
    return showToast(`⚠️ המצברים מההזמנה הזאת כבר עלו — חשבונית ${r.invoice} נקלטה${when ? ' ב-' + when : ''}`, 8000);
  }
  // the packaging line is not a battery — it is dropped from the form, but it
  // still counts in the arithmetic check above, which is what validates the file
  const goods = r.items.filter(it => !/אריזה|אריזות/.test(it.desc || '') && !/אריזה/.test(it.sku || ''));
  const dropped = r.items.length - goods.length;
  if (!goods.length) return showToast('⚠️ לא נמצאו מצברים בחשבונית — אפשר להוסיף ידנית', 6000);
  _bsLines = goods.map(it => {
    const known = _bsCatFind(it.sku);
    return { key: ++_bsLineSeq, sku: it.sku, model: known?.model || _bsCleanModel(it), price: String(it.unit), qty: String(it.qty) };
  });
  _bsRenderLines();
  const inv = document.getElementById('bs-invoice');
  if (inv) inv.value = r.invoice || '';
  const note = document.getElementById('bs-add-note');
  if (note) note.value = r.date ? 'חשבונית מתאריך ' + r.date : '';
  // The order history records the invoice as it came in — every line that was
  // on it and its own total. Removing a line from the form below takes it off
  // the cabinet, it does not rewrite what the supplier sent.
  const origLines = goods.map(it => {
    const known = _bsCatFind(it.sku);
    return { sku: it.sku, model: known?.model || _bsCleanModel(it), price: Number(it.unit) || null, qty: Number(it.qty) || 0 };
  });
  _bsImportFile = {
    name: f.name, invoice: r.invoice || '', date: r.date || '', data: '', url: '',
    lines: origLines,
    units: origLines.reduce((t, l) => t + l.qty, 0),
    total: origLines.reduce((t, l) => t + (l.price || 0) * l.qty, 0),
  };
  try {
    const b64 = await new Promise((res, rej) => {
      const fr = new FileReader(); fr.onload = e => res(e.target.result); fr.onerror = rej; fr.readAsDataURL(f);
    });
    // a document has a hard 1MB limit, so a large file goes to storage instead
    // of being dropped — either way the whole invoice is kept
    if (b64.length < 700000) _bsImportFile.data = b64;
    else if (window._uploadBytes && window._storageRef) {
      showToast('📤 מעלה את הקובץ...');
      const path = `battery_invoices/${Date.now()}_${f.name}`;
      const ref = window._storageRef(window._storage, path);
      await window._uploadBytes(ref, f);
      _bsImportFile.url = await window._getDownloadURL(ref);
    } else showToast('הקובץ גדול מדי לשמירה בהיסטוריה — הנתונים נקראו בכל זאת', 6000);
  } catch (e) { console.error('invoice keep', e); /* the import still works */ }
  _bsImportBanner(true, `✅ נקראה חשבונית ${r.invoice || ''}${r.date ? ' · ' + r.date : ''}<br>${goods.length} סוגי מצברים · הסכומים בחשבונית נבדקו ומסתדרים${dropped ? `<br>שורת אריזה דולגה` : ''}<br>עבור על השורות ותקן אם צריך, ואז שמור.`);
  openModal('modal-bs-add');
}
window.bsImportInvoice = bsImportInvoice;


/* ---- the SKU catalogue: entered once, used from then on ---- */
function openBsCatalogModal() {
  ['bsc-sku', 'bsc-model', 'bsc-price'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  _bsVatHint('bsc-price', 'bsc-price-vat');
  _bsRenderCatalog();
  openModal('modal-bs-catalog');
}
window.openBsCatalogModal = openBsCatalogModal;

function _bsRenderCatalog() {
  const c = document.getElementById('bsc-list');
  if (!c) return;
  if (!_bsCatalog.length) {
    c.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted)">עדיין לא נקלטו מק״טים</div>`;
    return;
  }
  c.innerHTML = _bsCatalog.map(x => `<div style="display:flex;align-items:center;gap:10px;border:2px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:900;font-size:14px">${esc(x.sku)}</div>
        <div style="font-size:13px;color:var(--muted);font-weight:700">${esc(x.model || '')}${x.price ? ` · ${Number(x.price).toLocaleString('he-IL')} ₪ לפני מע״מ` : ''}</div>
      </div>
      <button onclick="bsEditCatalog(this.dataset.s)" data-s="${esc(x.sku)}" style="background:var(--surface2);border:none;border-radius:8px;width:30px;height:30px;cursor:pointer">✏️</button>
      <button onclick="bsRemoveCatalog(this.dataset.s)" data-s="${esc(x.sku)}" style="background:#ef4444;color:#fff;border:none;border-radius:8px;width:30px;height:30px;cursor:pointer">🗑</button>
    </div>`).join('');
}

function bsEditCatalog(sku) {
  const x = _bsCatFind(sku);
  if (!x) return;
  document.getElementById('bsc-sku').value = x.sku;
  document.getElementById('bsc-model').value = x.model || '';
  document.getElementById('bsc-price').value = x.price != null ? x.price : '';
  _bsVatHint('bsc-price', 'bsc-price-vat');
  // the form sits above a long list — without this the click looks like it did
  // nothing at all
  const skuEl = document.getElementById('bsc-sku');
  skuEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('bsc-model').focus();
  skuEl.style.borderColor = 'var(--gold)';
  setTimeout(() => { skuEl.style.borderColor = ''; }, 1500);
  showToast(`✏️ עורך את ${x.sku} — שנה ולחץ שמור`);
}
window.bsEditCatalog = bsEditCatalog;

async function submitBsCatalog() {
  const sku = document.getElementById('bsc-sku').value.trim();
  const model = document.getElementById('bsc-model').value.trim();
  const priceRaw = document.getElementById('bsc-price').value;
  if (!sku) return showToast('נא להזין מק״ט');
  if (!model) return showToast('נא להזין סוג מצבר');
  try {
    // the SKU is encoded into the document id, so saving the same SKU updates it
    // instead of creating a second row for the same battery
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await setDoc(_docRef('battery_catalog', _bsSkuId(sku)), {
      sku, model, price: priceRaw === '' ? null : Number(priceRaw), updatedAt: _serverTs()
    }, { merge: true });
    ['bsc-sku', 'bsc-model', 'bsc-price'].forEach(id => { document.getElementById(id).value = ''; });
    _bsVatHint('bsc-price', 'bsc-price-vat');
    showToast('✅ המק״ט נשמר');
  } catch (e) { showToast('שגיאה בשמירה: ' + (e.code || e.message)); }
}
window.submitBsCatalog = submitBsCatalog;

async function bsRemoveCatalog(sku) {
  if (!confirm(`למחוק את המק״ט ${sku} מהרשימה? המלאי הקיים לא ייפגע.`)) return;
  try {
    const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(doc(window._db, 'battery_catalog', _bsSkuId(sku)));
    showToast('🗑️ נמחק');
  } catch (e) { showToast('שגיאה: ' + (e.code || e.message)); }
}
window.bsRemoveCatalog = bsRemoveCatalog;

/* read-only table of every battery type on record — for deciding which battery
   a particular car needs, without touching the catalogue itself */
function openBsTypesModal() {
  const q = document.getElementById('bs-types-search');
  if (q) q.value = '';
  _bsRenderTypes();
  openModal('modal-bs-types');
}
window.openBsTypesModal = openBsTypesModal;

/* ---- order history: one row per delivery, with its invoice file ---- */
function openBsHistoryModal() { _bsRenderDeliveries(); openModal('modal-bs-history'); }
window.openBsHistoryModal = openBsHistoryModal;

// an invoice may only be taken in once — the same delivery must never be
// counted into the cabinet twice
function _bsInvoiceUsed(inv) {
  const v = String(inv || '').trim().toUpperCase();
  if (!v) return null;
  return _bsDeliveries.find(d => String(d.invoice || '').trim().toUpperCase() === v) || null;
}

function _bsRenderDeliveries() {
  const c = document.getElementById('bs-history-list');
  if (!c) return;
  if (!_bsDeliveries.length) {
    c.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted)">עדיין לא נרשמו הזמנות</div>`;
    return;
  }
  c.innerHTML = _bsDeliveries.map(d => {
    const when = d.invoiceDate || (d.at ? new Date(d.at).toLocaleDateString('he-IL') : '');
    const kinds = (d.lines || []).map(l => `${esc(l.model || l.sku)} ×${l.qty}`).join(' · ');
    return `<div style="display:flex;align-items:center;gap:10px;border:2px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px;background:var(--card)">
      <div style="flex:1;min-width:0">
        <div style="font-weight:900;font-size:15px">🧾 ${esc(d.invoice || 'ללא מספר חשבונית')}</div>
        <div style="font-size:13px;color:var(--muted);font-weight:700"><span style="background:#fde68a;color:#78350f;border-radius:6px;padding:1px 7px;font-weight:900">${esc(when)}</span> · ${d.units || 0} יחידות${d.total ? ` · ${Number(d.total).toLocaleString('he-IL')} ₪ לפני מע״מ` : ''}</div>
        ${kinds ? `<div style="font-size:12px;color:var(--muted);margin-top:3px">${kinds}</div>` : ''}
        ${(d.addedUnits != null && d.addedUnits !== d.units) ? `<div style="font-size:12px;color:#b45309;font-weight:800;margin-top:3px">נכנסו לארון ${d.addedUnits} מתוך ${d.units}</div>` : ''}
      </div>
      ${(d.file || d.fileUrl)
        ? `<button onclick="bsOpenInvoiceFile('${d.id}')" style="background:#0369a1;color:#fff;border:none;border-radius:10px;padding:9px 14px;font-family:'Heebo',sans-serif;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap">📄 הקובץ</button>`
        : `<span style="font-size:12px;color:var(--muted);font-weight:700;white-space:nowrap">הוזן ידנית</span>`}
    </div>`;
  }).join('');
}

// data: URLs are blocked from opening directly, so the file is handed over as a
// real download instead
function bsOpenInvoiceFile(id) {
  const d = _bsDeliveries.find(x => x.id === id);
  if (d?.fileUrl) return void window.open(d.fileUrl, '_blank');
  if (!d?.file) return;
  try {
    const b64 = d.file.split(',')[1] || '';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = d.fileName || `חשבונית ${d.invoice || ''}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (e) { showToast('לא הצלחנו לפתוח את הקובץ'); }
}
window.bsOpenInvoiceFile = bsOpenInvoiceFile;

function _bsRenderTypes() {
  const c = document.getElementById('bs-types-table');
  if (!c) return;
  const q = (document.getElementById('bs-types-search')?.value || '').trim();
  const rows = _bsCatalog
    .filter(x => !q || String(x.sku).includes(q) || String(x.model || '').includes(q))
    .sort((a, b) => String(a.model || '').localeCompare(String(b.model || ''), 'he'));
  if (!rows.length) {
    c.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted)">${_bsCatalog.length ? 'לא נמצא סוג מתאים' : 'עדיין לא נקלטו מק״טים'}</div>`;
    return;
  }
  const stockOf = sku => _bsStock.filter(r => r.sku === sku).reduce((s, r) => s + (r.qty || 0), 0);
  c.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;direction:rtl">
    <thead><tr style="background:var(--dark);color:#fff">
      <th style="text-align:right;padding:9px 10px;border-radius:0 8px 0 0">סוג מצבר</th>
      <th style="text-align:right;padding:9px 10px">מק״ט</th>
      <th style="text-align:right;padding:9px 10px">לפני מע״מ</th>
      <th style="text-align:right;padding:9px 10px">כולל מע״מ</th>
      <th style="text-align:center;padding:9px 10px;border-radius:8px 0 0 0">בארון</th>
    </tr></thead><tbody>${rows.map(x => {
      const q2 = stockOf(x.sku);
      return `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:9px 10px;font-weight:800">${esc(x.model || '')}</td>
        <td style="padding:9px 10px;font-weight:700">${esc(x.sku)}</td>
        <td style="padding:9px 10px;white-space:nowrap">${x.price ? Number(x.price).toLocaleString('he-IL') + ' ₪' : '—'}</td>
        <td style="padding:9px 10px;white-space:nowrap;color:var(--muted)">${x.price ? _fmtIls(_incVat(x.price)) : '—'}</td>
        <td style="padding:9px 10px;text-align:center;font-weight:900;color:${q2 ? 'var(--success)' : '#ef4444'}">${q2}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}
window._bsRenderTypes = _bsRenderTypes;

// the amperage written in the type name, used to order the list
function _bsAmpOf(row) {
  const m = String(_bsModelOf(row)).match(/\d{2,3}/);
  return m ? Number(m[0]) : Infinity;   // anything without an amperage goes last
}

function openBsIssueModal() {
  const sel = document.getElementById('bs-issue-model');
  // lowest amperage first, highest last
  const avail = _bsStock.filter(r => (r.qty || 0) > 0)
    .sort((a, b) => _bsAmpOf(a) - _bsAmpOf(b) || String(a.model || '').localeCompare(String(b.model || ''), 'he'));
  if (!avail.length) return showToast('אין מצברים במלאי — הוסף קודם לארון');
  sel.innerHTML = avail.map(r => `<option value="${esc(r.id)}">${r.sku ? esc(r.sku) + ' · ' : ''}${esc(_bsModelOf(r))} (${r.qty} במלאי)</option>`).join('');
  document.getElementById('bs-issue-plate').value = '';
  document.getElementById('bs-issue-note').value = '';
  document.getElementById('bs-issue-car').value = '';
  document.getElementById('bs-issue-msg').textContent = '';
  const d = new Date();
  document.getElementById('bs-issue-date').value =
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  openModal('modal-bs-issue');
}
window.openBsIssueModal = openBsIssueModal;

// pulls the car's details from the transport ministry, exactly like the parts
// catalogue does — a record with no make and no model is not treated as a match
async function bsIssueLookupPlate() {
  const plate = document.getElementById('bs-issue-plate').value.replace(/\D/g, '');
  const carEl = document.getElementById('bs-issue-car');
  const msgEl = document.getElementById('bs-issue-msg');
  const say = t => { if (msgEl) msgEl.textContent = t; };
  if (!plate) return say('נא להזין מספר רישוי');
  say('מחפש במשרד התחבורה…');
  try {
    const rec = await _pcFilterLookup(plate, plate);
    const maker = rec ? _cleanMaker(rec['tozeret_nm'] || '') : '';
    const model = rec ? (rec['kinuy_mishari'] || rec['degem_nm'] || '') : '';
    if (!rec || !(maker || model)) return say(window._plateRegistryEmpty ? 'מאגר משרד התחבורה בעדכון כרגע — אפשר למלא ידנית' : 'לא נמצא רכב במספר הזה — אפשר למלא ידנית');
    const parts = [maker, model, rec['shnat_yitzur'] || '', rec['tzeva_rechev'] || ''].filter(Boolean);
    carEl.value = parts.join(' ');
    say('✅ נמצא: ' + parts.join(' · '));
  } catch (e) {
    say('לא הצלחנו למשוך פרטים — אפשר למלא ידנית');
  }
}
window.bsIssueLookupPlate = bsIssueLookupPlate;

async function submitBsIssue() {
  const id = document.getElementById('bs-issue-model').value;
  const plate = document.getElementById('bs-issue-plate').value.replace(/\D/g, '');
  const date = document.getElementById('bs-issue-date').value;
  const car = document.getElementById('bs-issue-car').value.trim();
  const note = document.getElementById('bs-issue-note').value.trim();
  const row = _bsStock.find(r => r.id === id);
  if (!row) return showToast('נא לבחור מצבר');
  if (!plate) return showToast('נא להזין מספר רישוי');
  // the car's details are what make the record worth anything later — the
  // driver pulls them from the ministry before the fitting can be saved
  if (!car) {
    const el = document.getElementById('bs-issue-car');
    if (el) {
      el.style.borderColor = '#dc2626';
      setTimeout(() => { el.style.borderColor = ''; }, 2500);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return showToast('לחץ על 🔎 משוך פרטים כדי להביא את נתוני הרכב', 5000);
  }
  if ((row.qty || 0) < 1) return showToast('אין יחידות מהדגם הזה במלאי');
  try {
    // log first — a battery that left the cabinet must be recorded even if the
    // stock update fails, otherwise the history loses an installation
    await _addDoc(_colRef('battery_installs'), {
      model: row.model, sku: row.sku || '', price: row.price ?? null, stockId: id, plate, car,
      installedAt: date || new Date().toISOString().slice(0, 10),
      // ordered נכתב כבר עכשיו כדי שהשרת יוכל לסנן את "צריך להזמין"
      // במקום שהאפליקציה תמשוך את כל ההיסטוריה ותסנן בעצמה
      ordered: false,
      note, createdBy: currentUser.name, createdAt: _serverTs()
    });
    await _updateDoc(_docRef('battery_stock', id), { qty: Math.max(0, (row.qty || 0) - 1), updatedAt: _serverTs() });
    closeModal('modal-bs-issue');
    showToast(`✅ נרשם: ${row.model} לרכב ${plate}`);
  } catch (e) { showToast('שגיאה בשמירה: ' + (e.code || e.message)); }
}
window.submitBsIssue = submitBsIssue;

async function bsDeleteInstall(id) {
  const rec = _bsInstalls.find(r => r.id === id);
  if (!rec) return;
  if (!confirm(`למחוק את רישום ההרכבה לרכב ${rec.plate}? המצבר יוחזר למלאי.`)) return;
  try {
    const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(doc(window._db, 'battery_installs', id));
    const row = _bsStock.find(r => r.id === rec.stockId) || _bsStock.find(r => r.model === rec.model);
    if (row) await _updateDoc(_docRef('battery_stock', row.id), { qty: (row.qty || 0) + 1, updatedAt: _serverTs() });
    showToast('🗑️ הרישום נמחק והמצבר הוחזר למלאי');
  } catch (e) { showToast('שגיאה: ' + (e.code || e.message)); }
}
window.bsDeleteInstall = bsDeleteInstall;

window.openPartsCatalogScreen = openPartsCatalogScreen;
window.lookupPartsPlate = lookupPartsPlate;
window.pcCleanPlateInput = pcCleanPlateInput;
window.pcCopyVin = pcCopyVin;
