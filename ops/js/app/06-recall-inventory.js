/* ריקולים, קטלוג חלקים ובדיקת מלאי
   חלק 6 מתוך 13 של אפליקציית התפעול.
   הקבצים נטענים לפי הסדר ומתנהגים בדיוק כמו קובץ אחד — אין לשנות את הסדר. */
window.markChecked = markChecked;
/* ─── RECALL CHECK (manager) ───────────────────────────
   Stage 1: upload a plates file → auto-enrich each plate with manufacturer,
   model, year and VIN from the transport-ministry registry (gov.il).
   Stage 2 (importer recall lookup) plugs into the last column. */
let _recallRows = []; // {plate, tozeret, degem, shnat, misgeret, state: 'wait'|'ok'|'miss'|'err'}

// gov.il's tozeret_nm often appends the country of manufacture (e.g. "יונדאי צכיה",
// "טויוטה-יפן") — the recall lookup only needs the brand, so strip a trailing
// country name/prefix.
const _MFR_COUNTRIES = ['יפן','קוריאה','גרמניה','ארהב',"ארה\"ב",'צכיה','צ\'כיה','ספרד','איטליה','סין',
  'הודו','טורקיה','שוודיה','בריטניה','פורטוגל','סלובקיה','רומניה','פולין','בלגיה','צרפת','פרנסה',
  'מקסיקו','ברזיל','רוסיה','תאילנד','מלזיה','הונגריה','אוסטריה','הולנד','סלובניה','ארגנטינה','דרום אפריקה'];
function _stripMfrCountry(name) { return _cleanMaker(name); }

// Firestore (recall_status/current) is the single source of truth — it's
// updated by the daily automatic scan AND by this screen. Opening the screen
// must never push stale local/localStorage data over it (that would erase
// this morning's automatic results) — it only LISTENS.
let _recallStatusUnsub = null;
let _recallRunUnsub = null;
function openRecallScreen() {
  document.getElementById('recall-user-badge').textContent = currentUser.name;
  showScreen('recall');
  if (_recallStatusUnsub) _recallStatusUnsub();
  // report of the last run — success or failure — so a morning without a scan
  // can never look like a morning without recalls
  if (_recallRunUnsub) _recallRunUnsub();
  _listenRecallProgress();          // גם סריקת הבוקר תראה אחוזים, אם המסך פתוח
  _recallRunUnsub = _onSnap(_docRef('recall_status', 'lastRun'), snap => {
    _renderRecallLastRun(snap.exists() ? snap.data() : null);
  }, () => _renderRecallLastRun(null));
  _recallStatusUnsub = _onSnap(_docRef('recall_status', 'current'), snap => {
    const data = snap.exists() ? snap.data() : {};
    const cars = data.cars || [];
    _recallRows = cars.map(c => ({
      plate: c.plate, tozeret: c.tozeret, degem: c.degem, shnat: c.shnat, misgeret: c.misgeret || '',
      state: 'ok', recallState: 'open', recallDetails: c.recallDetails || null,
      resolved: !!c.resolved, taskCreated: !!c.taskId, taskId: c.taskId || null
    }));
    _renderRecallScanInfo(data);
    renderRecallTable();
    _recallUpdateHomeBadge();
  });
}

/* ── התקדמות הסריקה ─────────────────────────────────────────────────
   הסריקה רצה בשרת, ולכן היא מדווחת על עצמה: אחרי כל מנת רכבים היא כותבת
   כמה נסרקו מתוך כמה. המסך מקשיב לדיווח הזה ומצייר אחוזים.
   זה עובד גם לסריקה האוטומטית של הבוקר, אם המסך פתוח בזמן שהיא רצה.
─────────────────────────────────────────────────────────────────────── */
let _recallProgUnsub = null;
function _listenRecallProgress() {
  if (_recallProgUnsub) return;
  _recallProgUnsub = _onSnap(_docRef('recall_status', 'progress'), snap => {
    _renderRecallProgress(snap.exists() ? snap.data() : null);
  }, () => {});
}

function _renderRecallProgress(p) {
  const box = document.getElementById('recall-progress');
  const txt = document.getElementById('recall-progress-text');
  const bar = document.getElementById('recall-progress-bar');
  if (!box || !txt || !bar) return;
  // דיווח ישן נחשב לסריקה שנעצרה — לא משאירים פס תקוע על המסך
  const at = p?.at?.toDate ? p.at.toDate() : (p?.at ? new Date(p.at) : null);
  const fresh = at && (Date.now() - at.getTime()) < 3 * 60000;
  if (!p || !p.running || !fresh) { box.style.display = 'none'; return; }
  const total = p.total || 0, done = Math.min(p.done || 0, total);
  const pct = total ? Math.round(done / total * 100) : 0;
  box.style.display = 'block';
  bar.style.width = pct + '%';
  txt.textContent = `⏳ סורק… ${pct}% · ${done} מתוך ${total} רכבים`;
}

