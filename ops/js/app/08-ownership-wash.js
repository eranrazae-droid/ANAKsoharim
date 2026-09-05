/* בעלויות, חיפוש לוחית ופתק שטיפה
   חלק 8 מתוך 13 של אפליקציית התפעול.
   הקבצים נטענים לפי הסדר ומתנהגים בדיוק כמו קובץ אחד — אין לשנות את הסדר. */
let _ownGone = [], _ownGoneUnsub = null;

function _renderOwnGone() {
  const box = document.getElementById('own-gone');
  if (!box) return;
  // רכב שאינו נסרק בכלל לא אמור להופיע כאן — הוא "ירד מהמלאי" רק
  // בגלל שהוצא מהסריקה, ולא בגלל שקרה לו משהו
  const rows = _ownGone.filter(r => !r.approvedBy
    && !_SCAN_SKIP_PLATES.has(String(r.plate || '').replace(/\D/g, '')));
  if (!rows.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'block';
  box.innerHTML = `<div style="font-weight:900;font-size:14px;margin-bottom:8px">📤 ירדו מהמלאי — ממתין לאישור (${rows.length})</div>`
    + rows.map(r => {
      const moved = r.movedOnExit && r.to
        ? `עבר מבעלות ${esc(_ownBaalutPhrase(r.from))} לבעלות ${esc(_ownBaalutPhrase(r.to))}`
        : (r.from ? `הבעלות לא השתנתה (${esc(_ownBaalutPhrase(r.from))})` : '');
      return `<div style="border:2px solid #d97706;border-radius:12px;padding:11px 13px;margin-bottom:8px;background:#fffbeb">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div style="min-width:0">
          <div style="font-weight:900;font-size:17px;letter-spacing:1px">${esc(r.plate || '')}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">${esc([r.tozeret, r.degem, r.shnat].filter(Boolean).join(' · '))}</div>
          ${moved ? `<div style="font-size:12.5px;font-weight:800;color:#b45309;margin-top:4px">${moved}</div>` : ''}
          <div style="font-size:12px;color:var(--muted);font-weight:700;margin-top:3px">🕒 זוהה ב-${esc(_ownLogDate(r.at))}</div>
        </div>
        <button onclick="ownGoneApprove('${esc(r.id)}')" style="background:#16a34a;color:#fff;border:none;border-radius:9px;padding:9px 14px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;flex-shrink:0">✅ אשר</button>
      </div>
    </div>`;
    }).join('');
}

// אישור רכב שירד מהמלאי — נעלם מהרשימה ולא חוזר
async function ownGoneApprove(id) {
  const r = _ownGone.find(x => x.id === id);
  if (!r) return;
  r.approvedBy = currentUser?.name || 'מנהל';    // תגובה מיידית
  _renderOwnGone();
  try {
    await _updateDoc(_docRef('ownership_log', id),
      { approvedBy: currentUser?.name || 'מנהל', approvedAt: new Date().toISOString() });
    showToast('✅ אושר — הרכב לא יוצג שוב');
  } catch (e) {
    r.approvedBy = null; _renderOwnGone();
    showToast('שמירה נכשלה: ' + (e.code || e.message), 6000);
  }
}
window.ownGoneApprove = ownGoneApprove;

// קולט רשימת רכבים ושומר מהם רק את הספק, לפי מספר רישוי. רכב שממתין
// לאיסוף גובר על רכב שכבר נאסף, כי זה המצב העדכני יותר.
function _ownAbsorbPickup(snap, state) {
  snap.docs.forEach(d => {
    const c = d.data();
    const key = String(c.plate || '').replace(/\D/g, '');
    const src = String(c.source || '').trim();
    if (!key || !src) return;
    const cur = _ownPickupByPlate[key];
    if (cur && cur.state === 'ממתין לאיסוף' && state !== 'ממתין לאיסוף') return;
    _ownPickupByPlate[key] = { source: src, state };
  });
  _ownRender();
}

// האזנה לתוצאת הבדיקה. רצה גם בלי שמסך הבעלויות נפתח, כדי שהחלונית
// היומית תדע מה להציג.
function _ownStartWatch() {
  if (_ownUnsub) return;
  _ownUnsub = _onSnap(_docRef('ownership_status', 'current'), snap => {
    const d = snap.exists() ? snap.data() : null;
    _ownCars = (d && d.cars) || [];
    const u = d && d.updatedAt && d.updatedAt.toDate ? d.updatedAt.toDate() : null;
    _ownUpdatedRaw = u;
    _ownUpdatedAt = u ? u.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    _ownRender();
    _renderOwnMorning();
  }, () => {});
}

function openOwnershipScreen() {
  document.getElementById('own-user-badge').textContent = currentUser.name;
  showScreen('ownership');
  _ownStartWatch();
  // הספק נלמד גם מהרכבים שממתינים לאיסוף וגם מאלה שכבר נאספו, כדי
  // שרכב שנאסף עדיין יציג מאיזו חברה הוא הגיע
  if (!_ownPickupUnsub) {
    _ownPickupUnsub = [
      _onSnap(_colRef('pickup_cars'),    snap => _ownAbsorbPickup(snap, 'ממתין לאיסוף'), () => {}),
      _onSnap(_colRef('pickup_archive'), snap => _ownAbsorbPickup(snap, 'נאסף'),        () => {}),
    ];
  }
  if (!_ownGoneUnsub) {
    _ownGoneUnsub = _onSnap(_query(_colRef('ownership_log'), _where('kind', '==', 'gone')), snap => {
      _ownGone = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.at?.toMillis?.() ?? 0) - (a.at?.toMillis?.() ?? 0));
      _renderOwnGone();
    }, () => {});
  }
  _ownLoadConfig();
  _syncOwnMorningBar();
  // תמיד מציגים את הדוח העדכני ביותר
  setTimeout(_ownEnsureFresh, 1200);
}
window.openOwnershipScreen = openOwnershipScreen;

async function _ownLoadConfig() {
  try {
    const s = await window._getDoc(_docRef('config', 'ownership'));
    const d = s.exists() ? s.data() : {};
    _ownIds = d.ourIds || [];
  } catch (e) {}
  _ownRender();
}

async function ownSaveIds() {
  const ids = ['own-id1', 'own-id2']
    .map(id => (document.getElementById(id).value || '').replace(/\D/g, ''))
    .filter(Boolean);
  _ownIds = ids;
  try {
    await window._setDoc(_docRef('config', 'ownership'), { ourIds: ids }, { merge: true });
    showToast('✅ המספרים נשמרו');
  } catch (e) { showToast('שגיאה בשמירה'); }
}
window.ownSaveIds = ownSaveIds;

// רשימת בעלויות: שורה לכל רכב — מספר רישוי ואחריו הח.פ/ת.ז הרשום.
async function ownSaveOwners() {
  const txt = document.getElementById('own-paste').value || '';
  const owners = {};
  let bad = 0;
  for (const raw of txt.split('\n')) {
    const nums = (raw.trim().match(/\d+/g) || []);
    if (nums.length < 2) { if (raw.trim()) bad++; continue; }
    const plate = nums[0], id = nums[1];
    if (plate.length < 6 || id.length < 8) { bad++; continue; }
    owners[plate] = id;
  }
  try {
    await window._setDoc(_docRef('config', 'ownership'), { owners }, { merge: true });
    showToast(bad ? `✅ נשמרו ${Object.keys(owners).length} · ${bad} שורות לא הובנו` : `✅ נשמרו ${Object.keys(owners).length} בעלויות`, 5000);
    runOwnershipScan();   // מיד מצליב את המלאי מול הרשימה החדשה
  } catch (e) { showToast('שגיאה בשמירה'); }
}
window.ownSaveOwners = ownSaveOwners;

async function runOwnershipScan() {
  if (_ownScanning) return;
  _ownScanning = true;
  const btn = document.getElementById('own-scan-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ בודק…'; }
  try {
    const res = await fetch(_OWN_FN);
    const r = await res.json().catch(() => ({}));
    if (r.ok) showToast(`✅ נטענו ${r.checked} רכבים`, 5000);
    else if (r.reason === 'registry-unreachable') showToast('⚠️ אין כרגע גישה למרשם הרכב של משרד התחבורה — הבדיקה לא בוצעה', 9000);
    else showToast('⚠️ הטעינה נכשלה: ' + (r.reason || r.error || res.status), 7000);
  } catch (e) { showToast('⚠️ שגיאת חיבור לשרת: ' + e.message, 7000); }
  finally { _ownScanning = false; if (btn) { btn.disabled = false; btn.textContent = '🔄 בדוק עכשיו'; } }
}
window.runOwnershipScan = runOwnershipScan;

function ownFilter(f) { _ownFilter = f; _ownRender(); }
window.ownFilter = ownFilter;


/* ── יומן שינויי בעלות ───────────────────────────────────────────────
   כל שינוי שהסריקה זיהתה נשמר בשרת ב-ownership_log ונשאר שם לתמיד.
   כאן מציגים אותו, ומאפשרים לסמן "אושר על ידי" עם שם ותאריך.        */
let _ownLog = [], _ownLogUnsub = null, _ownLogFilter = 'all';

const _OWN_LOG_KINDS = {
  moved:   { icon: '🚨', label: 'עבר בעלות',                 color: '#dc2626' },
  new_not: { icon: '⚠️', label: 'נכנס למלאי לא על תו סחר',   color: '#d97706' },
  gone:    { icon: '📤', label: 'ירד מהמלאי',                 color: '#6b7280' },
  back:    { icon: '✅', label: 'חזר לתו סחר',                color: '#16a34a' },
};
const _ownBaalutPhrase = b => ({
  'סוחר': 'תו סחר', 'פרטי': 'אדם פרטי', 'חברה': 'חברה',
  'ליסינג': 'ליסינג', 'השכרה': 'השכרה',
}[String(b || '').trim()] || b || '');

function openOwnLog() {
  openModal('modal-own-log');
  if (_ownLogUnsub) { _renderOwnLog(); return; }
  document.getElementById('own-log-list').innerHTML =
    '<div style="padding:20px;text-align:center;color:var(--muted)">טוען…</div>';
  _ownLogUnsub = _onSnap(_colRef('ownership_log'), snap => {
    _ownLog = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.at?.toMillis?.() ?? 0) - (a.at?.toMillis?.() ?? 0));
    _renderOwnLog();
  }, err => {
    document.getElementById('own-log-list').innerHTML =
      `<div style="padding:20px;text-align:center;color:#dc2626">שגיאה בטעינה: ${esc(err?.code || err?.message || '')}</div>`;
  });
}
window.openOwnLog = openOwnLog;

