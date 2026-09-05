/* מגרש, פיטים וטלגרם
   חלק 11 מתוך 13 של אפליקציית התפעול.
   הקבצים נטענים לפי הסדר ומתנהגים בדיוק כמו קובץ אחד — אין לשנות את הסדר. */
window.filterParts = filterParts;
window.updatePartStatus = updatePartStatus;
window.openModal = openModal;
window.closeModal = closeModal;
window.openTasksScreen = openTasksScreen;
window.openVehiclesScreen = openVehiclesScreen;
window.openPartsScreen = openPartsScreen;
window.openYardScreen = openYardScreen;
window.startYard = startYard;
window.saveYard = saveYardDraft;
window.resetYard = resetYard;

/* ═══════════════════════════════════════════════════════
   PITS SCREEN
═══════════════════════════════════════════════════════ */

var pitsUnsub = null;

function openPitsScreen() {
  document.getElementById('pits-user-badge').textContent = currentUser.name;
  const toolbar = document.getElementById('pits-manager-toolbar');
  if (toolbar) toolbar.style.display = currentUser.role === 'manager' ? 'flex' : 'none';
  showScreen('pits');
  loadPits();
}

function _pitCard(p, isManager, showArchiveBtn) {
  const ts = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString('he-IL') : '';
  const sent = p.status === 'sent';
  const archived = p.status === 'archived';
  const borderColor = archived ? '#94a3b8' : sent ? '#22c55e' : 'var(--gold)';
  const statusBadge = archived
    ? `<span style="background:#94a3b8;color:#fff;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700">📁 בארכיון</span>`
    : sent
      ? `<span style="background:#22c55e;color:#fff;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700">✅ נשלח</span>`
      : `<span style="background:var(--gold);color:#000;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700">⏳ ממתין לביצוע</span>`;
  const notifyBtn = isManager && !sent && !archived && showArchiveBtn
    ? `<button onclick="managerPitSent('${p.id}','${esc(p.plate)}','${esc(p.checkType)}','${esc(p.brand||'')}','${esc(p.model||'')}','${esc(p.color||'')}','${esc(p.year||'')}')" style="background:#22c55e;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;flex-shrink:0;white-space:nowrap">✅ נשלח</button>`
    : '';
  const sentBtn = !sent && !archived && !isManager
    ? `<button onclick="markPitSent('${p.id}')" style="background:#22c55e;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;flex-shrink:0">✅ נשלח</button>`
    : '';
  const archiveBtn = isManager && sent && showArchiveBtn
    ? `<button onclick="archivePit('${p.id}')" style="background:#6366f1;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;flex-shrink:0;white-space:nowrap">📋 קיבלתי טופס ועדכנתי</button>`
    : '';
  const deleteBtn = isManager
    ? `<button onclick="deletePitCheck('${p.id}')" style="background:#ef4444;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;flex-shrink:0">🗑️</button>`
    : '';
  const archiveTs = p.archivedAt?.toDate ? p.archivedAt.toDate().toLocaleString('he-IL') : '';
  return `<div class="vehicle-card" style="border-right:5px solid ${borderColor}${archived?';opacity:.75':''}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div class="vehicle-plate">${esc(p.plate)}</div>
          ${statusBadge}
        </div>
        ${[p.brand,p.model,p.color,p.year].filter(Boolean).length ? `<div class="vehicle-info" style="margin-top:2px">${[p.brand,p.model,p.color,p.year].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
        <div class="vehicle-info" style="margin-top:4px">🔧 ${esc(p.checkType)}</div>
        ${ts ? `<div class="task-time" style="margin-top:4px">${ts}</div>` : ''}
        ${archiveTs ? `<div class="task-time" style="margin-top:2px">📁 הועבר לארכיון: ${archiveTs}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        ${notifyBtn}${sentBtn}${archiveBtn}${deleteBtn}
      </div>
    </div>
  </div>`;
}

// כשהבורות מוצגים בלשונית שבמסך הבית של המנהל — אותה טעינה בדיוק,
// בלי מעבר מסך
function _pitsMountedOnHome() {
  const toolbar = document.getElementById('pits-manager-toolbar');
  if (toolbar) toolbar.style.display = currentUser?.role === 'manager' ? 'flex' : 'none';
  loadPits();
}
window._pitsMountedOnHome = _pitsMountedOnHome;

function loadPits() {
  if (!window._CONFIG_DONE) return;
  if (pitsUnsub) pitsUnsub();
  const isManager = currentUser?.role === 'manager';
  const q = _query(_colRef('pit_checks'), _orderBy('createdAt','desc'));
  pitsUnsub = _onSnap(q, snap => {
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const list = document.getElementById('pits-list');
    const archiveWrap = document.getElementById('pits-archive-wrap');
    const archiveBody = document.getElementById('pits-archive-body');

    if (isManager) {
      const active   = all.filter(p => p.status !== 'archived');
      const archived = all.filter(p => p.status === 'archived');
      list.innerHTML = active.length
        ? active.map(p => _pitCard(p, true, true)).join('')
        : `<div class="empty-state"><div class="es-icon">🕳️</div><h3>אין בדיקות</h3><p>לחץ + הוסף בדיקה</p></div>`;
      if (archiveWrap) archiveWrap.style.display = archived.length ? 'block' : 'none';
      const archiveSearch = document.getElementById('pits-archive-search');
      if (archiveSearch) archiveSearch.style.display = archived.length ? 'block' : 'none';
      window._pitsArchiveAll = archived;
      if (archiveBody) archiveBody.innerHTML = archived.map(p => _pitCard(p, true, false)).join('');
    } else {
      const items = all.filter(p => p.status === 'pending');
      list.innerHTML = items.length
        ? items.map(p => _pitCard(p, false, false)).join('')
        : `<div class="empty-state"><div class="es-icon">🕳️</div><h3>אין בדיקות ממתינות</h3></div>`;
      if (archiveWrap) archiveWrap.style.display = 'none';
    }
  });
}

function filterPitsArchive() {
  const q = (document.getElementById('pits-archive-q')?.value || '').trim();
  const body = document.getElementById('pits-archive-body');
  if (!body) return;
  const all = window._pitsArchiveAll || [];
  const filtered = q ? all.filter(p => (p.plate || '').includes(q)) : all;
  body.innerHTML = filtered.length
    ? filtered.map(p => _pitCard(p, true, false)).join('')
    : `<div style="text-align:center;padding:20px;color:var(--muted);font-weight:700">לא נמצאו תוצאות</div>`;
}
window.filterPitsArchive = filterPitsArchive;

async function archivePit(id) {
  const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await updateDoc(doc(window._db, 'pit_checks', id), { status: 'archived', archivedAt: _serverTs() });
  showToast('📁 הועבר לארכיון');
}
window.archivePit = archivePit;

async function markPitSent(id) {
  const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await updateDoc(doc(window._db, 'pit_checks', id), { status: 'sent', sentAt: _serverTs() });
  showToast('✅ סומן כנשלח');
}
window.markPitSent = markPitSent;

async function resendPitNotify(plate, checkType, brand, model, color, year) {
  const vDesc = [brand, model, color, year].filter(Boolean).join(' ');
  await _notifyAllDrivers(`🕳️ תזכורת — בור/בדיקה ממתינה: ${plate}${vDesc ? ' · '+vDesc : ''} (${checkType}). כנס לאפליקציה ענק הרכבים.`);
  showToast('📲 התראה נשלחה לנהגים');
}
window.resendPitNotify = resendPitNotify;

async function managerPitSent(id, plate, checkType, brand, model, color, year) {
  const vDesc = [brand, model, color, year].filter(Boolean).join(' ');
  await _notifyAllDrivers(`🕳️ בור/בדיקה חדשה נוספה — ${plate}${vDesc ? ' · '+vDesc : ''} (${checkType}). כנס לאפליקציה ענק הרכבים.`);
  const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await updateDoc(doc(window._db, 'pit_checks', id), { status: 'sent', sentAt: _serverTs() });
  showToast('✅ נשלח לנהגים');
}
window.managerPitSent = managerPitSent;

async function fetchPitVehicle() {
  const raw = document.getElementById('pit-plate').value.trim().replace(/[^0-9]/g,'');
  if (!raw) return showToast('נא להזין מספר לוחית');
  const status = document.getElementById('pit-fetch-status');
  const btn = document.getElementById('btn-fetch-pit');
  const info = document.getElementById('pit-vehicle-info');
  status.style.color = 'var(--muted)'; status.textContent = '⏳ מחפש...';
  btn.disabled = true; info.style.display = 'none';
  try {
    const rec = await _plateLookup(raw);
    if (!rec) { status.style.color='var(--danger)'; status.textContent = window._plateRegistryEmpty ? '⏳ מאגר משרד התחבורה בעדכון כרגע — נסו שוב מאוחר יותר או מלאו ידנית' : '❌ לא נמצא רכב עם מספר זה'; return; }
    window._pitVehicleData = { brand: rec.maker, model: rec.model, color: rec.color, year: rec.year };
    status.style.color='var(--success)'; status.textContent='✅ פרטים נטענו';
    info.style.display='block';
    info.textContent = [rec.maker, rec.model, rec.color, rec.year].filter(Boolean).join(' · ');
  } catch(e) {
    status.style.color='var(--danger)'; status.textContent='❌ שגיאה בחיבור לשרת';
  } finally { btn.disabled=false; }
}
window.fetchPitVehicle = fetchPitVehicle;

function selectPitType(el) {
  const active = el.dataset.selected === '1';
  el.dataset.selected = active ? '0' : '1';
  el.style.background = active ? '#fff' : 'var(--dark)';
  el.style.borderColor = active ? 'var(--border)' : 'var(--dark)';
  el.style.color = active ? 'inherit' : '#fff';
  const selected = Array.from(document.querySelectorAll('.pit-type-btn'))
    .filter(b => b.dataset.selected === '1').map(b => b.dataset.type);
  document.getElementById('pit-type').value = selected.join(', ');
}
window.selectPitType = selectPitType;

async function addPitCheck() {
  const plate = document.getElementById('pit-plate').value.trim();
  const checkType = document.getElementById('pit-type').value.trim();
  if (!plate) return showToast('נא להזין מספר רכב');
  if (!checkType) return showToast('נא לבחור סוג בדיקה');

  // Block duplicate בור/בדיקה מלאה for same plate if already active
  const blockedTypes = ['בור', 'בדיקה מלאה'];
  const selectedTypes = checkType.split(',').map(t => t.trim());
  const hasBlocked = selectedTypes.some(t => blockedTypes.includes(t));
  if (hasBlocked) {
    const { getDocs, query, collection, where } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDocs(query(collection(window._db, 'pit_checks'), where('plate','==',plate)));
    const active = snap.docs.map(d => d.data()).filter(d => d.status !== 'archived');
    const conflict = active.find(d => {
      const existing = (d.checkType || '').split(',').map(t => t.trim());
      return existing.some(t => blockedTypes.includes(t));
    });
    if (conflict) {
      const statusLabel = conflict.status === 'sent' ? 'נשלח — ממתין לאישור' : 'ממתין לביצוע';
      return showToast(`⚠️ לרכב ${plate} כבר קיימת בדיקה פעילה (${statusLabel})`, 5000);
    }
  }

  const vehicleData = window._pitVehicleData || {};
  await _addDoc(_colRef('pit_checks'), { plate, checkType, ...vehicleData, status: 'pending', createdAt: _serverTs() });
  const vDesc = [vehicleData.brand, vehicleData.model, vehicleData.color, vehicleData.year].filter(Boolean).join(' ');
  _notifyAllDrivers(`🕳️ בור/בדיקה חדשה נוספה — ${plate}${vDesc ? ' · '+vDesc : ''} (${checkType}). כנס לאפליקציה ענק הרכבים.`);
  document.getElementById('pit-plate').value = '';
  document.getElementById('pit-type').value = '';
  document.getElementById('pit-fetch-status').textContent = '';
  document.getElementById('pit-vehicle-info').style.display = 'none';
  window._pitVehicleData = null;
  document.querySelectorAll('.pit-type-btn').forEach(b => { b.style.background='#fff'; b.style.borderColor='var(--border)'; b.style.color='inherit'; b.dataset.selected='0'; });
  closeModal('modal-add-pit');
  showToast('✅ הבדיקה נוספה');
}

async function deletePitCheck(id) {
  if (!confirm('למחוק בדיקה זו?')) return;
  const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await deleteDoc(doc(window._db, 'pit_checks', id));
  showToast('🗑️ נמחק');
}

/* ═══════════════════════════════════════════════════════
   YARD SCREEN
═══════════════════════════════════════════════════════ */

function openYardScreen() {
  document.getElementById('yard-user-badge').textContent = currentUser.name;
  const isManager = currentUser.role === 'manager';
  // Ensure list is visible before rendering (driver may have hidden it)
  const tbl = document.getElementById('yard-list');
  const msg = document.getElementById('yard-no-data-msg');
  if (tbl) tbl.style.display = '';
  if (msg) msg.style.display = 'none';
  renderYardTable();
  showScreen('yard');
  loadYardData();
  if (isManager) {
    const btn = document.getElementById('yard-publish-btn');
    if (btn) { btn.textContent = '📤 שלח לנהגים'; btn.style.background = 'var(--gold)'; btn.style.color = '#000'; btn.onclick = publishYard; btn.disabled = false; }
  }
}

let _yardZoom = 1;
function yardZoom(dir) {
  _yardZoom = Math.min(2.5, Math.max(0.5, +(_yardZoom + dir * 0.15).toFixed(2)));
  _applyYardZoom();
}
function _applyYardZoom() {
  const t = document.getElementById('yard-table');
  if (t) t.style.zoom = _yardZoom;
  const lbl = document.getElementById('yard-zoom-label');
  if (lbl) lbl.textContent = Math.round(_yardZoom * 100) + '%';
}
window.yardZoom = yardZoom;

function startYard(mode) {
  closeModal('modal-yard-start');
  const btn = document.getElementById('yard-publish-btn');
  if (btn) { btn.textContent = '📤 שלח לנהגים'; btn.style.background = 'var(--gold)'; btn.style.color = '#000'; btn.onclick = publishYard; btn.disabled = false; }
  if (mode === 'new') {
    yardData = {};
    _yardUpdate({ data: {}, updatedAt: _serverTs(), publishedAt: null, status: 'draft' });
  } else {
    loadYardData();
  }
  renderYardTable();
  showScreen('yard');
}

var _yardLastStatus = null;

function _updateYardResetBanner(d) {
  const banner = document.getElementById('yard-reset-banner');
  if (!banner) return;
  const by = d.resetBy;
  const at = d.resetAt;
  if (!by && !at) { banner.style.display = 'none'; return; }
  let timeStr = '';
  if (at) {
    const date = at.toDate ? at.toDate() : new Date(at);
    timeStr = date.toLocaleString('he-IL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  }
  banner.style.display = 'block';
  banner.textContent = `🔄 טבלה אופסה בפעם האחרונה על ידי ${by || ''}${timeStr ? ' — ' + timeStr : ''}`;
}

function loadYardData() {
  if (!window._CONFIG_DONE) return;
  if (yardUnsub) yardUnsub();
  _yardLastStatus = null;
  yardUnsub = _onSnap(_docRef('yard','current'), snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    const isManager = currentUser?.role === 'manager';

    // Update reset banner for everyone
    _updateYardResetBanner(d);

    if (!isManager) {
      // Driver: sync table from Firestore
      yardData = d.data || {};
      const hasData = Object.values(yardData).some(v => v && String(v).trim());
      const toolbar = document.getElementById('yard-driver-toolbar');
      if (toolbar) toolbar.style.display = hasData ? 'flex' : 'none';

      const noDataMsg = document.getElementById('yard-no-data-msg');
      const tbl = document.getElementById('yard-list');
      if (!hasData) {
        if (noDataMsg) noDataMsg.style.display = 'block';
        if (tbl) tbl.style.display = 'none';
        return;
      }
      if (noDataMsg) noDataMsg.style.display = 'none';
      if (tbl) tbl.style.display = '';
      renderYardTable();
      renderYardInputValues();
      return;
    } else {
      // Manager: only react to status transitions, never overwrite live edits
      if (_yardLastStatus === null) {
        // First load — populate table from Firestore
        yardData = d.data || {};
        renderYardInputValues();
      } else if (d.status === 'done' && _yardLastStatus !== 'done') {
        // Driver marked בוצע — reset manager table too
        yardData = {};
        renderYardInputValues();
        showToast('✅ נהג סימן בוצע — הטבלה אופסה');
        const btn = document.getElementById('yard-publish-btn');
        if (btn) { btn.textContent = '📤 שלח לנהגים'; btn.style.background = 'var(--gold)'; btn.style.color = '#000'; btn.onclick = publishYard; btn.disabled = false; }
      }
      _yardLastStatus = d.status;
    }
  });
}

function renderYardTable() {
  const isManager = currentUser.role === 'manager';
  // Show/hide manager controls
  document.getElementById('yard-manager-toolbar').style.display = isManager ? 'flex' : 'none';
  document.getElementById('yard-driver-toolbar').style.display = 'none'; // shown dynamically after data loads
  document.getElementById('yard-to-place-panel').style.display = isManager ? 'block' : 'none';
  if (isManager) renderToPlaceGrid(true);

  const list = document.getElementById('yard-list');
  if (!list) return;
  const flt = _yardFilterEmpty;
  const isFilled = k => (yardData[k] || '').trim() !== '';

  // left spots (1–34): each has entrance + 2 road lanes
  const leftRows = LEFT_SPOTS.map(spot => {
    const n = parseInt(spot);
    if (n >= 30 && n <= 34) {
      const keys = ['L_' + spot + '_כניסה', 'L_' + spot + '_כביש_1', 'L_' + spot + '_כביש_2'];
      if (flt && keys.every(isFilled)) return '';
      return _yardSpotCard(spot, [[keys[0], 'חניה'], [keys[1], 'כביש 1'], [keys[2], 'כביש 2']], isManager);
    }
    const keys = ['L_' + spot + '_כניסה', 'L_' + spot + '_כביש_1'];
    if (flt && keys.every(isFilled)) return '';
    return _yardSpotCard(spot, [[keys[0], 'חניה'], [keys[1], 'כביש']], isManager);
  }).join('');

  // right spots: each row is a pair — even = בפנים, odd = בחוץ (same row)
  const rightRowsHtml = RIGHT_ROWS.map(r => {
    if (!r) return '';
    if (flt) {
      const keys = r.map(n => parseInt(n) % 2 === 0 ? 'R_' + n + '_בפנים' : 'R_' + n + '_בחוץ');
      if (keys.every(isFilled)) return '';
    }
    return _yardRightRowCard(r, isManager);
  }).join('');
  const rightHeader = `<div class="yard-card" style="background:var(--dark);border:none;padding:8px 10px">
    <div class="yard-num" style="visibility:hidden;min-width:44px;height:0"></div>
    <div class="yard-fields">
      <div class="yard-field" style="color:var(--gold);font-weight:900;text-align:center;font-size:14px">בפנים</div>
      <div class="yard-field" style="color:var(--gold);font-weight:900;text-align:center;font-size:14px">בחוץ</div>
    </div>
  </div>`;

  const insideNums = [], outsideNums = [];
  RIGHT_ROWS.forEach(r => { if (!r) return; r.forEach(n => { (parseInt(n) % 2 === 0 ? insideNums : outsideNums).push(n); }); });
  const allKeys = [
    ...LEFT_SPOTS.flatMap(s => { const b = ['L_' + s + '_כניסה', 'L_' + s + '_כביש_1']; if (+s >= 30 && +s <= 34) b.push('L_' + s + '_כביש_2'); return b; }),
    ...insideNums.map(n => 'R_' + n + '_בפנים'),
    ...outsideNums.map(n => 'R_' + n + '_בחוץ'),
  ];
  const filled = allKeys.filter(isFilled).length;

  list.innerHTML =
    `<div class="yard-summary"><span>מולאו <b>${filled}</b> מתוך ${allKeys.length}</span>` +
      (isManager ? `<button class="yard-flt ${flt ? 'on' : ''}" onclick="toggleYardFilter()">${flt ? '↩ הצג הכל' : '🔎 ריקים בלבד'}</button>` : '') +
    `</div>` +
    _yardSection('חניות צד שמאל (1–34)', leftRows) +
    _yardSection('חניות מגרש', rightRowsHtml ? rightHeader + rightRowsHtml : '');
  renderYardInputValues();
}

function _yardRightRowCard(r, editable) {
  let even = '', odd = '';
  r.forEach(n => { if (parseInt(n) % 2 === 0) even = n; else odd = n; });
  // single spot → span the whole row
  if (!even || !odd) {
    const n = even || odd;
    const key = even ? 'R_' + even + '_בפנים' : 'R_' + odd + '_בחוץ';
    const label = even ? 'בפנים' : 'בחוץ';
    return `<div class="yard-card"><div class="yard-num">${esc(n)}</div><div class="yard-fields"><div class="yard-field" style="flex:1"><span>${label}</span>${_yardCell(key, editable)}</div></div></div>`;
  }
  const f1 = even ? `<div class="yard-field"><span>${esc(even)}</span>${_yardCell('R_' + even + '_בפנים', editable)}</div>` : `<div class="yard-field"></div>`;
  const f2 = odd ? `<div class="yard-field"><span>${esc(odd)}</span>${_yardCell('R_' + odd + '_בחוץ', editable)}</div>` : `<div class="yard-field"></div>`;
  const badge = [even, odd].filter(Boolean).join('/');
  return `<div class="yard-card"><div class="yard-num" style="font-size:13px;line-height:1.15">${esc(badge)}</div><div class="yard-fields">${f1}${f2}</div></div>`;
}

let _yardFilterEmpty = false;
function toggleYardFilter() { _yardFilterEmpty = !_yardFilterEmpty; renderYardTable(); }
window.toggleYardFilter = toggleYardFilter;

function _yardSection(title, rows) {
  if (!rows.trim()) return '';
  return `<div class="yard-sec-h">${title}</div>${rows}`;
}

function _yardSpotCard(num, fields, editable) {
  return `<div class="yard-card">
    <div class="yard-num">${esc(num)}</div>
    <div class="yard-fields">
      ${fields.map(([key, label]) => `<div class="yard-field">${label ? `<span>${label}</span>` : ''}${_yardCell(key, editable)}</div>`).join('')}
    </div>
  </div>`;
}

function _yardCell(key, editable) {
  const val = yardData[key] || '';
  if (!editable) return `<div data-key="${key}" class="yard-val ${val ? 'has' : ''}">${val ? esc(val) : '—'}</div>`;
  return `<input data-key="${key}" value="${esc(val)}" placeholder="—" class="yard-inp ${val ? 'has' : ''}"
    onchange="yardData[this.dataset.key]=this.value;this.classList.toggle('has',!!this.value.trim());_autoSaveYard()"
    onkeydown="if(event.key==='Enter'||event.keyCode===13){event.preventDefault();yardData[this.dataset.key]=this.value;clearTimeout(_yardSaveTimer);_yardUpdate({data:yardData,updatedAt:_serverTs(),status:'draft'});_yardFocusNext(this);}">`;
}

function renderToPlaceGrid(isManager) {
  const grid = document.getElementById('yard-to-place-grid');
  const soldGrid = document.getElementById('yard-sold-grid');
  let html = '', soldHtml = '';
  for (let i = 1; i <= 6; i++) {
    const key = 'TO_PLACE_' + i;
    if (isManager) {
      const tpVal = yardData[key] || '';
      const tpBg = tpVal ? '#dcfce7' : '#fff';
      const tpBorder = tpVal ? '#16a34a' : 'var(--border)';
      html += `<input data-key="${key}" value="${esc(tpVal)}" placeholder="רכב ${i}"
        onchange="yardData[this.dataset.key]=this.value;this.style.background=this.value?'#dcfce7':'#fff';this.style.borderColor=this.value?'#16a34a':'var(--border)';_autoSaveYard()"
        onkeydown="if(event.key==='Enter'||event.keyCode===13){event.preventDefault();yardData[this.dataset.key]=this.value;clearTimeout(_yardSaveTimer);_yardUpdate({data:yardData,updatedAt:_serverTs(),status:'draft'});_yardFocusNext(this);}"
        style="background:${tpBg};border:1px solid ${tpBorder};border-radius:8px;padding:6px 8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;color:#15803d;text-align:center;outline:none"
        onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor=this.value?'#16a34a':'var(--border)'">`;
    } else {
      const val = yardData[key] || '';
      html += `<div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:6px 8px;font-size:13px;text-align:center;min-height:32px;color:${val?'var(--dark)':'#ccc'}">${val||'—'}</div>`;
    }
  }
  for (let i = 1; i <= 6; i++) {
    const key = 'SOLD_' + i;
    if (isManager) {
      const sVal = yardData[key] || '';
      const sBg = sVal ? '#fef08a' : '#fefce8';
      const sBorder = sVal ? '#ca8a04' : '#fde047';
      soldHtml += `<input data-key="${key}" value="${esc(sVal)}" placeholder="מכונית ${i}"
        onchange="yardData[this.dataset.key]=this.value;this.style.background=this.value?'#fef08a':'#fefce8';this.style.borderColor=this.value?'#ca8a04':'#fde047';_autoSaveYard()"
        onkeydown="if(event.key==='Enter'||event.keyCode===13){event.preventDefault();yardData[this.dataset.key]=this.value;clearTimeout(_yardSaveTimer);_yardUpdate({data:yardData,updatedAt:_serverTs(),status:'draft'});_yardFocusNext(this);}"
        style="background:${sBg};border:1px solid ${sBorder};border-radius:8px;padding:6px 8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;color:#854d0e;text-align:center;outline:none"
        onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor=this.value?'#ca8a04':'#fde047'">`;
    } else {
      const val = yardData[key] || '';
      soldHtml += `<div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:6px 8px;font-size:13px;text-align:center;min-height:32px;color:${val?'#854d0e':'#ca8a04'}">${val||'—'}</div>`;
    }
  }
  grid.innerHTML = html;
  if (soldGrid) soldGrid.innerHTML = soldHtml;
}

function spotInput(key, editable) {
  const val = yardData[key] || '';
  if (!editable) {
    return `<div data-key="${key}" style="min-width:60px;min-height:24px;font-size:12px;text-align:center;color:${val?'var(--dark)':'#bbb'}">${val||'—'}</div>`;
  }
  const bg = val ? '#dcfce7' : 'transparent';
  const border = val ? '#16a34a' : 'var(--border)';
  return `<input data-key="${key}" value="${esc(val)}" onchange="yardData[this.dataset.key]=this.value;this.style.background=this.value?'#dcfce7':'transparent';this.style.borderColor=this.value?'#16a34a':'var(--border)';_autoSaveYard()"
    onkeydown="if(event.key==='Enter'||event.keyCode===13){event.preventDefault();yardData[this.dataset.key]=this.value;clearTimeout(_yardSaveTimer);_yardUpdate({data:yardData,updatedAt:_serverTs(),status:'draft'});_yardFocusNext(this);}"
    style="width:100%;min-width:60px;background:${bg};border:1px solid ${border};border-radius:6px;padding:4px 6px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;color:#15803d;outline:none"
    onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor=this.value?'#16a34a':'var(--border)'">`;
}

function tdStyle(align) {
  return `padding:6px 8px;border:1px solid #e0e4ef;vertical-align:top;text-align:${align||'center'};font-size:14px;font-weight:${align==='right'?'700':'400'}`;
}

function renderYardInputValues() {
  document.querySelectorAll('#yard-list input[data-key], #yard-to-place-grid input[data-key], #yard-sold-grid input[data-key]').forEach(inp => {
    inp.value = yardData[inp.dataset.key] || '';
    if (inp.classList.contains('yard-inp')) inp.classList.toggle('has', !!inp.value.trim());
  });
  // Update read-only display divs
  document.querySelectorAll('#yard-list div[data-key], #yard-to-place-grid div[data-key], #yard-sold-grid div[data-key]').forEach(div => {
    const val = yardData[div.dataset.key] || '';
    div.textContent = val || '—';
    if (div.classList.contains('yard-val')) div.classList.toggle('has', !!val.trim());
    else div.style.color = val ? 'var(--dark)' : '#bbb';
  });
}

function _collectYardInputs() {
  document.querySelectorAll('#yard-list input[data-key], #yard-to-place-grid input[data-key], #yard-sold-grid input[data-key]').forEach(inp => {
    yardData[inp.dataset.key] = inp.value;
  });
}

async function _yardUpdate(fields) {
  if (!window._CONFIG_DONE) return;
  try {
    await _updateDoc(_docRef('yard','current'), fields);
  } catch(e) {
    if (e.code === 'not-found') await _setDoc(_docRef('yard','current'), fields);
    else console.warn('yard save error', e);
  }
}

let _yardSaveTimer = null;
function _yardFocusNext(el) {
  const all = Array.from(document.querySelectorAll('#screen-yard input[data-key]'));
  const idx = all.indexOf(el);
  if (idx >= 0 && idx < all.length - 1) { all[idx + 1].focus(); all[idx + 1].select(); }
  else el.blur();
}
function _autoSaveYard() {
  _collectYardInputs();
  clearTimeout(_yardSaveTimer);
  _yardSaveTimer = setTimeout(() => _yardUpdate({ data: yardData, updatedAt: _serverTs(), status: 'draft' }), 800);
}

async function saveYardDraft() {
  _collectYardInputs();
  if (!window._CONFIG_DONE) return showToast('Firebase לא מחובר');
  await _yardUpdate({ data: yardData, updatedAt: _serverTs(), status: 'draft' });
}

async function publishYard() {
  _collectYardInputs();
  if (!window._CONFIG_DONE) return showToast('Firebase לא מחובר');
  await _yardUpdate({ data: yardData, updatedAt: _serverTs(), publishedAt: _serverTs(), status: 'pending' });
  showToast('📤 הטבלה נשלחה לנהגים!');
  _notifyAllDrivers('🅿️ סידור מגרש חדש נשלח. כנס לאפליקציה ענק הרכבים לצפייה בטבלה.');
  const btn = document.getElementById('yard-publish-btn');
  if (btn) {
    btn.textContent = '✅ בוצע';
    btn.style.background = '#22c55e';
    btn.style.color = '#fff';
    btn.disabled = false;
    btn.onclick = doneYardManager;
  }
}

async function doneYardManager() {
  if (!window._CONFIG_DONE) return showToast('Firebase לא מחובר');
  await _yardUpdate({ data: {}, updatedAt: _serverTs(), publishedAt: null, status: 'done', resetBy: currentUser?.name || '', resetAt: _serverTs() });
  yardData = {};
  showToast('✅ בוצע! הטבלה אופסה');
  goHome();
}

async function markYardDone() {
  if (!window._CONFIG_DONE) return showToast('Firebase לא מחובר');
  await _yardUpdate({ data: {}, updatedAt: _serverTs(), publishedAt: null, status: 'done', resetBy: currentUser?.name || '', resetAt: _serverTs() });
  yardData = {};
  showToast('✅ בוצע! הטבלה אופסה');
  document.getElementById('yard-driver-toolbar').style.display = 'none';
  goHome();
}

async function resetYard() {
  if (!confirm('למחוק את כל הנתונים ולהתחיל טבלה חדשה?')) return;
  yardData = {};
  renderYardInputValues();
  await _yardUpdate({ data: {}, updatedAt: _serverTs(), publishedAt: null, status: 'draft', resetBy: currentUser?.name || '', resetAt: _serverTs() });
  const btn = document.getElementById('yard-publish-btn');
  if (btn) { btn.textContent = '📤 שלח לנהגים'; btn.style.background = 'var(--gold)'; btn.style.color = '#000'; btn.onclick = publishYard; btn.disabled = false; }
  showToast('🔄 הטבלה אופסה אצל כולם');
}

/* ═══════════════════════════════════════════════════════
   SMS NOTIFICATIONS (Twilio via Firebase Function)
═══════════════════════════════════════════════════════ */
var _driverContacts = null;
// after `firebase deploy --only functions`, replace with the real sendSms Cloud Run URL
const _SMS_FUNC_URL = 'https://sendsms-343573102369.europe-west1.run.app';

async function _loadDriverContacts() {
  if (_driverContacts) return _driverContacts;
  try {
    const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDoc(doc(window._db, 'config', 'driver_contacts'));
    _driverContacts = snap.exists() ? snap.data() : {};
  } catch(e) { _driverContacts = {}; }
  return _driverContacts;
}

/* ── טלגרם: מקום אחד לכל השליחות ─────────────────────────────────────
   כל קריאה ל-Bot API עוברת דרך _telegramApi. פונקציות הנוחות למטה
   (הודעה/תמונה/סרטון) שומרות בדיוק על אותה חתימה שכל הקוד הקיים קורא
   לה — רק המנגנון הפנימי אוחד, שום התנהגות לא השתנתה.
─────────────────────────────────────────────────────────────────────── */
async function _telegramToken() {
  const contacts = await _loadDriverContacts();
  return (contacts['_telegramToken']?.value || '').trim();
}

// method: 'sendMessage' | 'sendPhoto' | 'sendVideo' | 'getUpdates?limit=100' | ...
// body: FormData לקבצים, אובייקט JS שנשלח כ-JSON, או undefined לבקשת GET
async function _telegramApi(method, body) {
  const token = await _telegramToken();
  if (!token) return { ok: false, description: 'אין טוקן טלגרם מוגדר', _noToken: true };
  const opts = body instanceof FormData
    ? { method: 'POST', body }
    : body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {};
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, opts);
  const data = await res.json().catch(() => ({}));
  return { ...data, _httpOk: res.ok, _status: res.status };
}
window._telegramApi = _telegramApi;

// Telegram Bot API is free/unlimited and supports CORS, so we can call it
// directly from the browser — no Cloud Function needed.
// a picture goes as a file, not as text — telegram wants it uploaded
async function _sendTelegramPhoto(chatId, dataUrl, caption) {
  if (!dataUrl) return false;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption || '');
    form.append('photo', blob, 'car.jpg');
    const data = await _telegramApi('sendPhoto', form);
    return !!data._httpOk;
  } catch (e) { console.error('telegram photo', e); return false; }
}
window._sendTelegramPhoto = _sendTelegramPhoto;