// run the same server-side scan on demand instead of waiting for 07:00
async function runRecallScanNow() {
  const btn = document.getElementById('recall-scan-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ סורק את כל המלאי... (עד כמה דקות)'; }
  _listenRecallProgress();
  try {
    const res = await fetch('https://europe-west1-anak-soharim.cloudfunctions.net/runRecallScanNow');
    const r = await res.json().catch(() => ({}));
    if (r.ok) {
      showToast(`✅ נסרקו ${r.checked} רכבים · ${r.withRecall} עם ריקול פתוח`, 6000);
    } else if (r.reason === 'unreliable') {
      showToast('⚠️ הסריקה לא הושלמה — משרד התחבורה לא הגיב. הרשימה הקודמת נשמרה.', 7000);
    } else {
      showToast('⚠️ הסריקה נכשלה: ' + (r.reason || r.error || res.status), 7000);
    }
  } catch(e) {
    showToast('⚠️ שגיאת חיבור לשרת: ' + e.message, 7000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 הרץ סריקה עכשיו'; }
    _renderRecallProgress(null);
  }
}
window.runRecallScanNow = runRecallScanNow;

const _RECALL_REASONS = {
  'inventory-fetch-failed': 'לא הצלחנו למשוך את רשימת הרכבים מהמערכת',
  'empty-inventory': 'רשימת הרכבים חזרה ריקה',
  'no-valid-plates': 'לא נמצאו מספרי רישוי תקינים',
  'unreliable': 'משרד התחבורה לא הגיב',
  'crashed': 'הסריקה נעצרה עקב שגיאה',
};

function _renderRecallLastRun(d) {
  const box = document.getElementById('recall-run-banner');
  if (!box) return;
  const paint = (bg, col, html) => {
    box.style.display = 'block'; box.style.background = bg; box.style.color = col;
    box.innerHTML = html;
  };
  if (!d || !d.at) {
    return paint('#fef3c7', '#92400e', '⏳ אין עדיין דיווח על ריצת סריקה. הסריקה רצה כל בוקר ב-07:00 (ראשון–שישי).');
  }
  const at = d.at?.toDate ? d.at.toDate() : new Date(d.at);
  const when = at.toLocaleDateString('he-IL') + ' בשעה ' + at.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' });
  const stale = (Date.now() - at.getTime()) > 26 * 3600000;
  if (d.ok && !stale) {
    return paint('#dcfce7', '#166534', `✅ הסריקה האחרונה רצה בהצלחה · ${when}`);
  }
  if (d.ok && stale) {
    return paint('#fee2e2', '#991b1b', `⚠️ לא רצה סריקה מאז ${when} — עברו יותר מיממה. כדאי להריץ סריקה ידנית.`);
  }
  paint('#fee2e2', '#991b1b',
    `⚠️ הסריקה האחרונה נכשלה · ${when}<br>סיבה: ${_RECALL_REASONS[d.reason] || d.reason || 'לא ידועה'}<br>אפשר להריץ סריקה ידנית מהכפתור למטה.`);
}

// report of the last automatic scan: when it ran and what it found
function _renderRecallScanInfo(data) {
  const box = document.getElementById('recall-scan-info');
  if (!box) return;
  const ts = data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : null);
  if (!ts) {
    box.innerHTML = '<div style="color:var(--muted)">⏳ טרם בוצעה סריקה אוטומטית. הסריקה רצה כל בוקר בשעה 07:00 (ראשון–שישי).</div>';
    return;
  }
  const cars = data.cars || [];
  const withRecall = cars.filter(c => !c.resolved).length;
  const resolved = cars.filter(c => c.resolved).length;
  const total = data.checkedCount || 0;
  const clean = total ? Math.max(0, total - cars.length) : null;
  const date = ts.toLocaleDateString('he-IL', { day:'numeric', month:'numeric', year:'numeric' });
  const time = ts.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' });
  // כמה רכבים היו במלאי וכמה דולגו — בלי זה "נסרקו 85" נראה כמו רכבים חסרים
  const inv = data.inventoryCount || 0;
  const feed = data.feedCount || 0;
  const bad = data.badPlateCount || 0;
  const badPlates = data.badPlates || [];
  const skipped = data.skippedCount || 0;
  const skippedPlates = data.skippedPlates || [];
  box.innerHTML =
    `<div style="font-weight:900;margin-bottom:4px">🔄 בוצעה סריקה · ${date} בשעה ${time}</div>` +
    (feed ? `<div>📥 התקבלו <b>${feed}</b> רכבים מהמלאי</div>` : '') +
    (bad ? `<div style="color:var(--muted)">📦 <b>${bad}</b> רכבים לפי הזמנה — עדיין אין להם מספר רישוי ולכן אין מה לבדוק</div>` : '') +
    (total ? `<div>נסרקו <b>${total}</b> רכבים${inv ? ` מתוך <b>${inv}</b> תקינים` : ''}</div>` : '') +
    (skipped ? `<div style="color:#92400e">⏭️ <b>${skipped}</b> רכבים עם מספר רישוי דולגו ידנית
        <button onclick="recallToggleSkipped()" style="background:none;border:none;color:#0d6ab0;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;padding:0 4px">הצג</button></div>
      <div id="recall-skipped-box" style="display:none;margin:6px 0 2px;padding:9px 11px;background:var(--card);border:2px solid var(--border);border-radius:10px">
        <div style="font-size:12.5px;font-weight:700;color:var(--muted);margin-bottom:6px">הרכבים האלה הוצאו מהסריקה ידנית:</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">${skippedPlates.map(p => `<span style="background:var(--surface2);border-radius:999px;padding:3px 10px;font-size:12.5px;font-weight:800;direction:ltr">${esc(p)}</span>`).join('')}</div>
        <button onclick="recallClearSkip()" style="margin-top:9px;background:#0d6ab0;color:#fff;border:none;border-radius:9px;padding:8px 14px;font-family:Heebo,sans-serif;font-size:12.5px;font-weight:800;cursor:pointer">✅ בטל את הדילוג — סרוק את כולם</button>
      </div>` : '') +
    (clean !== null ? `<div style="color:#166534">✅ <b>${clean}</b> רכבים ללא ריקול</div>` : '') +
    `<div style="color:${withRecall ? '#991b1b' : '#166534'}">${withRecall ? '⚠️' : '✅'} <b>${withRecall}</b> רכבים עם ריקול פתוח</div>` +
    (resolved ? `<div style="color:#166534">🔧 <b>${resolved}</b> טופלו — ממתינים להסרה ע״י משרד התחבורה</div>` : '');
}