function _ownLogDate(v) {
  const d = v?.toDate ? v.toDate() : (v ? new Date(v) : null);
  if (!d || isNaN(d)) return '';
  return d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function _renderOwnLog() {
  const box = document.getElementById('own-log-list');
  if (!box) return;
  for (const [id, on] of [['olf-all', _ownLogFilter === 'all'], ['olf-open', _ownLogFilter === 'open']]) {
    const b = document.getElementById(id);
    if (b) {
      b.style.background = on ? 'var(--gold)' : 'var(--surface2)';
      b.style.color = on ? '#000' : 'var(--text)';
      b.style.border = on ? 'none' : '2px solid var(--border)';
    }
  }
  const term = (document.getElementById('own-log-search')?.value || '').replace(/\D/g, '');
  let rows = _ownLog;
  if (term) rows = rows.filter(r => String(r.plate || '').includes(term));
  if (_ownLogFilter === 'open') rows = rows.filter(r => !r.approvedBy);
  if (!rows.length) {
    box.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted)">${
      _ownLog.length ? 'אין רשומות שמתאימות לסינון' : 'עדיין לא נרשמו שינויי בעלות'}</div>`;
    return;
  }
  box.innerHTML = rows.map(r => {
    const k = _OWN_LOG_KINDS[r.kind] || { icon: '•', label: r.kind || '', color: 'var(--muted)' };
    // ברכב שירד מהמלאי מציינים במפורש אם הבעלות זזה או לא — זו השאלה
    // הראשונה ששואלים כשרכב נעלם מהרשימה
    const move = (r.from && r.to) ? `עבר מבעלות ${esc(_ownBaalutPhrase(r.from))} לבעלות ${esc(_ownBaalutPhrase(r.to))}`
      : (r.kind === 'gone' && r.from) ? `הבעלות לא השתנתה (${esc(_ownBaalutPhrase(r.from))})`
      : r.to ? `רשום על ${esc(_ownBaalutPhrase(r.to))}`
      : r.from ? `היה רשום על ${esc(_ownBaalutPhrase(r.from))}` : '';
    return `<div style="border:2px solid ${r.approvedBy ? '#16a34a' : 'var(--border)'};border-radius:12px;padding:12px 14px;margin-bottom:8px;background:${r.approvedBy ? '#f0fdf4' : 'var(--card)'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:900;font-size:16px">${k.icon} ${esc(r.plate || '')}
            <span style="font-weight:700;font-size:13px;color:var(--muted)">${esc([r.tozeret, r.degem, r.shnat].filter(Boolean).join(' '))}</span></div>
          <div style="font-size:13px;font-weight:800;color:${k.color};margin-top:3px">${esc(k.label)}${move ? ' · ' + move : ''}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:700;margin-top:3px">🕒 זוהה ב-${esc(_ownLogDate(r.at))}</div>
          ${r.approvedBy ? `<div style="font-size:12px;font-weight:800;color:#16a34a;margin-top:3px">✅ אושר על ידי ${esc(r.approvedBy)} · ${esc(_ownLogDate(r.approvedAt))}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          <button onclick="_ownCopy('${esc(r.plate || '')}','מספר הרכב')" style="background:var(--surface2);border:2px solid var(--border);border-radius:9px;width:36px;height:36px;font-size:15px;cursor:pointer">📋</button>
          ${r.approvedBy
            ? `<button onclick="ownLogApprove('${esc(r.id)}',false)" style="background:var(--surface2);color:var(--muted);border:2px solid var(--border);border-radius:9px;padding:6px 10px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap">בטל אישור</button>`
            : `<button onclick="ownLogApprove('${esc(r.id)}',true)" style="background:#16a34a;color:#fff;border:none;border-radius:9px;padding:8px 12px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap">✅ אשר</button>`}
        </div>
      </div>
    </div>`;
  }).join('');
}
window._renderOwnLog = _renderOwnLog;

// אישור העברת הבעלות — נשמר עם השם של מי שאישר ומתי
async function ownLogApprove(id, on) {
  const r = _ownLog.find(x => x.id === id);
  if (!r) return;
  let by = null;
  if (on) {
    by = prompt('אושר על ידי:', currentUser?.name || '');
    if (by === null) return;
    by = by.trim();
    if (!by) return showToast('נא להזין שם');
  }
  try {
    await _updateDoc(_docRef('ownership_log', id), on
      ? { approvedBy: by, approvedAt: new Date().toISOString() }
      : { approvedBy: null, approvedAt: null });
    showToast(on ? '✅ סומן כמאושר' : 'האישור בוטל');
  } catch (e) { showToast('שמירה נכשלה: ' + (e.code || e.message), 6000); }
}
window.ownLogApprove = ownLogApprove;

function _ownCopy(txt, label) {
  const done = () => showToast('📋 ' + label + ' הועתק');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done).catch(() => _pcCopyFallback(txt, done));
  else _pcCopyFallback(txt, done);
}
window._ownCopy = _ownCopy;

function _ownRender() {
  const hero  = document.getElementById('own-hero');
  const tiles = document.getElementById('own-tiles');
  const list  = document.getElementById('own-list');
  if (!hero || !list) return;
  const e = s => esc(s);
  if (!_ownCars.length) {
    hero.style.background = 'var(--surface2)';
    hero.style.borderColor = 'var(--border)';
    hero.innerHTML = `<div style="text-align:center;color:var(--muted);font-weight:700;font-size:14px;line-height:1.8">עדיין לא נטענה רשימת מלאי<br>לחץ ״בדוק עכשיו״ כדי להצליב את המלאי מול מרשם הרכב</div>`;
    if (tiles) tiles.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  // הסטטוס מגיע רק מההצלבה האוטומטית מול מרשם הרכב (תו סחר)
  const eff = c => c.status || 'unknown';
  const total = _ownCars.length;
  const ours = _ownCars.filter(c => eff(c) === 'ours').length;
  const not  = _ownCars.filter(c => eff(c) === 'not').length;
  const unk  = total - ours - not;

  // כותרת גדולה שעונה במשפט אחד: יש בעיה או שאין
  const ok = not === 0 && unk < total;   // הכל לא במרשם = לא הצלחנו לבדוק
  if (unk === total) {
    hero.style.background = '#fef3c7';
    hero.style.borderColor = '#d97706';
    hero.innerHTML = `<div style="font-size:34px;line-height:1">\u2753</div>
      <div style="font-weight:900;font-size:18px;margin-top:6px;color:#92400e">לא ניתן לבדוק כרגע</div>
      <div style="font-weight:700;font-size:13px;margin-top:4px;color:#92400e">אין גישה למרשם הרכב של משרד התחבורה — אף רכב לא נבדק</div>`;
    if (tiles) tiles.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  hero.style.background = ok ? '#dcfce7' : '#fee2e2';
  hero.style.borderColor = ok ? '#16a34a' : '#dc2626';
  hero.innerHTML = `
    <div style="font-size:34px;line-height:1">${ok ? '\u2705' : '\u26a0\ufe0f'}</div>
    <div style="font-weight:900;font-size:19px;margin-top:6px;color:${ok ? '#166534' : '#991b1b'}">${ok ? 'הכל תקין' : `${not === 1 ? 'רכב אחד לא על תו סחר' : not + ' רכבים לא על תו סחר'}`}</div>
    <div style="font-weight:700;font-size:13px;margin-top:4px;color:${ok ? '#166534' : '#991b1b'}">${ok ? `כל ${total} הרכבים במלאי רשומים על תו סחר` : `מתוך ${total} רכבים במלאי`}</div>
    ${_ownUpdatedAt ? `<div style="font-size:12px;font-weight:700;color:var(--muted);margin-top:8px">נבדק לאחרונה: ${e(_ownUpdatedAt)}</div>` : ''}`;

  // שלוש קוביות = גם סיכום וגם סינון
  const tile = (key, num, label, col) => {
    const on = _ownFilter === key;
    return `<div onclick="ownFilter('${key}')" style="cursor:pointer;border:2px solid ${on ? col : 'var(--border)'};background:${on ? col : 'var(--card)'};color:${on ? '#fff' : 'var(--text)'};border-radius:12px;padding:10px 6px;text-align:center">
      <div style="font-size:22px;font-weight:900">${num}</div>
      <div style="font-size:11px;font-weight:800;margin-top:2px;opacity:.85">${label}</div>
    </div>`;
  };
  if (tiles) {
    tiles.style.display = 'grid';
    tiles.innerHTML = tile('all', total, 'הכל', '#0d9488')
      + tile('not', not, 'לא על תו סחר', '#dc2626')
      + tile('ours', ours, 'על תו סחר', '#16a34a')
      + (unk ? tile('unknown', unk, 'לא במרשם', '#6b7280') : '');
    tiles.style.gridTemplateColumns = `repeat(${unk ? 4 : 3},1fr)`;
  }

  let cars = _ownCars;
  if (_ownFilter !== 'all') cars = cars.filter(c => eff(c) === _ownFilter);
  // הבעייתיים תמיד ראשונים
  const rank = c => eff(c) === 'not' ? 0 : eff(c) === 'unknown' ? 1 : 2;
  cars = cars.slice().sort((a, b) => rank(a) - rank(b) || String(a.plate).localeCompare(String(b.plate)));
  if (!cars.length) { list.innerHTML = `<div style="color:var(--muted);padding:20px;text-align:center;font-weight:700">אין רכבים בקטגוריה הזו</div>`; return; }

  list.innerHTML = cars.map(c => {
    const mk = eff(c);
    const col = mk === 'ours' ? '#16a34a' : mk === 'not' ? '#dc2626' : '#6b7280';
    const label = mk === 'ours' ? 'על תו סחר' : mk === 'not' ? 'לא על תו סחר' : 'לא נמצא במרשם';
    // רכב שאינו על תו סחר וגם ממתין לאיסוף — מציגים מאיזו חברה הוא
    const pk = mk === 'ours' ? null : _ownPickupByPlate[String(c.plate || '').replace(/\D/g, '')];
    const pickupTag = (pk && pk.source)
      ? (_PICKUP_LOGOS[pk.source]
          ? `<span class="own-logo" style="background:${_pickupSourceColor(pk.source)}" title="${e(pk.state)} · ${e(pk.source)}">${_PICKUP_LOGOS[pk.source]}</span>`
          // ספק שאין לו לוגו — מוצג בשמו, כדי שלא תופיע תיבה ריקה
          : `<span class="own-logo" style="background:${_pickupSourceColor(pk.source)};color:#fff;font-size:11px;font-weight:900" title="${e(pk.state)}">${e(pk.source)}</span>`)
      : '';
    return `<div style="border:2px solid var(--border);border-right:6px solid ${col};border-radius:12px;padding:11px 13px;margin-bottom:8px;background:var(--card)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="font-weight:900;font-size:18px;letter-spacing:1px">${e(c.plate)}</div>
            ${pickupTag}
          </div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">${e([c.tozeret,c.degem,c.shnat].filter(Boolean).join(' · '))}</div>
          <div style="display:inline-block;margin-top:6px;background:${col};color:#fff;border-radius:999px;padding:3px 11px;font-size:12px;font-weight:900">${label}${c.baalut ? ' · ' + e(c.baalut) : ''}</div>
          ${c.baalutChangedAt ? `<div style="font-size:12px;font-weight:800;color:#b45309;margin-top:6px">🕒 שינוי בעלות ב-${e(new Date(c.baalutChangedAt).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}))}${c.baalutFrom ? ` · היה ${e(c.baalutFrom)}` : ''}</div>` : ''}
        </div>
        <button onclick="_ownCopy('${e(c.plate)}','מספר הרכב')" title="העתק מספר רכב" style="background:var(--surface2);border:2px solid var(--border);border-radius:9px;width:38px;height:38px;font-size:16px;cursor:pointer;flex-shrink:0">📋</button>
      </div>
    </div>`;
  }).join('');
}