async function _sendTelegram(chatId, message) {
  if (!chatId) return false;
  try {
    const data = await _telegramApi('sendMessage', { chat_id: chatId, text: message });
    if (!data.ok) { console.error('Telegram send error', data); showToast(`⚠️ טלגרם שגיאה: ${data.description || data._status}`, 5000); return false; }
    return true;
  } catch(e) {
    console.error('Telegram fetch error', e);
    showToast(`⚠️ טלגרם: שגיאת חיבור — ${e.message}`, 6000);
    return false;
  }
}

// manual "remind now" button (battery-check screen) — same message + reply
// buttons as the scheduled 11:00 reminder, sent on demand instead of waiting.
async function sendBatteryReminders() {
  const btn = document.getElementById('batt-remind-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ שולח...'; }
  try {
    const { getDocs, query, collection, where } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDocs(query(collection(window._db, 'battery_assignments'), where('status', '==', 'pending')));
    const countByDriver = {};
    snap.forEach(d => {
      const data = d.data();
      const rows = data.rowsJson ? JSON.parse(data.rowsJson) : [];
      if (!data.assignedTo) return;
      countByDriver[data.assignedTo] = (countByDriver[data.assignedTo] || 0) + rows.length;
    });
    if (!Object.keys(countByDriver).length) { showToast('אין בדיקות טעינה ממתינות לאף נהג'); return; }

    const contacts = await _loadDriverContacts();
    const token = await _telegramToken();
    if (!token) { showToast('⚠️ טוקן טלגרם לא מוגדר בהגדרות הודעות'); return; }

    let sent = 0, missing = [];
    for (const [name, count] of Object.entries(countByDriver)) {
      const chatId = contacts[name]?.telegramId;
      if (!chatId) { missing.push(name); continue; }
      const text = `🔋 תזכורת — יש לך ${count} רכבים שממתינים לבדיקת סוללה. כנס לאפליקציה להשלים.`;
      const reply_markup = { inline_keyboard: [
        [{ text: '⏰ עסוק עכשיו, תזכיר לי מחר', callback_data: `battery_snooze:${name}` }],
        [{ text: '✅ מטפל בזה עכשיו', callback_data: `battery_now:${name}` }],
      ]};
      try {
        await _telegramApi('sendMessage', { chat_id: chatId, text, reply_markup });
        sent++;
      } catch(e) { console.error('sendBatteryReminders', name, e); }
    }
    showToast(`✅ נשלחה תזכורת ל-${sent} נהגים${missing.length ? ` · אין טלגרם ל: ${missing.join(', ')}` : ''}`, 5000);
  } catch(e) {
    showToast('שגיאה בשליחת תזכורות: ' + (e.message || e));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 שלח תזכורת לנהגים על בדיקות טעינה פתוחות'; }
  }
}
window.sendBatteryReminders = sendBatteryReminders;