function recallToggleSkipped() {
  const el = document.getElementById('recall-skipped-box');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
window.recallToggleSkipped = recallToggleSkipped;

/* רשימת הדילוג נבנתה מרכבים "לפי הזמנה" שטרם הגיעו. משהגיעו, אין סיבה
   להמשיך לדלג עליהם. הריקון נשמר בשרת ותופס בסריקה הבאה. */
async function recallClearSkip() {
  if (!confirm('לסרוק מעכשיו את כל הרכבים במלאי, בלי דילוג?')) return;
  if (!_requireNet('עדכון רשימת הדילוג')) return;
  try {
    await window._setDoc(_docRef('config', 'scan_filter'), { skipPlates: [] }, { merge: true });
    showToast('✅ הדילוג בוטל — הרץ סריקה עכשיו כדי לראות את כל הרכבים', 7000);
  } catch (e) { showToast('העדכון נכשל: ' + (e.code || e.message), 6000); }
}
window.recallClearSkip = recallClearSkip;

// persists the open-recall list to Firestore — this is what the daily
// automatic scan, the home-screen badge, and the 8:30 reminder all read.
async function _recallSyncFirestore() {
  try {
    const { setDoc, doc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const cars = _recallRows.filter(r => r.recallState === 'open').map(r => ({
      plate: r.plate, tozeret: r.tozeret, degem: r.degem, shnat: r.shnat, misgeret: r.misgeret,
      resolved: !!r.resolved, taskId: r.taskId || null
    }));
    await setDoc(doc(window._db, 'recall_status', 'current'), { cars, updatedAt: serverTimestamp() });
  } catch(e) { console.error('_recallSyncFirestore', e); }
  _recallUpdateHomeBadge();
}

function _recallUpdateHomeBadge() {
  const openCount = _recallRows.filter(r => r.recallState === 'open' && !r.resolved).length;
  _setCardBadge('recall', openCount, '#ef4444');
  _recallUpdateHomeButton(openCount);
}

// Home-screen recall button: gold while nothing needs doing, red with a warning
// sign the moment an unresolved recall exists.
function _recallUpdateHomeButton(openCount) {
  const btn = document.getElementById('menu-card-recall');
  if (!btn) return;
  const warn = document.getElementById('recall-home-warn');
  const cnt  = document.getElementById('recall-home-count');
  const hasOpen = openCount > 0;
  btn.style.background = hasOpen
    ? 'linear-gradient(135deg,#ef4444,#b91c1c)'
    : 'linear-gradient(135deg,#d4a017,#b8860b)';
  btn.style.color = hasOpen ? '#fff' : '#000';
  if (warn) warn.style.display = hasOpen ? 'inline' : 'none';
  if (cnt) {
    cnt.style.display = hasOpen ? 'inline-block' : 'none';
    cnt.textContent = hasOpen ? openCount : '';
  }
}
window._recallUpdateHomeButton = _recallUpdateHomeButton;

async function recallOpenTask(plate) {
  const row = _recallRows.find(r => r.plate === plate);
  if (!row || row.taskCreated) return;
  const desc = [row.tozeret, row.degem, row.shnat ? `שנת ${row.shnat}` : ''].filter(Boolean).join(' ');
  const title = `⚠️ ריקול פתוח — ${row.plate}${desc ? ' · ' + desc : ''} — יש לקבוע תור לתיקון`;
  try {
    const ref = await _addDoc(_colRef('tasks'), {
      title, label: 'משימות בעדיפות עליונה', color: 'red', status: 'open',
      createdBy: currentUser.name, createdAt: _serverTs()
    });
    row.taskCreated = true;
    row.taskId = ref.id;
    localStorage.setItem('_recallData', JSON.stringify(_recallRows));
    renderRecallTable();
    showToast('✅ נוצרה משימה בלוח המשימות');
  } catch(e) { showToast('שגיאה ביצירת משימה: ' + (e.message || e)); }
}
window.recallOpenTask = recallOpenTask;

async function recallMarkResolved(plate) {
  const row = _recallRows.find(r => r.plate === plate);
  if (!row) return;
  row.resolved = true;
  if (row.taskId) {
    try {
      const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await deleteDoc(doc(window._db, 'tasks', row.taskId));
    } catch(e) { console.error('recall task delete failed', e); }
    row.taskCreated = false;
    row.taskId = null;
  }
  localStorage.setItem('_recallData', JSON.stringify(_recallRows));
  renderRecallTable();
  _recallSyncFirestore();
}
window.recallMarkResolved = recallMarkResolved;



// Ministry of Transport's "vehicles pending recall repair" registry — a plate
// found here has an OPEN recall that hasn't been fixed yet. This resource
// (unlike the main vehicle registry) doesn't send CORS headers to browsers,
// so it's fetched via JSONP — CKAN's datastore_search supports a `callback`
// parameter, which bypasses CORS without needing any server of our own.
const _RECALL_RESOURCE = '36bf1404-0be4-49d2-82dc-2f1ead4a8b93';
const _sleep = ms => new Promise(r => setTimeout(r, ms));
// CKAN answers 409 for filter validation errors (e.g. a field name that
// doesn't exist in this resource) — so first LEARN the plate field's real
// name from a sample record, and if filtered queries still fail, fall back
// to free-text search (q=) which is what was verified to work.
let _recallPlateField = null;
async function _recallLearnField() {
  if (_recallPlateField) return _recallPlateField;
  const res = await fetch(`https://europe-west1-anak-soharim.cloudfunctions.net/govilProxy?resource_id=${_RECALL_RESOURCE}&limit=1`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  const rec = json?.result?.records?.[0] || {};
  // prefer a field whose name mentions rechev/mispar and whose value looks like a plate
  const keys = Object.keys(rec).filter(k => !k.startsWith('_'));
  let best = keys.find(k => /rechev|rishuy|mispar/i.test(k) && /^\d{6,9}$/.test(String(rec[k]).replace(/\D/g,'')));
  if (!best) best = keys.find(k => /^\d{6,9}$/.test(String(rec[k]).replace(/\D/g,'')));
  _recallPlateField = best || 'mispar_rechev';
  console.log('recall plate field =', _recallPlateField, 'sample record keys:', keys);
  return _recallPlateField;
}
async function _recallQueryBatch(plates, attempt = 0) {
  const field = await _recallLearnField();
  const filters = encodeURIComponent(JSON.stringify({ [field]: plates.map(Number) }));
  const url = `https://europe-west1-anak-soharim.cloudfunctions.net/govilProxy?resource_id=${_RECALL_RESOURCE}&filters=${filters}&limit=${plates.length * 5}`;
  const res = await fetch(url);
  if (res.status === 409) throw new Error('VALIDATION'); // wrong field/filter — don't retry, switch strategy
  if (!res.ok) {
    if (attempt < 2) { await _sleep(1000 * Math.pow(2, attempt)); return _recallQueryBatch(plates, attempt + 1); }
    throw new Error('HTTP ' + res.status);
  }
  const json = await res.json();
  if (!json?.success) throw new Error('CKAN error');
  return json.result?.records || [];
}
// free-text fallback — verified to work against this resource (q=<plate>)
async function _recallQueryQ(plate) {
  const res = await fetch(`https://europe-west1-anak-soharim.cloudfunctions.net/govilProxy?resource_id=${_RECALL_RESOURCE}&q=${plate}&limit=5`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json?.success) throw new Error('CKAN error');
  // free-text search can match other fields too — keep only records where some
  // field's digits equal the plate exactly
  return (json.result?.records || []).filter(rec =>
    Object.entries(rec).some(([k, v]) => !k.startsWith('_') && String(v).replace(/\D/g, '') === plate));
}
async function _recallCheckAll() {
  const banner = document.getElementById('recall-status-banner');
  const targets = _recallRows.filter(r => r.recallState !== 'open' && r.recallState !== 'none');
  if (!targets.length) { renderRecallTable(); return; }
  targets.forEach(r => r.recallState = 'checking');
  renderRecallTable();
  const BATCH = 40;
  let done = 0;
  let useQ = false; // once filtered queries prove invalid, stay on free-text mode
  for (let i = 0; i < targets.length; i += BATCH) {
    const chunk = targets.slice(i, i + BATCH);
    let batchOk = false;
    if (!useQ) {
      try {
        const recs = await _recallQueryBatch(chunk.map(r => r.plate));
        const byPlate = {};
        for (const rec of recs) {
          for (const [k, v] of Object.entries(rec)) {
            if (k.startsWith('_')) continue;
            const d = String(v).replace(/\D/g, '');
            if (d.length >= 6 && d.length <= 9) (byPlate[d] = byPlate[d] || []).push(rec);
          }
        }
        for (const row of chunk) {
          if (byPlate[row.plate]?.length) { row.recallState = 'open'; row.recallDetails = [...new Set(byPlate[row.plate])]; }
          else { row.recallState = 'none'; }
        }
        batchOk = true;
      } catch(e) {
        console.error('recall batch query failed — switching to free-text mode', e);
        useQ = true;
      }
    }
    if (!batchOk) {
      // free-text search per plate — slower but verified to work
      for (const row of chunk) {
        try {
          const recs = await _recallQueryQ(row.plate);
          if (recs.length) { row.recallState = 'open'; row.recallDetails = recs; }
          else { row.recallState = 'none'; }
        } catch(e2) { row.recallState = 'err'; }
        done++;
        if (banner) banner.innerHTML = `⏳ בודק ריקולים פתוחים... ${Math.min(done, targets.length)}/${targets.length}`;
        await _sleep(250);
      }
      renderRecallTable();
      continue;
    }
    done += chunk.length;
    if (banner) banner.innerHTML = `⏳ בודק ריקולים פתוחים... ${Math.min(done, targets.length)}/${targets.length}`;
    renderRecallTable();
    if (i + BATCH < targets.length) await _sleep(400); // stay under the rate limit
  }
  localStorage.setItem('_recallData', JSON.stringify(_recallRows));
  if (banner) banner.style.display = 'none'; // the list itself now shows the final result
  renderRecallTable();
  _recallSyncFirestore();
}

function renderRecallTable() {
  const c = document.getElementById('recall-list');
  if (!c) return;
  const open = _recallRows.filter(r => r.recallState === 'open' && !r.resolved);
  const resolved = _recallRows.filter(r => r.recallState === 'open' && r.resolved);
  const errNote = '';
  if (!open.length && !resolved.length) {
    c.innerHTML = `<div class="empty-state" style="padding:40px 20px;text-align:center;color:#166534">✅ אין רכבים עם ריקול פתוח</div>`;
    return;
  }
  const cardHtml = (r, isResolved) => {
    const details = (r.recallDetails || []).map(rec =>
      Object.entries(rec).filter(([k]) => !k.startsWith('_')).map(([k,v]) => `<div style="display:flex;gap:6px;font-size:12px;padding:2px 0"><div style="font-weight:700;color:var(--muted);min-width:100px">${esc(k)}</div><div>${esc(String(v))}</div></div>`).join('')
    ).join('<div style="height:6px"></div>');
    const border = isResolved ? '#22c55e' : '#ef4444', bg = isResolved ? '#f0fff4' : '#fff5f6', titleColor = isResolved ? '#166534' : '#991b1b';
    return `<div style="border:2px solid ${border};background:${bg};border-radius:14px;padding:14px 16px;margin-bottom:12px">
      <div style="font-weight:900;font-size:16px;color:${titleColor};margin-bottom:6px">🚗 ${esc(r.plate)} · ${esc(r.tozeret)||'—'} ${esc(r.degem)||''} ${r.shnat?`(${esc(String(r.shnat))})`:''}</div>
      ${r.misgeret ? `<div style="font-size:12px;color:var(--muted);margin-bottom:8px;font-family:monospace">שלדה: ${esc(r.misgeret)}</div>` : ''}
      <div style="border-top:1px solid ${isResolved?'#bbf7d0':'#fecaca'};padding-top:8px">${details}</div>
      ${isResolved
        ? `<div style="margin-top:10px;font-weight:700;color:#166534;font-size:13px">🔧 הריקול בוצע — ממתין להסרה ע״י משרד התחבורה</div>`
        : `<div style="display:flex;gap:8px;margin-top:12px">
             <button onclick="recallOpenTask('${r.plate}')" ${r.taskCreated?'disabled':''} style="flex:1;background:${r.taskCreated?'#e5e7eb':'#7c3aed'};color:${r.taskCreated?'#6b7280':'#fff'};border:none;border-radius:10px;padding:9px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:${r.taskCreated?'default':'pointer'}">${r.taskCreated?'✓ נוצרה משימה':'🔧 פתח משימה'}</button>
             <button onclick="recallMarkResolved('${r.plate}')" style="flex:1;background:#22c55e;color:#fff;border:none;border-radius:10px;padding:9px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer">✅ הריקול בוצע</button>
           </div>`}
    </div>`;
  };
  c.innerHTML = errNote +
    (open.length ? `<div style="font-weight:800;font-size:14px;color:#991b1b;margin-bottom:10px">⚠️ נמצאו ${open.length} רכבים עם ריקול פתוח מתוך ${_recallRows.length}</div>` + open.map(r => cardHtml(r, false)).join('') : '') +
    (resolved.length ? resolved.map(r => cardHtml(r, true)).join('') : '');
}
window.openRecallScreen = openRecallScreen;
window._recallCheckAll = _recallCheckAll;

/* ─── PARTS CATALOG (manager) ──────────────────────────
   Stage 1: plate → vehicle details + VIN (misgeret) from the transport-ministry
   registry, cached per plate so a repeat lookup is instant. The VIN is what the
   user needs today in order to search importer/parts sites by hand.
   Stage 2 (parts supplier lookup) plugs into this same screen. */
const _PC_REGISTRY = '053cea08-09bc-40ec-8f7a-156f0677aff3';
let _pcCurrent = null; // last looked-up vehicle

function openPartsCatalogScreen() {
  document.getElementById('pc-user-badge').textContent = currentUser.name;
  // opening the screen must never show the previous vehicle's details
  _pcCurrent = null;
  document.getElementById('pc-plate').value = '';
  document.getElementById('pc-status').textContent = '';
  document.getElementById('pc-result').innerHTML = '';
  document.getElementById('pc-term').value = '';
  document.getElementById('pc-guide').innerHTML = '';
  showScreen('parts-catalog');
}

// the registry stores plates as digits only
function _pcNormalizePlate(raw) { return String(raw || '').replace(/\D/g, ''); }

// strip anything that isn't a digit as it's typed, keeping the caret in place
function pcCleanPlateInput(el) {
  const before = el.value;
  const clean = before.replace(/\D/g, '');
  if (clean === before) return;
  const pos = el.selectionStart;
  const removed = before.slice(0, pos).replace(/\D/g, '').length;
  el.value = clean;
  try { el.setSelectionRange(removed, removed); } catch (e) { /* not all inputs allow it */ }
}

// cached vehicles almost never change — read the cache before going out to gov.il
async function _pcReadCache(plate) {
  if (!window._getDoc || !window._docRef) return null;
  try {
    const snap = await window._getDoc(_docRef('parts_catalog_vehicles', plate));
    return snap.exists() ? snap.data() : null;
  } catch (e) { console.warn('parts cache read failed', e); return null; }
}

function _pcWriteCache(plate, data) {
  if (!window._setDoc || !window._docRef) return;
  // fire-and-forget — the user already has the result on screen
  Promise.resolve(window._setDoc(_docRef('parts_catalog_vehicles', plate), data, { merge: true }))
    .catch(e => console.warn('parts cache write failed', e));
}

// a stalled request on weak reception must not hold the whole lookup
function _pcFetch(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || 6000);
  return fetch(url, { signal: ctl.signal }).finally(() => clearTimeout(t));
}

/* מרשם הרכב חוסם ומאט מדי פעם, ואז שש שניות לא מספיקות והחיפוש נראה
   כאילו הוא לא עובד. ניסיון שני עם המתנה קצרה פותר את רוב המקרים. */
async function _pcFetchRetry(url) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await _pcFetch(url, 12000);
      if (res.ok) return res;
      last = new Error('HTTP ' + res.status);
      if (res.status < 500 && res.status !== 429) throw last;   // תשובה אמיתית — אין טעם לנסות שוב
    } catch (e) {
      last = (e && e.name === 'AbortError') ? new Error('התשובה לא הגיעה בזמן') : e;
    }
    if (i < 2) await new Promise(r => setTimeout(r, 800 * (i + 1)));
  }
  throw last || new Error('שגיאה לא ידועה');
}