/* ── חיפוש רכב לפי לוחית ─────────────────────────────────────────────
   מסך אחד שעונה על "מה קורה עם הרכב הזה": כל מה שהמערכת יודעת עליו,
   מכל המודולים, לפי מספר הרישוי בלבד.
   ההשוואה נעשית על הספרות בלבד, כי בשדות חופשיים נכתבו לוחיות עם
   מקפים ורווחים. משימות אינן נושאות שדה לוחית — שם מחפשים בכותרת.
─────────────────────────────────────────────────────────────────────── */
const _PS_SOURCES = [
  { col: 'intake_assignments', icon: '🚗', label: 'קליטת רכב',      when: d => d.createdAt, desc: d => `סטטוס: ${d.status === 'pending' ? 'ממתינה' : d.status === 'done' ? 'בוצעה' : d.status || ''}${d.assignedTo ? ' · ' + d.assignedTo : ''}` },
  { col: 'intake_archive',     icon: '🗄️', label: 'קליטה בארכיון',  when: d => d.archivedAt || d.createdAt, desc: d => d.assignedTo || '' },
  { col: 'refreshes',          icon: '✨', label: 'רענון',           when: d => d.createdAt, desc: d => `${d.status === 'pending' ? 'ממתין' : 'בוצע'}${d.assignedTo ? ' · ' + d.assignedTo : ''}` },
  { col: 'tasks',              icon: '📋', label: 'משימה',           when: d => d.createdAt, desc: d => `${d.title || ''} · ${d.label || ''}${d.assignedTo ? ' · ' + d.assignedTo : ''}`, inTitle: true },
  { col: 'pickup_cars',        icon: '🚙', label: 'ממתין לאיסוף',    when: d => d.createdAt, desc: d => [d.city, d.address, d.assignedDriver].filter(Boolean).join(' · ') },
  { col: 'pickup_archive',     icon: '✅', label: 'נאסף',            when: d => d.collectedAt, desc: d => [d.city, d.collectedBy].filter(Boolean).join(' · ') },
  { col: 'bodyshop_jobs',      icon: '🔨', label: 'פחחות',           when: d => d.createdAt, desc: d => `${d.status === 'draft' ? 'ממתין לשליחה' : d.status === 'at_shop' ? 'אצל הפחח' : 'סיימנו'}${d.desc ? ' · ' + d.desc : ''}` },
  { col: 'pit_checks',         icon: '🕳️', label: 'בור / בדיקה',     when: d => d.createdAt, desc: d => [d.checkType, d.vDesc, d.status === 'pending' ? 'ממתין' : 'בוצע'].filter(Boolean).join(' · ') },
  { col: 'test_drives',        icon: '🏎️', label: 'נסיעת מבחן',      when: d => d.createdAt, desc: d => [d.assignedTo, d.status === 'pending' ? 'ממתין' : 'בוצע'].filter(Boolean).join(' · ') },
  { col: 'wash_notes',         icon: '🧽', label: 'שטיפה',           when: d => d.createdAt, desc: d => [d.type, d.createdBy].filter(Boolean).join(' · ') },
  { col: 'battery_installs',   icon: '🔋', label: 'הרכבת מצבר',      when: d => d.createdAt, desc: d => [d.model, d.createdBy].filter(Boolean).join(' · ') },
  { col: 'charging_tasks',     icon: '⚡', label: 'טעינה',           when: d => d.createdAt, desc: d => [d.status === 'active' ? 'בטעינה' : 'הסתיימה', d.assignedTo].filter(Boolean).join(' · ') },
  { col: 'parts',              icon: '🔧', label: 'בקשת חלק',        when: d => d.requestedAt, desc: d => [d.qty ? d.qty + ' יח׳' : '', d.supplier, d.requestedBy].filter(Boolean).join(' · ') },
];

const _psDigits = v => String(v == null ? '' : v).replace(/\D/g, '');
let _psCache = {};           // collection → { at, docs }
let _psBusy = false;

async function openPlateSearch() {
  document.getElementById('ps-user-badge').textContent = currentUser.name;
  showScreen('plate-search');
  document.getElementById('ps-plate').value = '';
  document.getElementById('ps-msg').textContent = '';
  document.getElementById('ps-card').innerHTML = '';
  document.getElementById('ps-results').innerHTML = '';
}
window.openPlateSearch = openPlateSearch;

let _psT = null;
function psSearchSoon() {
  clearTimeout(_psT);
  const p = _psDigits(document.getElementById('ps-plate').value);
  if (p.length < 6) {
    document.getElementById('ps-card').innerHTML = '';
    document.getElementById('ps-results').innerHTML = '';
    document.getElementById('ps-msg').textContent = '';
    return;
  }
  _psT = setTimeout(psSearch, 350);
}
window.psSearchSoon = psSearchSoon;

// קריאה אחת לכל collection, עם מטמון קצר — חיפוש שני של אותו רכב או
// של רכב אחר בתוך דקות לא פונה שוב לשרת
async function _psDocs(col) {
  const c = _psCache[col];
  if (c && Date.now() - c.at < 5 * 60000) return c.docs;
  const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const snap = await getDocs(_colRef(col));
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _psCache[col] = { at: Date.now(), docs };
  return docs;
}

async function psSearch() {
  const plate = _psDigits(document.getElementById('ps-plate').value);
  const msg = document.getElementById('ps-msg');
  if (plate.length < 6) return msg.textContent = 'נא להזין מספר רישוי מלא';
  if (_psBusy) return;
  _psBusy = true;
  msg.textContent = '⏳ מחפש בכל המערכת…';
  document.getElementById('ps-results').innerHTML = '';

  // פרטי הרכב מוצגים מיד, בלי להמתין לסריקה
  _plateLookup(plate).then(v => _psRenderCard(plate, v)).catch(() => _psRenderCard(plate, null));

  const hits = [];
  await Promise.all(_PS_SOURCES.map(async src => {
    let docs = [];
    try { docs = await _psDocs(src.col); } catch (e) { return; }
    for (const d of docs) {
      const match = src.inTitle
        ? _psDigits(d.title).includes(plate)
        : _psDigits(d.plate) === plate;
      if (match) hits.push({ src, d });
    }
  }));

  // הפחחות שומרת רכבים גם בתוך תיקיות ארכיון, כמערך בתוך מסמך אחד
  try {
    for (const a of await _psDocs('bodyshop_archive')) {
      (a.cars || []).forEach((c, idx) => {
        if (_psDigits(c.plate) === plate) {
          hits.push({ src: {
            icon: '🧾', label: 'פחחות · שולם', kind: 'bshop_archive_car',
            when: () => a.paidAt, desc: () => [a.title, c.total ? Number(c.total).toLocaleString('he-IL') + ' ₪' : ''].filter(Boolean).join(' · '),
          }, d: { ...c, _archiveDoc: a, _archiveId: a.id, _archiveIdx: idx } });
        }
      });
    }
  } catch (e) {}

  // ריקול פתוח יושב במסמך אחד עם מערך רכבים
  try {
    const snap = await window._getDoc(_docRef('recall_status', 'current'));
    const cars = snap.exists() ? (snap.data().cars || []) : [];
    const car = cars.find(c => _psDigits(c.plate) === plate);
    if (car) hits.push({ src: { icon: '⚠️', label: 'ריקול פתוח', kind: 'recall', when: () => null, desc: () => car.resolved ? 'טופל — ממתין להסרה' : 'דורש טיפול', warn: true }, d: car });
  } catch (e) {}

  // בדיקת בעלויות — כל רכב שנסרק, כולל אלה שסומנו תקינים, כך שהתשובה
  // ברורה גם כשאין חריגה
  try {
    const snap = await window._getDoc(_docRef('ownership_status', 'current'));
    const cars = snap.exists() ? (snap.data().cars || []) : [];
    const car = cars.find(c => _psDigits(c.plate) === plate);
    if (car) {
      // תקין = רשום על תו סחר. כל בעלות אחרת אומרת שהרכב כבר לא אצלנו.
      const bad = car.status === 'not' || (car.baalut && !car.baalut.includes('סוחר'));
      hits.push({ src: {
        icon: bad ? '📑' : '✅', label: 'בדיקת בעלויות', kind: 'ownership',
        when: () => null,
        desc: () => bad
          ? `אינו רשום על תו סחר${car.baalut ? ' · ' + car.baalut : ''}${car.ownerId ? ' · ' + car.ownerId : ''}`
          : `תקין${car.baalut ? ' · ' + car.baalut : ''}`,
        warn: bad,
      }, d: car });
    }
  } catch (e) {}

  _psRenderResults(hits);
  msg.textContent = hits.length ? `נמצאו ${hits.length} רשומות` : 'לא נמצאה שום רשומה לרכב הזה';
  _psBusy = false;
}
window.psSearch = psSearch;

function _psRenderCard(plate, v) {
  const box = document.getElementById('ps-card');
  if (!box) return;
  const line = v ? [v.maker, v.model, v.subModel, v.color, v.year].filter(Boolean).join(' · ') : 'לא נמצא במשרד התחבורה';
  box.innerHTML = `<div style="border:2px solid var(--border);border-radius:14px;padding:13px 15px;margin-bottom:12px;background:var(--surface2)">
      <div style="font-size:22px;font-weight:900;letter-spacing:1px">${esc(plate)}</div>
      <div style="font-size:13px;color:var(--muted);font-weight:700;margin-top:3px">${esc(line)}</div>
      ${v && _plateTestDate(v) ? `<div style="font-size:13px;font-weight:800;margin-top:4px">🔧 טסט: ${esc(_plateTestDate(v))}</div>` : ''}
    </div>`;
}

const _psWhen = t => {
  const d = t?.toDate ? t.toDate() : (t ? new Date(t) : null);
  return d && !isNaN(d) ? d.toLocaleDateString('he-IL') : '';
};

// המקורות שיש להם טופס/מסך ספציפי שאפשר לפתוח בלחיצה. מה שלא ברשימה
// עדיין ניתן ללחיצה — פשוט עובר למסך הכללי של אותו מודול.
let _psLastHits = [];

function _psRenderResults(hits) {
  const box = document.getElementById('ps-results');
  if (!box) return;
  _psLastHits = hits;
  if (!hits.length) { box.innerHTML = ''; return; }
  // החדש למעלה; רשומה בלי תאריך יורדת לסוף
  const key = h => { const t = h.src.when(h.d); const d = t?.toDate ? t.toDate() : (t ? new Date(t) : null); return d && !isNaN(d) ? d.getTime() : 0; };
  hits.sort((a, b) => key(b) - key(a));
  box.innerHTML = hits.map(({ src, d }, i) => `
    <div onclick="_psOpenRecord(${i})" style="display:flex;align-items:flex-start;gap:10px;border:2px solid ${src.warn ? '#ef4444' : 'var(--border)'};border-radius:12px;padding:11px 13px;margin-bottom:8px;background:${src.warn ? '#fee2e2' : 'var(--card)'};cursor:pointer">
      <div style="font-size:20px;flex-shrink:0">${src.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:900;font-size:14px;${src.warn ? 'color:#991b1b' : ''}">${esc(src.label)}</div>
        <div style="font-size:12.5px;color:${src.warn ? '#991b1b' : 'var(--muted)'};font-weight:700;margin-top:2px">${esc(src.desc(d) || '')}</div>
      </div>
      <div style="font-size:11.5px;color:var(--muted);font-weight:700;white-space:nowrap">${esc(_psWhen(src.when(d)))}</div>
    </div>`).join('');
}