// fetch recent messages sent TO the bot, to discover each driver's chat id
async function _telegramGetUpdates() {
  const token = await _telegramToken();
  if (!token) { showToast('נא להזין קודם טוקן בוט'); return []; }
  // הבוט עובד ב-webhook, ולכן getUpdates חסום על ידי טלגרם. השיחות
  // נרשמות בשרת ברגע שהן מגיעות — קוראים משם. אם אין שם כלום, ננסה
  // בכל זאת את getUpdates (למקרה שה-webhook מנותק).
  try {
    const snap = await window._getDoc(_docRef('config', 'telegram_chats'));
    if (snap.exists()) {
      const rows = Object.values(snap.data() || {})
        .filter(c => c && c.id)
        .sort((a, b) => String(b.at?.toMillis?.() ?? b.at ?? '').localeCompare(String(a.at?.toMillis?.() ?? a.at ?? '')))
        .map(c => ({ id: c.id, name: c.name || String(c.id) }));
      if (rows.length) return rows;
    }
  } catch (e) { console.warn('telegram_chats read', e); }
  try {
    const data = await _telegramApi('getUpdates?limit=100');
    if (!data.ok) {
      const busy = /webhook is active/i.test(data.description || '');
      showToast(busy
        ? 'הבוט עובד במצב webhook — בקש מהעובד לשלוח הודעה לבוט עכשיו, ואז לחץ שוב'
        : `⚠️ שגיאת טוקן: ${data.description || ''}`, 7000);
      return [];
    }
    const seen = new Map(); // chatId → name (last message wins, most recent)
    for (const u of (data.result || [])) {
      const m = u.message || u.edited_message;
      if (!m || !m.chat) continue;
      const name = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') || m.chat.username || String(m.chat.id);
      seen.set(m.chat.id, name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  } catch(e) {
    console.error('telegram getUpdates', e);
    showToast('⚠️ שגיאת חיבור לטלגרם', 5000);
    return [];
  }
}

async function _sendSms(phone, message) {
  // SMS (Twilio) is retired — Telegram is the only active channel now.
  // Kept as a silent no-op fallback so old callers don't error; no popups.
  if (!phone) return;
  const contacts = await _loadDriverContacts();
  const accountSid = (contacts['_twilioSid']?.value   || '').trim();
  const authToken  = (contacts['_twilioToken']?.value || '').trim();
  const from       = (contacts['_twilioFrom']?.value  || '').trim();
  if (!accountSid || !authToken || !from) { console.warn('SMS skipped — no Twilio creds'); return; }
  try {
    const res = await fetch(_SMS_FUNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountSid, authToken, from, to: phone, message })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error('Twilio SMS error', res.status, data);
  } catch(e) {
    console.error('SMS fetch error', e);
  }
}

async function _addDriverNotification(driverName, message) {
  try {
    const { addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await addDoc(collection(window._db, 'driver_notifications'), { to: driverName, message, seen: false, createdAt: serverTimestamp() });
  } catch(e) { console.error('_addDriverNotification', e); }
}

async function _checkDriverNotifications() {
  if (!window._CONFIG_DONE || !currentUser || currentUser.role === 'manager') return;
  try {
    const { getDocs, query, collection, where, updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDocs(query(collection(window._db, 'driver_notifications'), where('to','==',currentUser.name), where('seen','==',false)));
    if (snap.empty) return;
    snap.docs.forEach(async d => {
      showToast(d.data().message, 6000);
      await updateDoc(doc(window._db, 'driver_notifications', d.id), { seen: true });
    });
  } catch(e) { console.error('_checkDriverNotifications', e); }
}

async function _notifyDriver(driverName, message) {
  const contacts = await _loadDriverContacts();
  const c = contacts[driverName];
  // Telegram is free — prefer it whenever a chat id is set
  if (c?.telegramId) { const ok = await _sendTelegram(c.telegramId, message); if (ok) return; }
  if (c?.phone) { _sendSms(c.phone, message); return; }
  // fallback: if notifying manager ('ליאל') and no contact set, try _managerPhone
  if (driverName === 'ליאל') {
    const mp = contacts['_managerPhone']?.value;
    if (mp) _sendSms(mp, message);
  }
}

async function _notifyAllDrivers(message) {
  const contacts = await _loadDriverContacts();
  for (const [key, c] of Object.entries(contacts)) {
    if (key.startsWith('_') || key === 'ליאל') continue;
    if (c?.telegramId) { const ok = await _sendTelegram(c.telegramId, message); if (ok) continue; }
    if (c?.phone) _sendSms(c.phone, message);
  }
}

// ─── Settings screen ───────────────────────────────────
// חלונית ההגדרות המאוחדת — שלוש הלשוניות במקום אחד
async function openSettings() {
  if (currentUser?.role !== 'manager') return;
  settingsTab('telegram');
  openModal('modal-settings');
  // ממלאים את שלושת החלקים
  _openNotifySettingsInner().catch(e => { showToast('שגיאה: ' + e.message, 6000); console.error(e); });
  openGcalScreen();
  openUsersScreen();
  _loadMapsKeyStatus();
  _loadBarcaStatus();
}
window.openSettings = openSettings;

// ── מפתח גוגל מפות: נשמר ב-config/maps, השרת קורא אותו משם ──
async function _loadMapsKeyStatus() {
  const st = document.getElementById('maps-key-status');
  const inp = document.getElementById('maps-api-key');
  if (!st || !inp) return;
  try {
    const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDoc(_docRef('config', 'maps'));
    const key = snap.exists() ? (snap.data().key || '') : '';
    if (key) {
      st.textContent = '✅ מפתח מוגדר (' + key.slice(0, 8) + '…) — המרחקים מגיעים מגוגל';
      st.style.color = '#16a34a';
    } else {
      st.textContent = 'אין מפתח — המערכת עובדת עם מקור המפות החינמי';
      st.style.color = 'var(--muted)';
    }
  } catch (e) { st.textContent = ''; }
}

async function saveMapsKey() {
  const inp = document.getElementById('maps-api-key');
  const key = (inp?.value || '').trim();
  if (!key) return showToast('נא להדביק מפתח');
  if (!/^AIza[0-9A-Za-z_\-]{30,}$/.test(key)) return showToast('זה לא נראה כמו מפתח Google תקין (מתחיל ב-AIza)');
  try {
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await setDoc(_docRef('config', 'maps'), { key, updatedAt: new Date().toISOString(), updatedBy: currentUser.name });
    inp.value = '';
    _mapsHasKey = null;   // הבדיקה הבאה תזהה את המפתח והכל יחושב מחדש דרך גוגל
    showToast('✅ המפתח נשמר — המפה תעבוד עכשיו עם נתוני גוגל');
    _loadMapsKeyStatus();
  } catch (e) { showToast('שמירה נכשלה: ' + (e.code || e.message), 6000); }
}
window.saveMapsKey = saveMapsKey;

// ── משחקי ברצלונה: המפתח נשמר ב-config/barca, השרת מושך משם כל שלושה ימים ──
const _BARCA_FN = 'https://europe-west1-anak-soharim.cloudfunctions.net/runBarcaSyncNow';

async function _loadBarcaStatus() {
  const st = document.getElementById('barca-status');
  if (!st) return;
  try {
    const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDoc(_docRef('config', 'barca'));
    const d = snap.exists() ? snap.data() : {};
    if (!d.token) { st.textContent = 'אין מפתח — המשחקים לא נמשכים'; st.style.color = 'var(--muted)'; return; }
    const when = d.lastSync ? new Date(d.lastSync).toLocaleString('he-IL') : 'עדיין לא רץ';
    st.textContent = `✅ מפתח מוגדר · משיכה אחרונה: ${when}` + (d.lastCount != null ? ` · ${d.lastCount} משחקים` : '');
    st.style.color = '#16a34a';
  } catch (e) { st.textContent = ''; }
}

async function saveBarcaToken() {
  const inp = document.getElementById('barca-token');
  const token = (inp?.value || '').trim();
  if (!token) return showToast('נא להדביק מפתח');
  if (!_requireNet('שמירת המפתח')) return;
  try {
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await setDoc(_docRef('config', 'barca'), { token, updatedAt: new Date().toISOString(), updatedBy: currentUser.name }, { merge: true });
    inp.value = '';
    showToast('✅ המפתח נשמר');
    _loadBarcaStatus();
  } catch (e) { showToast('שמירה נכשלה: ' + (e.code || e.message), 6000); }
}
window.saveBarcaToken = saveBarcaToken;

async function runBarcaSyncNow() {
  if (!_requireNet('משיכת המשחקים')) return;
  const st = document.getElementById('barca-status');
  if (st) { st.textContent = '⏳ מושך משחקים...'; st.style.color = 'var(--muted)'; }
  try {
    const r = await (await fetch(_BARCA_FN)).json();
    if (r.ok) showToast(`✅ נוספו/עודכנו ${r.written} משחקים` + (r.removed ? ` · ${r.removed} נמחקו` : ''), 6000);
    else if (r.reason === 'no-token') showToast('אין מפתח שמור — קודם לשמור מפתח', 6000);
    else showToast('המשיכה נכשלה: ' + (r.reason || r.error || ''), 7000);
  } catch (e) { showToast('שגיאת חיבור: ' + e.message, 6000); }
  _loadBarcaStatus();
}
window.runBarcaSyncNow = runBarcaSyncNow;

// שמירת הסמל כ-PNG קטן עם שקיפות. 160 פיקסל מספיקים ליומן ומשקלם זניח.
function _crestToPng(file, maxPx = 160) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxPx || h > maxPx) {
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function uploadBarcaCrest(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (!_requireNet('שמירת הסמל')) { input.value = ''; return; }
  try {
    const data = await _crestToPng(file);
    if (_b64Size(data) > 700 * 1024) return showToast('התמונה גדולה מדי — נסה קובץ קטן יותר', 6000);
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await setDoc(_docRef('config', 'barca'), { crest: data, crestBy: currentUser.name, crestAt: new Date().toISOString() }, { merge: true });
    showToast('✅ הסמל נשמר ויופיע ביומן');
  } catch (e) { showToast('העלאה נכשלה: ' + (e.code || e.message), 6000); }
  input.value = '';
}
window.uploadBarcaCrest = uploadBarcaCrest;

async function resetBarcaCrest() {
  if (!_requireNet('שחזור הסמל')) return;
  try {
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await setDoc(_docRef('config', 'barca'), { crest: '' }, { merge: true });
    showToast('הסמל חזר לברירת המחדל');
  } catch (e) { showToast('שמירה נכשלה: ' + (e.code || e.message), 6000); }
}
window.resetBarcaCrest = resetBarcaCrest;

// החלפת לשונית (בטלפון). במחשב שלושתן מוצגות יחד ממילא.
function settingsTab(name) {
  ['telegram', 'users', 'gcal', 'maps', 'barca'].forEach(t => {
    document.getElementById('stab-' + t)?.classList.toggle('active', t === name);
    document.getElementById('spanel-' + t)?.classList.toggle('active', t === name);
  });
}
window.settingsTab = settingsTab;

async function openNotifySettings() {
  try { return await _openNotifySettingsInner(); } catch(e) { showToast('שגיאה: ' + e.message, 6000); console.error(e); }
}
async function _openNotifySettingsInner() {
  const contacts = await _loadDriverContacts();
  const twilioSid   = contacts['_twilioSid']?.value   || '';
  const twilioToken = contacts['_twilioToken']?.value || '';
  const twilioFrom  = contacts['_twilioFrom']?.value  || '';
  const managerPhone = contacts['_managerPhone']?.value || '';
  const telegramToken = contacts['_telegramToken']?.value || '';
  // איברהים אינו מקבל התראות טלגרם — גיבוי הפתקים אליו מוקפא (_BSHOP_TG_BACKUP)
  const drivers = ['ליאל','עופר','גיל','איתי','משה'];
  const telegramRow = `
    <div style="border:2px solid #229ED9;border-radius:12px;padding:12px 14px;margin-bottom:14px;background:#eaf7ff">
      <div style="font-weight:900;font-size:14px;margin-bottom:4px;color:#0d6ab0">✈️ טלגרם — חינמי, מועדף</div>
      <div style="font-size:11px;color:#333;margin-bottom:8px;line-height:1.6">1. בטלגרם: שלח ל-<b>@BotFather</b> את <b>/newbot</b>, ותקבל טוקן.<br>2. כל נהג פותח שיחה עם הבוט ושולח לו הודעה כלשהי (למשל /start).<br>3. הדבק את הטוקן כאן, שמור, ואז לחץ "רענן צ׳אטים מהבוט" כדי לשייך כל נהג.</div>
      <input id="nc-telegram-token" value="${telegramToken}" placeholder="טוקן הבוט (123456:ABC-DEF...)" style="border:1.5px solid #229ED9;border-radius:8px;padding:8px 10px;font-family:Heebo,sans-serif;font-size:13px;direction:ltr;text-align:left;width:100%;box-sizing:border-box;margin-bottom:8px">
      <button onclick="refreshTelegramChats()" style="background:#229ED9;color:#fff;border:none;border-radius:8px;padding:8px;width:100%;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;cursor:pointer">🔄 רענן צ׳אטים מהבוט</button>
      <div id="nc-telegram-chats" style="margin-top:8px;font-size:12px"></div>
    </div>`;
  // קבוצת סרטוני הפחחות — הבוט (מנהל בקבוצה) רושם אותה כשהוא רואה הודעה
  _pahachGroupSel = contacts['_pahachVideoChat']?.value || '';
  let groups = {};
  try {
    const gs = await window._getDoc(_docRef('config', 'telegram_groups'));
    if (gs.exists()) groups = gs.data() || {};
  } catch (e) {}
  window._pahachGroups = groups;
  const videoGroupRow = `
    <div style="border:2px solid #7c3aed;border-radius:12px;padding:12px 14px;margin-bottom:14px;background:#f5f3ff">
      <div style="font-weight:900;font-size:14px;margin-bottom:4px;color:#6d28d9">🎥 קבוצת סרטוני פחחות</div>
      <div style="font-size:11px;color:#333;margin-bottom:8px;line-height:1.6">סרטון שמצורף לפתק פחחות נשלח לקבוצה שנבחרת כאן.</div>
      <div id="nc-video-groups"></div>
    </div>`;
  const rows = drivers.map(name => {
    const c = contacts[name] || {};
    return `<div style="border:1.5px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:10px;background:#fff">
      <div style="font-weight:900;font-size:15px;margin-bottom:8px">👤 ${name}</div>
      <input id="nc-telegram-${name}" value="${c.telegramId||''}" placeholder="מזוהה אוטומטית מהבוט, או הדבק chat id ידנית" style="border:1.5px solid #229ED9;border-radius:8px;padding:8px 10px;font-family:Heebo,sans-serif;font-size:13px;direction:ltr;text-align:left;width:100%;box-sizing:border-box;margin-bottom:6px">
      <input id="nc-phone-${name}" type="hidden" value="${c.phone||''}">
      <button onclick="testTelegram('${name}')" style="width:100%;background:#229ED9;color:#fff;border:none;border-radius:8px;padding:7px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;cursor:pointer">✈️ בדיקת טלגרם</button>
    </div>`;
  }).join('');
  // רשימת המשתמשים מקופלת — היא ארוכה, ורוב הזמן לא נוגעים בה
  const driversBlock = `
    <button type="button" onclick="_toggleBox('nc-drivers','nc-drivers-btn','👥 הצגת משתמשים','👥 הסתרת משתמשים')"
      id="nc-drivers-btn" class="btn-submit" style="width:100%;margin-top:0;margin-bottom:10px;background:var(--surface2);color:var(--text);border:2px solid var(--border)">👥 הצגת משתמשים</button>
    <div id="nc-drivers" style="display:none">${rows}</div>`;
  document.getElementById('notify-settings-body').innerHTML = telegramRow + videoGroupRow + driversBlock;
  _renderPahachGroups();
}

/* פתיחה וסגירה של אזור מקופל. השדות נשארים בעמוד גם כשהם מוסתרים,
   כדי ששמירה תמשיך לקרוא מהם גם בלי לפתוח את הרשימה. */
function _toggleBox(boxId, btnId, showText, hideText) {
  const box = document.getElementById(boxId), btn = document.getElementById(btnId);
  if (!box) return;
  const open = box.style.display !== 'none';
  box.style.display = open ? 'none' : 'block';
  if (btn) btn.textContent = open ? showText : hideText;
}
window._toggleBox = _toggleBox;

// בחירת קבוצת היעד לסרטונים — נשמרת מיד בלחיצה
let _pahachGroupSel = '';
function _renderPahachGroups() {
  const box = document.getElementById('nc-video-groups');
  if (!box) return;
  const entries = Object.values(window._pahachGroups || {}).filter(g => g && g.id);
  if (!entries.length) {
    box.innerHTML = `<div style="font-size:12px;color:#6d28d9;font-weight:700">עדיין לא זוהתה קבוצה — ודא שהבוט מנהל בקבוצה ושלח בה הודעה, ואז פתח שוב את ההגדרות.</div>`;
    return;
  }
  box.innerHTML = entries.map(g => {
    const on = String(g.id) === String(_pahachGroupSel);
    return `<button type="button" onclick="pickPahachGroup('${esc(String(g.id))}')" style="display:block;width:100%;text-align:right;margin-bottom:6px;padding:10px 12px;border-radius:10px;font-family:Heebo,sans-serif;font-size:14px;font-weight:800;cursor:pointer;${on
      ? 'background:#7c3aed;color:#fff;border:2px solid #7c3aed'
      : 'background:#fff;color:var(--text);border:2px solid var(--border)'}">${on ? '✅ ' : ''}${esc(g.title || 'קבוצה')} <span style="font-weight:600;opacity:.7;font-size:11px">(${esc(String(g.id))})</span></button>`;
  }).join('');
}
async function pickPahachGroup(id) {
  _pahachGroupSel = (String(_pahachGroupSel) === String(id)) ? '' : id;
  _renderPahachGroups();
  try {
    await window._setDoc(_docRef('config', 'driver_contacts'), { _pahachVideoChat: { value: _pahachGroupSel } }, { merge: true });
    _driverContacts = { ...(_driverContacts || {}), _pahachVideoChat: { value: _pahachGroupSel } };
    showToast(_pahachGroupSel ? '✅ קבוצת הסרטונים נשמרה' : 'הבחירה בוטלה');
  } catch (e) { showToast('שמירת הקבוצה נכשלה'); }
}
window.pickPahachGroup = pickPahachGroup;

async function saveNotifySettings() {
  // איברהים אינו מקבל התראות טלגרם — גיבוי הפתקים אליו מוקפא (_BSHOP_TG_BACKUP)
  const drivers = ['ליאל','עופר','גיל','איתי','משה'];
  const data = {};
  const telegramToken = document.getElementById('nc-telegram-token')?.value.trim();
  if (telegramToken) data['_telegramToken'] = { value: telegramToken };
  drivers.forEach(name => {
    const phone = document.getElementById(`nc-phone-${name}`)?.value.trim();
    const telegramId = document.getElementById(`nc-telegram-${name}`)?.value.trim();
    if (phone || telegramId) data[name] = { ...(phone ? { phone } : {}), ...(telegramId ? { telegramId } : {}) };
  });
  const { setDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await setDoc(doc(window._db, 'config', 'driver_contacts'), data, { merge: true });
  _driverContacts = data;
  closeModal('modal-settings');
  showToast('✅ הגדרות נשמרו');
}

async function testTelegram(name) {
  const chatId = document.getElementById(`nc-telegram-${name}`)?.value.trim();
  if (!chatId) return showToast(`נא להזין/לשייך chat id עבור ${name}`);
  // use the token currently in the form, even if not saved yet
  const token = document.getElementById('nc-telegram-token')?.value.trim();
  if (!token) return showToast('נא להזין קודם טוקן בוט');
  _driverContacts = { ..._driverContacts, _telegramToken: { value: token } };
  showToast(`📤 שולח בדיקה ל-${name}...`, 3000);
  const ok = await _sendTelegram(chatId, `✅ בדיקה — מערכת ענק הרכבים מחוברת ל-${name}`);
  if (ok) showToast(`✅ נשלח ל-${name} בטלגרם`);
}

// pull the bot's recent chats and let the manager assign each one to a driver
async function refreshTelegramChats() {
  const token = document.getElementById('nc-telegram-token')?.value.trim();
  if (!token) return showToast('נא להזין קודם טוקן בוט');
  _driverContacts = { ..._driverContacts, _telegramToken: { value: token } };
  const box = document.getElementById('nc-telegram-chats');
  box.innerHTML = '⏳ טוען...';
  const chats = await _telegramGetUpdates();
  if (!chats.length) {
    box.innerHTML = 'לא נמצאו שיחות — בקש מכל עובד לשלוח הודעה לבוט (למשל /start), ואז לחץ שוב.';
    return;
  }
  const drivers = ['ליאל','עופר','גיל','איתי','משה'];
  box.innerHTML = chats.map(chat => {
    const opts = ['<option value="">— שייך לנהג —</option>']
      .concat(drivers.map(d => `<option value="${d}">${d}</option>`)).join('');
    return `<div style="display:flex;gap:6px;align-items:center;background:#fff;border:1px solid #bcdff5;border-radius:8px;padding:6px 8px;margin-bottom:5px">
      <span style="flex:1;font-weight:700">${esc(chat.name)}</span>
      <select onchange="_assignTelegramChat('${chat.id}',this.value)" style="border:1px solid #229ED9;border-radius:6px;padding:4px 6px;font-family:Heebo,sans-serif;font-size:12px">${opts}</select>
    </div>`;
  }).join('');
}
window.refreshTelegramChats = refreshTelegramChats;
window.testTelegram = testTelegram;

function _assignTelegramChat(chatId, driverName) {
  if (!driverName) return;
  const el = document.getElementById(`nc-telegram-${driverName}`);
  if (el) el.value = chatId;
  showToast(`שויך ל-${driverName} — לחץ "שמור הגדרות" לאישור`);
}
window._assignTelegramChat = _assignTelegramChat;
async function resendIntakeNotify(driver, plate, brand, model) {
  await _notifyDriver(driver, `🚗 קליטת רכב ממתינה לך — ${plate} ${brand} ${model}. כנס לאפליקציה ענק הרכבים.`);
  showToast(`📲 התראה נשלחה ל${driver}`);
}
window.resendIntakeNotify = resendIntakeNotify;
window.openNotifySettings = openNotifySettings;
window.saveNotifySettings = saveNotifySettings;

async function openBroadcast() {
  document.getElementById('broadcast-text').value = '';
  const contacts = await _loadDriverContacts();
  const drivers = ['עופר','גיל','איתי'].filter(n => contacts[n]?.phone);
  const container = document.getElementById('broadcast-drivers');
  container.innerHTML = drivers.map(name => `
    <label style="display:flex;align-items:center;gap:6px;background:#f0f2ff;border:2px solid var(--border);border-radius:10px;padding:8px 12px;cursor:pointer;font-weight:700;font-size:14px;user-select:none">
      <input type="checkbox" id="bc-drv-${name}" value="${name}" checked style="width:16px;height:16px;cursor:pointer">
      ${name}
    </label>`).join('');
  openModal('modal-broadcast');
}
async function sendBroadcast() {
  const msg = document.getElementById('broadcast-text').value.trim();
  if (!msg) return showToast('כתוב הודעה קודם');
  const selected = [...document.querySelectorAll('#broadcast-drivers input[type=checkbox]:checked')].map(el => el.value);
  if (!selected.length) return showToast('בחר לפחות נהג אחד');
  const btn = document.getElementById('broadcast-send-btn');
  btn.disabled = true; btn.textContent = '⏳ שולח...';
  try {
    for (const name of selected) await _notifyDriver(name, msg);
    showToast(`✅ ההודעה נשלחה ל${selected.length === 1 ? selected[0] : selected.length + ' נהגים'}!`);
    closeModal('modal-broadcast');
  } catch(e) {
    showToast('⚠️ שגיאה בשליחה: ' + (e.message || e));
  } finally {
    btn.disabled = false; btn.textContent = '📤 שלח';
  }
}
window.openBroadcast = openBroadcast;
window.sendBroadcast = sendBroadcast;

// ─── Live Intake View ─────────────────────────────────
let _liveIntakeUnsub = null;
let _liveIntakeDocs = [];
let _liveIntakeActive = null;

const _liveChecklistLabels = {
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

async function openLiveIntakeView() {
  openModal('modal-live-intake');
  document.getElementById('live-intake-tabs').innerHTML = '';
  document.getElementById('live-intake-body').innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';

  if (_liveIntakeUnsub) { _liveIntakeUnsub(); _liveIntakeUnsub = null; }

  try {
    const { collection, query, where, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const q = query(collection(window._db, 'intake_assignments'), where('status', '==', 'pending'));
    _liveIntakeUnsub = onSnapshot(q, snap => {
      _liveIntakeDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (a.createdAt?.toMillis?.()??0) - (b.createdAt?.toMillis?.()??0));
      if (!_liveIntakeActive || !_liveIntakeDocs.find(d => d.id === _liveIntakeActive))
        _liveIntakeActive = _liveIntakeDocs[0]?.id || null;
      _renderLiveIntakeModal();
    });
  } catch(e) {
    document.getElementById('live-intake-body').innerHTML = '<div style="color:red;padding:20px">שגיאה: ' + e.message + '</div>';
  }
}

function _renderLiveIntakeModal() {
  const tabs = document.getElementById('live-intake-tabs');
  const body = document.getElementById('live-intake-body');
  if (!tabs || !body) return;

  if (_liveIntakeDocs.length === 0) {
    tabs.innerHTML = '';
    body.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:15px">אין קליטות פעילות כרגע</div>';
    return;
  }

  tabs.innerHTML = _liveIntakeDocs.map(d => {
    const active = d.id === _liveIntakeActive;
    const hasDraft = !!(d.liveDraft && Object.keys(d.liveDraft.checks||{}).length);
    return '<button onclick="window._setLiveTab(\'' + d.id + '\')" style="background:' + (active?'#0f172a':'#e2e8f0') + ';color:' + (active?'#fff':'#334155') + ';border:none;border-radius:999px;padding:6px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;position:relative">' +
      esc(d.plate||d.assignedTo) + (hasDraft?'<span style="position:absolute;top:-3px;right:-3px;width:9px;height:9px;background:#22c55e;border-radius:50%;border:2px solid #fff"></span>':'') +
    '</button>';
  }).join('');

  const doc = _liveIntakeDocs.find(d => d.id === _liveIntakeActive);
  if (!doc) return;

  const draft = doc.liveDraft || {};
  const checks = draft.checks || {};
  const notes = draft.notes || {};
  const ts = doc.liveUpdatedAt ? new Date(doc.liveUpdatedAt).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : null;
  const totalChecked = Object.values(checks).filter(Boolean).length;
  const totalLabels = Object.keys(_liveChecklistLabels).length;
  const pct = Math.round(totalChecked / totalLabels * 100);

  let html = '<div style="background:#f8fafc;border-radius:12px;padding:12px 16px;margin-bottom:12px;border:2px solid #e2e8f0">' +
    '<div style="font-weight:900;font-size:17px">🚗 ' + esc(doc.plate||'—') + '</div>' +
    '<div style="color:#475569;margin-top:2px">נהג: <strong>' + esc(doc.assignedTo||'') + '</strong>' + (doc.brand||doc.model?' · '+esc(((doc.brand||'')+' '+(doc.model||'')).trim()):'') + '</div>' +
    '<div style="font-size:13px;margin-top:4px">ק"מ: <strong>'+(draft.km?esc(draft.km):'<span style="color:#94a3b8">לא הוזן</span>')+'</strong> &nbsp;|&nbsp; קוד: <strong>'+(draft.code?esc(draft.code):'<span style="color:#94a3b8">לא הוזן</span>')+'</strong></div>' +
    (draft.isElectric ? '<div style="font-size:13px;margin-top:4px;color:#15803d;font-weight:700">⚡ רכב חשמלי'+(draft.evCharge?' · טעינה: '+esc(draft.evCharge)+'%':'')+(draft.evRange?' · טווח: '+esc(draft.evRange)+' ק"מ':'')+'</div>' : '') +
    '<div style="margin-top:8px;background:#e2e8f0;border-radius:999px;height:8px"><div style="width:'+pct+'%;background:#22c55e;height:8px;border-radius:999px;transition:width .4s"></div></div>' +
    '<div style="font-size:12px;color:#64748b;margin-top:4px">'+totalChecked+' מתוך '+totalLabels+' בדיקות'+(ts?' · עדכון: '+ts:' · טרם התחיל')+'</div>' +
    '</div><div style="display:flex;flex-direction:column;gap:6px">';

  for (const [key, label] of Object.entries(_liveChecklistLabels)) {
    const val = checks[key];
    const icon = val === 'v' ? '✅' : val === 'x' ? '❌' : '⬜';
    const bg = val === 'v' ? '#f0fff4' : val === 'x' ? '#fff0f0' : '#f8fafc';
    const border = val ? '' : 'border:1.5px dashed #e2e8f0;';
    const note = notes[key] ? '<div style="font-size:12px;color:#555;margin-top:3px">📝 '+esc(notes[key])+'</div>' : '';
    let extra = '';
    if (key === 'c-battery-is-original' && val === 'x') {
      if (draft.batteryNoDate) {
        extra = '<div style="font-size:12px;color:#b45309;margin-top:3px;font-weight:700">📅 לא רואים תאריך מצבר</div>';
      } else if (draft.batteryMonth) {
        const parts = draft.batteryMonth.split('-');
        const formatted = parts.length === 2 ? parts[1]+'/'+parts[0] : draft.batteryMonth;
        extra = '<div style="font-size:12px;color:#b45309;margin-top:3px;font-weight:700">📅 חודש מצבר: '+esc(formatted)+'</div>';
      }
    }
    if (key === 'c-dashboard' && val === 'x' && draft.dashChecks) {
      const dashLabels = {'dash-check-engine':"צ'ק אנג'ין",'dash-tire-pressure':'לחץ אוויר','dash-service':'טיפול','dash-collision':'התגשות','dash-fuel':'דלק','dash-istop':'iStop','dash-other':'אחר'};
      const active = Object.entries(draft.dashChecks).filter(([,v])=>v).map(([k])=>dashLabels[k]||k);
      if (active.length) extra = '<div style="font-size:12px;color:#dc2626;margin-top:3px;font-weight:700">🔴 '+active.join(' · ')+'</div>';
    }
    html += '<div style="background:'+bg+';'+border+'border-radius:8px;padding:9px 13px;font-size:14px;font-weight:'+(val?'700':'400')+';color:'+(val?'inherit':'#94a3b8')+'">'+icon+' '+label+note+extra+'</div>';
  }

  html += '</div>';
  if (draft.general) html += '<div style="margin-top:10px;background:#fefce8;border-radius:8px;padding:9px 13px;font-size:13px">📝 הערות כלליות: '+esc(draft.general)+'</div>';
  body.innerHTML = html;
}

window._setLiveTab = function(id) { _liveIntakeActive = id; _renderLiveIntakeModal(); };
window.openLiveIntakeView = openLiveIntakeView;

/* ═══════════════════════════════════════════════════════
   רענון רכב
═══════════════════════════════════════════════════════ */
var _currentRefreshId = null;
var _currentRefreshData = null;

var _rfUpholsteryPhotos = [];
function addRfUpholsteryPhoto(input) {
  const files = [...input.files];
  _rfUpholsteryPhotos.push(...files.slice(0, 6 - _rfUpholsteryPhotos.length));
  input.value = '';
  _renderRfUpholsteryPhotos();
}
function removeRfUpholsteryPhoto(i) {
  _rfUpholsteryPhotos.splice(i, 1);
  _renderRfUpholsteryPhotos();
}
function _renderRfUpholsteryPhotos() {
  const grid = document.getElementById('rf-upholstery-photos');
  const btn = document.getElementById('btn-rf-upholstery-photo');
  if (!grid) return;
  grid.innerHTML = _rfUpholsteryPhotos.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div class="ci-photo-box"><img src="${url}"><button class="rm-btn" type="button" onclick="removeRfUpholsteryPhoto(${i})">✕</button></div>`;
  }).join('');
  if (btn) btn.style.display = _rfUpholsteryPhotos.length >= 6 ? 'none' : 'block';
}
window.addRfUpholsteryPhoto = addRfUpholsteryPhoto;
window.removeRfUpholsteryPhoto = removeRfUpholsteryPhoto;

var _rfBatteryPhotoFiles = [];
function addRfBatteryPhoto(input) {
  const files = [...input.files];
  _rfBatteryPhotoFiles.push(...files.slice(0, 4 - _rfBatteryPhotoFiles.length));
  input.value = '';
  _renderRfBatteryPhotos();
}
function removeRfBatteryPhoto(i) { _rfBatteryPhotoFiles.splice(i, 1); _renderRfBatteryPhotos(); }
function _renderRfBatteryPhotos() {
  const grid = document.getElementById('rf-battery-photos');
  const cnt = document.getElementById('rf-battery-photo-count');
  if (!grid) return;
  grid.innerHTML = _rfBatteryPhotoFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div class="ci-photo-box"><img src="${url}"><button class="rm-btn" type="button" onclick="removeRfBatteryPhoto(${i})">✕</button></div>`;
  }).join('');
  if (cnt) cnt.textContent = _rfBatteryPhotoFiles.length ? `${_rfBatteryPhotoFiles.length} תמונות` : '';
  const noCb = document.getElementById('rf-battery-no-date-cb');
  const ds = document.getElementById('rf-battery-date-section');
  if (ds && !noCb?.checked) ds.style.display = _rfBatteryPhotoFiles.length ? '' : 'none';
}
function rfBatteryNoDateToggle(cb) {
  const ds = document.getElementById('rf-battery-date-section');
  if (ds) ds.style.display = cb.checked ? 'none' : (_rfBatteryPhotoFiles.length ? '' : 'none');
  if (cb.checked) { const m = document.getElementById('rf-battery-month'); if(m)m.value=''; }
}
window.addRfBatteryPhoto = addRfBatteryPhoto;
window.removeRfBatteryPhoto = removeRfBatteryPhoto;
window.rfBatteryNoDateToggle = rfBatteryNoDateToggle;

var _rfDashboardPhotos = [];
function addRfDashboardPhoto(input) {
  const files = [...input.files];
  _rfDashboardPhotos.push(...files.slice(0, 4 - _rfDashboardPhotos.length));
  input.value = '';
  _renderRfDashboardPhotos();
}
function removeRfDashboardPhoto(i) { _rfDashboardPhotos.splice(i, 1); _renderRfDashboardPhotos(); }
function _renderRfDashboardPhotos() {
  const grid = document.getElementById('rf-dashboard-photos');
  const btn = document.getElementById('btn-rf-dashboard-photo');
  if (!grid) return;
  grid.innerHTML = _rfDashboardPhotos.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div class="ci-photo-box"><img src="${url}"><button class="rm-btn" type="button" onclick="removeRfDashboardPhoto(${i})">✕</button></div>`;
  }).join('');
  if (btn) btn.style.display = _rfDashboardPhotos.length >= 4 ? 'none' : 'block';
}
window.addRfDashboardPhoto = addRfDashboardPhoto;
window.removeRfDashboardPhoto = removeRfDashboardPhoto;

var _rfGenericPhotos = {};
function addRfGenericPhoto(key, input) {
  if (!_rfGenericPhotos[key]) _rfGenericPhotos[key] = [];
  const files = [...input.files];
  _rfGenericPhotos[key].push(...files.slice(0, 4 - _rfGenericPhotos[key].length));
  input.value = '';
  _renderRfGenericPhotos(key);
  _rfAutoSave();
}
function removeRfGenericPhoto(key, i) {
  if (_rfGenericPhotos[key]) _rfGenericPhotos[key].splice(i, 1);
  _renderRfGenericPhotos(key);
  _rfAutoSave();
}
function _renderRfGenericPhotos(key) {
  const grid = document.getElementById('rf-photos-' + key);
  if (!grid) return;
  const arr = _rfGenericPhotos[key] || [];
  grid.innerHTML = arr.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div class="ci-photo-box"><img src="${url}"><button class="rm-btn" type="button" onclick="removeRfGenericPhoto('${key}',${i})">✕</button></div>`;
  }).join('');
}
window.addRfGenericPhoto = addRfGenericPhoto;
window.removeRfGenericPhoto = removeRfGenericPhoto;

let _rfAutoSaveTimer = null;

function _rfAutoSave() {
  if (!_currentRefreshId) return;
  clearTimeout(_rfAutoSaveTimer);
  _rfAutoSaveTimer = setTimeout(async () => {
    if (!_currentRefreshId) return;
    const draft = _collectRfDraft();
    localStorage.setItem('rf_draft_' + _currentRefreshId, JSON.stringify(draft));
    try {
      const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await updateDoc(doc(window._db, 'refreshes', _currentRefreshId), { liveDraft: draft });
    } catch(e) {}
  }, 1200);
}

function _collectRfDraft() {
  const checks = {}, notes = {};
  ['rf-oil','rf-water','rf-battery','rf-battery-orig','rf-safety','rf-lights-break','rf-glass-break','rf-bulbs','rf-frames','rf-tires','rf-glove','rf-windows','rf-ac','rf-dashboard','rf-sunroof','rf-smell','rf-plastic','rf-upholstery','rf-steering','rf-test-drive'].forEach(key => {
    if (document.querySelector(`.rf-box[data-key="${key}"].v-active`)) checks[key]='v';
    else if (document.querySelector(`.rf-box[data-key="${key}"].x-active`)) checks[key]='x';
    const ta=document.getElementById('rfcn-'+key); if(ta?.value.trim()) notes[key]=ta.value.trim();
  });
  const dashChecks = {};
  ['rfd-check-engine','rfd-tire-pressure','rfd-service','rfd-collision','rfd-fuel','rfd-other'].forEach(id => { const el=document.getElementById(id); if(el) dashChecks[id]=el.checked; });
  return {
    checks, notes, dashChecks,
    scratches: document.getElementById('rfcn-scratches')?.value||'',
    notSold: document.getElementById('rfcn-not-sold')?.value||'',
    km: document.getElementById('rf-km')?.value||'',
    code: document.getElementById('rf-code')?.value||'',
    batteryNoDate: document.getElementById('rf-battery-no-date-cb')?.checked||false,
    batteryMonth: document.getElementById('rf-battery-month')?.value||'',
  };
}
function _applyRfDraft(draft) {
  draft.checks && Object.entries(draft.checks).forEach(([key,val]) => {
    const btn = document.querySelector(`.rf-box[data-key="${key}"][data-val="${val}"]`);
    if (btn) { btn.classList.add(val==='v'?'v-active':'x-active'); const nr=document.getElementById('rfnote-'+key); if(nr && val==='x') nr.style.display=''; }
  });
  draft.notes && Object.entries(draft.notes).forEach(([key,val]) => { const el=document.getElementById('rfcn-'+key); if(el) el.value=val; });
  draft.dashChecks && Object.entries(draft.dashChecks).forEach(([k,v]) => { const el=document.getElementById(k); if(el)el.checked=v; });
  if(draft.dashChecks?.['rfd-other']){const el=document.getElementById('rfcn-rf-dashboard');if(el)el.style.display='block';}
  ['scratches','notSold','km','code'].forEach(f => { if(draft[f]){ const id=f==='scratches'?'rfcn-scratches':f==='notSold'?'rfcn-not-sold':'rf-'+f; const el=document.getElementById(id); if(el)el.value=draft[f]; }});
  if (draft.batteryNoDate) { const el=document.getElementById('rf-battery-no-date-cb'); if(el)el.checked=true; }
  if (draft.batteryMonth) { const el=document.getElementById('rf-battery-month'); if(el){el.value=draft.batteryMonth; const ds=document.getElementById('rf-battery-date-section'); if(ds)ds.style.display='';} }
}
async function saveRfDraftAndClose() {
  if (!_currentRefreshId) { closeModal('modal-refresh-form'); return; }
  const draft = _collectRfDraft();
  const hasContent = Object.keys(draft.checks||{}).length || Object.values(draft.notes||{}).some(v=>v) || draft.scratches || draft.km;
  if (hasContent) {
    localStorage.setItem('rf_draft_'+_currentRefreshId, JSON.stringify(draft));
    // also save to Firestore so draft survives across devices/sessions
    try {
      const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await updateDoc(doc(window._db, 'refreshes', _currentRefreshId), { liveDraft: draft });
    } catch(e) {}
    showToast('💾 טיוטה נשמרה — תמשיך מאוחר יותר');
  }
  closeModal('modal-refresh-form');
}
window.saveRfDraftAndClose = saveRfDraftAndClose;

var _rfSunroofVideo = null;
function addRfSunroofVideo(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) { showToast('⚠️ הסרטון גדול מדי (מקסימום 50MB)'); input.value = ''; return; }
  _rfSunroofVideo = file;
  input.value = '';
  const preview = document.getElementById('rf-sunroof-video-preview');
  const btn = document.getElementById('btn-rf-sunroof-video');
  if (preview) {
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<div style="position:relative;display:inline-block">
      <video src="${url}" controls style="max-width:100%;border-radius:8px;max-height:200px"></video>
      <button type="button" onclick="removeRfSunroofVideo()" style="position:absolute;top:4px;right:4px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:24px;height:24px;font-size:14px;cursor:pointer;line-height:1">✕</button>
    </div>`;
  }
  if (btn) btn.textContent = '🎥 החלף סרטון';
}
function removeRfSunroofVideo() {
  _rfSunroofVideo = null;
  const preview = document.getElementById('rf-sunroof-video-preview');
  const btn = document.getElementById('btn-rf-sunroof-video');
  if (preview) preview.innerHTML = '';
  if (btn) btn.textContent = '🎥 צלם סרטון גג';
}
window.addRfSunroofVideo = addRfSunroofVideo;
window.removeRfSunroofVideo = removeRfSunroofVideo;

function rfClick(btn) {
  const key = btn.dataset.key;
  const val = btn.dataset.val;
  const activeClass = val === 'v' ? 'v-active' : 'x-active';
  const alreadyActive = btn.classList.contains(activeClass);
  document.querySelectorAll(`.rf-box[data-key="${key}"]`).forEach(b => b.classList.remove('v-active','x-active'));
  const noteRow = document.getElementById('rfnote-' + key);
  if (alreadyActive) {
    if (noteRow) noteRow.style.display = 'none';
  } else {
    btn.classList.add(activeClass);
    if (noteRow) noteRow.style.display = val === 'x' ? '' : 'none';
  }
}

async function openRefreshScreen() {
  const isManager = currentUser?.role === 'manager';
  document.getElementById('refresh-user-badge').textContent = currentUser?.name || '';
  document.getElementById('fab-new-refresh').style.display = isManager ? 'flex' : 'none';
  showScreen('refresh');
  const container = document.getElementById('refresh-list-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div> טוען...</div>';
  const { getDocs, query, collection, where } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  let q = isManager
    ? query(collection(window._db, 'refreshes'))
    : query(collection(window._db, 'refreshes'), where('assignedTo', '==', currentUser.name));
  let snap;
  try { snap = await getDocs(q); } catch(e) { container.innerHTML = `<div class="empty-state"><div class="es-icon">⚠️</div><h3>שגיאת טעינה</h3><p>${e.message}</p></div>`; return; }
  const docs = [...snap.docs].sort((a,b) => (b.data().createdAt?.toMillis?.()??0)-(a.data().createdAt?.toMillis?.()??0));
  if (snap.empty) {
    container.innerHTML = `<div class="empty-state"><div class="es-icon">🔄</div><h3>אין רענונים</h3><p>${isManager ? 'לחץ + רענון חדש להוסיף' : 'אין רענונים ממתינים'}</p></div>`;
    return;
  }
  container.innerHTML = docs.map(d => {
    const r = d.data();
    const done = r.status === 'done';
    const ts = r.createdAt?.toDate ? new Date(r.createdAt.toDate()).toLocaleDateString('he-IL') : '';
    return `<div class="vehicle-card" style="border-right:5px solid ${done?'var(--success)':'var(--warning)'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div onclick="openRefreshForm('${d.id}')" style="flex:1;cursor:pointer;min-width:0">
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
          <button onclick="openEditRefresh('${d.id}')" style="background:#6366f1;color:#fff;border:none;border-radius:10px;padding:7px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">✏️ עריכה</button>
          ${!done && r.assignedTo ? `<button onclick="notifyRefreshDriver('${esc(r.assignedTo)}','${esc(r.plate||'')}')" style="background:#16a34a;color:#fff;border:none;border-radius:10px;padding:7px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">📲 התראה</button>` : ''}
          <button onclick="deleteRefresh('${d.id}')" style="background:#ef4444;color:#fff;border:none;border-radius:10px;padding:7px 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">🗑️ מחיקה</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function notifyRefreshDriver(driverName, plate) {
  _notifyDriver(driverName, `🔔 תזכורת: יש לך רענון רכב ממתין — ${plate}. אנא טפל בהקדם.`);
  showToast(`📲 התראה נשלחה ל${driverName}`);
}

function openNewRefreshAssign() {
  ['ra-plate','ra-type','ra-year','ra-color','ra-parking','ra-notes','ra-driver'].forEach(id => { const el=document.getElementById(id); if(el)el.value=''; });
  const st = document.getElementById('ra-fetch-status'); if(st) { st.textContent=''; st.style.color='var(--muted)'; }
  openModal('modal-refresh-assign');
}

async function rfFetchVehicle() {
  const raw = document.getElementById('ra-plate').value.trim().replace(/[^0-9]/g,'');
  if (!raw) return showToast('נא להזין מספר לוחית');
  const status = document.getElementById('ra-fetch-status');
  const btn = document.getElementById('btn-rf-fetch');
  status.style.color = 'var(--muted)'; status.textContent = '⏳ מחפש...'; btn.disabled = true;
  try {
    const rec = await _plateLookup(raw);
    if (!rec) { status.style.color='var(--danger)'; status.textContent = window._plateRegistryEmpty ? '⏳ מאגר משרד התחבורה בעדכון כרגע — נסו שוב מאוחר יותר או מלאו ידנית' : '❌ לא נמצא רכב עם מספר זה'; return; }
    document.getElementById('ra-type').value = [rec.maker, rec.model].filter(Boolean).join(' ');
    document.getElementById('ra-year').value  = rec.year;
    document.getElementById('ra-color').value = rec.color;
    status.style.color = 'var(--success)'; status.textContent = '✅ פרטים נטענו בהצלחה';
  } catch(e) {
    status.style.color = 'var(--danger)'; status.textContent = '❌ שגיאה בחיבור לשרת';
  } finally { btn.disabled = false; }
}
window.rfFetchVehicle = rfFetchVehicle;

async function submitRefreshAssign() {
  const plate = document.getElementById('ra-plate')?.value.trim();
  const vehicleType = document.getElementById('ra-type')?.value.trim();
  const year = document.getElementById('ra-year')?.value.trim();
  const color = document.getElementById('ra-color')?.value.trim();
  const parking = document.getElementById('ra-parking')?.value.trim();
  const managerNotes = document.getElementById('ra-notes')?.value.trim() || '';
  const assignedTo = document.getElementById('ra-driver')?.value;
  if (!plate) return showToast('נא להזין לוחית רישוי');
  if (!assignedTo) return showToast('נא לבחור נהג');
  const { addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await addDoc(collection(window._db, 'refreshes'), { plate, vehicleType, year, color, parking, managerNotes, assignedTo, status: 'pending', createdAt: serverTimestamp() });
  closeModal('modal-refresh-assign');
  showToast('✅ רענון נוסף בהצלחה');
  _notifyDriver(assignedTo, `🔄 רענון רכב חדש ממתין לך — ${plate}${vehicleType?' '+vehicleType:''}${year?' שנת '+year:''}. כנס לאפליקציה ענק הרכבים.`);
  openVehiclesScreen();
}

async function openRefreshForm(id) {
  _currentRefreshId = id;
  document.querySelectorAll('#modal-refresh-form .rf-box').forEach(b => b.classList.remove('v-active','x-active'));
  document.querySelectorAll('#modal-refresh-form .ci-note-row').forEach(r => r.style.display = 'none');
  ['rfcn-rf-oil','rfcn-rf-water','rfcn-rf-battery','rfcn-rf-battery-orig','rfcn-rf-safety','rfcn-rf-lights-break','rfcn-rf-glass-break','rfcn-rf-bulbs','rfcn-rf-frames','rfcn-rf-tires','rfcn-rf-glove','rfcn-rf-windows','rfcn-rf-ac','rfcn-rf-dashboard','rfcn-rf-sunroof','rfcn-scratches','rfcn-rf-smell','rfcn-rf-plastic','rfcn-rf-upholstery','rfcn-rf-steering','rfcn-rf-test-drive','rfcn-not-sold'].forEach(eid => { const el=document.getElementById(eid); if(el)el.value=''; });
  ['rfd-check-engine','rfd-tire-pressure','rfd-service','rfd-collision','rfd-fuel','rfd-other'].forEach(eid => { const el=document.getElementById(eid); if(el)el.checked=false; });
  _rfUpholsteryPhotos = []; _renderRfUpholsteryPhotos();
  _rfBatteryPhotoFiles = []; _renderRfBatteryPhotos();
  _rfDashboardPhotos = []; _renderRfDashboardPhotos();
  _rfGenericPhotos = {};
  ['rf-oil', 'rf-water', 'rf-battery', 'rf-battery-orig', 'rf-safety', 'rf-lights-break', 'rf-glass-break', 'rf-bulbs', 'rf-frames', 'rf-tires', 'rf-glove', 'rf-windows', 'rf-ac', 'rf-smell', 'rf-plastic', 'rf-upholstery', 'rf-steering'].forEach(k => _renderRfGenericPhotos(k));
  _rfSunroofVideo = null;
  const svPrev = document.getElementById('rf-sunroof-video-preview'); if(svPrev) svPrev.innerHTML='';
  const svBtn = document.getElementById('btn-rf-sunroof-video'); if(svBtn) svBtn.textContent='🎥 צלם סרטון גג';
  const rfBatNoCb = document.getElementById('rf-battery-no-date-cb'); if(rfBatNoCb) rfBatNoCb.checked = false;
  const rfBatDate = document.getElementById('rf-battery-date-section'); if(rfBatDate) rfBatDate.style.display = 'none';
  const rfBatMonth = document.getElementById('rf-battery-month'); if(rfBatMonth) rfBatMonth.value = '';
  const rfKm = document.getElementById('rf-km'); if(rfKm) rfKm.value='';
  const rfCode = document.getElementById('rf-code'); if(rfCode) rfCode.value='';
  const rfDash = document.getElementById('rfcn-rf-dashboard'); if(rfDash) rfDash.style.display='none';
  const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const snap = await getDoc(doc(window._db, 'refreshes', id));
  if (!snap.exists()) return showToast('רענון לא נמצא');
  _currentRefreshData = snap.data();
  const r = _currentRefreshData;
  document.getElementById('rf-title').innerHTML = `רענון – ${esc(r.plate||'')} <button class="modal-close" onclick="saveRfDraftAndClose()">✕</button>`;
  document.getElementById('rf-vehicle-info').innerHTML = `<strong>${esc(r.plate||'')}</strong>${r.vehicleType?' · '+esc(r.vehicleType):''}${r.parking?' · חניה '+esc(r.parking):''}${r.managerNotes?`<div style="margin-top:6px;font-size:13px;color:#374151"><span style="font-weight:700">הערת מנהל:</span> ${esc(r.managerNotes)}</div>`:''}` ;
  if (r.formData) {
    const fd = r.formData;
    ['rf-oil','rf-water','rf-battery','rf-battery-orig','rf-safety','rf-lights-break','rf-glass-break','rf-bulbs','rf-frames','rf-tires','rf-glove','rf-windows','rf-ac','rf-dashboard','rf-sunroof','rf-smell','rf-plastic','rf-upholstery','rf-steering','rf-test-drive'].forEach(key => {
      const val = fd.checks?.[key];
      if (val) {
        const btn = document.querySelector(`.rf-box[data-key="${key}"][data-val="${val}"]`);
        if (btn) btn.classList.add(val==='v'?'v-active':'x-active');
        if (val==='x') { const nr=document.getElementById('rfnote-'+key); if(nr)nr.style.display=''; }
        const ta = document.getElementById('rfcn-'+key);
        if (ta && fd.notes?.[key]) ta.value = fd.notes[key];
      }
    });
    if (fd.scratches) { const el=document.getElementById('rfcn-scratches'); if(el)el.value=fd.scratches; }
    if (fd.notSold) { const el=document.getElementById('rfcn-not-sold'); if(el)el.value=fd.notSold; }
    if (fd.km) { const el=document.getElementById('rf-km'); if(el)el.value=fd.km; }
    if (fd.code) { const el=document.getElementById('rf-code'); if(el)el.value=fd.code; }
    if (fd.dashChecks) {
      Object.entries(fd.dashChecks).forEach(([k,v]) => { const el=document.getElementById(k); if(el)el.checked=v; });
      if (fd.dashChecks['rfd-other']) { const el=document.getElementById('rfcn-rf-dashboard'); if(el)el.style.display='block'; }
    }
    if (fd.batteryPhotos?.length) {
      const grid = document.getElementById('rf-battery-photos');
      if (grid) grid.innerHTML = fd.batteryPhotos.map(src => `<div class="ci-photo-box"><img src="${src}"></div>`).join('');
    }
    if (fd.batteryNoDate) { const el=document.getElementById('rf-battery-no-date-cb'); if(el)el.checked=true; }
    if (fd.batteryMonth) { const el=document.getElementById('rf-battery-month'); if(el){el.value=fd.batteryMonth; const ds=document.getElementById('rf-battery-date-section'); if(ds)ds.style.display='';} }
    if (fd.upholsteryPhotos?.length) {
      const grid = document.getElementById('rf-upholstery-photos');
      if (grid) grid.innerHTML = fd.upholsteryPhotos.map(src => `<div class="ci-photo-box"><img src="${src}"></div>`).join('');
    }
    if (fd.dashboardPhotos?.length) {
      const grid = document.getElementById('rf-dashboard-photos');
      if (grid) grid.innerHTML = fd.dashboardPhotos.map(src => `<div class="ci-photo-box"><img src="${src}"></div>`).join('');
    }
    ['rf-oil', 'rf-water', 'rf-battery', 'rf-battery-orig', 'rf-safety', 'rf-lights-break', 'rf-glass-break', 'rf-bulbs', 'rf-frames', 'rf-tires', 'rf-glove', 'rf-windows', 'rf-ac', 'rf-smell', 'rf-plastic', 'rf-upholstery', 'rf-steering'].forEach(k => {
      if (fd.genericPhotos?.[k]?.length) {
        const grid = document.getElementById('rf-photos-'+k);
        if (grid) grid.innerHTML = fd.genericPhotos[k].map(src => `<div class="ci-photo-box"><img src="${src}"></div>`).join('');
      }
    });
    if (fd.sunroofVideo) {
      const preview = document.getElementById('rf-sunroof-video-preview');
      const btn = document.getElementById('btn-rf-sunroof-video');
      if (preview) preview.innerHTML = `<video src="${fd.sunroofVideo}" controls style="max-width:100%;border-radius:8px;max-height:200px"></video>`;
      if (btn) btn.textContent = '🎥 החלף סרטון';
    }
  }
  if (r.status !== 'done') {
    const draftKey = 'rf_draft_' + id;
    const localDraft = localStorage.getItem(draftKey);
    const localObj = localDraft ? (() => { try { return JSON.parse(localDraft); } catch(e) { return null; } })() : null;
    /* טיוטה מקומית ריקה לא מנצחת טיוטה מלאה מהשרת — אחרת הטופס נראה
       ריק במכשיר שני למרות שמישהו כבר מילא אותו. */
    const draft = _draftWeight(localObj) ? localObj : (r.liveDraft || localObj);
    if (draft && Object.keys(draft.checks||{}).length) {
      _applyRfDraft(draft);
      const bar = document.createElement('div');
      bar.style.cssText = 'background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px;font-weight:700;display:flex;justify-content:space-between;align-items:center;gap:8px';
      bar.innerHTML = `<span>💾 נטענה טיוטה שמורה</span><button type="button" onclick="localStorage.removeItem('${draftKey}');this.parentNode.remove()" style="background:none;border:1px solid #f59e0b;border-radius:8px;padding:4px 10px;font-family:Heebo,sans-serif;font-size:12px;cursor:pointer">נקה</button>`;
      document.getElementById('rf-vehicle-info')?.after(bar);
    }
  }
  // wire auto-save on any input/change inside the form
  const _rfModal = document.getElementById('modal-refresh-form');
  if (_rfModal && !_rfModal._autoSaveWired) {
    _rfModal._autoSaveWired = true;
    _rfModal.addEventListener('input', _rfAutoSave);
    _rfModal.addEventListener('change', _rfAutoSave);
    // also hook rf-box clicks (they fire click, not input)
    _rfModal.addEventListener('click', e => { if (e.target.closest('.rf-box')) _rfAutoSave(); });
  }
  openModal('modal-refresh-form');
}

async function submitRefreshForm() {
  if (!_currentRefreshId) return;
  const xNoteKeys = ['rf-oil','rf-water','rf-battery','rf-battery-orig','rf-safety','rf-lights-break','rf-glass-break','rf-bulbs','rf-frames','rf-tires','rf-glove','rf-windows','rf-ac','rf-sunroof','rf-smell','rf-plastic','rf-upholstery','rf-steering','rf-test-drive'];
  for (const key of xNoteKeys) {
    const isX = document.querySelector(`.rf-box[data-key="${key}"].x-active`);
    if (isX) {
      const ta = document.getElementById('rfcn-' + key);
      if (!ta?.value.trim()) { ta?.scrollIntoView({behavior:'smooth',block:'center'}); showToast('⚠️ נא להזין הערה לסעיף שסומן ✕'); return; }
    }
  }
  if (!_rfBatteryPhotoFiles.length) {
    document.getElementById('rf-battery-photos')?.scrollIntoView({behavior:'smooth',block:'center'});
    showToast('⚠️ נא לצלם תמונת מצבר'); return;
  }
  const rfBatNoCb = document.getElementById('rf-battery-no-date-cb');
  const rfBatMonth = document.getElementById('rf-battery-month');
  if (!rfBatNoCb?.checked && !rfBatMonth?.value) {
    rfBatMonth?.scrollIntoView({behavior:'smooth',block:'center'});
    showToast('⚠️ נא להזין חודש מצבר או לסמן "לא רואים תאריך"'); return;
  }
  if (!_rfUpholsteryPhotos.length) {
    document.getElementById('rf-upholstery-photos')?.scrollIntoView({behavior:'smooth',block:'center'});
    showToast('⚠️ נא לצלם תמונות ריפודים ושטיחים'); return;
  }
  if (document.querySelector('.rf-box[data-key="rf-dashboard"].x-active')) {
    const dashIds = ['rfd-check-engine','rfd-tire-pressure','rfd-service','rfd-collision','rfd-fuel','rfd-other'];
    if (!dashIds.some(id => document.getElementById(id)?.checked)) {
      document.getElementById('rfnote-rf-dashboard')?.scrollIntoView({behavior:'smooth',block:'center'});
      showToast('⚠️ נא לסמן לפחות מנורה אחת'); return;
    }
    if (!_rfDashboardPhotos.length) {
      document.getElementById('rf-dashboard-photos')?.scrollIntoView({behavior:'smooth',block:'center'});
      showToast('⚠️ נא לצלם תמונת לוח שעונים'); return;
    }
  }
  const checks = {}, notes = {};
  ['rf-oil','rf-water','rf-battery','rf-battery-orig','rf-safety','rf-lights-break','rf-glass-break','rf-bulbs','rf-frames','rf-tires','rf-glove','rf-windows','rf-ac','rf-dashboard','rf-sunroof','rf-smell','rf-plastic','rf-upholstery','rf-steering','rf-test-drive'].forEach(key => {
    if (document.querySelector(`.rf-box[data-key="${key}"].v-active`)) checks[key]='v';
    else if (document.querySelector(`.rf-box[data-key="${key}"].x-active`)) checks[key]='x';
    const ta=document.getElementById('rfcn-'+key); if(ta?.value.trim()) notes[key]=ta.value.trim();
  });
  const dashChecks = {};
  ['rfd-check-engine','rfd-tire-pressure','rfd-service','rfd-collision','rfd-fuel','rfd-other'].forEach(id => { const el=document.getElementById(id); if(el) dashChecks[id]=el.checked; });
  const scratches = document.getElementById('rfcn-scratches')?.value.trim()||'';
  const notSold = document.getElementById('rfcn-not-sold')?.value.trim()||'';
  const km = document.getElementById('rf-km')?.value.trim()||'';
  const code = document.getElementById('rf-code')?.value.trim()||'';
  const { updateDoc, doc, addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  showToast('⏳ שולח...');
  const upholsteryPhotoB64s = await Promise.all(_rfUpholsteryPhotos.map(f => compressToBase64(f)));
  const batteryPhotoB64s = await Promise.all(_rfBatteryPhotoFiles.map(f => compressToBase64(f)));
  const rfBatNoCbVal = document.getElementById('rf-battery-no-date-cb')?.checked || false;
  const rfBatMonthVal = document.getElementById('rf-battery-month')?.value || '';
  let sunroofVideoB64 = '';
  if (_rfSunroofVideo && document.querySelector('.rf-box[data-key="rf-sunroof"].x-active')) {
    showToast('⏳ מעבד סרטון...');
    sunroofVideoB64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = e => res(e.target.result); fr.onerror = rej; fr.readAsDataURL(_rfSunroofVideo); });
  }
  const dashboardPhotoB64s = document.querySelector('.rf-box[data-key="rf-dashboard"].x-active')
    ? await Promise.all(_rfDashboardPhotos.map(f => compressToBase64(f))) : [];
  const genericPhotoB64s = {};
  for (const k of ['rf-oil', 'rf-water', 'rf-battery', 'rf-battery-orig', 'rf-safety', 'rf-lights-break', 'rf-glass-break', 'rf-bulbs', 'rf-frames', 'rf-tires', 'rf-glove', 'rf-windows', 'rf-ac', 'rf-smell', 'rf-plastic', 'rf-upholstery', 'rf-steering']) {
    if (_rfGenericPhotos[k]?.length) genericPhotoB64s[k] = await Promise.all(_rfGenericPhotos[k].map(f => compressToBase64(f)));
  }
  await updateDoc(doc(window._db, 'refreshes', _currentRefreshId), { formData: {checks,notes,dashChecks,scratches,notSold,km,code,upholsteryPhotos:upholsteryPhotoB64s,batteryPhotos:batteryPhotoB64s,batteryNoDate:rfBatNoCbVal,batteryMonth:rfBatMonthVal,dashboardPhotos:dashboardPhotoB64s,genericPhotos:genericPhotoB64s,sunroofVideo:sunroofVideoB64}, status:'done', completedAt:serverTimestamp(), completedBy:currentUser?.name||'' });
  if (checks['rf-smell']==='x') {
    const r = _currentRefreshData;
    await addDoc(collection(window._db,'tasks'), { title:`טיפול בריח — ${r.plate||''}${r.vehicleType?' · '+r.vehicleType:''}${r.parking?' · חניה '+r.parking:''}`, notes:notes['rf-smell']||'', assignedTo:r.assignedTo||'', column:'משימות כלליות', status:'pending', createdAt:serverTimestamp() });
  }
  localStorage.removeItem('rf_draft_' + _currentRefreshId);
  const _rfPlate = _currentRefreshData?.plate || '';
  const _rfDriver = currentUser?.name || '';
  _notifyDriver('ליאל', `✅ ${_rfDriver} סיים רענון רכב — ${_rfPlate}`);
  showToast('✅ רענון נשמר בהצלחה');
  closeModal('modal-refresh-form');
  openVehiclesScreen();
}
async function openEditRefresh(id) {
  const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const snap = await getDoc(doc(window._db, 'refreshes', id));
  if (!snap.exists()) return showToast('לא נמצא');
  const r = snap.data();
  document.getElementById('re-id').value = id;
  document.getElementById('re-plate').value = r.plate || '';
  document.getElementById('re-type').value = r.vehicleType || '';
  document.getElementById('re-year').value = r.year || '';
  document.getElementById('re-color').value = r.color || '';
  document.getElementById('re-parking').value = r.parking || '';
  document.getElementById('re-notes').value = r.managerNotes || '';
  openModal('modal-refresh-edit');
}
async function submitEditRefresh() {
  const id = document.getElementById('re-id').value;
  if (!id) return;
  const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await updateDoc(doc(window._db, 'refreshes', id), {
    plate: document.getElementById('re-plate').value.trim(),
    vehicleType: document.getElementById('re-type').value.trim(),
    year: document.getElementById('re-year').value.trim(),
    color: document.getElementById('re-color').value.trim(),
    parking: document.getElementById('re-parking').value.trim(),
    managerNotes: document.getElementById('re-notes').value.trim(),
  });
  closeModal('modal-refresh-edit');
  showToast('✅ פרטים עודכנו');
  openVehiclesScreen();
}
async function deleteRefresh(id) {
  if (!confirm('למחוק רענון זה?')) return;
  const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await deleteDoc(doc(window._db, 'refreshes', id));
  showToast('🗑️ רענון נמחק');
  openVehiclesScreen();
}
window.deleteRefresh = deleteRefresh;
window.openEditRefresh = openEditRefresh;
window.submitEditRefresh = submitEditRefresh;
window.openRefreshScreen = openRefreshScreen;
window.openNewRefreshAssign = openNewRefreshAssign;
window.submitRefreshAssign = submitRefreshAssign;
window.openRefreshForm = openRefreshForm;
window.submitRefreshForm = submitRefreshForm;
window.rfClick = rfClick;

// ══════════════════════════════════════════
//  PICKUP CARS
// ══════════════════════════════════════════

let _pickupAllCars = [];
let _pickupSortMode = 0; // 0=newest first, 1=wait high→low, 2=wait low→high

let _pickupArchiveLoaded = false;
let _pickupArchiveOpen = false;
let _pickupArchiveCars = [];
let _pickupSelected = new Set();
let _pickupShownIds = [];

// ── City → region mapping (from the manager's Excel) ──
const _CITY_REGION = {"אום אל־פחם": "צפון", "אור עקיבא": "צפון", "באקה אל־גרבייה": "צפון", "בית שאן": "צפון", "דלית אל־כרמל": "צפון", "חיפה": "צפון", "טבריה": "צפון", "טירת הכרמל": "צפון", "טירת כרמל": "צפון", "טמרה": "צפון", "יקנעם עילית": "צפון", "כרמיאל": "צפון", "כפר קאסם": "צפון", "מעלות־תרשיחא": "צפון", "מגדל העמק": "צפון", "נוף הגליל": "צפון", "נהריה": "צפון", "נשר": "צפון", "נצרת": "צפון", "עכו": "צפון", "עפולה": "צפון", "עראבה": "צפון", "צפת": "צפון", "קריית אתא": "צפון", "קריית ביאליק": "צפון", "קריית ים": "צפון", "קריית מוצקין": "צפון", "קריית שמונה": "צפון", "שפרעם": "צפון", "סח'נין": "צפון", "טייבה": "צפון", "טירה": "צפון", "קלנסווה": "צפון", "אלעד": "מרכז", "אריאל": "מרכז", "באר יעקב": "מרכז", "בת ים": "מרכז", "בני ברק": "מרכז", "גבעת שמואל": "מרכז", "גבעתיים": "מרכז", "הוד השרון": "מרכז", "הרצליה": "מרכז", "חולון": "מרכז", "חדרה": "מרכז", "חריש": "מרכז", "יהוד־מונוסון": "מרכז", "יבנה": "מרכז", "ירושלים": "מרכז", "מבשרת ציון": "מרכז", "כפר סבא": "מרכז", "לוד": "מרכז", "מודיעין־מכבים־רעות": "מרכז", "מעלה אדומים": "מרכז", "נס ציונה": "מרכז", "נתניה": "מרכז", "אור יהודה": "מרכז", "פתח תקווה": "מרכז", "ראש העין": "מרכז", "ראשון לציון": "מרכז", "רחובות": "מרכז", "רמלה": "מרכז", "רעננה": "מרכז", "רמת גן": "מרכז", "רמת השרון": "מרכז", "תל אביב–יפו": "מרכז", "אופקים": "דרום", "אילת": "דרום", "אשדוד": "דרום", "אשקלון": "דרום", "באר שבע": "דרום", "בית שמש": "דרום", "דימונה": "דרום", "נתיבות": "דרום", "ערד": "דרום", "קריית גת": "דרום", "קריית מלאכי": "דרום", "רהט": "דרום", "שדרות": "דרום", "ניר צבי": "מרכז", "גלילות": "מרכז"};
function _normCityName(s) {
  return String(s || '')
    .replace(/[־–—-]/g, ' ')  // maqaf ־ / en–em dash / hyphen → space
    .replace(/['"׳״`]/g, '')        // gershayim / quotes → remove
    .replace(/(^|\s)קרית/g, '$1קריית') // common short spelling → the list's spelling
    .replace(/\s+/g, ' ').trim();
}
const _CITY_REGION_NORM = (() => { const o = {}; for (const k in _CITY_REGION) o[_normCityName(k)] = _CITY_REGION[k]; return o; })();
const _CITY_LIST = Object.keys(_CITY_REGION).sort((a, b) => a.localeCompare(b, 'he'));
function _regionOfCity(city) {
  const n = _normCityName(city); if (!n) return '';
  if (_CITY_REGION_NORM[n]) return _CITY_REGION_NORM[n];
  if (n.length >= 3) for (const k in _CITY_REGION_NORM) { if (k.startsWith(n) || n.startsWith(k)) return _CITY_REGION_NORM[k]; }
  return '';
}
function _cityAutocomplete(inputId, ddId) {
  const input = document.getElementById(inputId), dd = document.getElementById(ddId);
  if (!input || !dd) return;
  const v = _normCityName(input.value);
  if (!v) { dd.style.display = 'none'; dd.innerHTML = ''; return; }
  const matches = _CITY_LIST.filter(c => _normCityName(c).startsWith(v)).slice(0, 10);
  if (!matches.length) { dd.style.display = 'none'; dd.innerHTML = ''; return; }
  dd.innerHTML = matches.map(c => `<div onclick="_pickCity('${inputId}','${ddId}',this.dataset.c)" data-c="${c.replace(/"/g,'&quot;')}" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:14px;font-weight:600;background:var(--card);color:var(--text)">${c}</div>`).join('');
  dd.style.display = 'block';
}
window._cityAutocomplete = _cityAutocomplete;
function _pickCity(inputId, ddId, city) {
  const input = document.getElementById(inputId); if (input) input.value = city;
  const dd = document.getElementById(ddId); if (dd) { dd.style.display = 'none'; dd.innerHTML = ''; }
}
window._pickCity = _pickCity;
/* Whatever is typed in a city field is matched against the list of towns when
   the field is left — "טירת כרמל", "פ״ת" or a typo all end up as the one name
   the rest of the system knows. Text that matches nothing is left as it is. */
function _snapCityField(inputId) {
  const el = document.getElementById(inputId);
  const raw = (el?.value || '').trim();
  if (!el || !raw) return;
  if (typeof _fuzzyMatchCity !== 'function') return;
  const m = _fuzzyMatchCity(raw);
  if (m?.city && m.city !== raw) el.value = m.city;
}