// one filtered registry query; returns the record only if the plate matches exactly
async function _pcFilterLookup(plate, value) {
  const filters = encodeURIComponent(JSON.stringify({ mispar_rechev: value }));
  const res = await _pcFetchRetry(`https://europe-west1-anak-soharim.cloudfunctions.net/govilProxy?resource_id=${_PC_REGISTRY}&filters=${filters}&limit=1`);
  const json = await res.json();
  if (json && 'registryEmpty' in json) window._plateRegistryEmpty = !!json.registryEmpty;
  const rec = json?.result?.records?.[0];
  if (rec && _pcNormalizePlate(rec['mispar_rechev']) === plate) { _regCacheSet(plate, rec); return rec; }
  // המרשם הממשלתי ריק/חסר — ננסה את המטמון שלנו
  const cached = await _regCacheGet(plate);
  if (cached && _pcNormalizePlate(cached['mispar_rechev']) === plate) return cached;
  return null;
}

async function lookupPartsPlate() {
  const plate = _pcNormalizePlate(document.getElementById('pc-plate').value);
  const st = document.getElementById('pc-status');
  const out = document.getElementById('pc-result');
  const btn = document.getElementById('pc-search-btn');
  if (!plate) { st.style.color = '#dc2626'; st.textContent = 'נא להזין מספר רישוי'; return; }

  _pcCurrent = null;
  out.innerHTML = '';
  st.style.color = 'var(--muted)';
  st.textContent = '⏳ מחפש...';
  btn.disabled = true;

  let netFailed = false;
  const attempt = p => Promise.resolve(p).catch(e => { netFailed = true; console.warn('registry lookup failed', e); return null; });

  try {
    // Don't wait for the cache before asking the registry — both start together,
    // so a cache miss costs nothing and a cache hit still renders immediately.
    const cacheP = _pcReadCache(plate);
    // the registry stores the plate as text — this is the fast path and normally hits
    const textP = attempt(_pcFilterLookup(plate, plate));

    const cached = await cacheP;
    if (cached && cached.misgeret) {
      _pcCurrent = cached;
      st.textContent = '';
      _pcRenderVehicle(cached, true);
      return;
    }

    let rec = await textP;
    // some records are stored numerically — try that before the slow free-text path
    if (!rec) rec = await attempt(_pcFilterLookup(plate, Number(plate)));

    // last resort: free-text. It must return enough rows for the requested plate
    // to actually be among them, and the match is verified exactly.
    if (!rec) {
      rec = await attempt((async () => {
        const res2 = await _pcFetch(`https://europe-west1-anak-soharim.cloudfunctions.net/govilProxy?resource_id=${_PC_REGISTRY}&q=${plate}&limit=100`);
        const json2 = await res2.json();
        return json2?.result?.records?.find(r => _pcNormalizePlate(r['mispar_rechev']) === plate) || null;
      })());
    }

    if (!rec) {
      st.style.color = '#dc2626';
      st.textContent = netFailed
        ? '❌ שגיאה בחיפוש — בדוק חיבור לאינטרנט ונסה שוב'
        : (window._plateRegistryEmpty
          ? '⏳ מאגר משרד התחבורה בעדכון כרגע — נסו שוב מאוחר יותר'
          : '❌ הרכב לא נמצא במאגר משרד התחבורה');
      return;
    }

    const veh = {
      plate,
      misgeret:  rec['misgeret'] || '',
      tozeret:   _cleanMaker(rec['tozeret_nm'] || ''),
      degem:     rec['kinuy_mishari'] || rec['degem_nm'] || '',
      shnat:     rec['shnat_yitzur'] || '',
      degemManoa: rec['degem_manoa'] || '',
      tzeva:     rec['tzeva_rechev'] || '',
      fetchedAt: new Date().toISOString()
    };

    _pcCurrent = veh;
    st.textContent = '';
    _pcRenderVehicle(veh, false);
    if (veh.misgeret) _pcWriteCache(plate, veh);

  } catch (e) {
    console.error('parts plate lookup failed', e);
    st.style.color = '#dc2626';
    st.textContent = '❌ שגיאה בחיפוש — בדוק חיבור לאינטרנט ונסה שוב';
  } finally {
    btn.disabled = false;
  }
}