// פותח את הטופס הרלוונטי לרשומה שנלחצה — אם יש כזה; אחרת עובר למסך
// הכללי של אותו מודול, כך שלפחות מגיעים למקום הנכון.
async function _psOpenRecord(i) {
  const hit = _psLastHits[i];
  if (!hit) return;
  const { src, d } = hit;
  const col = d._archiveDoc ? 'bshop_archive_car' : src.kind || src.col;
  try {
    if (col === 'tasks') return openEditTask(d.id);

    // ארבעת אלה נפתחים כחלונית משלהם בלבד — בלי לעבור למסך המלא שמאחוריהן,
    // כך שהחיפוש נשאר ברקע והטופס פשוט קופץ מעליו, בדיוק כמו כל חלונית
    // אחרת במערכת.
    if (col === 'pickup_cars') {
      if (!_pickupAllCars.find(c => c.id === d.id)) _pickupAllCars.push(d);
      return openEditPickupModal(d.id);
    }

    if (col === 'bodyshop_jobs') {
      if (!_bshopJobs.find(j => j.id === d.id)) _bshopJobs.push(d);
      return bshopOpenFill(d.id);
    }

    if (col === 'bshop_archive_car') {
      if (!_bshopArchive.find(a => a.id === d._archiveId)) _bshopArchive.push(d._archiveDoc);
      return bsmOpenArchiveCar(d._archiveId, d._archiveIdx);
    }

    // שאר המודולים — אין טופס ספציפי לרשומה בודדת, עוברים למסך הכללי
    const screenByCol = {
      intake_assignments: 'vehicles', intake_archive: 'vehicles', refreshes: 'vehicles',
      pickup_archive: 'pickup', pit_checks: 'pits', test_drives: 'test-drive',
      wash_notes: 'wash', battery_installs: 'battery-stock', charging_tasks: 'battery',
      parts: 'parts', recall: 'recall', ownership: 'ownership',
    };
    const screen = screenByCol[col];
    if (screen) goToScreen(screen);
  } catch (e) { console.error('_psOpenRecord', e); showToast('לא הצלחנו לפתוח את הרשומה'); }
}
window._psOpenRecord = _psOpenRecord;

/* ── פתק שטיפה ───────────────────────────────────────────────────────
   הנהג בוחר רכב וסוג שטיפה, ומדפיס פתק גדול שנתלה על הרכב. ההדפסה
   נעשית מאותה מסגרת נסתרת של פתק הפחחות, כדי שחלון ההדפסה ייפתח מיד
   ולא ייפתח דף חדש. כל פתק גם נשמר, כדי שיהיה תיעוד מה נשלח לשטיפה.
─────────────────────────────────────────────────────────────────────── */
const _WASH_TYPES = ['חיצוני', 'חיצוני ידני', 'פנימי', 'חיצוני + פנימי'];
let _washType = '';
let _washNotes = [];
let _washUnsub = null;

/* טופס השטיפה חי במקום אחד בלבד. במסך רחב אצל המנהל הוא יושב בעמודה
   האמצעית של מסך הבית, ובכל מצב אחר הוא חוזר למסך השטיפה שלו. כך אין
   שני עותקים של אותם שדות ואין התנגשות מזהים. */
/* בטלפון פרטי הרכב מקופלים כדי שהמסך ייכנס בעמוד אחד. הם נפתחים
   בלחיצה, וגם לבד ברגע שמשיכת הפרטים ממלאת אותם. */
function washToggleVeh() {
  const f = document.getElementById('wash-veh-fields');
  const b = document.getElementById('wash-veh-toggle');
  if (!f) return;
  const open = f.classList.toggle('show');
  if (b) b.textContent = open ? '🚗 פרטי הרכב ▴' : '🚗 פרטי הרכב ▾';
}
window.washToggleVeh = washToggleVeh;

// אחרי משיכת פרטים מוצלחת הפרטים נפתחים מעצמם, כדי שיראו מה נמשך
function _washRevealVeh() {
  const f = document.getElementById('wash-veh-fields');
  if (!f || f.classList.contains('show')) return;
  const any = ['wash-maker','wash-model','wash-submodel','wash-color','wash-year']
    .some(id => (document.getElementById(id)?.value || '').trim());
  if (any) washToggleVeh();
}
window._washRevealVeh = _washRevealVeh;

/* חלונית אחת במסך הבית של המנהל עם שלוש לשוניות. כל טופס חי במסכו
   שלו, והלשונית פשוט מעבירה אותו פיזית לתוך המסגרת ומחזירה אותו
   כשעוזבים — כך אין שכפול של קוד או של מאזינים. */
const _HOME_PANELS = {
  'wash':       { body: 'wash-form-body', home: 'screen-wash',       back: 'wash-screen-slot' },
  'pits':       { body: 'pits-form-body', home: 'screen-pits',       back: 'pits-screen-slot' },
  'test-drive': { body: 'td-form-body',   home: 'screen-test-drive', back: 'td-screen-slot' },
};
let _homePanelTab = 'wash';
let _homePanelShown = null;   // הלשונית שכרגע באמת מוצגת בחלונית

function setHomePanelTab(tab) {
  if (!_HOME_PANELS[tab]) return;
  _homePanelTab = tab;
  _washMount();
}
window.setHomePanelTab = setHomePanelTab;

function _washMount() {
  const slot = document.getElementById('home-wash-slot');
  // מסכי השטיפה/הבורות/נסיעת המבחן נפתחים גם כחלונית שמארחת את המסך
  // עצמו. כשמסך מארוח — הטופס שלו חייב לחזור אליו, אחרת החלונית
  // תיפתח ריקה.
  const onHome = currentUser?.role === 'manager'
    && !!document.querySelector('.home-body.mgr-home');

  let shown = null;
  for (const [tab, p] of Object.entries(_HOME_PANELS)) {
    const body = document.getElementById(p.body);
    if (!body) continue;
    const scr = document.getElementById(p.home);
    const inHost = !!(scr && scr.closest('#screen-host-slot'));
    const toHome = !inHost && onHome && tab === _homePanelTab && !!slot;
    const target = toHome ? slot : document.getElementById(p.back);
    if (target && body.parentElement !== target) target.appendChild(body);
    if (toHome) shown = tab;
  }

  // כפתור הסיכום נחשף למנהל בלבד — גם כשהטופס יושב במסך הבית ולא
  // עברנו דרך openWashScreen
  const sum = document.getElementById('wash-summary-btn');
  if (sum) sum.style.display = currentUser?.role === 'manager' ? '' : 'none';

  const tabs = document.getElementById('home-panel-tabs');
  if (tabs) tabs.querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === _homePanelTab);
  });

  // הטופס שנבחר נטען רק כשהוא באמת מוצג, כדי לא לפתוח מאזינים לחינם
  if (shown === 'wash') { try { _washRenderTypes(); _washSavedListen(); } catch (e) {} }
  // הבורות ונסיעות המבחן פותחים מאזין לשרת, ולכן נטענים רק כשהלשונית
  // באמת מתחלפת — לא בכל שינוי רוחב של החלון
  if (shown !== _homePanelShown) {
    _homePanelShown = shown;
    if (shown === 'pits')       { try { _pitsMountedOnHome(); } catch (e) {} }
    if (shown === 'test-drive') { try { _tdMountedOnHome(); } catch (e) {} }
  }
}
window._washMount = _washMount;

// שינוי רוחב החלון מעביר את הטופס לצד הנכון
let _washMountTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_washMountTimer);
  _washMountTimer = setTimeout(() => { try { _washMount(); } catch (e) {} }, 200);
});

function openWashScreen() {
  document.getElementById('wash-user-badge').textContent = currentUser.name;
  showScreen('wash');
  _washMount();                 // הטופס חוזר למסך שלו
  // הסיכום הוא כלי ניהולי — הנהג מכין ומדפיס פתקים בלבד
  const sumBtn = document.getElementById('wash-summary-btn');
  if (sumBtn) sumBtn.style.display = currentUser.role === 'manager' ? '' : 'none';
  _washBatch = [];            // כניסה למסך מתחילה טופס נקי
  _washRenderBatch();
  _washClear();
  if (!_washUnsub) {
    _washUnsub = _onSnap(_colRef('wash_notes'), snap => {
      _washNotes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      _washRenderList();
      if (document.getElementById('wash-sum-from')?.value) _washRenderSummary();
    }, () => {});
  }
  _washRenderList();
}
window.openWashScreen = openWashScreen;

function _washRenderTypes() {
  const c = document.getElementById('wash-types');
  if (!c) return;
  c.innerHTML = _WASH_TYPES.map(t => {
    const on = t === _washType;
    return `<button onclick="washPickType('${esc(t)}')" style="padding:12px 8px;border-radius:12px;font-family:'Heebo',sans-serif;font-size:15px;font-weight:900;cursor:pointer;${on
      ? 'background:#0d9488;color:#fff;border:2px solid #0d9488'
      : 'background:var(--surface2);color:var(--text);border:2px solid var(--border)'}">${esc(t)}</button>`;
  }).join('');
}

// בחירה אחת בלבד — סוג חדש מחליף את הקודם, ולחיצה חוזרת מבטלת
function washPickType(t) { _washType = (_washType === t ? '' : t); _washRenderTypes(); }
window.washPickType = washPickType;

// חיפוש אוטומטי ברגע שהוקלד מספר רישוי שלם, בלי ללחוץ על הזכוכית
let _washLookupT = null;
function washLookupPlateSoon() {
  clearTimeout(_washLookupT);
  const p = (document.getElementById('wash-plate').value || '').replace(/\D/g, '');
  if (p.length < 7) return;
  _washLookupT = setTimeout(washLookupPlate, 150);
}
window.washLookupPlateSoon = washLookupPlateSoon;

async function washLookupPlate() {
  const plate = (document.getElementById('wash-plate').value || '').replace(/\D/g, '');
  const msg = document.getElementById('wash-lookup-msg');
  if (!plate) return;
  msg.textContent = '⏳ מחפש...'; msg.style.color = 'var(--muted)';
  try {
    const rec = await _plateLookup(plate);
    if (!rec) { msg.textContent = '❌ לא נמצא — אפשר למלא ידנית'; msg.style.color = 'var(--danger,#ef4444)'; return; }
    document.getElementById('wash-maker').value = rec.maker;
    document.getElementById('wash-model').value = rec.model;
    document.getElementById('wash-submodel').value = rec.subModel;
    document.getElementById('wash-color').value = rec.color;
    document.getElementById('wash-year').value = rec.year;
    _washRevealVeh();          // הפרטים נפתחים כדי שיראו מה נמשך
    msg.textContent = '✅ פרטים נטענו'; msg.style.color = 'var(--success,#16a34a)';
  } catch (e) {
    msg.textContent = '⚠️ שגיאה בחיבור — אפשר למלא ידנית'; msg.style.color = 'var(--danger,#ef4444)';
  }
}
window.washLookupPlate = washLookupPlate;

/* ── כמה פתקים בטופס אחד ─────────────────────────────────────────────
   "פתק נוסף" מעביר את הרכב שבטופס לרשימת המתנה ומנקה את הטופס לרכב
   הבא. "שמור והדפס" שומר כל רכב כפתק נפרד — בדיוק כמו פתק בודד, ולכן
   ברשימה ובסיכום כל רכב מופיע בשורה משלו — ומדפיס עד שלושה בעמוד,
   כשהעמוד מחולק שווה בשווה ביניהם.                                    */
let _washBatch = [];