function _pcRenderVehicle(v, fromCache) {
  const out = document.getElementById('pc-result');
  const row = (label, val) => val
    ? `<div style="display:flex;gap:8px;font-size:14px;padding:4px 0"><div style="font-weight:700;color:var(--muted);min-width:90px">${esc(label)}</div><div>${esc(String(val))}</div></div>`
    : '';
  out.innerHTML = `
    <div style="border:2px solid var(--border);border-radius:16px;padding:16px;background:var(--card)">
      <div style="font-weight:900;font-size:17px;margin-bottom:10px">🚗 ${esc(v.plate)}</div>
      ${row('יצרן', v.tozeret)}
      ${row('דגם', v.degem)}
      ${row('שנה', v.shnat)}
      ${row('צבע', v.tzeva)}
      ${row('דגם מנוע', v.degemManoa)}
      <div style="margin-top:14px;border-top:2px solid var(--border);padding-top:12px">
        <div style="font-size:13px;font-weight:700;color:var(--muted);margin-bottom:6px">מספר שילדה</div>
        ${v.misgeret
          ? `<div style="display:flex;gap:8px;align-items:center">
               <div style="flex:1;font-family:monospace;font-size:17px;font-weight:700;letter-spacing:.04em;word-break:break-all">${esc(v.misgeret)}</div>
               <button onclick="pcCopyVin()" style="background:var(--gold);color:#000;border:none;border-radius:10px;padding:9px 14px;font-family:'Heebo',sans-serif;font-weight:700;font-size:13px;cursor:pointer;flex-shrink:0">📋 העתק</button>
             </div>`
          : `<div style="color:#dc2626;font-size:14px;font-weight:700">לא קיים מספר שילדה לרכב זה במאגר</div>`}
      </div>
      ${v.misgeret ? _pcCatalogsHtml(v.misgeret, v.tozeret) : ''}
      ${fromCache ? `<div style="margin-top:10px;font-size:12px;color:var(--muted)">⚡ נטען מהזיכרון</div>` : ''}
    </div>`;
}

/* Free manufacturer catalogues. They allow browsing by chassis number without
   registration, but block automated access — so the app opens them with the
   number ready instead of trying to read the part number itself. */
const _PC_CATALOGS = {
  partsouq: { key: 'partsouq', label: 'PartSouq', sub: 'אירופאיות וקוריאניות', direct: true },
  amayama:  { key: 'amayama',  label: 'Amayama',  sub: 'קטלוג יפני',            direct: false },
  '7zap':   { key: '7zap',     label: '7zap',     sub: 'כ-70 יצרנים',           direct: false },
};

// Japanese makes get the Japanese catalogue only; everything else gets the rest.
// the registry is not consistent about spelling — "ניסאן" and "ניסן" both appear
const _PC_JAPANESE = ['טויוטה','טויטה','לקסוס','מאזדה','מזדה','ניסאן','ניסן','אינפיניטי',
  'מיצובישי','מיצובושי','מיצובישי','סובארו','סוברו','סוזוקי','הונדה','אקורה',
  'דייהטסו','דיהטסו','דייהצו','איסוזו','איסוזה'];
function _pcIsJapanese(maker) {
  const m = String(maker || '').trim();
  return !!m && _PC_JAPANESE.some(j => m.includes(j));
}

function _pcCatalogsHtml(vin, maker) {
  const clean = vin.replace(/\s/g, '').toUpperCase();
  // The first character of the chassis number is the region of manufacture.
  // A Japanese make built in Europe (e.g. Nissan from the UK, "S...") is not in
  // the Japanese catalogue — a real lookup failed exactly this way.
  const builtInJapan = clean.charAt(0) === 'J';
  const jpMake = _pcIsJapanese(maker);

  let list, note = '';
  // A chassis number starting with J means the car was built in Japan, whatever
  // the registry called the make — that alone justifies the Japanese catalogue.
  if (builtInJapan) {
    list = [_PC_CATALOGS.amayama, _PC_CATALOGS.partsouq];
  } else if (jpMake) {
    list = [_PC_CATALOGS.partsouq, _PC_CATALOGS.amayama];
    note = 'הרכב יפני אך לא יוצר ביפן — הקטלוג היפני עלול לא לזהות אותו, לכן מתחילים מ-PartSouq.';
  } else {
    list = [_PC_CATALOGS.partsouq, _PC_CATALOGS['7zap']];
  }
  const short = clean.length !== 17;
  // the first catalogue in the list is the one to try first for this make
  const btn = (c, i) => `<button onclick="pcOpenCatalog('${c.key}')" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;background:${i===0?'#fffaf0':'var(--bg)'};border:2px solid ${i===0?'var(--gold)':'var(--border)'};border-radius:12px;padding:${i===0&&list.length>1?'16px 6px 10px':'10px 6px'};font-family:'Heebo',sans-serif;cursor:pointer">
      ${i===0 && list.length>1 ? `<span style="position:absolute;top:-9px;right:50%;transform:translateX(50%);background:var(--gold);color:#000;border-radius:999px;font-size:10px;font-weight:900;padding:1px 8px;white-space:nowrap">מומלץ</span>` : ''}
      <span style="font-weight:800;font-size:14px;color:var(--dark)">${esc(c.label)}</span>
      <span style="font-size:11px;color:var(--muted)">${esc(c.sub)}</span>
      <span style="font-size:11px;color:var(--muted)">${c.direct ? 'נפתח עם השילדה' : 'השילדה תועתק — הדבק'}</span>
    </button>`;
  return `<div style="margin-top:14px;border-top:2px solid var(--border);padding-top:12px">
    <div style="font-size:13px;font-weight:700;color:var(--muted);margin-bottom:8px">חיפוש מק"ט בקטלוג היצרן</div>
    ${short ? `<div style="font-size:12px;color:#b45309;font-weight:700;margin-bottom:8px">⚠️ מספר השילדה אינו באורך 17 תווים — ייתכן שהקטלוג לא יזהה אותו</div>` : ''}
    ${note ? `<div style="font-size:12px;color:#b45309;font-weight:700;margin-bottom:8px;line-height:1.6">ℹ️ ${esc(note)}</div>` : ''}
    <div style="display:flex;gap:8px;align-items:stretch">${list.map(btn).join('')}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:10px;line-height:1.6">
      ${list.length > 1 ? `התחל מ-${esc(list[0].label)}. אם הרכב לא נמצא שם — נסה את השני.<br>` : ''}
      בקטלוג מוצגים שרטוטי פירוק של הרכב — אתר את החלק בשרטוט וקבל את המק"ט שלו.
    </div>
  </div>`;
}