function _washRenderBatch() {
  const box = document.getElementById('wash-batch');
  if (!box) return;
  if (!_washBatch.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
  box.style.display = '';
  box.innerHTML = `<div style="font-size:12.5px;font-weight:900;color:var(--muted);margin-bottom:6px">
      ממתינים בטופס — ${_washBatch.length} ${_washBatch.length === 1 ? 'רכב' : 'רכבים'}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${_washBatch.map((f, i) => `
      <span style="display:inline-flex;align-items:center;gap:6px;background:var(--surface2);border:2px solid var(--border);border-radius:999px;padding:5px 10px;font-size:12.5px;font-weight:800">
        ${esc(f.plate)} · ${esc(f.type)}
        <button onclick="washBatchRemove(${i})" title="הסר" style="background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;line-height:1;cursor:pointer">✕</button>
      </span>`).join('')}</div>`;
}

function washBatchRemove(i) { _washBatch.splice(i, 1); _washRenderBatch(); }
window.washBatchRemove = washBatchRemove;

// מוסיף את הרכב שבטופס לרשימת ההמתנה ומנקה את הטופס לרכב הבא
function washAddAnother() {
  const f = _washForm();
  if (!f) return;
  if (_washBatch.some(x => x.plate === f.plate)) return showToast('הרכב כבר ברשימה');
  _washBatch.push(f);
  _washClear();
  _washRenderBatch();
  showToast(`➕ ${f.plate} נוסף · סה״כ ${_washBatch.length}`);
}
window.washAddAnother = washAddAnother;

/* הדפסת כמה פתקים: עד שלושה בעמוד, והעמוד מחולק שווה בשווה ביניהם.
   פתק בודד ממשיך לעבור במסלול הישן, כדי שההדפסה הרגילה לא תשתנה. */
function washPrintNotes(list, onDone) {
  if (!list.length) return onDone && onDone();
  if (list.length === 1) return washPrintNote(list[0], onDone);
  const PER = 3;
  const pages = [];
  for (let i = 0; i < list.length; i += PER) pages.push(list.slice(i, i + PER));

  const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>פתקי שטיפה (${list.length})</title>
<style>
  /* אותו פתק בדיוק כמו בהדפסה בודדת — אותו נוסח ואותו מבנה. ההבדל
     היחיד הוא שהעמוד מחולק שווה בשווה בין הפתקים שבו, והכתב מוקטן
     בהתאם כדי שהכל ייכנס. */
  @page { size: A4; margin: 8mm; }
  html, body { height:auto; margin:0; }
  body { font-family: Arial, "Segoe UI", sans-serif; color:#222; text-align:center;
         -webkit-print-color-adjust:exact; }
  .page { display:flex; flex-direction:column; height:281mm; gap:5mm;
          page-break-after:always; break-after:page; }
  .page:last-child { page-break-after:auto; break-after:auto; }
  .sheet { flex:1 1 0; min-height:0; display:flex; flex-direction:column;
           border:1px solid #d5d5d5; border-radius:8px; padding:5mm 7mm;
           page-break-inside:avoid; break-inside:avoid; }
  h1 { font-weight:normal; letter-spacing:4px; color:#444; margin:0; }
  .sub { letter-spacing:3px; color:#888; margin:3px 0 0; }
  .rule { border:0; border-top:1px solid #d5d5d5; margin:6px 0 8px; }
  table.info { border-collapse:collapse; width:100%; margin-bottom:8px; }
  table.info td { border-bottom:1px solid #e2e2e2; padding:4px 4px; text-align:right; }
  table.info tr:last-child td { border-bottom:0; }
  table.info td.l { width:32%; color:#888; letter-spacing:1px; }
  table.info td.v { font-weight:bold; color:#111; }
  table.info tr.plate td { border-bottom:2px solid #999; padding:5px 4px 7px; }
  table.info tr.plate td.v { letter-spacing:4px; line-height:1.1; }
  .type-l { letter-spacing:3px; color:#888; margin-bottom:3px; }
  .type { font-weight:bold; color:#111; border:1px solid #bbb;
          border-radius:10px; padding:6px 10px; }
  .note { border:1px solid #ddd; border-radius:10px; padding:5px 10px; margin-top:6px;
          text-align:right; color:#333; line-height:1.4; }
  .note b { color:#888; font-weight:normal; letter-spacing:1px; }
  .stamp { flex:1; min-height:12mm; border:1px solid #ccc; border-radius:10px;
           margin-top:7px; position:relative; }
  .stamp span { position:absolute; top:5px; right:10px; letter-spacing:2px; color:#999; }
  .foot { margin-top:6px; letter-spacing:1px; color:#999;
          border-top:1px solid #e2e2e2; padding-top:5px; }
  /* שני פתקים בעמוד */
  .n2 h1 { font-size:16px; } .n2 .sub { font-size:11px; }
  .n2 table.info td { font-size:13px; } .n2 table.info td.l { font-size:11px; }
  .n2 table.info tr.plate td.v { font-size:33px; }
  .n2 .type-l { font-size:11px; } .n2 .type { font-size:23px; }
  .n2 .note { font-size:12.5px; } .n2 .note b { font-size:11px; }
  .n2 .stamp span,.n2 .foot { font-size:10px; }
  /* שלושה פתקים בעמוד */
  .n3 h1 { font-size:14px; } .n3 .sub { font-size:10px; }
  .n3 table.info td { font-size:11.5px; padding:2.5px 4px; } .n3 table.info td.l { font-size:10px; }
  .n3 table.info tr.plate td.v { font-size:25px; }
  .n3 .type-l { font-size:10px; } .n3 .type { font-size:18px; padding:4px 8px; }
  .n3 .note { font-size:11px; padding:4px 8px; } .n3 .note b { font-size:10px; }
  .n3 .stamp { min-height:9mm; } .n3 .stamp span,.n3 .foot { font-size:9px; }
</style></head><body>
${pages.map(pg => `<div class="page n${pg.length}">${pg.map(_washSheet).join('')}</div>`).join('')}
</body></html>`;
  _printHtml(html, 'wash print batch', 'שגיאה בהדפסה', onDone);
}


/* ── רכבים שמורים לשטיפה ────────────────────────────────────────────
   רכבים שחוזרים על עצמם. הרשימה גלויה לכולם וכל אחד יכול לבחור ממנה
   כדי למלא את הטופס בלחיצה. הוספה ומחיקה — למנהל בלבד.               */
let _washSaved = [], _washSavedUnsub = null;

function _washSavedListen() {
  if (_washSavedUnsub) return;
  _washSavedUnsub = _onSnap(_colRef('wash_vehicles'), snap => {
    _washSaved = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.plate || '').localeCompare(String(b.plate || '')));
    _washRenderSaved();
  }, () => {});
}

function openWashSaved() {
  const mgr = currentUser?.role === 'manager';
  const box = document.getElementById('wash-saved-add');
  if (box) box.style.display = mgr ? '' : 'none';   // הוספה רק למנהל
  const q = document.getElementById('wash-saved-search');
  if (q) q.value = '';
  _washSavedListen();
  _washRenderSaved();
  openModal('modal-wash-saved');
}
window.openWashSaved = openWashSaved;

function _washRenderSaved() {
  const box = document.getElementById('wash-saved-list');
  if (!box) return;
  const mgr = currentUser?.role === 'manager';
  const term = (document.getElementById('wash-saved-search')?.value || '').trim().toLowerCase();
  const rows = _washSaved.filter(v => !term ||
    String(v.plate || '').includes(term.replace(/\D/g, '')) ||
    [v.maker, v.model, v.subModel, v.label].filter(Boolean).join(' ').toLowerCase().includes(term));
  if (!rows.length) {
    box.innerHTML = `<div style="padding:26px;text-align:center;color:var(--muted);font-weight:700">${
      _washSaved.length ? 'לא נמצא רכב' : 'עדיין אין רכבים שמורים'}</div>`;
    return;
  }
  box.innerHTML = rows.map(v => {
    const desc = [v.maker, v.model, v.subModel, v.color, v.year].filter(Boolean).join(' ');
    return `<div style="display:flex;align-items:center;gap:8px;border:2px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:var(--card)">
      <div onclick="washPickSaved('${esc(v.id)}')" style="flex:1;min-width:0;cursor:pointer">
        <div style="font-weight:900;font-size:15px">${esc(v.plate || '')}${v.label ? ` <span style="font-size:12px;font-weight:800;color:var(--muted)">· ${esc(v.label)}</span>` : ''}</div>
        ${desc ? `<div style="font-size:12.5px;font-weight:700;color:var(--muted)">${esc(desc)}</div>` : ''}
      </div>
      <button onclick="washPickSaved('${esc(v.id)}')" style="background:var(--dark);color:#fff;border:none;border-radius:9px;padding:8px 14px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap">בחר</button>
      ${mgr ? `<button onclick="washSavedDelete('${esc(v.id)}')" title="הסר מהרשימה" style="background:#ef4444;color:#fff;border:none;border-radius:9px;width:34px;height:34px;font-size:14px;cursor:pointer">🗑</button>` : ''}
    </div>`;
  }).join('');
}
window._washRenderSaved = _washRenderSaved;

// בחירה מהרשימה ממלאת את הטופס בדיוק כמו מילוי ידני
function washPickSaved(id) {
  const v = _washSaved.find(x => x.id === id);
  if (!v) return;
  const set = (el, val) => { const e = document.getElementById(el); if (e) e.value = val || ''; };
  set('wash-plate', v.plate); set('wash-maker', v.maker); set('wash-model', v.model);
  set('wash-submodel', v.subModel); set('wash-color', v.color); set('wash-year', v.year);
  const msg = document.getElementById('wash-lookup-msg');
  if (msg) { msg.textContent = ''; msg.style.color = 'var(--muted)'; }
  closeModal('modal-wash-saved');
  showToast(`🚗 ${v.plate}`);
}
window.washPickSaved = washPickSaved;

// משיכת הפרטים ממשרד התחבורה כדי לא להקליד ידנית
async function washSavedLookup() {
  const plate = (document.getElementById('ws-plate')?.value || '').replace(/\D/g, '');
  const msg = document.getElementById('ws-msg');
  const btn = document.getElementById('ws-lookup');
  if (!plate) { if (msg) { msg.style.color = '#dc2626'; msg.textContent = 'נא להזין מספר רישוי'; } return; }
  if (btn) btn.disabled = true;
  if (msg) { msg.style.color = 'var(--muted)'; msg.textContent = '⏳ מחפש...'; }
  try {
    const rec = await _plateLookup(plate);
    const set = (el, val) => { const e = document.getElementById(el); if (e) e.value = val || ''; };
    if (rec) {
      set('ws-maker', rec.maker); set('ws-model', rec.model); set('ws-submodel', rec.subModel);
      set('ws-color', rec.color); set('ws-year', rec.year);
      if (msg) { msg.style.color = 'var(--success,#16a34a)'; msg.textContent = `✅ ${rec.maker} ${rec.model}`; }
    } else if (msg) {
      msg.style.color = '#b45309';
      msg.textContent = window._plateRegistryEmpty
        ? 'מאגר משרד התחבורה בעדכון — אפשר למלא ידנית'
        : 'לא נמצא רכב במספר הזה — אפשר למלא ידנית';
    }
  } catch (e) {
    if (msg) { msg.style.color = '#dc2626'; msg.textContent = 'שגיאה בחיפוש — אפשר למלא ידנית'; }
  } finally { if (btn) btn.disabled = false; }
}
window.washSavedLookup = washSavedLookup;

async function washSavedAdd() {
  if (currentUser?.role !== 'manager') return;
  const val = id => (document.getElementById(id)?.value || '').trim();
  const plate = val('ws-plate').replace(/\D/g, '');
  const msg = document.getElementById('ws-msg');
  if (!plate) { if (msg) { msg.style.color = '#dc2626'; msg.textContent = 'נא להזין מספר רישוי'; } return; }
  if (_washSaved.some(v => v.plate === plate)) {
    if (msg) { msg.style.color = '#b45309'; msg.textContent = 'הרכב כבר ברשימה'; }
    return;
  }
  if (!_requireNet('הוספת רכב')) return;
  const btn = document.getElementById('ws-save');
  if (btn) btn.disabled = true;
  try {
    await window._addDoc(_colRef('wash_vehicles'), {
      plate, maker: val('ws-maker'), model: val('ws-model'), subModel: val('ws-submodel'),
      color: val('ws-color'), year: val('ws-year'), label: val('ws-label'),
      addedBy: currentUser.name, createdAt: _serverTs(),
    });
    ['ws-plate','ws-maker','ws-model','ws-submodel','ws-color','ws-year','ws-label']
      .forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    if (msg) { msg.style.color = 'var(--success,#16a34a)'; msg.textContent = '✅ נוסף לרשימה'; }
    showToast('✅ הרכב נוסף לרשימה');
  } catch (e) {
    if (msg) { msg.style.color = '#dc2626'; msg.textContent = 'השמירה נכשלה — נסה שוב'; }
  } finally { if (btn) btn.disabled = false; }
}
window.washSavedAdd = washSavedAdd;

async function washSavedDelete(id) {
  if (currentUser?.role !== 'manager') return;
  const v = _washSaved.find(x => x.id === id);
  if (!v || !confirm(`להסיר את ${v.plate} מהרשימה?`)) return;
  if (!_requireNet('הסרת רכב')) return;
  try {
    const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(_docRef('wash_vehicles', id));
    showToast('🗑 הוסר מהרשימה');
  } catch (e) { showToast('ההסרה נכשלה — נסה שוב'); }
}
window.washSavedDelete = washSavedDelete;

function _washForm() {
  const plate = (document.getElementById('wash-plate').value || '').trim();
  if (!plate) { showToast('נא להזין מספר רישוי'); return null; }
  if (!_washType) { showToast('נא לבחור סוג שטיפה'); return null; }
  const val = id => (document.getElementById(id).value || '').trim();
  const f = {
    plate,
    maker: val('wash-maker'), model: val('wash-model'), subModel: val('wash-submodel'),
    color: val('wash-color'), year: val('wash-year'),
    type: _washType,
    note: val('wash-note'),
  };
  // שורה אחת לתצוגה ברשימה ובפתקים ישנים
  f.desc = [f.maker, f.model, f.subModel, f.color, f.year].filter(Boolean).join(' ');
  return f;
}

// השמירה נעשית לפני ההדפסה, כך שפתק שיצא למדפסת תמיד מתועד
async function _washStore(f) {
  await _addDoc(_colRef('wash_notes'), { ...f, createdBy: currentUser.name, createdAt: _serverTs() });
}

// קודם מוקפץ מסך ההדפסה, ורק כשהוא נסגר הפתק נשמר והטופס מתנקה
function washSaveAndPrint() {
  // הרכב שבטופס מצטרף לאלה שכבר ממתינים. אם הטופס ריק והרשימה מלאה —
  // מדפיסים את מי שברשימה בלבד.
  const plateVal = (document.getElementById('wash-plate')?.value || '').trim();
  let cur = null;
  if (plateVal || _washType) {          // הטופס התחיל להתמלא — חייב להיות שלם
    cur = _washForm();
    if (!cur) return;                   // _washForm כבר אמר מה חסר
  }
  const list = [..._washBatch, ...(cur ? [cur] : [])];
  if (!list.length) { _washForm(); return; }   // אין כלום — מציג "נא להזין מספר רישוי"
  const btn = document.getElementById('wash-print-btn');
  if (btn) btn.disabled = true;
  washPrintNotes(list, async () => {
    let ok = 0;
    for (const f of list) {
      try { await _washStore(f); ok++; } catch (e) { console.error('wash store', e); }
    }
    if (ok === list.length) {
      _washBatch = []; _washRenderBatch(); _washClear();
      showToast(ok === 1 ? '✅ הפתק נשמר' : `✅ ${ok} פתקים נשמרו`);
    } else {
      showToast(`שגיאה בשמירה — נשמרו ${ok} מתוך ${list.length}`, 7000);
    }
    if (btn) btn.disabled = false;
  });
}
window.washSaveAndPrint = washSaveAndPrint;

function _washClear() {
  ['wash-plate','wash-maker','wash-model','wash-submodel','wash-color','wash-year','wash-note']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('wash-lookup-msg').textContent = '';
  _washType = '';
  _washRenderTypes();
}

// הפתק נתלה על הרכב, ולכן הכל גדול: מספר הרישוי ענק וסוג השטיפה מתחתיו
/* גוף הפתק — מקום אחד לנוסח. גם הדפסת פתק בודד וגם הדפסה של כמה
   בעמוד משתמשות בו, ולכן הנוסח זהה תמיד ולא יכול להתפצל. */
function _washSheet(f) {
  // בהדפסה חוזרת מוצג התאריך שבו הפתק נוצר, לא תאריך ההדפסה
  const now = f.createdAt?.toDate ? f.createdAt.toDate() : new Date();
  const when = now.toLocaleDateString('he-IL') + ' · ' + now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const row = (label, v, cls) => v ? `<tr${cls ? ` class="${cls}"` : ''}><td class="l">${label}</td><td class="v">${esc(v)}</td></tr>` : '';
  // מספר הרישוי הוא השורה הראשונה בטבלה. פתקים ישנים נשמרו כשורה אחת
  // בלבד — עדיין צריכים להידפס כמו שצריך.
  const details = row('מספר רישוי', f.plate, 'plate') +
    ([f.maker, f.model, f.subModel, f.color, f.year].some(Boolean)
      ? `${row('יצרן', f.maker)}${row('דגם', f.model)}${row('תת דגם', f.subModel)}${row('צבע', f.color)}${row('שנה', f.year)}`
      : row('רכב', f.desc));
  return ` <div class="sheet">
  <h1>פתק לשטיפה</h1>
  <div class="sub">ענק הרכבים · מאסטר קלין</div>
  <hr class="rule">
  <table class="info">${details}</table>
  <div class="type-l">סוג שטיפה</div>
  <div class="type">${esc(f.type)}</div>
  ${f.note ? `<div class="note"><b>הערה</b><br>${esc(f.note)}</div>` : ''}
  <div class="stamp"><span>חותמת ואישור ביצוע</span></div>
  <div class="foot">${esc(f.createdBy || currentUser.name)} · ${esc(when)}</div>
 </div>`;
}

function washPrintNote(f, onDone) {
  _printHtml(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>פתק שטיפה ${esc(f.plate)}</title>
<style>
  /* עיצוב עדין: קווים דקים ואפורים, וכהות רק במה שחשוב — מספר הרישוי
     וסוג השטיפה. הכל בעמוד אחד: המידות ביחידות עמוד (mm/vh) והתוכן
     כולו בגוש שאסור לפצל, כך שגם הדפסה מהטלפון לא תגלוש לעמוד שני. */
  @page { size: A4; margin: 10mm; }
  html, body { height:auto; }
  body { font-family: Arial, "Segoe UI", sans-serif; color:#222; text-align:center;
         margin:0; -webkit-print-color-adjust:exact; }
  .sheet { page-break-inside:avoid; break-inside:avoid; page-break-after:avoid; }
  h1 { font-size:19px; font-weight:normal; letter-spacing:4px; color:#444; margin:0; }
  .sub { font-size:12px; letter-spacing:3px; color:#888; margin:4px 0 0; }
  .rule { border:0; border-top:1px solid #d5d5d5; margin:9px 0 12px; }
  table.info { border-collapse:collapse; width:100%; margin-bottom:14px; }
  table.info td { border-bottom:1px solid #e2e2e2; padding:7px 4px; text-align:right; font-size:16px; }
  table.info tr:last-child td { border-bottom:0; }
  table.info td.l { width:32%; color:#888; font-size:13px; letter-spacing:1px; }
  table.info td.v { font-weight:bold; color:#111; }
  /* מספר הרישוי — השורה הראשונה, והבולטת ביותר בטבלה */
  table.info tr.plate td { border-bottom:2px solid #999; padding:9px 4px 12px; }
  table.info tr.plate td.v { font-size:46px; letter-spacing:4px; line-height:1.1; }
  .type-l { font-size:12px; letter-spacing:3px; color:#888; margin-bottom:5px; }
  .type { font-size:32px; font-weight:bold; color:#111; border:1px solid #bbb;
          border-radius:10px; padding:11px 10px; }
  .note { font-size:16px; border:1px solid #ddd; border-radius:10px;
          padding:10px 14px; margin-top:12px; text-align:right; color:#333; line-height:1.5; }
  .note b { color:#888; font-weight:normal; font-size:13px; letter-spacing:1px; }
  .stamp { border:1px solid #ccc; border-radius:10px; height:38mm; margin-top:14px;
           position:relative; }
  .stamp span { position:absolute; top:8px; right:14px; font-size:12px;
                letter-spacing:2px; color:#999; }
  .foot { margin-top:12px; font-size:12px; letter-spacing:1px; color:#999;
          border-top:1px solid #e2e2e2; padding-top:8px; }
</style></head><body>
${_washSheet(f)}
</body></html>`, 'wash print', 'שגיאה בהדפסה', onDone);
}

/* ── סיכום שטיפות ───────────────────────────────────────────────────
   כמה שטיפות היו מכל סוג בטווח תאריכים. נהג רואה את שלו, מנהל את הכל.
─────────────────────────────────────────────────────────────────────── */
const _washYmd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// סדר הפירוט המודפס: לפי תאריך הביצוע או לפי מספר הרישוי
let _washSort = 'date';
const _WASH_SORTS = [['date', 'לפי תאריך'], ['plate', 'לפי מספר רישוי']];

function _washRenderSortBtns() {
  const c = document.getElementById('wash-sum-sort');
  if (!c) return;
  c.innerHTML = _WASH_SORTS.map(([k, label]) => {
    const on = _washSort === k;
    return `<button onclick="washSetSort('${k}')" style="flex:1;padding:9px;border-radius:9px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;${on
      ? 'background:#0d9488;color:#fff;border:2px solid #0d9488'
      : 'background:var(--surface2);color:var(--text);border:2px solid var(--border)'}">${label}</button>`;
  }).join('');
}

function washSetSort(k) { _washSort = k; _washRenderSortBtns(); }
window.washSetSort = washSetSort;

function openWashSummary() {
  washSumRange('month');
  _washRenderSortBtns();
  openModal('modal-wash-summary');
}
window.openWashSummary = openWashSummary;

function washSumRange(which) {
  const now = new Date();
  let from, to;
  if (which === 'all') { from = new Date(2020, 0, 1); to = now; }
  else if (which === 'prev') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0);
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = now;
  }
  document.getElementById('wash-sum-from').value = _washYmd(from);
  document.getElementById('wash-sum-to').value = _washYmd(to);
  _washRenderSummary();
}
window.washSumRange = washSumRange;

// מחזיר את השורות והסכומים לפי הטווח שנבחר
function _washSummaryData() {
  const fromV = document.getElementById('wash-sum-from')?.value || '';
  const toV = document.getElementById('wash-sum-to')?.value || '';
  const from = fromV ? new Date(fromV + 'T00:00:00') : null;
  // עד סוף היום שנבחר, כדי ששטיפות מאותו יום ייכללו
  const to = toV ? new Date(toV + 'T23:59:59') : null;
  const mine = currentUser.role === 'manager' ? _washNotes : _washNotes.filter(n => n.createdBy === currentUser.name);
  const rows = mine.filter(n => {
    const d = n.createdAt?.toDate ? n.createdAt.toDate() : null;
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
  const counts = {};
  for (const t of _WASH_TYPES) counts[t] = 0;
  for (const n of rows) {
    const t = n.type || 'ללא סוג';
    counts[t] = (counts[t] || 0) + 1;
  }
  if (_washSort === 'plate') {
    // השוואה ספרה אחרי ספרה, כמו רשימה שמית — לא לפי גודל המספר.
    // לכן 12345678 בא לפני 1243567: הספרה השלישית 3 קטנה מ-4.
    const d = n => String(n || '').replace(/\D/g, '');
    rows.sort((a, b) => d(a.plate) < d(b.plate) ? -1 : d(a.plate) > d(b.plate) ? 1 : 0);
  } else {
    // ישן→חדש, כלומר לפי סדר הביצוע
    rows.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  }
  return { counts, total: rows.length, fromV, toV, rows };
}

function _washRenderSummary() {
  const box = document.getElementById('wash-sum-body');
  if (!box) return;
  const { counts, total } = _washSummaryData();
  box.innerHTML = Object.entries(counts).map(([t, n]) => `
      <div style="display:flex;align-items:center;justify-content:space-between;border:2px solid var(--border);border-radius:11px;padding:10px 13px;margin-bottom:6px;background:var(--card)">
        <span style="font-weight:800;font-size:15px">${esc(t)}</span>
        <span style="font-weight:900;font-size:20px;color:${n ? '#0d9488' : 'var(--muted)'}">${n}</span>
      </div>`).join('') +
    `<div style="display:flex;align-items:center;justify-content:space-between;border-radius:11px;padding:12px 14px;margin:8px 0 12px;background:var(--dark);color:#fff">
       <span style="font-weight:900;font-size:15px">סה״כ שטיפות</span>
       <span style="font-weight:900;font-size:22px">${total}</span>
     </div>`;
}
window._washRenderSummary = _washRenderSummary;

/* פירוט הרכבים בתחתית הסיכום.
   הכלל: קודם ממלאים שורות, ורק כשנגמר המקום לגובה פותחים עמודה נוספת.
   ככל שיש פחות רכבים, השורות גבוהות והכתב גדול יותר — עשרה רכבים
   נראים כמו רשימה מסודרת, לא כמו טבלה זעירה. שלוש עמודות נפתחות רק
   כשבאמת יש הרבה רכבים.
   העמודות נבנות כאן ולא ע"י הדפדפן, כדי שאף שורה לא תיפול מחוץ לדף. */
const _WASH_LAYOUTS = [
  { cols: 1, rows: 24, h: 7.5, font: 11,  sub: 9.5 },
  { cols: 2, rows: 27, h: 6.5, font: 9.5, sub: 8.5 },
  { cols: 3, rows: 30, h: 5.4, font: 7.4, sub: 6.8 },
];
const _WASH_PER_PAGE = 90;   // המבנה הצפוף ביותר — 3 עמודות של 30

function _washLayoutFor(n) {
  for (const l of _WASH_LAYOUTS) if (n <= l.cols * l.rows) return l;
  return _WASH_LAYOUTS[_WASH_LAYOUTS.length - 1];
}

function _washDetailPages(rows) {
  const pages = [];
  for (let i = 0; i < rows.length; i += _WASH_PER_PAGE) {
    const chunk = rows.slice(i, i + _WASH_PER_PAGE);
    const L = _washLayoutFor(chunk.length);
    // חלוקה שווה בין העמודות שנפתחו, מימין לשמאל
    const perCol = Math.ceil(chunk.length / L.cols);
    const line = n => {
      const car = [n.maker, n.model, n.color].filter(Boolean).join(' ') || n.desc || '';
      return `<div class="ln" style="height:${L.h}mm;font-size:${L.font}pt">
        <span class="p">${esc(n.plate || '')}</span><span class="c">${esc(car)}</span><span class="w" style="font-size:${L.sub}pt">${esc(n.type || '')}</span></div>`;
    };
    let cols = '';
    for (let c = 0; c < L.cols; c++) {
      const part = chunk.slice(c * perCol, (c + 1) * perCol);
      if (!part.length) continue;
      cols += `<div class="col">${part.map(line).join('')}</div>`;
    }
    pages.push(`<div class="det">${cols}</div>`);
  }
  return pages;
}

function washPrintSummary() {
  const { counts, total, fromV, toV, rows } = _washSummaryData();
  if (!total) return showToast('אין שטיפות בטווח שנבחר');
  const he = v => v ? new Date(v + 'T00:00:00').toLocaleDateString('he-IL') : '';
  const detail = _washDetailPages(rows);
  _printHtml(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>סיכום שטיפות</title>
<style>
  @page { size: A4; margin: 12mm; }
  html, body { height:auto; }
  body { font-family: Arial, "Segoe UI", sans-serif; color:#222; text-align:center; margin:0; }
  h1 { font-size:20px; font-weight:normal; letter-spacing:4px; color:#444; margin:0; }
  .sub { font-size:12px; letter-spacing:3px; color:#888; margin:4px 0 0; }
  .range { font-size:13px; color:#555; margin-top:7px; }
  hr { border:0; border-top:1px solid #d5d5d5; margin:10px 0 12px; }
  table { border-collapse:collapse; width:100%; }
  td { border-bottom:1px solid #e2e2e2; padding:7px 6px; text-align:right; font-size:15px; }
  td.n { text-align:left; font-weight:bold; font-size:17px; width:22%; }
  tr.tot td { border-top:2px solid #999; border-bottom:0; font-weight:bold; font-size:18px; padding-top:9px; }
  .foot { margin-top:12px; font-size:11px; letter-spacing:1px; color:#999;
          border-top:1px solid #e2e2e2; padding-top:7px; }
  /* פירוט הרכבים — שלוש עמודות, שלושים שורות בכל אחת */
  .det-l { font-size:11px; letter-spacing:3px; color:#888; margin:12px 0 5px;
           border-top:1px solid #e2e2e2; padding-top:9px; }
  /* העמודות והגבהים נקבעים בקוד לפי כמות הרכבים */
  .det { display:flex; gap:5mm; align-items:flex-start; }
  .det .col { flex:1 1 0; min-width:0; }
  .det .ln { display:flex; gap:4px; align-items:center;
             border-bottom:1px solid #eee; overflow:hidden; white-space:nowrap; }
  .det .p { font-weight:bold; color:#111; flex:0 0 auto; }
  .det .c { color:#666; flex:1 1 auto; overflow:hidden; text-overflow:ellipsis; }
  .det .w { color:#0d6a63; flex:0 0 auto; }
  .page { page-break-after:always; }
  .page:last-child { page-break-after:auto; }
</style></head><body>
 <div class="sheet page">
  <h1>סיכום שטיפות</h1>
  <div class="sub">ענק הרכבים · מאסטר קלין</div>
  <div class="range">${esc(he(fromV))} — ${esc(he(toV))}</div>
  <hr>
  <table>
    ${Object.entries(counts).map(([t, n]) => `<tr><td>${esc(t)}</td><td class="n">${n}</td></tr>`).join('')}
    <tr class="tot"><td>סה״כ שטיפות</td><td class="n">${total}</td></tr>
  </table>
  <div class="det-l">פירוט הרכבים · ${_washSort === 'plate' ? 'לפי מספר רישוי' : 'לפי תאריך'}</div>
  ${detail[0] || ''}
  <div class="foot">${esc(currentUser.name)} · ${esc(new Date().toLocaleDateString('he-IL'))}</div>
 </div>
 ${detail.slice(1).map((d, i) => `<div class="sheet page">
   <div class="det-l" style="border-top:0;margin-top:0">פירוט הרכבים · המשך (${i + 2})</div>
   ${d}
 </div>`).join('')}
</body></html>`, 'wash summary print', 'שגיאה בהדפסה');
}
window.washPrintSummary = washPrintSummary;

function _washRenderList() {
  const c = document.getElementById('wash-list');
  if (!c) return;
  // רשימת השטיפות משותפת — נהג ומנהל רואים את כל מה שנשלח לשטיפה
  const rows = _washNotes.slice(0, 30);
  if (!rows.length) {
    c.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted)">עדיין לא נשלחו רכבים לשטיפה</div>`;
    return;
  }
  c.innerHTML = rows.map(n => {
    const d = n.createdAt?.toDate ? n.createdAt.toDate() : null;
    const when = d ? d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
    return `<div style="display:flex;align-items:center;gap:10px;border:2px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:var(--card)">
      <div style="flex:1;min-width:0">
        <div style="font-weight:900;font-size:16px">${esc(n.plate || '')} <span style="font-size:13px;color:#0d9488">· ${esc(n.type || '')}</span></div>
        <div style="font-size:12px;color:var(--muted);font-weight:700">${esc(n.desc || '')}${when ? ' · ' + esc(when) : ''}${n.createdBy ? ' · ' + esc(n.createdBy) : ''}</div>
        ${n.note ? `<div style="font-size:13px;font-weight:800;margin-top:4px">📝 ${esc(n.note)}</div>` : ''}
      </div>
      <button onclick="washReprint('${esc(n.id)}')" title="הדפס שוב" style="background:var(--dark);color:#fff;border:none;border-radius:8px;width:34px;height:34px;font-size:15px;cursor:pointer">🖨️</button>
      <button onclick="washDelete('${esc(n.id)}')" title="מחק" style="background:#ef4444;color:#fff;border:none;border-radius:8px;width:34px;height:34px;font-size:15px;cursor:pointer">🗑</button>
    </div>`;
  }).join('');
}

function washReprint(id) {
  const n = _washNotes.find(x => x.id === id);
  if (n) washPrintNote(n);
}
window.washReprint = washReprint;

async function washDelete(id) {
  const n = _washNotes.find(x => x.id === id);
  if (!n || !confirm(`למחוק את פתק השטיפה של ${n.plate}?`)) return;
  try {
    const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(_docRef('wash_notes', id));
  } catch (e) { showToast('שגיאה במחיקה'); }
}
window.washDelete = washDelete;

function openBsmSendModal() {
  _bsmPicked = [];
  _bsmVladi = [];
  _bsmFocus = null;
  document.getElementById('bsm-plate').value = '';
  document.getElementById('bsm-desc').value = '';
  document.getElementById('bsm-note').value = '';
  document.getElementById('bsm-extra').value = '';
  document.getElementById('bsm-lookup-msg').textContent = '';
  _bsmMaker = '';
  _bsmPhoto = null;
  _bsmThumb = null;
  _bsmVideoFile = null;
  _bsmVideoInfo = null;
  _bsmUpl = null;
  _bsmRenderVideo();
  _bsmRenderPhoto();
  _bsmRenderPicker();
  _bsmVladiSyncForm();
  openModal('modal-bsm-send');
}
window.openBsmSendModal = openBsmSendModal;

/* ── ולאדי ─────────────────────────────────────────────────────────────
   בחירה נפרדת לחלוטין מהחלקים של הפחח: מערך משלה, חלונית משלה ובחירה
   שנשמרת רק אל תוך המשימה של ולאדי. הפתק של איברהים אינו מושפע. */
function _bsmVladiSyncForm() {
  const btn = document.getElementById('bsm-vladi-btn');
  const sum = document.getElementById('bsm-vladi-sum');
  const n = _bsmVladi.length;
  if (btn) {
    btn.textContent = n ? `🧰 ולאדי · ${n} חלקים` : '🧰 ולאדי';
    btn.style.background = n ? '#1d4ed8' : 'var(--bg)';
    btn.style.color = n ? '#fff' : 'var(--text)';
    btn.style.borderColor = n ? '#1d4ed8' : 'var(--border)';
  }
  if (sum) sum.textContent = n
    ? _bshopSortNames(_bsmVladi).join(', ')
    : 'לא נבחרו חלקים — לא תיפתח משימה לולאדי';
}

// הבחירה נשמרת כל עוד הפתק פתוח: יציאה וכניסה חוזרת מציגות אותה כמו שהייתה
function bsmVladiClose() {
  closeModal('modal-bsm-vladi');
  _bsmVladiSyncForm();
}
window.bsmVladiClose = bsmVladiClose;

function bsmVladiOpen() {
  const el = document.getElementById('bsm-vladi-extra');
  if (el) el.value = '';
  _bsmVladiRender();
  openModal('modal-bsm-vladi');
}
window.bsmVladiOpen = bsmVladiOpen;

function bsmVladiClear() {
  _bsmVladi = [];
  _bsmVladiRender();
  _bsmVladiSyncForm();
}
window.bsmVladiClear = bsmVladiClear;

function _bsmVladiRender() {
  const c = document.getElementById('bsm-vladi-pick');
  if (!c) return;
  const all = [..._bshopItems, ..._bsmVladi.filter(p => !_bshopItems.includes(p))];
  const btn = name => {
    const on = _bsmVladi.includes(name);
    return `<button type="button" onclick="bsmVladiToggle(this.dataset.n)" data-n="${esc(name)}"
      style="background:${on ? '#1d4ed8' : 'var(--bg)'};color:${on ? '#fff' : 'var(--text)'};border:2px solid ${on ? '#1d4ed8' : 'var(--border)'};border-radius:999px;padding:7px 13px;font-family:'Heebo',sans-serif;font-size:13px;font-weight:700;cursor:pointer">${esc(name)}</button>`;
  };
  c.innerHTML = all.length
    ? _bshopByGroup(all).map(([g, list]) =>
        _bshopGroupTitle(g, '#1d4ed8') + `<div style="display:flex;flex-wrap:wrap;gap:6px">${list.map(btn).join('')}</div>`
      ).join('')
    : `<div style="padding:14px;text-align:center;color:var(--muted);font-size:13px">רשימת החלקים עדיין נטענת</div>`;
}

function bsmVladiToggle(name) {
  _bsmVladi = _bsmVladi.includes(name) ? _bsmVladi.filter(n => n !== name) : [..._bsmVladi, name];
  _bsmVladiRender();
}
window.bsmVladiToggle = bsmVladiToggle;

function bsmVladiAddExtra() {
  const el = document.getElementById('bsm-vladi-extra');
  const v = (el?.value || '').trim();
  if (!v) return;
  if (!_bsmVladi.includes(v)) _bsmVladi = [..._bsmVladi, v];
  el.value = '';
  _bsmVladiRender();
}
window.bsmVladiAddExtra = bsmVladiAddExtra;

function bsmVladiDone() {
  closeModal('modal-bsm-vladi');
  _bsmVladiSyncForm();
  if (_bsmVladi.length) showToast(`🧰 נשמרו ${_bsmVladi.length} חלקים לולאדי`);
}
window.bsmVladiDone = bsmVladiDone;

function _bsmRenderPicker() {
  const c = document.getElementById('bsm-items-pick');
  if (!c) return;
  const all = [..._bshopItems, ..._bsmPicked.filter(p => !_bshopItems.includes(p))];
  const btn = name => {
    const on = _bsmPicked.includes(name);
    return `<button type="button" onclick="bsmTogglePick(this.dataset.n)" data-n="${esc(name)}"
      style="background:${on ? 'var(--dark)' : 'var(--bg)'};color:${on ? '#fff' : 'var(--text)'};border:2px solid ${on ? 'var(--dark)' : 'var(--border)'};border-radius:999px;padding:7px 13px;font-family:'Heebo',sans-serif;font-size:13px;font-weight:700;cursor:pointer">${esc(name)}</button>`;
  };
  // a colour of its own for the form where a note is written
  c.innerHTML = all.length
    ? _bshopByGroup(all).map(([g, list]) =>
        _bshopGroupTitle(g, '#0f766e') + `<div style="display:flex;flex-wrap:wrap;gap:6px">${list.map(btn).join('')}</div>`
      ).join('')
    : `<div style="padding:14px;text-align:center;color:var(--muted);font-size:13px">רשימת החלקים עדיין נטענת — אם זה נמשך, פתח את "⚙️ רשימת חלקים"</div>`;
}

function bsmTogglePick(name) {
  _bsmPicked = _bsmPicked.includes(name) ? _bsmPicked.filter(n => n !== name) : [..._bsmPicked, name];
  _bsmRenderPicker();
}
window.bsmTogglePick = bsmTogglePick;

function bsmAddExtra() {
  const el = document.getElementById('bsm-extra');
  const v = el.value.trim();
  if (!v) return;
  if (!_bsmPicked.includes(v)) _bsmPicked.push(v);
  el.value = '';
  _bsmRenderPicker();
}
window.bsmAddExtra = bsmAddExtra;

let _bsmMaker = '';   // manufacturer, kept for the brand logo on the card

async function _bsmLookupPlate(manual) {
  const plate = document.getElementById('bsm-plate').value.replace(/\D/g, '');
  const descEl = document.getElementById('bsm-desc');
  const msgEl = document.getElementById('bsm-lookup-msg');
  const say = t => { if (msgEl) msgEl.textContent = t; };
  if (!plate) return say(manual ? 'נא להזין מספר רישוי' : '');
  // pressing the button always refreshes; typing never overwrites what you wrote
  if (!manual && descEl.value.trim()) return;
  say('מחפש במשרד התחבורה…');
  try {
    const rec = await _pcFilterLookup(plate, plate);
    const maker = rec ? _cleanMaker(rec['tozeret_nm'] || '') : '';
    const model = rec ? (rec['kinuy_mishari'] || rec['degem_nm'] || '') : '';
    // a record with no make and no model is not a real match — never report it
    // as found, otherwise a made-up plate looks like a real car
    if (!rec || !(maker || model)) return say(window._plateRegistryEmpty ? 'מאגר משרד התחבורה בעדכון כרגע — אפשר למלא ידנית' : 'לא נמצא רכב במספר הזה — אפשר למלא ידנית');
    _bsmMaker = maker;
    const parts = [maker, model, rec['shnat_yitzur'] || '', rec['tzeva_rechev'] || ''].filter(Boolean);
    descEl.value = parts.join(' ');
    // echo what came back so a wrong plate is obvious at a glance
    say('✅ נמצא: ' + parts.join(' · '));
  } catch (e) {
    console.error('plate lookup failed', e);
    // הסיבה נכתבת על המסך — בלעדיה אי אפשר לדעת אם זו רשת, חסימה או תקלה
    say(manual ? `לא הצלחנו למשוך פרטים (${e.message || e}) — אפשר למלא ידנית` : '');
  }
}
window._bsmLookupPlate = _bsmLookupPlate;

let _bsmPhoto = null;   // one optional photo of the car, shown to the beater
let _bsmThumb = null;   // small copy kept on the job document itself

function _bsmRenderPhoto() {
  const w = document.getElementById('bsm-photo-wrap');
  if (!w) return;
  w.innerHTML = _bsmPhoto
    ? `<div style="position:relative">
         <img src="${_bsmPhoto}" alt="" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px;display:block">
         <button type="button" onclick="bsmClearPhoto()" style="position:absolute;top:8px;left:8px;background:#ef4444;color:#fff;border:none;border-radius:8px;width:30px;height:30px;font-weight:900;cursor:pointer">✕</button>
       </div>`
    : `<button type="button" onclick="document.getElementById('bsm-photo-file').click()" style="width:100%;background:#0ea5e9;color:#fff;border:none;border-radius:10px;padding:10px;font-family:Heebo,sans-serif;font-weight:700;font-size:14px;cursor:pointer">📷 צלם תמונה</button>`;
}

/* The photo is always the front of the car, and the card shows only a strip of
   it. Left alone that strip cuts the middle of the picture and the number plate
   falls outside it. The yellow plate is found in the image and the strip is
   centred on it instead. Nothing is found — the picture behaves as before. */
async function _bsmPlateFocus(dataUrl) {
  try {
    const img = await _loadImg(dataUrl);
    const w = 200, h = Math.max(1, Math.round(img.height * w / img.width));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const xs = [], ys = [];
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      // israeli plates are a strong yellow: red and green high, blue far below
      if (r > 150 && g > 120 && b < 120 && r - b > 70 && g - b > 50) {
        const px = (i / 4) % w, py = Math.floor((i / 4) / w);
        xs.push(px); ys.push(py);
      }
    }
    if (xs.length < w * h * 0.002) return null;   // too little yellow to trust
    const mid = a => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
    return { x: +(mid(xs) / w).toFixed(3), y: +(mid(ys) / h).toFixed(3) };
  } catch (e) { return null; }
}

async function bsmPickPhoto(input) {
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  try {
    _bsmPhoto = await compressToBase64(f, 1000, 0.7);   // full size, own document
    _bsmThumb = await compressToBase64(f, 700, 0.62);   // small, rides on the job
    _bsmFocus = await _bsmPlateFocus(_bsmPhoto);
  } catch (e) { _bsmPhoto = null; _bsmThumb = null; _bsmFocus = null; return showToast('לא הצלחנו לעבד את התמונה'); }
  _bsmRenderPhoto();
}
window.bsmPickPhoto = bsmPickPhoto;

function bsmClearPhoto() { _bsmPhoto = null; _bsmThumb = null; _bsmRenderPhoto(); }

// הוספת תמונה לפתק קיים שנוצר בלי תמונה — אותו עיבוד ואותה שמירה
// כמו ביצירת פתק: מוקטנת על הכרטיס, מלאה במסמך נפרד
let _bsmAddPhotoJob = null;
function bsmAddPhoto(id) {
  _bsmAddPhotoJob = id;
  document.getElementById('bsm-addphoto-file').click();
}
window.bsmAddPhoto = bsmAddPhoto;

async function bsmAddPhotoPicked(input) {
  const f = input.files && input.files[0];
  input.value = '';
  const id = _bsmAddPhotoJob;
  _bsmAddPhotoJob = null;
  if (!f || !id) return;
  showToast('מעבד תמונה…');
  let photo, thumb, focus;
  try {
    photo = await compressToBase64(f, 1000, 0.7);
    thumb = await compressToBase64(f, 700, 0.62);
    focus = await _bsmPlateFocus(photo);
  } catch (e) { return showToast('לא הצלחנו לעבד את התמונה'); }
  try {
    const { setDoc, deleteField } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await setDoc(_docRef('bodyshop_photos', id), { photo });
    await _updateDoc(_docRef('bodyshop_jobs', id), {
      photoThumb: thumb,
      ...(focus ? { photoFocus: focus } : {}),
      photoFailed: deleteField(),
    });
    showToast('✅ התמונה נוספה לפתק');
  } catch (e) { showToast('⚠️ שמירת התמונה נכשלה: ' + (e.code || e.message), 7000); }
}