function pcOpenCatalog(key) {
  // the catalogues reject a chassis number that carries stray whitespace
  const vin = (_pcCurrent && _pcCurrent.misgeret || '').replace(/\s/g, '');
  if (!vin) return;
  // copy first, synchronously — the browser blocks window.open if we await here
  try {
    const ta = document.createElement('textarea');
    ta.value = vin;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (e) { /* opening the catalogue still helps without the copy */ }

  const urls = {
    partsouq: 'https://partsouq.com/en/search/all?q=' + encodeURIComponent(vin),
    amayama:  'https://www.amayama.com/en/genuine-catalogs',
    '7zap':   'https://7zap.com/en/vin-decoder/'
  };
  window.open(urls[key] || urls.partsouq, '_blank', 'noopener');
  showToast(key === 'partsouq' ? '🔎 נפתח עם מספר השילדה' : '📋 השילדה הועתקה — הדבק בשדה החיפוש', 3500);
}

function pcCopyVin() {
  const vin = _pcCurrent && _pcCurrent.misgeret;
  if (!vin) return;
  const done = () => showToast('✅ מספר השילדה הועתק');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(vin).then(done).catch(() => _pcCopyFallback(vin, done));
  } else {
    _pcCopyFallback(vin, done);
  }
}

// older in-app browsers have no clipboard API
