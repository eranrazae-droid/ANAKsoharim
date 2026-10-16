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

async function runOwnershipScan(opts) {
  const silent = !!(opts && opts.silent);   // ריענון ברקע: בלי שום הודעה
  if (_ownScanning) return;
  _ownScanning = true;
  const btn = document.getElementById('own-scan-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ בודק…'; }
  try {
    const res = await fetch(_OWN_FN);
    const r = await res.json().catch(() => ({}));
    if (silent) { /* בלי הודעות */ }
    else if (r.ok) showToast(`✅ נטענו ${r.checked} רכבים`, 5000);
    else if (r.reason === 'registry-empty') showToast('מאגר משרד התחבורה מתפרסם מחדש כרגע וחזר ריק. הנתונים שעל המסך הם מהבדיקה האחרונה שהצליחה. יש לנסות שוב מאוחר יותר.', 11000);
    else if (r.reason === 'registry-unreachable') showToast('אין כרגע גישה למאגר משרד התחבורה — הבדיקה לא בוצעה. הנתונים שעל המסך הם מהבדיקה האחרונה שהצליחה.', 11000);
    else showToast('⚠️ הטעינה נכשלה: ' + (r.reason || r.error || res.status), 7000);
  } catch (e) { if (!silent) showToast('⚠️ שגיאת חיבור לשרת: ' + e.message, 7000); }
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
  { col: 'intake_assignments', icon: '🚗', label: 'קליטת רכב',      when: d => d.createdAt, desc: d => `סטטוס: ${d.status === 'pending' ? 'ממתינה' : d.status === 'done' ? 'בוצעה' : d.status === 'not_in_yard' ? 'הרכב לא במגרש' : d.status || ''}${d.assignedTo ? ' · ' + d.assignedTo : ''}` },
  { col: 'intake_archive',     icon: '🗄️', label: 'קליטה בארכיון',  when: d => d.archivedAt || d.createdAt, desc: d => d.assignedTo || '' },
  { col: 'refreshes',          icon: '✨', label: 'רענון',           when: d => d.createdAt, desc: d => `${d.status === 'pending' ? 'ממתין' : d.status === 'not_in_yard' ? 'הרכב לא במגרש' : 'בוצע'}${d.assignedTo ? ' · ' + d.assignedTo : ''}` },
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

/* המחירון של מאסטר קלין, כפי שהוא מופיע בחשבונית. הסכום נשמר בתוך רשומת
   התשלום עצמה, ולכן עדכון מחיר כאן לא משנה תשלומים שכבר בוצעו.
   סוג שטיפה שאין לו מחיר כאן מסומן בהערה במקום להיחשב אפס בשקט. */
// אין מחירון במערכת: המחירים של השטיפה נלקחים מהחשבונית בלבד (בדיקת חשבונית לפני תשלום)
const _WASH_PRICES = {};
const _washHasPrices = () => Object.keys(_WASH_PRICES).length > 0;
const _WASH_VAT = 0.18;
const _washMoney = n => Math.round(n).toLocaleString('he-IL') + ' ₪';
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
  // בטלפון הפרטים מופיעים בשורת סיכום אחת, ולא נפתחים מעצמם
  if (document.getElementById('screen-wash')?.classList.contains('washm-on')) return;
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
  try { _mgrHomeFit(); } catch (e) {}
}
window.setHomePanelTab = setHomePanelTab;

/* שורת הפעולות של טופס השטיפה: הנהג רואה "רכבים שמורים" בלבד,
   המנהל רואה גם סיכום וגם ארכיון תשלומים — ואז השורה היא שלושה
   כפתורים ברוחב שווה. */
function _washActionsMode() {
  const mgr = currentUser?.role === 'manager';
  const row = document.getElementById('wash-actions');
  if (row) row.classList.toggle('mgr', mgr);
  for (const id of ['wash-summary-btn', 'wash-archive-btn']) {
    const el = document.getElementById(id);
    if (el) el.style.display = mgr ? '' : 'none';
  }
}
window._washActionsMode = _washActionsMode;

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

  // כפתורי הניהול נחשפים למנהל בלבד — גם כשהטופס יושב במסך הבית
  // ולא עברנו דרך openWashScreen
  _washActionsMode();

  const tabs = document.getElementById('home-panel-tabs');
  if (tabs) tabs.querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === _homePanelTab);
  });

  // הטופס שנבחר נטען רק כשהוא באמת מוצג, כדי לא לפתוח מאזינים לחינם
  if (shown === 'wash') { try { _washRenderTypes(); _washSavedListen(); _washNotesListen(); } catch (e) {} }
  // הבורות ונסיעות המבחן פותחים מאזין לשרת, ולכן נטענים רק כשהלשונית
  // באמת מתחלפת — לא בכל שינוי רוחב של החלון
  if (shown !== _homePanelShown) {
    _homePanelShown = shown;
    if (shown === 'pits')       { try { _pitsMountedOnHome(); } catch (e) {} }
    if (shown === 'test-drive') { try { _tdMountedOnHome(); } catch (e) {} }
  }
}
window._washMount = _washMount;

/* המספרים שהיו ליד "בורות" ו"נסיעות מבחן" ברשימת כל המסכים עברו
   ללשוניות, כדי שלא יאבד הסימון שיש משהו שממתין. */
function _homePanelBadges() {
  const tabs = document.getElementById('home-panel-tabs');
  if (!tabs) return;
  tabs.querySelectorAll('.tb').forEach(sp => {
    const src = document.getElementById(sp.dataset.badge);
    const n = src && src.style.display !== 'none' ? (src.textContent || '').trim() : '';
    sp.textContent = n;
    sp.style.display = (n && n !== '0') ? 'inline-block' : 'none';
  });
}
window._homePanelBadges = _homePanelBadges;


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
  // הסיכום והארכיון הם כלים ניהוליים — הנהג מכין ומדפיס פתקים בלבד
  _washActionsMode();
  _washBatch = [];            // כניסה למסך מתחילה טופס נקי
  _washRenderBatch();
  _washClear();
  // רשימת הרכבים השמורים משתתפת בהיתר, ולכן חייבת להיטען בכל דרך
  // שבה מגיעים לטופס — גם אצל הנהג, שאינו עובר דרך מסך הבית
  _washSavedListen();
  _washNotesListen();
  _washRenderList();
  try { _washmSetup(); } catch (e) { console.error('washm', e); }
}
window.openWashScreen = openWashScreen;

/* היסטוריית הפתקים נטענת גם כשהטופס יושב בחלונית שבמסך הבית, ולא רק
   כשנכנסים למסך השטיפה — אחרת הסיכום יוצא ריק. */
function _washNotesListen() {
  if (_washUnsub || !window._onSnap) return;
  _washUnsub = _onSnap(_colRef('wash_notes'), snap => {
    _washNotes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    _washRenderList();
    if (document.getElementById('modal-wash-summary')?.classList.contains('open')) _washRenderSummary();
  }, () => {});
}
window._washNotesListen = _washNotesListen;

function _washRenderTypes() {
  const c = document.getElementById('wash-types');
  if (!c) return;
  c.innerHTML = _WASH_TYPES.map((t, ti) => {
    const on = t === _washType;
    return `<button class="wt${on ? ' on' : ''}" data-t="${ti}" onclick="washPickType('${esc(t)}')" style="padding:12px 8px;border-radius:12px;font-family:'Heebo',sans-serif;font-size:15px;font-weight:900;cursor:pointer;${on
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
  _washPlateFeedback();
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
  try { _washmSync(); } catch (e) {}
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
async function washAddAnother() {
  const f = _washForm();
  if (!f) return;
  if (_washBatch.some(x => x.plate === f.plate)) return showToast('הרכב כבר ברשימה');
  if (!await _washAllowPlate(f.plate)) return;
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
<title>פתקי שטיפה</title>
<style>
  /* אותו פתק בדיוק כמו בהדפסה בודדת — אותו מבנה ואותו צבע, רק
     הגדלים קטנים יותר כדי שכמה ייכנסו בעמוד. margin:0 מבטל את
     הכותרת והכתובת שהדפדפן מדפיס מעצמו. */
  @page { size: A4; margin: 0; }
  html, body { height:auto; margin:0; }
  body { font-family:"Segoe UI", Arial, sans-serif; color:#1a1a2e;
         -webkit-print-color-adjust:exact; print-color-adjust:exact; padding:7mm; }
  .page { display:flex; flex-direction:column; height:283mm; gap:6mm;
          page-break-after:always; break-after:page; }
  .page:last-child { page-break-after:auto; break-after:auto; }
  .sheet { flex:1 1 0; min-height:0; display:flex; flex-direction:column;
           border:1px solid #dde1e8; border-radius:10px; overflow:hidden;
           page-break-inside:avoid; break-inside:avoid; }
  .bd { flex:1; display:flex; flex-direction:column; }
${_WASH_CSS}
  /* משבצת החותמת סופגת את מה שנשאר ומתכווצת כשיש הערה ארוכה —
     כך שורת התחתית תמיד נשארת בתוך המסגרת */
  .stamp { flex:1 1 0; min-height:0; }
  /* שני פתקים בעמוד */
  .n2 .hd { padding:5mm 7mm 4.5mm; }
  .n2 .hd .ttl { font-size:14px; letter-spacing:5px; margin-bottom:7px; }
  .n2 .hd .side u { font-size:8px; letter-spacing:2.5px; margin-bottom:3px; }
  .n2 .hd .side b { font-size:13.5px; }
  .n2 .hd .side i { font-size:9.5px; margin-top:2px; }
  .n2 .bd { padding:5mm 7mm 5mm; }
  .n2 .pl { font-size:9.5px; letter-spacing:3px; }
  .n2 .plate { font-size:37px; letter-spacing:1px; margin-top:3px; }
  .n2 .spec { gap:4px 14px; margin-top:4.5mm; }
  .n2 .spec div { font-size:12px; padding-bottom:4px; }
  .n2 .spec span { font-size:9px; }
  .n2 .type { padding:9px 8px; margin-top:4mm; border-radius:10px; }
  .n2 .type span { font-size:9px; letter-spacing:3px; margin-bottom:4px; }
  .n2 .type b { font-size:23px; }
  .n2 .note { font-size:11.5px; padding:6px 10px; margin-top:3mm; border-radius:10px; }
  .n2 .note i { font-size:9px; letter-spacing:1.5px; margin-bottom:2px; }
  .n2 .stamp { min-height:13mm; margin-top:4mm; border-radius:10px; }
  .n2 .stamp i { top:6px; right:11px; font-size:9px; letter-spacing:1.5px; }
  .n2 .foot { margin-top:3.5mm; padding-top:6px; font-size:9px; }
  /* שלושה פתקים בעמוד */
  .n3 .hd { padding:3mm 5mm 2.5mm; }
  .n3 .hd .ttl { font-size:11px; letter-spacing:4px; margin-bottom:4px; }
  .n3 .hd .side u { font-size:7px; letter-spacing:2px; margin-bottom:2px; }
  .n3 .hd .side b { font-size:11.5px; }
  .n3 .hd .side i { font-size:8.5px; margin-top:1px; }
  .n3 .bd { padding:3.5mm 5mm 3.5mm; }
  .n3 .pl { font-size:8px; letter-spacing:2.5px; }
  .n3 .plate { font-size:25px; letter-spacing:1px; margin-top:1px; }
  .n3 .spec { gap:1px 11px; margin-top:2.5mm; }
  .n3 .spec div { font-size:9.5px; padding-bottom:2px; }
  .n3 .spec span { font-size:8px; }
  .n3 .type { padding:5px 6px; margin-top:2mm; border-radius:9px; }
  .n3 .type span { font-size:8px; letter-spacing:2.5px; margin-bottom:3px; }
  .n3 .type b { font-size:15.5px; }
  .n3 .note { font-size:9px; padding:3px 8px; margin-top:1.5mm; border-radius:9px; }
  .n3 .note i { font-size:8px; letter-spacing:1px; margin-bottom:1px; }
  .n3 .stamp { min-height:7mm; margin-top:2mm; border-radius:9px; }
  .n3 .stamp i { top:4px; right:9px; font-size:8px; letter-spacing:1px; }
  .n3 .foot { margin-top:2mm; padding-top:4px; font-size:8px; }
</style></head><body>
${pages.map(pg => `<div class="page n${pg.length}">${pg.map(_washSheet).join('')}</div>`).join('')}
</body></html>`;
  _printHtml(html, 'wash print batch', 'שגיאה בהדפסה', onDone);
}


/* ── רכבים שמורים לשטיפה ────────────────────────────────────────────
   רכבים שחוזרים על עצמם. הרשימה גלויה לכולם וכל אחד יכול לבחור ממנה
   כדי למלא את הטופס בלחיצה. הוספה ומחיקה — למנהל בלבד.               */
let _washSaved = [], _washSavedUnsub = null;

/* ── מי מותר לשטיפה ───────────────────────────────────────────────
   פתק יוצא רק לרכב שנמצא במלאי. הפעם הבדיקה היא שאילתה חיה ל-CRM
   ברגע ההדפסה — לא צילום מצב יומי. הניסיון הקודם נשען על תמונת
   מצב של סריקת הבעלויות, וחסם רכב שנכנס למלאי אחרי הסריקה האחרונה.

   שלוש דרגות:
   • במלאי, או ברשימת הרכבים השמורים — עובר.
   • אינו במלאי, והמשתמש נהג — נחסם.
   • אינו במלאי, והמשתמש המנהל — נחסם עד שהוא מאשר במפורש.
   • ה-CRM לא ענה — עובר. חסימה מתוך חוסר מידע עוצרת את העבודה
     בדיוק כשאי אפשר לברר, וזו הייתה הטעות בפעם הקודמת. */
const _WASH_CRM_URL = 'https://europe-west1-anak-soharim.cloudfunctions.net/crmVehicle';
const _washStockCache = new Map();   // רישוי → true/false, לאורך הביקור הנוכחי

async function _washInStock(plate) {
  const p = _psDigits(plate);
  if (p.length !== 7 && p.length !== 8) return null;      // null = לא ידוע
  if (_washStockCache.has(p)) return _washStockCache.get(p);
  try {
    const res = await fetch(`${_WASH_CRM_URL}?plate=${p}`);
    const d = await res.json();
    if (!d || d.ok !== true) return null;                 // ה-CRM לא ענה כשורה
    _washStockCache.set(p, !!d.found);
    return !!d.found;
  } catch (e) { return null; }
}

const _washIsSaved = plate => {
  const p = _psDigits(plate);
  return _washSaved.some(v => _psDigits(v.plate) === p);
};

/* מחזירה true אם מותר להמשיך. חוסמת, או שואלת את המנהל, לפי התפקיד. */
async function _washAllowPlate(plate) {
  if (_washIsSaved(plate)) return true;
  const inStock = await _washInStock(plate);
  if (inStock !== false) return true;                     // במלאי, או שלא ידוע
  if (currentUser?.role !== 'manager') {
    showToast(`🚫 ${plate} אינו במלאי — פנה למנהל`, 7000);
    return false;
  }
  return confirm(`${plate} אינו נמצא במלאי.\n\nלהדפיס לו פתק בכל זאת?`);
}

// חיווי ליד שדה הרישוי, כדי שלא יגלו את החסימה רק בלחיצה על הדפסה
async function _washPlateFeedback() {
  const el = document.getElementById('wash-plate');
  const msg = document.getElementById('wash-stock-msg');
  if (!el || !msg) return;
  const p = _psDigits(el.value);
  if (p.length < 7) { msg.textContent = ''; return; }
  if (_washIsSaved(p)) { msg.textContent = '🚗 רכב שמור'; msg.style.color = 'var(--muted)'; return; }
  const inStock = await _washInStock(p);
  if (_psDigits(el.value) !== p) return;                  // הוקלד משהו אחר בינתיים
  if (inStock === false) {
    msg.textContent = currentUser?.role === 'manager'
      ? `⚠️ ${p} אינו במלאי — תתבקש לאשר`
      : `🚫 ${p} אינו במלאי — פנה למנהל`;
    msg.style.color = '#dc2626';
  } else { msg.textContent = ''; }
}
window._washPlateFeedback = _washPlateFeedback;

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
  const box2 = document.getElementById('washm-saved-list');   // הלשונית בטלפון
  if (!box && !box2) return;
  const mgr = currentUser?.role === 'manager';
  const term = (document.getElementById('wash-saved-search')?.value || document.getElementById('washm-saved-search')?.value || '').trim().toLowerCase();
  const put = html => { if (box) box.innerHTML = html; if (box2) box2.innerHTML = html; };
  const rows = _washSaved.filter(v => !term ||
    String(v.plate || '').includes(term.replace(/\D/g, '')) ||
    [v.maker, v.model, v.subModel, v.label].filter(Boolean).join(' ').toLowerCase().includes(term));
  if (!rows.length) {
    put(`<div style="padding:26px;text-align:center;color:var(--muted);font-weight:700">${
      _washSaved.length ? 'לא נמצא רכב' : 'עדיין אין רכבים שמורים'}</div>`);
    return;
  }
  put(rows.map(v => {
    const desc = [v.maker, v.model, v.subModel, v.color, v.year].filter(Boolean).join(' ');
    return `<div style="display:flex;align-items:center;gap:8px;border:2px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:var(--card)">
      <div onclick="washPickSaved('${esc(v.id)}')" style="flex:1;min-width:0;cursor:pointer">
        <div style="font-weight:900;font-size:15px">${esc(v.plate || '')}${v.label ? ` <span style="font-size:12px;font-weight:800;color:var(--muted)">· ${esc(v.label)}</span>` : ''}</div>
        ${desc ? `<div style="font-size:12.5px;font-weight:700;color:var(--muted)">${esc(desc)}</div>` : ''}
      </div>
      <button onclick="washPickSaved('${esc(v.id)}')" style="background:var(--dark);color:#fff;border:none;border-radius:9px;padding:8px 14px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap">בחר</button>
      ${mgr ? `<button onclick="washSavedDelete('${esc(v.id)}')" title="הסר מהרשימה" style="background:#ef4444;color:#fff;border:none;border-radius:9px;width:34px;height:34px;font-size:14px;cursor:pointer">🗑</button>` : ''}
    </div>`;
  }).join(''));
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
  _washPlateFeedback();
  closeModal('modal-wash-saved');
  try { washmTab('new'); } catch (e) {}
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
async function washSaveAndPrint() {
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
  // רכב שנוסף לרשימה כבר נבדק; כאן נבדק מי שעדיין בטופס
  if (cur && !await _washAllowPlate(cur.plate)) return;
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

/* ── פתק שטיפה מתוך מסך הקליטות ──────────────────────────────────
   הרכב כבר ידוע מהקליטה, ולכן חסר רק סוג השטיפה. החלונית שואלת אותו
   ומדפיסה — ומשתמשת באותו נוסח ובאותה שמירה כמו הטופס הרגיל, כדי
   שהפתק ייראה זהה ויופיע גם בסיכום ובהיסטוריה. */
let _washQuick = null;
let _washQuickIntake = '';

function openWashForVehicle(plate, maker, model, year, color, intakeId) {
  _washSavedListen();
  _washQuick = { plate: String(plate || ''), maker: maker || '', model: model || '',
                 year: year || '', color: color || '', type: '' };
  _washQuickIntake = intakeId || '';   // הקליטה שממנה יצא הפתק, אם יש
  const head = document.getElementById('wash-quick-veh');
  if (head) head.textContent = [_washQuick.plate, [maker, model, year, color].filter(Boolean).join(' · ')]
    .filter(Boolean).join(' — ');
  _washQuickRenderTypes();
  openModal('modal-wash-quick');
}
window.openWashForVehicle = openWashForVehicle;

function _washQuickRenderTypes() {
  const c = document.getElementById('wash-quick-types');
  if (!c) return;
  c.innerHTML = _WASH_TYPES.map(t => {
    const on = _washQuick && t === _washQuick.type;
    return `<button type="button" onclick="washQuickPick('${esc(t)}')" style="padding:12px 8px;border-radius:12px;font-family:'Heebo',sans-serif;font-size:15px;font-weight:900;cursor:pointer;${on
      ? 'background:#0d9488;color:#fff;border:2px solid #0d9488'
      : 'background:var(--surface2);color:var(--text);border:2px solid var(--border)'}">${esc(t)}</button>`;
  }).join('');
}

function washQuickPick(t) {
  if (!_washQuick) return;
  _washQuick.type = (_washQuick.type === t ? '' : t);
  _washQuickRenderTypes();
}
window.washQuickPick = washQuickPick;

async function washQuickPrint() {
  if (!_washQuick) return;
  if (!_washQuick.type) return showToast('נא לבחור סוג שטיפה', 4000);
  /* פתק שיוצא מקליטה אינו נבדק מול המלאי. קליטה היא ההוכחה הטובה
     ביותר שהרכב נמצא בשטח — טובה יותר מרשימת המלאי, שמתעדכנת
     באיחור ולכן חסמה רכב שהתקבל היום. */
  if (!_washQuickIntake && !await _washAllowPlate(_washQuick.plate)) return;
  const note = (document.getElementById('wash-quick-note')?.value || '').trim();
  const f = { ..._washQuick, subModel: '', note };
  // אותה שורת תיאור כמו בטופס הרגיל, כדי שהפתק ייראה זהה ברשימות
  f.desc = [f.maker, f.model, f.subModel, f.color, f.year].filter(Boolean).join(' ');
  const btn = document.getElementById('wash-quick-print');
  if (btn) btn.disabled = true;
  const intakeId = _washQuickIntake;
  const type = f.type;
  washPrintNote(f, async () => {
    try { await _washStore(f); showToast('✅ הפתק נשמר'); }
    catch (e) { console.error('wash store', e); showToast('ההדפסה בוצעה, אבל השמירה נכשלה', 6000); }
    /* מסמנים על הקליטה שהוצא פתק. הנהג רואה את זה מיד — גם בכרטיס
       ברשימה וגם בתוך הטופס הפתוח, דרך המאזין החי שכבר קיים. */
    if (intakeId) {
      try {
        await window._updateDoc(_docRef('intake_assignments', intakeId), {
          washRequest: { type, at: new Date().toISOString(), by: currentUser?.name || '' }
        });
      } catch (e) { console.error('wash request flag', e); }
      /* ג — התראה שתקפוץ לנהג בכניסה הבאה לאפליקציה, למקרה שהוא
         בכלל לא פתוח עכשיו. אותו מנגנון שכבר משמש שאר ההתראות. */
      try {
        // נקרא מהמסמך עצמו ולא ממטמון, כדי שזה יעבוד גם כשהרשימה לא נטענה
        const snap = await window._getDoc(_docRef('intake_assignments', intakeId));
        const drv = snap.exists() ? snap.data().assignedTo : '';
        if (drv) await _addDoc(_colRef('driver_notifications'), {
          to: drv, seen: false, createdAt: _serverTs(),
          message: `🧽 נדרש שטיפה — ${f.plate} · ${type}`
        });
      } catch (e) { console.error('wash driver notify', e); }
    }
    if (btn) btn.disabled = false;
    closeModal('modal-wash-quick');
  });
}
window.washQuickPrint = washQuickPrint;

function _washClear() {
  ['wash-plate','wash-maker','wash-model','wash-submodel','wash-color','wash-year','wash-note']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('wash-lookup-msg').textContent = '';
  _washPlateFeedback();
  _washType = '';
  _washRenderTypes();
}

/* ── עיצוב הפתק ─────────────────────────────────────────────────────
   מבנה וצבע במקום אחד, וכל מצב הדפסה קובע רק גדלים. כך פתק בודד
   ופתק בהדפסה מרובה נראים אותו דבר ולא יכולים להתפצל.            */
const _WASH_GREEN = '#0f766e';
const _WASH_CSS = `
  .hd { background:${_WASH_GREEN}; color:#fff; }
  .hd .ttl { text-align:center; font-weight:800; }
  .hd .pair { display:flex; align-items:stretch; }
  .hd .side { flex:1; text-align:center; }
  .hd .side u { display:block; color:#9ed6cf; text-decoration:none; font-weight:700; }
  .hd .side b { display:block; font-weight:800; line-height:1.3; }
  .hd .side i { display:block; color:#bce5e0; font-style:normal; }
  .hd .sep { width:1px; background:rgba(255,255,255,.3); }
  .bd { text-align:center; }
  .pl { color:#9aa2b1; font-weight:800; }
  .plate { font-family:Arial, sans-serif; font-weight:800; color:#111; line-height:1.05; }
  .spec { display:grid; grid-template-columns:1fr 1fr; text-align:right; }
  .spec div { border-bottom:1px solid #eceef2; }
  .spec div.wide { grid-column:1 / -1; }
  .spec span { display:block; color:#8a93a3; letter-spacing:.5px; }
  .spec b { font-weight:800; color:#1a1a2e; }
  .type { background:#f0fdfa; border:2px solid ${_WASH_GREEN}; }
  .type span { display:block; color:${_WASH_GREEN}; font-weight:800; }
  .type b { color:${_WASH_GREEN}; font-weight:800; }
  .note { border:1px solid #dde1e8; text-align:right; color:#3b4250; line-height:1.5; }
  .note i { display:block; color:#9aa2b1; font-style:normal; }
  .stamp { border:1.5px solid #dde1e8; position:relative; }
  .stamp i { position:absolute; color:#b6bdc9; font-style:normal; }
  .foot { border-top:1px solid #eceef2; color:#9aa2b1;
          display:flex; justify-content:space-between; }
`;

/* מקפים במספר הרישוי: 8 ספרות → 3-2-3, 7 ספרות → 2-3-2.
   אורך אחר (רכבים ישנים, טרקטורים) נשאר כמו שהוא — עדיף מאשר
   לחתוך אותו במקום הלא נכון. */
function _washPlateFmt(plate) {
  const d = String(plate || '').replace(/\D/g, '');
  if (d.length === 8) return `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`;
  if (d.length === 7) return `${d.slice(0,2)}-${d.slice(2,5)}-${d.slice(5)}`;
  return String(plate || '');
}

// מי מבצע את השטיפה — מקום אחד לשם ולכתובת
const _WASH_VENDOR = { name: 'מאסטר קלין', addr: 'רוזנסקי 2, ראשון לציון' };

/* גוף הפתק — מקום אחד לנוסח. גם הדפסת פתק בודד וגם הדפסה של כמה
   בעמוד משתמשות בו, ולכן הנוסח זהה תמיד ולא יכול להתפצל. */
function _washSheet(f) {
  // בהדפסה חוזרת מוצג התאריך שבו הפתק נוצר, לא תאריך ההדפסה
  const now = f.createdAt?.toDate ? f.createdAt.toDate() : new Date();
  const when = now.toLocaleDateString('he-IL') + ' · ' + now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const cell = (label, v) => v ? `<div><span>${label}</span><b>${esc(v)}</b></div>` : '';
  // פתקים ישנים נשמרו עם שורת תיאור אחת בלבד — עדיין צריכים להידפס כמו שצריך
  const makerModel = [f.maker, f.model].filter(Boolean).join(' ');
  const spec = [f.maker, f.model, f.subModel, f.color, f.year].some(Boolean)
    ? cell('יצרן ודגם', makerModel) + cell('תת דגם', f.subModel) + cell('צבע', f.color) + cell('שנה', f.year)
    : (f.desc ? `<div class="wide"><span>רכב</span><b>${esc(f.desc)}</b></div>` : '');
  return ` <div class="sheet">
  <div class="hd">
   <div class="ttl">פתק לשטיפה</div>
   <div class="pair">
    <div class="side"><u>מאת</u><b>ענק הרכבים</b></div>
    <div class="sep"></div>
    <div class="side"><u>לביצוע אצל</u><b>${esc(_WASH_VENDOR.name)}</b><i>${esc(_WASH_VENDOR.addr)}</i></div>
   </div>
  </div>
  <div class="bd">
   <div class="pl">מספר רישוי</div>
   <div class="plate">${esc(_washPlateFmt(f.plate))}</div>
   ${spec ? `<div class="spec">${spec}</div>` : ''}
   <div class="type"><span>סוג שטיפה</span><b>${esc(f.type)}</b></div>
   ${f.note ? `<div class="note"><i>הערה</i>${esc(f.note)}</div>` : ''}
   <div class="stamp"><i>חותמת ואישור ביצוע</i></div>
   <div class="foot"><span>הוציא: ${esc(f.createdBy || currentUser.name)}</span><span>${esc(when)}</span></div>
  </div>
 </div>`;
}

function washPrintNote(f, onDone) {
  _printHtml(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>פתק לשטיפה</title>
<style>
  /* margin:0 על העמוד מבטל את הכותרת והכתובת שהדפדפן מדפיס מעצמו.
     השוליים מגיעים מהפתק עצמו, כך שהפס העליון נוגע בקצה הדף.
     הכל בעמוד אחד: התוכן בגוש שאסור לפצל. */
  @page { size: A4; margin: 0; }
  html, body { height:100%; margin:0; }
  body { font-family:"Segoe UI", Arial, sans-serif; color:#1a1a2e;
         -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  /* הפתק ממלא את הדף: משבצת החותמת נמתחת, והתחתית יושבת בתחתית
     העמוד — כך אין שליש ריק בסוף. */
  .sheet { height:100%; box-sizing:border-box; display:flex; flex-direction:column;
           page-break-inside:avoid; break-inside:avoid; page-break-after:avoid; }
  .bd { flex:1; display:flex; flex-direction:column; }
  .stamp { flex:1; }
${_WASH_CSS}
  /* גדלים להדפסה בודדת — פתק אחד לעמוד */
  .hd { padding:13mm 14mm 9mm; }
  .hd .ttl { font-size:20px; letter-spacing:7px; margin-bottom:13px; }
  .hd .side u { font-size:9px; letter-spacing:3px; margin-bottom:4px; }
  .hd .side b { font-size:17px; }
  .hd .side i { font-size:11.5px; margin-top:3px; }
  .bd { padding:11mm 14mm 12mm; }
  .pl { font-size:12px; letter-spacing:4px; }
  .plate { font-size:58px; letter-spacing:2px; margin-top:5px; }
  .spec { gap:9px 18px; margin-top:11mm; }
  .spec div { font-size:15px; padding-bottom:6px; }
  .spec span { font-size:11px; }
  .type { padding:16px 10px; margin-top:10mm; border-radius:12px; }
  .type span { font-size:11px; letter-spacing:4px; margin-bottom:6px; }
  .type b { font-size:34px; }
  .note { font-size:15px; padding:11px 15px; margin-top:7mm; border-radius:12px; }
  .note i { font-size:11px; letter-spacing:2px; margin-bottom:3px; }
  .stamp { min-height:42mm; margin-top:9mm; border-radius:12px; }
  .stamp i { top:9px; right:15px; font-size:11px; letter-spacing:2px; }
  .foot { margin-top:8mm; padding-top:9px; font-size:11px; }
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
  _washRenderSortBtns();
  _washRenderSummary();
  openModal('modal-wash-summary');
}
window.openWashSummary = openWashSummary;

/* מחזיר את החשבון הפתוח: כל פתק שעדיין לא נכלל בתשלום.
   פתק שעבר לארכיון התשלומים נושא paidId ולכן יוצא מכאן. */
/* לשוניות חודשים בסיכום. החשבון הפתוח מתחלק לפי החודש שבו הפתק נשלח;
   כל לשונית היא חודש אחד, כי כל חשבונית מכסה חודש שלם. */
let _washSumMonth = '';
const _WASH_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const _washMonthKey = n => { const d = n.createdAt?.toDate ? n.createdAt.toDate() : null; return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : ''; };
const _washMonthLabel = k => { const [y, m] = String(k).split('-'); return `${_WASH_MONTHS[+m - 1] || m} ${y}`; };
function _washOpenMonths() {
  const mine = currentUser.role === 'manager' ? _washNotes : _washNotes.filter(n => n.createdBy === currentUser.name);
  const by = {};
  for (const n of mine) if (!n.paidId && n.createdAt?.toDate) { const k = _washMonthKey(n); by[k] = (by[k] || 0) + 1; }
  return Object.keys(by).sort().map(k => ({ key: k, n: by[k] }));
}
function washSumMonth(k) { _washSumMonth = k; _washRenderSummary(); }
window.washSumMonth = washSumMonth;

function _washSummaryData(byMonth) {
  const mine = currentUser.role === 'manager' ? _washNotes : _washNotes.filter(n => n.createdBy === currentUser.name);
  let rows = mine.filter(n => !n.paidId && n.createdAt?.toDate);
  if (byMonth) {
    const months = _washOpenMonths();
    if (!months.some(m => m.key === _washSumMonth)) _washSumMonth = months.length ? months[0].key : '';
    if (_washSumMonth) rows = rows.filter(n => _washMonthKey(n) === _washSumMonth);
  }
  const counts = {};
  for (const t of _WASH_TYPES) counts[t] = 0;
  const unknown = {};
  let subtotal = 0;
  for (const n of rows) {
    const t = n.type || 'ללא סוג';
    counts[t] = (counts[t] || 0) + 1;
    const price = _WASH_PRICES[t];
    if (price == null) { if (_washHasPrices()) unknown[t] = (unknown[t] || 0) + 1; }
    else subtotal += price;
  }
  if (_washSort === 'plate') {
    // השוואה ספרה אחרי ספרה, כמו רשימה שמית — לא לפי גודל המספר.
    const d = n => String(n || '').replace(/\D/g, '');
    rows.sort((a, b) => d(a.plate) < d(b.plate) ? -1 : d(a.plate) > d(b.plate) ? 1 : 0);
  } else {
    rows.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  }
  const vat = subtotal * _WASH_VAT;
  const days = rows.map(n => n.createdAt.toDate()).sort((a, b) => a - b);
  return { counts, unknown, total: rows.length, subtotal, vat, grand: subtotal + vat, rows,
           fromV: days[0] ? _washYmd(days[0]) : '', toV: days[days.length - 1] ? _washYmd(days[days.length - 1]) : '' };
}

function _washRenderSummary() {
  const box = document.getElementById('wash-sum-body');
  if (!box) return;
  const { counts, unknown, total, subtotal, vat, grand } = _washSummaryData(true);
  const monthTabs = (() => {
    const ms = _washOpenMonths();
    if (!ms.length) return '';
    return `<div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:12px;padding-bottom:2px">` + ms.map(m => `<button type="button" onclick="washSumMonth('${m.key}')" style="flex:0 0 auto;border:2px solid ${m.key === _washSumMonth ? '#0d9488' : 'var(--border)'};background:${m.key === _washSumMonth ? '#0d9488' : 'var(--card)'};color:${m.key === _washSumMonth ? '#fff' : 'var(--text)'};border-radius:999px;padding:8px 14px;font-family:inherit;font-size:13.5px;font-weight:900;cursor:pointer">${esc(_washMonthLabel(m.key))} · ${m.n}</button>`).join('') + `</div>`;
  })();
  const line = (label, val, strong) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 14px;font-size:13.5px;font-weight:800;color:${strong ? 'var(--text)' : 'var(--muted)'}">
      <span>${label}</span><span>${val}</span></div>`;
  const warn = Object.keys(unknown).length
    ? `<div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:11px;padding:9px 12px;font-size:12.5px;font-weight:700;color:#92400e;margin-bottom:10px">
         ⚠️ אין מחיר לסוג ${Object.entries(unknown).map(([t, n]) => `<b>${esc(t)}</b> (${n})`).join(', ')} — הרכבים האלה לא נספרו בסכום.</div>`
    : '';
  const payBtn = document.getElementById('wash-pay-btn');
  if (payBtn) {
    payBtn.disabled = !total;
    payBtn.style.background = total ? '#0d9488' : 'var(--surface2)';
    payBtn.style.color = total ? '#fff' : 'var(--muted)';
  }
  box.innerHTML = monthTabs + warn + Object.entries(counts).map(([t, n]) => {
    const price = _WASH_PRICES[t];
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;border:2px solid var(--border);border-radius:11px;padding:9px 13px;margin-bottom:6px;background:var(--card)">
        <span style="font-weight:800;font-size:15px;flex:1;min-width:0">${esc(t)}</span>
        <span style="font-weight:900;font-size:19px;color:${n ? '#0d9488' : 'var(--muted)'};min-width:30px;text-align:center">${n}</span>
        ${_washHasPrices() ? `<span style="font-size:12px;color:var(--muted);font-weight:700;min-width:46px;text-align:center">${price == null ? '—' : price + ' ₪'}</span>
        <span style="font-weight:900;font-size:15px;min-width:74px;text-align:left">${price == null ? '—' : _washMoney(price * n)}</span>` : ''}
      </div>`;
  }).join('') +
    (_washHasPrices()
      ? line(`סה״כ לפני מע״מ · ${total} רכבים`, _washMoney(subtotal)) +
        line('מע״מ 18%', _washMoney(vat)) +
        `<div style="display:flex;align-items:center;justify-content:space-between;border-radius:11px;padding:11px 14px;margin:6px 0 12px;background:var(--dark);color:#fff">
       <span style="font-weight:900;font-size:15px">סה״כ לתשלום</span>
       <span style="font-weight:900;font-size:22px">${_washMoney(grand)}</span>
     </div>`
      : `<div style="display:flex;align-items:center;justify-content:space-between;border-radius:11px;padding:11px 14px;margin:6px 0 12px;background:var(--dark);color:#fff">
       <span style="font-weight:900;font-size:15px">סה״כ רכבים</span>
       <span style="font-weight:900;font-size:22px">${total}</span>
     </div>`) +
    _washHistoryHtml();
}

/* ההיסטוריה עצמה, בתוך הסיכום: כל פתק בטווח שנבחר, שורה לרכב. */
function _washHistoryHtml() {
  const { rows } = _washSummaryData(true);
  if (!rows.length) return '<div style="text-align:center;color:var(--muted);font-size:13px;font-weight:700;padding:10px">אין פתקים בטווח הזה</div>';
  return `<div style="font-weight:900;font-size:14px;margin:4px 0 6px">🧾 היסטוריית הפתקים (${rows.length})</div>` +
    rows.slice().reverse().map(n => {
      const d = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString('he-IL') : '';
      const veh = [n.maker, n.model, n.year, n.color].filter(Boolean).join(' · ');
      return `<div style="border:1.5px solid var(--border);border-radius:10px;padding:7px 10px;margin-bottom:5px;background:var(--card);display:flex;align-items:center;gap:9px;flex-wrap:wrap">
        <span style="font-weight:900;font-size:14px;direction:ltr">${esc(n.plate || '')}</span>
        <span style="flex:1;min-width:90px;font-size:12px;color:var(--muted)">${esc(veh)}</span>
        <span style="font-size:11.5px;font-weight:800;background:var(--surface2);border-radius:999px;padding:2px 9px">${esc(n.type || 'ללא סוג')}</span>
        ${_WASH_PRICES[n.type] != null ? `<span style="font-size:11.5px;font-weight:800;background:#0d9488;color:#fff;border-radius:999px;padding:2px 9px">${_WASH_PRICES[n.type]} ₪</span>` : ''}
        <span style="font-size:11.5px;color:var(--muted);font-weight:700">${esc(d)}</span>
        <button onclick="washReprint('${esc(n.id)}')" title="הדפס שוב" style="background:var(--dark);color:#fff;border:none;border-radius:8px;width:30px;height:30px;font-size:14px;cursor:pointer;flex-shrink:0">🖨️</button>
        <button onclick="washDelete('${esc(n.id)}')" title="מחק" style="background:#ef4444;color:#fff;border:none;border-radius:8px;width:30px;height:30px;font-size:14px;cursor:pointer;flex-shrink:0">🗑</button>
      </div>`;
    }).join('');
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
  const { counts, total, fromV, toV, rows, subtotal, vat, grand } = _washSummaryData(true);
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
    ${Object.entries(counts).map(([t, n]) => `<tr><td>${esc(t)}</td><td class="n">${n}</td>${_washHasPrices() ? `<td class="n">${_WASH_PRICES[t] != null ? _washMoney(_WASH_PRICES[t] * n) : '—'}</td>` : ''}</tr>`).join('')}
    ${_washHasPrices() ? `<tr><td>סה״כ לפני מע״מ</td><td class="n">${total}</td><td class="n">${_washMoney(subtotal)}</td></tr>
    <tr><td>מע״מ 18%</td><td class="n"></td><td class="n">${_washMoney(vat)}</td></tr>
    <tr class="tot"><td>סה״כ לתשלום</td><td class="n"></td><td class="n">${_washMoney(grand)}</td></tr>` : `<tr class="tot"><td>סה״כ רכבים</td><td class="n">${total}</td></tr>`}
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
  let _lastDay = '';
  const _dayLabel = d => {
    if (!d) return '';
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const k = new Date(d); k.setHours(0, 0, 0, 0);
    const diff = Math.round((t - k) / 86400000);
    return diff === 0 ? 'היום' : diff === 1 ? 'אתמול' : d.toLocaleDateString('he-IL');
  };
  c.innerHTML = rows.map(n => {
    const d = n.createdAt?.toDate ? n.createdAt.toDate() : null;
    const head = window.innerWidth <= 900 && _dayLabel(d) !== _lastDay ? `<div class="washm-day">${_dayLabel(d)}</div>` : '';
    _lastDay = _dayLabel(d);
    const when = d ? d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
    return head + `<div class="washm-row" style="display:flex;align-items:center;gap:10px;border:2px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:var(--card)">
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

/* הממוזערת של פתק פחחות נמשכת עם כל העבודות בכל פתיחת מסך, ולכן
   המשקל שלה נחשב. הממדים נשארים 700 — הכרטיס מציג אותה ברוחב מלא,
   ובמסכי רטינה הקטנה מהם כבר הייתה נראית. רק הדחיסה חזקה יותר,
   אחרי השוואה חזותית שלא הראתה הבדל. מקום אחד לשניהם. */
const _BSHOP_THUMB = { max: 700, q: 0.55 };

async function bsmPickPhoto(input) {
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  try {
    _bsmPhoto = await compressToBase64(f, 1000, 0.7);   // full size, own document
    _bsmThumb = await compressToBase64(f, _BSHOP_THUMB.max, _BSHOP_THUMB.q);   // small, rides on the job
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
    thumb = await compressToBase64(f, _BSHOP_THUMB.max, _BSHOP_THUMB.q);
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

/* ═══════════════════════════════════════════════════════════════════════
   ארכיון התשלומים לשטיפה
   ───────────────────────────────────────────────────────────────────────
   "בוצע תשלום" סוגר את החשבון הפתוח: נוצרת רשומת תשלום אחת שמחזיקה את
   כל הפירוט (רכב, תאריך, סוג ומחיר), וכל פתק שנכלל בה מסומן ב-paidId
   ולכן יוצא מהרשימה הפתוחה. שום פתק לא נמחק.
   פתק שלא נכלל — למשל כזה שנוצר אחרי הלחיצה — פשוט נשאר פתוח וייכנס
   לתשלום הבא. זה מה שמונע תשלום כפול.
   החשבונית הסרוקה נשמרת בנפרד (wash_payment_docs) כדי שרשימת התשלומים
   תישאר קלה לטעינה.
─────────────────────────────────────────────────────────────────────── */
const _WASH_DOC_MAX = 700 * 1024;
let _washPayments = [];
let _washPayUnsub = null;
let _washPayOpen = null;        // התשלום שפתוח כרגע לפירוט

/* סגירת תשלום היא פעולה שקשה לחזור ממנה, ולכן היא עוברת דרך חלונית
   אישור שמראה בדיוק מה עומד לקרות — כמה רכבים, כמה כסף, ומה לא נספר. */
/* מה בדיוק ייכלל בתשלום: כברירת מחדל כל החשבון הפתוח, ואחרי הצלבה
   מול הסריקה — רק הרכבים שהפתק שלהם חזר. */
function _washPaySelection() {
  const d = _washSummaryData();
  if (!_washPayOnly) return d;
  const rows = d.rows.filter(n => _washPayOnly.has(n.id));
  const counts = {}; const unknown = {}; let subtotal = 0;
  for (const t of _WASH_TYPES) counts[t] = 0;
  for (const n of rows) {
    const t = n.type || 'ללא סוג';
    counts[t] = (counts[t] || 0) + 1;
    const price = _WASH_PRICES[t];
    if (price == null) unknown[t] = (unknown[t] || 0) + 1; else subtotal += price;
  }
  const vat = subtotal * _WASH_VAT;
  const days = rows.map(n => n.createdAt.toDate()).sort((a, b) => a - b);
  return { ...d, rows, counts, unknown, total: rows.length, subtotal, vat, grand: subtotal + vat,
           fromV: days[0] ? _washYmd(days[0]) : '', toV: days[days.length - 1] ? _washYmd(days[days.length - 1]) : '' };
}

let _washPayFile = null;  // קובץ החשבונית שהועלה — נשמר בארכיון יחד עם התשלום
let _washPayInv = null;   // חשבונית השטיפה שלפיה משלמים (כשמגיעים מבדיקת החשבונית)
let _washPayRest = [];   // פתקי החודש שלא שולמו ויועברו לארכיון יחד עם התשלום
function washMarkPaid(only) {
  if (currentUser?.role !== 'manager') return;
  // אין מחירון: סוגרים תשלום רק לפי חשבונית (תשלומים → התחלת תהליך תשלום)
  if (!_washPayInv && !_washHasPrices()) return showToast('סגירת תשלום נעשית דרך "תשלומים" ← "התחלת תהליך תשלום", לפי החשבונית', 6000);
  _washPayOnly = only || null;
  const { total, counts, unknown, subtotal, vat, grand } = _washPaySelection();
  if (!total) return showToast('אין פתקים פתוחים');
  const missing = Object.values(unknown).reduce((a, b) => a + b, 0);
  const box = document.getElementById('wash-pay-confirm-body');
  // המבנה זהה לחשבונית שמגיעה מהשטיפה: כמות, סוג, מחיר ליחידה וסה״כ
  const items = Object.entries(counts).filter(([, n]) => n > 0).map(([t, n]) => {
    const unit = _WASH_PRICES[t];
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-weight:900;font-size:15px;white-space:nowrap">${n}</td>
      <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-weight:800;font-size:14px">${esc(t)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:13px;color:var(--muted);font-weight:700;text-align:center;white-space:nowrap">${unit == null ? '—' : unit + ' ₪'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-weight:900;font-size:14px;text-align:left;white-space:nowrap">${unit == null ? '—' : _washMoney(unit * n)}</td>
    </tr>`;
  }).join('');
  const foot = (label, val, strong) => `<tr>
      <td colspan="3" style="padding:${strong ? '10px' : '6px'} 10px;font-weight:${strong ? 900 : 800};font-size:${strong ? 15 : 13.5}px;color:${strong ? 'var(--text)' : 'var(--muted)'};${strong ? 'border-top:2px solid var(--border)' : ''}">${label}</td>
      <td style="padding:${strong ? '10px' : '6px'} 10px;text-align:left;font-weight:900;font-size:${strong ? 19 : 13.5}px;white-space:nowrap;${strong ? 'border-top:2px solid var(--border)' : ''}">${val}</td>
    </tr>`;
  // כשמשלמים לפי חשבונית — הסכומים הם אלה שבחשבונית, שורה אחר שורה
  const I = _washPayInv;
  let matchLine = '';
  if (I) { try { const A = _washChkAnalyze(); matchLine = `<div style="background:${A.moneyDiff > 0 ? '#fef2f2' : '#f0fdf4'};border:2px solid ${A.moneyDiff > 0 ? '#fca5a5' : '#86efac'};border-radius:11px;padding:9px 12px;font-size:12.5px;font-weight:800;color:${A.moneyDiff > 0 ? '#991b1b' : '#166534'};margin-bottom:12px;line-height:1.7">התאמה לפתקים (שטיפות, לפני מע״מ): לפי הפתקים ${_washMoney(A.expSub)} · בחשבונית ${_washMoney(A.gotSub)}<br>${A.moneyDiff > 0 ? '❌ חויבת ב-' + _washMoney(A.moneyDiff) + ' יותר' : A.moneyDiff < 0 ? '✅ החשבונית נמוכה ב-' + _washMoney(-A.moneyDiff) : '✅ הסכום תואם'}</div>`; } catch (e) {} }
  const invItems = I ? I.lines.map(l => `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-weight:900;font-size:15px;white-space:nowrap">${l.qty}</td>
      <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-weight:800;font-size:14px">${esc(l.type || l.desc)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:13px;color:var(--muted);font-weight:700;text-align:center;white-space:nowrap">${l.unit} ₪</td>
      <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-weight:900;font-size:14px;text-align:left;white-space:nowrap">${_washMoney(l.total)}</td></tr>`).join('') : '';
  const m2 = n => Number(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₪';
  const invFoot = I ? foot('סה״כ ללא מע״מ', m2(I.beforeVat != null ? I.beforeVat : I.lines.reduce((x, l) => x + l.total, 0))) +
    (I.discount ? foot('הנחה', '-' + m2(I.discount)) : '') +
    foot('מע״מ 18%', m2(I.vat != null ? I.vat : 0)) +
    foot('סה״כ לתשלום', m2(I.grand != null ? I.grand : 0), true) : '';
  if (box) box.innerHTML = `
    <div style="font-size:13.5px;font-weight:700;color:var(--muted);margin-bottom:12px">
      ${I ? `הסכומים זהים לחשבונית ${esc(I.number || '')} של השטיפה. ${total} רכבים לפי הפתקים עוברים לארכיון. ` : ''}${_washPayOnly && !I ? 'תשלום על הרכבים שהפתק שלהם חזר מהשטיפה. השאר נשארים בחשבון הפתוח. ' : ''}הפתקים יעברו לארכיון התשלומים ויֵצאו מהחשבון הפתוח. שום פתק לא יימחק.</div>
    ${matchLine}
    <div style="border:2px solid var(--border);border-radius:13px;overflow:hidden;margin-bottom:12px">
      <table style="width:100%;border-collapse:collapse;background:var(--card)">
        <tr style="background:var(--surface2)">
          <td style="padding:7px 10px;font-size:11.5px;font-weight:800;color:var(--muted)">כמות</td>
          <td style="padding:7px 10px;font-size:11.5px;font-weight:800;color:var(--muted)">סוג שטיפה</td>
          <td style="padding:7px 10px;font-size:11.5px;font-weight:800;color:var(--muted);text-align:center">ליחידה</td>
          <td style="padding:7px 10px;font-size:11.5px;font-weight:800;color:var(--muted);text-align:left">סה״כ</td>
        </tr>
        ${I ? invItems : items}
        ${I ? invFoot : foot(`סה״כ ללא מע״מ · ${total} רכבים`, _washMoney(subtotal)) + foot('מע״מ 18%', _washMoney(vat)) + foot('סה״כ לתשלום', _washMoney(grand), true)}
      </table>
    </div>
    ${_washPayRest.length ? `<div style="background:#eff6ff;border:2px solid #93c5fd;border-radius:11px;padding:9px 12px;font-size:12.5px;font-weight:700;color:#1e40af;margin-bottom:12px">🗄️ ${_washPayRest.length} פתקים נוספים של החודש שלא שולמו (לא חזרו או כפולים) יועברו גם הם לארכיון.</div>` : ''}
    ${missing ? `<div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:11px;padding:9px 12px;font-size:12.5px;font-weight:700;color:#92400e;margin-bottom:12px">
      ⚠️ ל-${missing} רכבים אין מחיר ולכן הם לא נספרו בסכום. הם בכל זאת ייכללו בתשלום ויֵצאו מהחשבון הפתוח.</div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn-submit" onclick="washPayCancel()" style="background:var(--surface2);color:var(--text);margin:0;width:100%">ביטול</button>
      <button class="btn-submit" id="wash-pay-go" onclick="washPayConfirm()" style="background:#0d9488;color:#fff;margin:0;width:100%">✅ אשר תשלום</button>
    </div>`;
  openModal('modal-wash-pay-confirm');
}
window.washMarkPaid = washMarkPaid;

async function washPayConfirm() {
  const go = document.getElementById('wash-pay-go');
  if (go?.dataset.busy) return;          // לחיצה שנייה לא פותחת תשלום כפול
  if (go) { go.dataset.busy = '1'; go.disabled = true; go.textContent = 'שומר…'; }
  const { rows, counts, total, subtotal, vat, fromV, toV } = _washPaySelection();
  const byType = Object.entries(counts).filter(([, n]) => n > 0).map(([type, qty]) => ({
    type, qty, unit: _WASH_PRICES[type] ?? null,
    sum: _WASH_PRICES[type] != null ? _WASH_PRICES[type] * qty : null,
  }));
  const cars = rows.map(n => ({
    plate: n.plate || '', type: n.type || '', price: _WASH_PRICES[n.type] ?? null,
    date: n.createdAt?.toDate ? _washYmd(n.createdAt.toDate()) : '',
    maker: n.maker || '', model: n.model || '', year: n.year || '', color: n.color || '',
  }));
  try {
    const I = _washPayInv;
    const invBy = I ? I.lines.map(l => ({ type: l.type || l.desc, qty: l.qty, unit: l.unit, sum: l.total })) : null;
    const invSub = I ? (I.beforeVat != null ? I.beforeVat : I.lines.reduce((x, l) => x + l.total, 0)) : 0;
    const ref = await _addDoc(_colRef('wash_payments'), {
      paidAt: _serverTs(), paidBy: currentUser.name,
      from: fromV, to: toV, count: total,
      ...(I ? { subtotal: invSub, vat: I.vat != null ? I.vat : 0, total: I.grand != null ? I.grand : invSub + (I.vat || 0), invoiceNumber: I.number || '', invoiceMonth: I.period ? `${I.period.year}-${String(I.period.month).padStart(2, '0')}` : '' }
         : { subtotal, vat, total: subtotal + vat }),
      byType: invBy || byType, cars, hasDoc: false,
      ...(_washPayRest.length ? { closedUnpaid: _washPayRest.length, restCars: _washPayRest.map(n => ({ plate: n.plate || '', type: n.type || '', date: n.createdAt?.toDate ? _washYmd(n.createdAt.toDate()) : '' })) } : {}),
    });
    // סימון הפתקים רק אחרי שרשומת התשלום נשמרה בהצלחה
    let failed = 0;
    for (const n of rows) {
      try { await _updateDoc(_docRef('wash_notes', n.id), { paidId: ref.id }); }
      catch (e) { failed++; }
    }
    // החשבונית שהועלתה נשמרת ליד התשלום בארכיון
    if (_washPayFile) {
      if (_washPayFile.data.length * 0.75 > _WASH_DOC_MAX) showToast('⚠️ החשבונית גדולה מדי לשמירה בארכיון (מעל 0.7MB). אפשר לצרף אותה ידנית מהארכיון.', 9000);
      else {
        try {
          await _setDoc(_docRef('wash_payment_docs', ref.id), { doc: _washPayFile.data, docMime: _washPayFile.mime, docName: _washPayFile.name });
          await _updateDoc(_docRef('wash_payments', ref.id), { hasDoc: true });
        } catch (e) { showToast('⚠️ התשלום נשמר, אך צירוף החשבונית נכשל. אפשר לצרף אותה מהארכיון.', 9000); }
      }
    }
    // שאר פתקי החודש עוברים לארכיון יחד עם התשלום, מסומנים כלא שולמו
    for (const n of _washPayRest) {
      try { await _updateDoc(_docRef('wash_notes', n.id), { paidId: ref.id, closedUnpaid: true }); }
      catch (e) { failed++; }
    }
    closeModal('modal-wash-pay-confirm');
    _washPayOnly = null; _washRec = null; _washChk = null; _washPayRest = []; _washPayInv = null; _washPayFile = null; _wckClear();
    _washRenderSummary();
    showToast(failed
      ? `⚠️ התשלום נשמר, אך ${failed} פתקים לא סומנו והם נשארו בחשבון הפתוח`
      : `✅ התשלום נשמר בארכיון · ${total} רכבים`, failed ? 9000 : 4000);
  } catch (e) {
    showToast('⚠️ שמירת התשלום נכשלה. שום פתק לא זז — אפשר לנסות שוב.', 8000);
  }
  if (go) { delete go.dataset.busy; go.disabled = false; go.textContent = '✅ אשר תשלום'; }
}
window.washPayConfirm = washPayConfirm;

// ביטול מחזיר את הבחירה למצב הרגיל — החשבון הפתוח כולו
function washPayCancel() { _washPayOnly = null; _washPayRest = []; _washPayInv = null; _washPayFile = null; closeModal('modal-wash-pay-confirm'); }
window.washPayCancel = washPayCancel;

function openWashPayHub() {
  if (currentUser?.role !== 'manager') return;
  openModal('modal-wash-payhub');
}
window.openWashPayHub = openWashPayHub;

function openWashPayments() {
  if (currentUser?.role !== 'manager') return;
  if (!_washPayUnsub && window._onSnap) {
    _washPayUnsub = _onSnap(_colRef('wash_payments'), snap => {
      _washPayments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.paidAt?.seconds || 0) - (a.paidAt?.seconds || 0));
      _washRenderPayments();
    }, () => {});
  }
  _washRenderPayments();
  openModal('modal-wash-payments');
}
window.openWashPayments = openWashPayments;

function washPayToggle(id) {
  _washPayOpen = _washPayOpen === id ? null : id;
  _washRenderPayments();
}
window.washPayToggle = washPayToggle;

function _washPayTitle(p) {
  // השם הוא החודש שהחשבונית מכסה, לא חודש התשלום ("חודש 9/26" בחשבונית = ספטמבר 2026)
  if (p.invoiceMonth) return _washMonthLabel(p.invoiceMonth);
  if (p.from && p.to && String(p.from).slice(0, 7) === String(p.to).slice(0, 7)) return _washMonthLabel(String(p.from).slice(0, 7));
  const d = p.paidAt?.toDate ? p.paidAt.toDate() : null;
  return d ? d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }) : 'תשלום';
}

function _washRenderPayments() {
  const box = document.getElementById('wash-pay-body');
  if (!box) return;
  if (!_washPayments.length) {
    box.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;font-weight:700;padding:18px">עדיין לא נסגר אף תשלום</div>';
    return;
  }
  box.innerHTML = _washPayments.map(p => {
    const open = _washPayOpen === p.id;
    const d = p.paidAt?.toDate ? p.paidAt.toDate().toLocaleDateString('he-IL') : '';
    return `<div style="border:2px solid ${open ? '#0d9488' : 'var(--border)'};border-radius:14px;padding:12px 14px;margin-bottom:9px;background:var(--card)">
      <div onclick="washPayToggle('${p.id}')" style="cursor:pointer">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
          <span style="font-weight:900;font-size:16px">${esc(_washPayTitle(p))}</span>
          <span style="font-weight:900;font-size:18px;color:#0d9488">${_washMoney(p.total || 0)}</span>
        </div>
        <div style="font-size:12.5px;color:var(--muted);font-weight:700">
          שולם ${esc(d)} · ${p.count || 0} רכבים · ${_washMoney(p.subtotal || 0)} + מע״מ ${_washMoney(p.vat || 0)}
          ${p.hasDoc ? ' · 📎 חשבונית מצורפת' : ''}
        </div>
      </div>
      ${open ? _washPayDetail(p) : ''}
    </div>`;
  }).join('');
}

function _washPayDetail(p) {
  const rows = (p.byType || []).map(t => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;border:2px solid var(--border);border-radius:11px;padding:7px 11px;margin-bottom:5px;background:var(--card)">
      <span style="font-weight:800;font-size:14px;flex:1;min-width:0">${esc(t.type)}</span>
      <span style="font-weight:900;font-size:17px;color:#0d9488;min-width:30px;text-align:center">${t.qty}</span>
      <span style="font-size:12px;color:var(--muted);font-weight:700;min-width:46px;text-align:center">${t.unit == null ? '—' : t.unit + ' ₪'}</span>
      <span style="font-weight:900;font-size:14px;min-width:74px;text-align:left">${t.sum == null ? '—' : _washMoney(t.sum)}</span>
    </div>`).join('');
  const cars = (p.cars || []).map(c => {
    const veh = [c.maker, c.model, c.year].filter(Boolean).join(' · ');
    const dt = c.date ? new Date(c.date + 'T00:00:00').toLocaleDateString('he-IL') : '';
    return `<div style="border:1.5px solid var(--border);border-radius:10px;padding:6px 9px;margin-bottom:5px;background:var(--card);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="font-weight:900;font-size:13px;direction:ltr">${esc(c.plate)}</span>
      <span style="flex:1;min-width:80px;font-size:11.5px;color:var(--muted)">${esc(veh)}</span>
      <span style="font-size:11.5px;font-weight:800;background:var(--surface2);border-radius:999px;padding:2px 9px">${esc(c.type)}</span>
      ${c.price != null ? `<span style="font-size:11.5px;font-weight:800;background:#0d9488;color:#fff;border-radius:999px;padding:2px 9px">${c.price} ₪</span>` : ''}
      <span style="font-size:11px;color:var(--muted);font-weight:700">${esc(dt)}</span>
    </div>`;
  }).join('');
  return `<div style="margin-top:10px">
    ${rows}
    <div style="font-size:12.5px;font-weight:800;color:var(--muted);margin:9px 0 5px">הרכבים שנכללו (${(p.cars || []).length})</div>
    ${cars}
    ${(p.restCars || []).length ? `<div style="font-size:12.5px;font-weight:800;color:#1e40af;margin:9px 0 5px">🗄️ נסגרו בלי תשלום (${p.restCars.length}) — לא חזרו או כפולים</div>` + p.restCars.map(c => `<div style="border:1.5px dashed var(--border);border-radius:10px;padding:5px 9px;margin-bottom:4px;font-size:12px;font-weight:700;color:var(--muted);display:flex;gap:8px"><span style="font-weight:900;direction:ltr">${esc(c.plate || '(ללא מספר)')}</span><span style="flex:1">${esc(c.type)}</span><span>${esc(c.date ? new Date(c.date + 'T00:00:00').toLocaleDateString('he-IL') : '')}</span></div>`).join('') : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
      <button class="btn-submit" onclick="washPrintPayment('${p.id}')" style="background:var(--dark);color:#fff;font-size:13.5px;padding:10px;margin:0;width:100%">🖨️ הדפס פירוט</button>
      ${p.hasDoc
        ? `<button class="btn-submit" onclick="washOpenInvoice('${p.id}')" style="background:#6366f1;color:#fff;font-size:13.5px;padding:10px;margin:0;width:100%">📎 פתח חשבונית</button>`
        : `<label class="btn-submit" style="background:#6366f1;color:#fff;font-size:13.5px;padding:10px;margin:0;width:100%;text-align:center;cursor:pointer;display:block">📎 צרף חשבונית
             <input type="file" accept="image/*,application/pdf" onchange="washAttachInvoice('${p.id}', this)" style="display:none"></label>`}
    </div>
  </div>`;
}

/* החשבונית נשמרת בתוך המסד ולכן יש לה תקרת גודל — עדיף לומר את זה
   בזמן הצירוף מאשר להיכשל בשמירה. אותו כלל כמו באישורי הבעלות. */
function washAttachInvoice(id, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > _WASH_DOC_MAX) {
    input.value = '';
    return showToast(`⚠️ הקובץ גדול מדי (${(file.size / 1024 / 1024).toFixed(1)}MB). המקסימום הוא 0.7MB — סרוק באיכות נמוכה יותר.`, 10000);
  }
  const r = new FileReader();
  r.onload = async e => {
    try {
      await _setDoc(_docRef('wash_payment_docs', id), { doc: e.target.result, docMime: file.type || '', docName: file.name || 'חשבונית' });
      await _updateDoc(_docRef('wash_payments', id), { hasDoc: true });
      showToast('✅ החשבונית צורפה');
    } catch (err) { showToast('⚠️ צירוף החשבונית נכשל', 7000); }
  };
  r.onerror = () => showToast('⚠️ קריאת הקובץ נכשלה', 7000);
  r.readAsDataURL(file);
}
window.washAttachInvoice = washAttachInvoice;

async function washOpenInvoice(id) {
  try {
    const snap = await _getDoc(_docRef('wash_payment_docs', id));
    const d = snap.exists() ? snap.data() : null;
    if (!d || !d.doc) return showToast('החשבונית לא נמצאה');
    const w = window.open('', '_blank');
    if (!w) return showToast('הדפדפן חסם את פתיחת החלון');
    w.document.write(String(d.docMime || '').startsWith('image/')
      ? `<body style="margin:0;background:#111"><img src="${d.doc}" style="width:100%"></body>`
      : `<body style="margin:0"><embed src="${d.doc}" type="application/pdf" style="width:100%;height:100vh"></body>`);
    w.document.close();
  } catch (e) { showToast('⚠️ פתיחת החשבונית נכשלה', 7000); }
}
window.washOpenInvoice = washOpenInvoice;

function washPrintPayment(id) {
  const p = _washPayments.find(x => x.id === id);
  if (!p) return;
  const d = p.paidAt?.toDate ? p.paidAt.toDate().toLocaleDateString('he-IL') : '';
  _printHtml(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>פירוט תשלום</title>
<style>
  @page { size:A4; margin:12mm }
  body { font-family: Arial, "Segoe UI", sans-serif; color:#222; margin:0; text-align:center }
  h1 { font-size:20px; font-weight:normal; letter-spacing:4px; color:#444; margin:0 }
  .sub { font-size:12px; letter-spacing:3px; color:#888; margin:4px 0 0 }
  .range { font-size:13px; color:#555; margin-top:7px }
  hr { border:0; border-top:1px solid #d5d5d5; margin:10px 0 12px }
  table { border-collapse:collapse; width:100% }
  td { border-bottom:1px solid #e2e2e2; padding:6px; text-align:right; font-size:14px }
  td.n { text-align:left; font-weight:bold; width:20% }
  tr.tot td { border-top:2px solid #999; border-bottom:0; font-weight:bold; font-size:17px; padding-top:9px }
  .det-l { font-size:11px; letter-spacing:3px; color:#888; margin:14px 0 5px; border-top:1px solid #e2e2e2; padding-top:9px }
  .ln { display:flex; gap:6px; font-size:11px; border-bottom:1px solid #eee; padding:2px 0; text-align:right }
  .ln .p { font-weight:bold; flex:0 0 auto }
  .ln .c { color:#666; flex:1 1 auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
  .ln .w { color:#0d6a63; flex:0 0 auto }
  .cols { display:flex; gap:6mm; align-items:flex-start }
  .cols>div { flex:1 1 0; min-width:0 }
  .foot { margin-top:12px; font-size:11px; letter-spacing:1px; color:#999; border-top:1px solid #e2e2e2; padding-top:7px }
</style></head><body>
  <h1>פירוט תשלום שטיפות</h1>
  <div class="sub">ענק הרכבים · מאסטר קלין</div>
  <div class="range">שולם ${esc(d)} · ${p.count || 0} רכבים</div>
  <hr>
  <table>
    ${(p.byType || []).map(t => `<tr><td>${esc(t.type)}${t.unit != null ? ` · ${t.unit} ₪` : ''}</td><td class="n">${t.qty}</td><td class="n">${t.sum == null ? '—' : _washMoney(t.sum)}</td></tr>`).join('')}
    <tr><td>סה״כ לפני מע״מ</td><td class="n">${p.count || 0}</td><td class="n">${_washMoney(p.subtotal || 0)}</td></tr>
    <tr><td>מע״מ 18%</td><td class="n"></td><td class="n">${_washMoney(p.vat || 0)}</td></tr>
    <tr class="tot"><td>סה״כ ששולם</td><td class="n"></td><td class="n">${_washMoney(p.total || 0)}</td></tr>
  </table>
  <div class="det-l">הרכבים שנכללו</div>
  <div class="cols">${(() => {
    const cars = p.cars || [];
    const per = Math.ceil(cars.length / 3) || 1;
    let out = '';
    for (let i = 0; i < cars.length; i += per) {
      out += '<div>' + cars.slice(i, i + per).map(c => {
        const veh = [c.maker, c.model, c.color].filter(Boolean).join(' ');
        return `<div class="ln"><span class="p">${esc(c.plate)}</span><span class="c">${esc(veh)}</span><span class="w">${esc(c.type)}</span></div>`;
      }).join('') + '</div>';
    }
    return out;
  })()}</div>
  <div class="foot">${esc(currentUser.name)} · ${esc(new Date().toLocaleDateString('he-IL'))}</div>
</body></html>`, 'wash payment print', 'שגיאה בהדפסה');
}
window.washPrintPayment = washPrintPayment;

/* ═══════════════════════════════════════════════════════════════════════
   הצלבת הפתקים שחזרו מהשטיפה מול החשבון הפתוח
   ───────────────────────────────────────────────────────────────────────
   השטיפה מחזירה את הפתקים שהדפסנו, והם נסרקים לקובץ אחד. כל עמוד הוא
   פתק אחד. מכאן שהתשלום צריך להיות על מה שחזר בפועל — לא על טווח
   תאריכים. רכב שברשימה ולא חזר פשוט נשאר בחשבון הפתוח וייכנס בפעם הבאה.

   הזיהוי עובד בשלושה מדרגים, מהמדויק לגס:
   1. שכבת הטקסט של ה-PDF — מדויקת לחלוטין, קיימת רק בקובץ שאינו סריקה
   2. זיהוי תווים מוגבל לספרות על החלק העליון של העמוד, שם יושבת הלוחית
   3. חיפוש כל מספר מהחשבון הפתוח בתוך כל הספרות שבעמוד

   בכל המדרגים ההתאמה נעשית מול רשימת המספרים שכבר בחשבון הפתוח, ולכן
   טעות של ספרה אחת עדיין מתכנסת לרכב הנכון. מה שלא זוהה מוצג בנפרד
   ואף פעם לא מנוחש — אתה משייך אותו ידנית.
   כל התהליך הוא תצוגה בלבד; שום דבר לא נשמר עד שתאשר את התשלום.
─────────────────────────────────────────────────────────────────────── */
let _washPayOnly = null;   // תת-קבוצת פתקים שהוצלבה מול הסריקה
let _washRec = null;     // { pages, matched:Map(noteId→plate), unknown:[], notes }

function openWashReconcile() {
  if (currentUser?.role !== 'manager') return;
  const { total } = _washSummaryData();
  if (!total) return showToast('אין פתקים פתוחים להצליב');
  _washRec = null;
  const st = document.getElementById('wash-rec-status');
  if (st) st.innerHTML = `<div style="font-size:13px;font-weight:700;color:var(--muted);line-height:1.6">
    בחשבון הפתוח יש <b>${total}</b> רכבים. העלה את הסריקה של הפתקים שחזרו מהשטיפה —
    קובץ PDF אחד או כמה תמונות. כל עמוד הוא פתק אחד.</div>`;
  const res = document.getElementById('wash-rec-body');
  if (res) res.innerHTML = '';
  const inp = document.getElementById('wash-rec-file');
  if (inp) inp.value = '';
  openModal('modal-wash-rec');
}
window.openWashReconcile = openWashReconcile;

// כל מספרי הרישוי שאפשר לזהות בעמוד, מהמדויק לגס
function _washPlatesInText(text) {
  const t = String(text || '').replace(/[‎‏]/g, '');
  const out = _plateTokens(t);
  // הפתק שלנו מודפס עם מקפים — 123-45-678
  for (const m of (t.match(/\d{2,3}[-–]\d{2,3}[-–]\d{2,4}/g) || [])) {
    const d = m.replace(/\D/g, '');
    if (d.length === 7 || d.length === 8) out.push(d);
  }
  return out;
}

// הצמדה לרשימת המספרים שבחשבון הפתוח — טעות של ספרה אחת עדיין מתכנסת
function _washSnap(tokens, known) {
  let best = { dist: 99, id: null };
  for (const t of tokens) {
    for (const k of known) {
      if (Math.abs(k.plate.length - t.length) > 1) continue;
      const d = _levenshtein(t, k.plate);
      if (d < best.dist) best = { dist: d, id: k.id, plate: k.plate };
    }
  }
  return best.id && best.dist <= 1 ? best : null;
}

// התאמה מקלה מול מאגר קטן של פתקים שלא הוצלבו: ספרות מדויקות, טעות של עד
// שתי ספרות, או חלון של שש ספרות רצופות מתוך המספר. מחזיר רק התאמה חד-משמעית.
function _washRelaxed(tokens, squash, pool) {
  const scored = [];
  for (const k of pool) {
    let best = 99;
    const pl = k.plate;
    if (squash.includes(pl)) best = 0;
    for (const t of tokens) {
      if (t.length < 6 || Math.abs(t.length - pl.length) > 2) continue;
      best = Math.min(best, _levenshtein(t, pl));
    }
    if (best > 2) {
      for (let a = 0; a + 6 <= pl.length; a++) if (squash.includes(pl.slice(a, a + 6))) { best = Math.min(best, 1.5); break; }
    }
    if (best <= 2) scored.push({ k, best });
  }
  if (!scored.length) return null;
  scored.sort((x, y) => x.best - y.best);
  // יותר ממועמד אחד בציון זהה, ולא אותו רכב — לא מכריעים
  if (scored.length > 1 && scored[1].best === scored[0].best && scored[1].k.plate !== scored[0].k.plate) return null;
  return { id: scored[0].k.id, plate: scored[0].k.plate };
}

function _washRotate(dataUrl, deg) {
  return _loadImg(dataUrl).then(img => {
    const c = document.createElement('canvas');
    const swap = deg === 90 || deg === 270;
    c.width = swap ? img.height : img.width; c.height = swap ? img.width : img.height;
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2); ctx.rotate(deg * Math.PI / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    return c.toDataURL('image/jpeg', 0.8);
  });
}

async function washReconcileFiles(input) {
  const files = [...(input.files || [])];
  const prog = (pct, label) => { try { if (typeof window._washProg === 'function') window._washProg(pct, label); } catch (e) {} };
  if (!files.length) return;
  const st = document.getElementById('wash-rec-status');
  const say = h => { if (st) st.innerHTML = h; };
  const { rows } = _washSummaryData();
  const known = rows.map(n => ({ id: n.id, plate: _normPlate(n.plate), n })).filter(k => k.plate.length >= 7);
  let worker = null;
  try {
    say('<div style="font-size:13px;font-weight:800;color:var(--muted)">⏳ מפצל את הקובץ לעמודים…</div>');
    const pages = [];        // { img, text }
    prog(2, 'מפצל את הקובץ לעמודים…');
    for (const f of files) {
      if (f.type === 'application/pdf') {
        const imgs = await _pdfFileToImages(f, (i, n) => prog(2 + 8 * i / n, `מפצל עמוד ${i} מתוך ${n}`));
        imgs.forEach((img, i) => pages.push({ img, text: (window._ownPdfText || [])[i] || '' }));
      } else if (f.type.startsWith('image/')) {
        pages.push({ img: await _fileToDataUrl(f), text: '' });
      }
    }
    if (!pages.length) { say('<div style="font-size:13px;font-weight:800;color:#991b1b">לא זוהו עמודים בקובץ</div>'); return; }
    prog(10, `${pages.length} עמודים`);

    const matched = new Map();   // noteId → מספר הרישוי שזוהה
    const unknown = [];          // עמודים שלא הצלחנו לשייך
    const repeats = [];          // עמודים נוספים לרכב שכבר הוצלב
    let byText = 0, byOcr = 0;
    const seen = pages.map(p => ({ tokens: _washPlatesInText(p.text), squash: String(p.text || '').replace(/\D/g, '') }));

    for (let i = 0; i < pages.length; i++) {
      say(`<div style="font-size:13px;font-weight:800;color:var(--muted)">🔎 קורא עמוד ${i + 1} מתוך ${pages.length}…</div>`);
      prog(10 + 75 * i / pages.length, `קורא עמוד ${i + 1} מתוך ${pages.length}`);
      const p = pages[i];
      let hit = _washSnap(_washPlatesInText(p.text), known);
      if (hit) byText++;
      if (!hit) {
        // סריקה — הלוחית יושבת בחלק העליון של הפתק
        if (!worker) {
          worker = await Tesseract.createWorker('eng', 1);
          await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
        }
        let tokens = [];
        for (const [box, scale, psm] of [[{ x1: 1, y1: 0.5 }, 2, '6'], [{ x1: 1, y1: 0.5 }, 2, '11'], [{ x1: 1, y1: 1 }, 1.5, '6']]) {
          await worker.setParameters({ tessedit_pageseg_mode: psm });
          const prep = await _prepRegion(p.img, box, scale);
          const txt = (await worker.recognize(prep)).data.text;
          tokens = tokens.concat(_washPlatesInText(txt));
          seen[i].tokens = seen[i].tokens.concat(_washPlatesInText(txt));
          seen[i].squash += '|' + String(txt).replace(/\D/g, '');
          // המדרג הגס: כל מספר מהחשבון הפתוח שמופיע בתוך ספרות העמוד
          const squash = String(txt).replace(/\D/g, '');
          for (const k of known) if (squash.includes(k.plate)) tokens.push(k.plate);
          hit = _washSnap(tokens, known);
          if (hit) break;
        }
        if (hit) byOcr++;
      }
      if (hit) {
        // אותו מספר רישוי יכול להופיע בכמה פתקים (שטיפה חוזרת) — כל עמוד משויך לפתק אחר
        // כשיש לאותו רכב כמה פתקים — קודם אלה של החודש שהחשבונית מכסה
        const pref = window._washPrefer;
        const same = known.filter(k => k.plate === hit.plate).sort((x, y) => (pref ? (pref(y.n) ? 1 : 0) - (pref(x.n) ? 1 : 0) : 0));
        const free = same.find(k => !matched.has(k.id));
        if (free) matched.set(free.id, hit.plate);
        else repeats.push(i + 1);          // עמוד נוסף לרכב שכבר הוצלב במלואו
      } else unknown.push(i + 1);
    }
    /* מעבר שני לעמודים שלא זוהו: ההשוואה מתבצעת רק מול הפתקים שעדיין לא
       הוצלבו (מעט מאוד), ולכן אפשר להקל — טעות של עד שתי ספרות מתקבלת.
       אם עדיין לא — מנסים את העמוד הפוך ומסובב. */
    if (unknown.length) {
      if (!worker) {
        worker = await Tesseract.createWorker('eng', 1);
        await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
      }
      const deepList = [...unknown];
      for (const pg of deepList) {
        const i = pg - 1;
        prog(85 + 14 * deepList.indexOf(pg) / deepList.length, `בדיקה מעמיקה של עמוד ${pg}`);
        say(`<div style="font-size:13px;font-weight:800;color:var(--muted)">🔍 בדיקה מעמיקה של עמוד ${pg}…</div>`);
        const pool = () => known.filter(k => !matched.has(k.id));
        let hit = _washRelaxed(seen[i].tokens, seen[i].squash, pool());
        const tries = [[0, { y0: 0.05, y1: 0.5 }, 3, '6'], [0, { y0: 0.1, y1: 0.4 }, 3, '7'], [180, null, 1.5, '6'], [90, null, 1.5, '6'], [270, null, 1.5, '6'], [180, { y1: 0.5 }, 2, '6']];
        for (const [deg, box, scale, psm] of tries) {
          if (hit) break;
          try {
            const src = deg ? await _washRotate(pages[i].img, deg) : pages[i].img;
            await worker.setParameters({ tessedit_pageseg_mode: psm });
            const txt = (await worker.recognize(await _prepRegion(src, box || {}, scale))).data.text;
            seen[i].tokens = seen[i].tokens.concat(_washPlatesInText(txt));
            seen[i].squash += '|' + String(txt).replace(/\D/g, '');
            hit = _washRelaxed(seen[i].tokens, seen[i].squash, pool());
          } catch (e) { /* ממשיכים לניסיון הבא */ }
        }
        if (hit) { matched.set(hit.id, hit.plate); unknown.splice(unknown.indexOf(pg), 1); byOcr++; }
      }
    }
    if (worker) { try { await worker.terminate(); } catch (e) {} }
    prog(100, 'סיום');
    _washRec = { pages: pages.length, matched, unknown, repeats, byText, byOcr, imgs: pages.map(p => p.img) };
    say(`<div style="font-size:13px;font-weight:800;color:var(--muted)">✅ נקראו ${pages.length} עמודים · ${byText} משכבת הטקסט · ${byOcr} מזיהוי תווים</div>`);
    _washRenderReconcile();
  } catch (e) {
    if (worker) { try { await worker.terminate(); } catch (e2) {} }
    say('<div style="font-size:13px;font-weight:800;color:#991b1b">שגיאה בקריאת הקובץ</div>');
  }
}
window.washReconcileFiles = washReconcileFiles;

function _washRenderReconcile() {
  const box = document.getElementById('wash-rec-body');
  if (!box || !_washRec) return;
  const { rows } = _washSummaryData();
  const { matched, unknown, pages } = _washRec;
  const hit = rows.filter(n => matched.has(n.id));
  const miss = rows.filter(n => !matched.has(n.id));
  let sum = 0;
  for (const n of hit) sum += _WASH_PRICES[n.type] || 0;
  const vat = sum * _WASH_VAT;
  const card = (color, bg, border, title, n, note) => `
    <div style="background:${bg};border:2px solid ${border};border-radius:13px;padding:11px 13px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span style="font-weight:900;font-size:14px;color:${color}">${title}</span>
        <span style="font-weight:900;font-size:20px;color:${color}">${n}</span></div>
      <div style="font-size:12px;font-weight:700;color:${color};opacity:.85;margin-top:3px;line-height:1.5">${note}</div>
    </div>`;
  const list = arr => arr.length ? `<div style="max-height:190px;overflow-y:auto;margin-bottom:10px">` + arr.map(n => {
    const veh = [n.maker, n.model, n.year].filter(Boolean).join(' · ');
    return `<div style="border:1.5px solid var(--border);border-radius:10px;padding:6px 9px;margin-bottom:5px;background:var(--card);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="font-weight:900;font-size:13px;direction:ltr">${esc(n.plate || '')}</span>
      <span style="flex:1;min-width:80px;font-size:11.5px;color:var(--muted)">${esc(veh)}</span>
      <span style="font-size:11.5px;font-weight:800;background:var(--surface2);border-radius:999px;padding:2px 9px">${esc(n.type || '')}</span>
    </div>`;
  }).join('') + '</div>' : '';

  box.innerHTML =
    card('#166534', '#f0fdf4', '#86efac', '✅ חזרו והוצלבו', hit.length, `אלה הרכבים שתשלם עליהם — ${_washMoney(sum)} + מע״מ ${_washMoney(vat)} = <b>${_washMoney(sum + vat)}</b>`) +
    (miss.length ? card('#92400e', '#fffbeb', '#fcd34d', '⏭️ ברשימה אך לא חזרו', miss.length, 'יישארו בחשבון הפתוח וייכנסו לתשלום הבא') : '') +
    (unknown.length ? card('#991b1b', '#fef2f2', '#fca5a5', '❓ עמודים שלא זוהו', unknown.length, `עמודים ${unknown.join(', ')} — לא שויכו לאף רכב. בדוק אותם בסריקה ושייך ידנית, או שלם עליהם בפעם הבאה.`) : '') +
    (miss.length ? `<div style="font-size:12.5px;font-weight:800;color:var(--muted);margin:10px 0 5px">הרכבים שלא חזרו</div>` + list(miss) : '') +
    (hit.length
      ? `<button class="btn-submit" onclick="washPayMatched()" style="background:#0d9488;color:#fff;width:100%;margin-top:4px">💳 שלם על ${hit.length} הרכבים שחזרו</button>`
      : `<div style="text-align:center;color:var(--muted);font-size:13px;font-weight:700;padding:10px">אף רכב לא הוצלב — לא נמצאה התאמה בין הסריקה לחשבון הפתוח</div>`) +
    `<div style="font-size:11.5px;font-weight:700;color:var(--muted);text-align:center;margin-top:8px">${pages} עמודים בסריקה · ${rows.length} רכבים בחשבון הפתוח</div>`;
}

/* תשלום על המוצלבים בלבד — עובר דרך אותה חלונית אישור, כדי שלא תהיה
   דרך אחת לסגור תשלום עם אישור ואחת בלעדיו. */
function washPayMatched() {
  if (!_washRec || !_washRec.matched.size) return;
  const only = new Set(_washRec.matched.keys());
  closeModal('modal-wash-rec');
  washMarkPaid(only);
}
window.washPayMatched = washPayMatched;


/* ═══ פתק שטיפה בטלפון: לשוניות, אריחים וסרגל הדפסה ═══════════════════
   שכבת תצוגה בלבד: אותן פונקציות הוספה, הדפסה, שמירה ומחיקה. */
let _washmTab = 'new', _washmTimer = null;
const _washmPhone = () => window.innerWidth <= 900;

function _washmSetup() {
  const scr = document.getElementById('screen-wash');
  const body = document.getElementById('wash-form-body');
  if (!scr || !body) return;
  const phone = _washmPhone();
  scr.classList.toggle('washm-on', phone);
  if (!phone) {
    ['washm-tabs', 'washm-add', 'washm-saved', 'washm-bar'].forEach(id => document.getElementById(id)?.remove());
    clearInterval(_washmTimer); _washmTimer = null;
    return;
  }
  if (!document.getElementById('washm-tabs')) {
    const t = document.createElement('div');
    t.id = 'washm-tabs';
    t.innerHTML = `<span data-t="new" onclick="washmTab('new')">פתק חדש</span><span data-t="saved" onclick="washmTab('saved')">רכבים שמורים</span><span data-t="hist" onclick="washmTab('hist')">היסטוריה</span>`;
    body.prepend(t);
  }
  if (!document.getElementById('washm-add')) {
    const a = document.createElement('button');
    a.id = 'washm-add'; a.type = 'button';
    a.textContent = '＋ הוסף לרשימה להדפסה';
    a.onclick = () => washAddAnother();
    const note = document.getElementById('wash-note');
    note.insertAdjacentElement('afterend', a);
  }
  if (!document.getElementById('washm-saved')) {
    const sv = document.createElement('div');
    sv.id = 'washm-saved';
    sv.innerHTML = `<div class="washm-hint">רכבים שאתה שוטף הרבה. לחיצה על רכב מעבירה אותו ישר לפתק חדש.</div>
      <input class="form-input" id="washm-saved-search" placeholder="🔎 חפש מספר רישוי או דגם" oninput="_washRenderSaved()">
      <div id="washm-saved-list"></div>
      <button type="button" class="washm-addsaved" onclick="openWashSaved()">＋ הוסף רכב שמור</button>`;
    body.appendChild(sv);
  }
  if (!document.getElementById('washm-bar')) {
    const b = document.createElement('div');
    b.id = 'washm-bar';
    b.innerHTML = '<button type="button" onclick="washSaveAndPrint()"></button>';
    body.appendChild(b);
  }
  _washRenderSaved();
  washmTab(_washmTab === 'new' ? 'new' : _washmTab);
  clearInterval(_washmTimer);
  _washmTimer = setInterval(_washmSync, 500);
}
function washmTab(t) {
  _washmTab = t;
  const scr = document.getElementById('screen-wash');
  if (!scr) return;
  scr.dataset.washmTab = t;
  document.querySelectorAll('#washm-tabs span').forEach(e => e.classList.toggle('on', e.dataset.t === t));
  const body = document.getElementById('wash-form-body'); if (body) body.scrollTop = 0;
}
window.washmTab = washmTab;

// כמה פתקים יצאו בלחיצה על ההדפסה: מי שברשימה, ועוד הרכב שבטופס אם הוא מלא
function _washmSync() {
  const bar = document.querySelector('#washm-bar button');
  if (!bar) return;
  const plate = (document.getElementById('wash-plate')?.value || '').trim();
  const n = (_washBatch?.length || 0) + (plate && _washType ? 1 : 0);
  // שורת הסיכום של פרטי הרכב: דגם, שנה וצבע, ולחיצה עליה פותחת עריכה
  const tg = document.getElementById('wash-veh-toggle');
  if (tg) {
    const v = id => (document.getElementById(id)?.value || '').trim();
    const desc = [v('wash-maker'), v('wash-model'), v('wash-year'), v('wash-color')].filter(Boolean).join(' · ');
    const open = document.getElementById('wash-veh-fields')?.classList.contains('show');
    const t2 = `🚗 ${desc || 'פרטי הרכב'} ${open ? '▴' : '▾'}`;
    if (tg.textContent !== t2) tg.textContent = t2;
  }
  const txt = n ? `🖨️ הדפס ושמור · ${n === 1 ? 'פתק אחד' : n + ' פתקים'}` : '🖨️ הדפס ושמור';
  if (bar.textContent !== txt) bar.textContent = txt;
  bar.classList.toggle('idle', !n);
}
window.addEventListener('resize', () => { try { if (document.getElementById('screen-wash')) _washmSetup(); } catch (e) {} });


/* ═══ בדיקת חשבונית לפני תשלום ═════════════════════════════════════
   משווה שלושה מקורות: מה שהוצא (החשבון הפתוח), מה שחזר מהשטיפה
   (סריקת הפתקים, אופציונלי) ומה שהם מחייבים (החשבונית). החשבונית
   נקראת משכבת הטקסט של ה-PDF, ולכן צריך להעלות את הקובץ המקורי ולא
   צילום. התוצאה: תקין, או רשימת הפרשים עם הסכום שכל אחד מהם משנה.
   אינה משנה שום נתון — רק קוראת.                                   */
let _washChk = null;   // { inv, rec }

/* מצב הבדיקה נשמר במכשיר (IndexedDB), כך שרענון או סגירה של האתר באמצע
   לא מוחקים אותו: החשבונית שנקראה, הפתקים שנסרקו והשיוכים הידניים. */
const _wckOpen = () => new Promise((res, rej) => {
  const r = indexedDB.open('anak-wash-check', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('s');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function _wckSave() {
  try {
    const rec = _washRec && _washRec.matched ? { pages: _washRec.pages, matched: [..._washRec.matched.entries()], unknown: _washRec.unknown || [], repeats: _washRec.repeats || [], byText: _washRec.byText || 0, byOcr: _washRec.byOcr || 0, imgs: _washRec.imgs || [] } : null;
    const inv = _washChk && _washChk.inv ? _washChk.inv : null;
    const file = _washChk && _washChk.file ? _washChk.file : null;
    if (!inv && !rec) return _wckClear();
    const db = await _wckOpen();
    await new Promise((res, rej) => { const tx = db.transaction('s', 'readwrite'); tx.objectStore('s').put({ inv, file, rec, at: Date.now() }, 'cur'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  } catch (e) { console.warn('wash check save', e); }
}
async function _wckClear() {
  try {
    const db = await _wckOpen();
    await new Promise(res => { const tx = db.transaction('s', 'readwrite'); tx.objectStore('s').delete('cur'); tx.oncomplete = res; tx.onerror = res; });
    db.close();
  } catch (e) {}
}
async function _wckRestore() {
  try {
    const db = await _wckOpen();
    const st = await new Promise(res => { const r = db.transaction('s').objectStore('s').get('cur'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
    db.close();
    if (!st || Date.now() - (st.at || 0) > 30 * 86400000) return;
    if (st.inv) _washChk = { inv: st.inv, file: st.file || null };
    if (st.rec) _washRec = { ...st.rec, matched: new Map(st.rec.matched) };
  } catch (e) {}
}

async function openWashCheck() {
  if (currentUser?.role !== 'manager') return;
  if (!(_washChk && _washChk.inv) && !(_washRec && _washRec.matched)) await _wckRestore();
  const { total } = _washSummaryData();
  if (!total) return showToast('אין פתקים פתוחים לבדיקה');
  _washChkMsg = '';
  // תהליך שנעצר באמצע: מציעים להמשיך ממנו או להתחיל חדש
  _washChkAsk = !!(_washChk && _washChk.inv) || !!(_washRec && _washRec.matched);
  if (!_washChkAsk) { _washChk = null; _washRec = null; }
  _washChkRender();
  openModal('modal-wash-check');
}
window.openWashCheck = openWashCheck;

// סוג שטיפה לפי תיאור השורה בחשבונית ("פנימי +חיצוני" ← "חיצוני + פנימי")
function _washInvType(desc) {
  const d = String(desc || '');
  const out = d.includes('חיצוני'), inn = d.includes('פנימי');
  if (out && inn) return 'חיצוני + פנימי';
  if (out && d.includes('ידני')) return 'חיצוני ידני';
  if (out) return 'חיצוני';
  if (inn) return 'פנימי';
  return null;
}

const _washNum = s => { const m = String(s).replace(/,/g, '').match(/^-?\d+(\.\d+)?$/); return m ? parseFloat(m[0]) : null; };

/* החשבונית מכסה חודש שלם: הפתקים שנשלחו באותו חודש בלבד, גם אם התקבלה
   אחרי תחילת החודש הבא. החודש נלקח משורת "חודש 9/26"; אם היא חסרה —
   מתאריך החשבונית, ואם הוא בחצי הראשון של החודש, החודש הקודם. */
function _washInvPeriod(text) {
  let m = String(text).match(/חודש\s*(\d{1,2})\s*\/\s*(\d{2,4})/);
  if (m) { const y = +m[2] < 100 ? 2000 + +m[2] : +m[2]; return { month: +m[1], year: y }; }
  m = String(text).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  let mo = +m[2], y = +m[3];
  if (+m[1] <= 15) { mo--; if (!mo) { mo = 12; y--; } }
  return { month: mo, year: y };
}

async function _washParseInvoice(file) {
  if (!window.pdfjsLib) throw new Error('pdf.js not loaded');
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const items = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    for (const it of tc.items) if (String(it.str).trim()) items.push({ s: String(it.str).trim(), x: it.transform[4], y: it.transform[5] + (p - 1) * -2000 });
  }
  if (!items.length) return { noText: true };
  // שורות לפי גובה, בסובלנות קטנה, ובתוך שורה מימין לשמאל
  items.sort((a, b) => b.y - a.y);
  const rows = [];
  for (const it of items) {
    const r = rows.find(r => Math.abs(r.y - it.y) <= 4);
    if (r) r.items.push(it); else rows.push({ y: it.y, items: [it] });
  }
  rows.forEach(r => r.items.sort((a, b) => b.x - a.x));
  const txt = r => r.items.map(i => i.s).join(' ');
  const decimals = r => r.items.filter(i => /^-?[\d,]+\.\d{2}$/.test(i.s));
  const lines = [];
  for (const r of rows) {
    const nums = decimals(r);
    if (nums.length < 3) continue;
    const desc = r.items.filter(i => !/^-?[\d,]+(\.\d+)?$/.test(i.s) && i.s !== '#').map(i => i.s).join(' ').trim();
    if (!desc) continue;
    // סדר העמודות מימין לשמאל: כמות, ליחידה, סה"כ
    const n = nums.slice(-3).map(i => _washNum(i.s));
    lines.push({ desc, qty: n[0], unit: n[1], total: n[2], type: _washInvType(desc) });
  }
  // סיכומים: הערך הוא המספר השמאלי ביותר בשורה (עמודת הסכומים)
  const leftmost = r => {
    const c = r.items.filter(i => /^-?[\d,]+\.\d{2}$/.test(i.s));
    return c.length ? _washNum(c.sort((a, b) => a.x - b.x)[0].s) : null;
  };
  const pick = re => { const r = rows.find(r => re.test(txt(r))); return r ? leftmost(r) : null; };
  const all = rows.map(txt).join('\n');
  return {
    lines,
    beforeVat: pick(/סה"כ ללא מע"מ/), discount: pick(/הנחה/), afterDiscount: pick(/לאחר הנחה/),
    vat: pick(/מע"מ\s*[\d.]+%|[\d.]+%\s*מע"מ/), grand: pick(/סה"כ לתשלום/),
    number: (all.match(/\d{2}\/\d{4,7}/) || [''])[0], date: (all.match(/\d{2}\/\d{2}\/\d{4}/) || [''])[0],
    period: _washInvPeriod(all),
  };
}

let _washChkMsg = '', _washChkAsk = false;
function _washChkProgress(pct, label) {
  const b = document.getElementById('wash-chk-body'); if (!b) return;
  pct = Math.max(0, Math.min(100, Math.round(pct)));
  b.innerHTML = `<div class="wchk-wrap" style="text-align:center;padding:26px 6px">
    <div style="font-size:15px;font-weight:900;margin-bottom:12px">📂 קורא את הפתקים</div>
    <div style="height:16px;border-radius:999px;background:var(--surface2);overflow:hidden">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#6366f1,#0ea5e9);border-radius:999px;transition:width .25s"></div></div>
    <div style="font-size:30px;font-weight:900;color:#0ea5e9;margin-top:10px">${pct}%</div>
    <div style="font-size:12.5px;font-weight:700;color:var(--muted);margin-top:4px">${esc(label || '')}</div></div>`;
}
const _washChkBusy = t => { const b = document.getElementById('wash-chk-body'); if (b) b.innerHTML = `<div style="text-align:center;padding:30px 10px;font-size:14px;font-weight:800;color:var(--muted)">⏳ ${t}</div>`; };

async function washCheckInvoice(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  _washChkBusy('קורא את החשבונית…');
  _washChkMsg = '';
  try {
    const inv = await _washParseInvoice(f);
    const fileData = await _fileToDataUrl(f);
    if (inv.noText || !inv.lines || !inv.lines.length) { _washChk = null; _washChkMsg = 'לא הצלחתי לקרוא את החשבונית. יש להעלות את קובץ ה-PDF המקורי שהתקבל מהשטיפה (לא צילום או סריקה).'; }
    else _washChk = { inv, file: { name: f.name || 'חשבונית.pdf', mime: f.type || 'application/pdf', data: fileData } };
  } catch (e) { console.error(e); _washChk = null; _washChkMsg = 'לא הצלחתי לקרוא את הקובץ. נסה שוב עם ה-PDF המקורי.'; }
  _wckSave();
  _washChkRender();
}
window.washCheckInvoice = washCheckInvoice;

// סריקת הפתקים שחזרו — אותה הצלבה שכבר קיימת
async function washCheckScan(input) {
  if (!(input.files && input.files.length)) return;
  _washChkProgress(0, 'מתחיל…');
  window._washProg = _washChkProgress;
  _washChkMsg = '';
  _washRec = null;
  const per = _washChk && _washChk.inv && _washChk.inv.period;
  window._washPrefer = per ? (n => { const d = n.createdAt?.toDate ? n.createdAt.toDate() : null; return !!d && d.getMonth() + 1 === per.month && d.getFullYear() === per.year; }) : null;
  try { await washReconcileFiles(input); } catch (e) { console.error(e); }
  window._washProg = null;
  if (!_washRec || !_washRec.matched) _washChkMsg = 'לא הצלחתי לקרוא את הפתקים. נסה שוב.';
  _wckSave();
  _washChkRender();
}
window.washCheckScan = washCheckScan;

// גרירת קובץ לשטח ההעלאה (במחשב)
function _washChkDrop(ev, label) {
  ev.preventDefault();
  const inp = label.querySelector('input[type=file]');
  if (!inp || !ev.dataTransfer || !ev.dataTransfer.files.length) return;
  inp.files = ev.dataTransfer.files;
  inp.dispatchEvent(new Event('change'));
}
window._washChkDrop = _washChkDrop;

// שיוך ידני של עמוד שלא זוהה לפתק שהוצא ולא הוצלב
function washCheckAssign(pg, noteId) {
  if (!noteId || !_washRec) return;
  if (noteId !== '-') {
    const n = _washSummaryData().rows.find(r => r.id === noteId);
    if (n) _washRec.matched.set(noteId, _normPlate(n.plate));
  }
  _washRec.unknown = (_washRec.unknown || []).filter(x => x !== pg);
  _wckSave();
  _washChkRender();
}
window.washCheckAssign = washCheckAssign;

function washCheckResume() { _washChkAsk = false; _washChkRender(); }
function washCheckRestart() { _washChk = null; _washRec = null; _washChkMsg = ''; _washChkAsk = false; _wckClear(); _washChkRender(); }
window.washCheckResume = washCheckResume; window.washCheckRestart = washCheckRestart;

function washCheckBack() {
  if (_washRec) _washRec = null; else _washChk = null;
  _washChkMsg = '';
  _wckSave();
  _washChkRender();
}
window.washCheckBack = washCheckBack;

function _washChkRound(n) { return Math.round(n * 100) / 100; }

function _washChkAnalyze() {
  const inv = _washChk.inv, ours0 = _washSummaryData(), rec = _washRec;
  const m = _washMoney, R = _washChkRound;
  // רק פתקים שנשלחו בחודש שהחשבונית מכסה
  const per = inv.period;
  const inPer = n => { if (!per) return true; const d = n.createdAt?.toDate ? n.createdAt.toDate() : null; return !!d && d.getMonth() + 1 === per.month && d.getFullYear() === per.year; };
  const ours = { ...ours0, rows: ours0.rows.filter(inPer) };
  const outside = ours0.rows.filter(n => !inPer(n));
  const outsideRet = outside.filter(n => rec.matched.has(n.id));
  const ret = ours.rows.filter(n => rec.matched.has(n.id));
  const notRet = ours.rows.filter(n => !rec.matched.has(n.id));
  const invBy = {}, extras = [];
  for (const l of inv.lines) {
    if (l.type) { const b = invBy[l.type] || (invBy[l.type] = { qty: 0, total: 0, units: new Set() }); b.qty += l.qty; b.total += l.total; b.units.add(l.unit); }
    else extras.push(l);
  }
  // המחיר ליחידה לכל סוג נלקח מהחשבונית עצמה (המחירים של השטיפה קבועים), ורק סוג שאינו בחשבונית מתומחר במחירון
  const priceOf = t => (invBy[t] && invBy[t].units.size ? [...invBy[t].units][0] : _WASH_PRICES[t]) || 0;
  const errors = [], warns = [], details = [], rows = [], dbl = [];
  /* פתק כפול = אותו רכב ואותו סוג בטווח של יומיים (שטיפה חוזרת אחרי שבוע
     היא רגילה). זו בעיה רק אם החשבונית אכן חייבה על שניהם: כשיש יותר שורות
     מהרכבים הייחודיים. פתק כפול שלא חויב פעמיים — מתעלמים. */
  // כפילות נבחנת רק בין הפתקים שחזרו מהשטיפה: כפילות במערכת בלבד אינה כפילות
  const byKey = {};
  for (const n of ret) {
    const d = n.createdAt?.toDate ? n.createdAt.toDate().getTime() : null;
    if (d == null) continue;
    (byKey[_normPlate(n.plate) + '|' + (n.type || '')] = byKey[_normPlate(n.plate) + '|' + (n.type || '')] || []).push({ n, d });
  }
  const dupExtra = {}, dupPlates = {}, dupNotes = {}, dupInfo = {}, skipIds = new Set();
  for (const k of Object.keys(byKey)) {
    const arr = byKey[k].sort((x, y) => x.d - y.d);
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].d - arr[i - 1].d <= 2 * 86400000) {
        const t = arr[i].n.type || '';
        dupExtra[t] = (dupExtra[t] || 0) + 1;
        (dupPlates[t] = dupPlates[t] || []).push(`${arr[i].n.plate} (${arr[i - 1].n.createdBy || ''} / ${arr[i].n.createdBy || ''})`);
        (dupNotes[t] = dupNotes[t] || []).push(arr[i].n);
        (dupInfo[t] = dupInfo[t] || []).push({ plate: arr[i].n.plate, by1: arr[i - 1].n.createdBy || '', by2: arr[i].n.createdBy || '', gap: arr[i].d - arr[i - 1].d });
      }
    }
  }
  for (const t of Object.keys(dupExtra)) {
    const ourN = ret.filter(n => (n.type || '') === t).length;
    const unique = ourN - dupExtra[t];
    const billedTwice = Math.min(dupExtra[t], Math.max(0, (invBy[t] ? invBy[t].qty : 0) - unique));
    // פתקים כפולים שלא חויבו פעמיים: לא נכללים בתשלום, כדי שיתאים לחשבונית
    for (const dn of (dupNotes[t] || []).slice(0, dupExtra[t] - billedTwice)) skipIds.add(dn.id);
    if (billedTwice > 0) {
      const price = priceOf(t);
      errors.push(`חיוב כפול אפשרי — ${t}: ${billedTwice} רכבים חויבו פעמיים (בערך ${m(billedTwice * price)} + מע״מ)`);
      details.push(`${t} — פתקים כפולים שהתקבלו מהשטיפה (עד יומיים): ${dupPlates[t].join(', ')}`);
      dbl.push(...(dupInfo[t] || []).slice(0, billedTwice).map(x => ({ ...x, type: t, price: priceOf(t) })));
    }
  }
  const retC = {};
  for (const n of ret) { if (skipIds.has(n.id)) continue; const t = n.type || 'ללא סוג'; retC[t] = (retC[t] || 0) + 1; }
  const types = [..._WASH_TYPES];
  for (const t of Object.keys(retC)) if (!types.includes(t)) types.push(t);
  let over = 0, overMoney = 0;
  const underBy = {};
  for (const t of types) {
    const r = retC[t] || 0, b = invBy[t], q = b ? b.qty : 0, price = priceOf(t);
    if (!r && !q) continue;
    const diff = q - r;
    const out = ours.rows.filter(n => (n.type || '') === t && !skipIds.has(n.id)).length;
    rows.push({ type: t, out, ret: r, inv: q, diff, sysDiff: out - r });
    if (diff > 0) {
      over += diff; overMoney += diff * (price || 0);
      const miss = notRet.filter(n => (n.type || '') === t).map(n => n.plate);
      if (miss.length) details.push(`${t} — הוצאו ולא חזרו: ${miss.join(', ')}`);
    } else if (diff < 0) underBy[t] = -diff;
    if (b) {
      if (R(b.total) !== R(b.qty * [...b.units][0])) errors.push(`${t}: הסכום בשורה לא שווה לכמות כפול מחיר`);
    }
  }
  if (over) errors.unshift(`חויבת על ${over} רכבים יותר ממה שקיבלת פתקים (בערך ${m(overMoney)} + מע״מ)`);
  // פריטים שאינם שטיפה (מגבים וכו') מתעלמים מהם לגמרי — בודקים רכבים בלבד
  const extraSum = 0;
  const expSub = R(types.reduce((s, t) => s + (retC[t] || 0) * priceOf(t), 0));
  const gotSub = R(Object.keys(invBy).reduce((s, t) => s + invBy[t].total, 0));
  if (rec.unknown && rec.unknown.length) warns.push(`${rec.unknown.length} עמודים בסריקה לא זוהו — הרכבים שלהם לא נספרו`);
  const totOut = rows.reduce((x, r) => x + r.out, 0), totRet = rows.reduce((x, r) => x + r.ret, 0), totInv = rows.reduce((x, r) => x + r.inv, 0);
  if (totOut > totRet) warns.push(`במערכת הוצאו ${totOut} פתקים, והתקבלו מהשטיפה ${totRet} — ${totOut - totRet} פתקים לא התקבלו`);
  else if (totRet > totOut) warns.push(`התקבלו ${totRet} פתקים, ובמערכת הוצאו ${totOut} — ${totRet - totOut} פתקים שאינם במערכת`);
  let under = 0;
  for (const t of Object.keys(underBy)) under += underBy[t];
  if (skipIds.size) details.push(`${skipIds.size} פתקים כפולים (עד יומיים) שלא חויבו פעמיים — לא נכללים בתשלום ונשארים בחשבון הפתוח; אפשר למחוק אותם מההיסטוריה`);
  if (notRet.length) details.push(`הוצאו בחודש ולא חזרו (נשארים בחשבון הפתוח): ${notRet.map(n => n.plate || `(ללא מספר · ${n.type || ''})`).join(', ')}`);
  if (outsideRet.length) warns.push(`${outsideRet.length} פתקים שחזרו הם מחוץ לחודש החשבונית — לא ייכללו בתשלום`);
  // התאמת סכום: מה שחויב בשורות השטיפה מול הפתקים שהתקבלו כפול המחירון
  const moneyDiff = R(gotSub - expSub);
  if (moneyDiff > 0 && !errors.length) errors.push(`הסכום בחשבונית (${m(gotSub)}) גבוה ב-${m(moneyDiff)} מהסכום לפי הפתקים (${m(expSub)}), לפני מע״מ`);
  const verdict = errors.length ? 'bad' : ((rec.unknown && rec.unknown.length) ? 'warn' : 'ok');
  return { errors, warns, details, rows, verdict, inv, expSub, gotSub, extraSum, notRet: notRet.length, retN: ret.length, moneyDiff, dbl, tot: { out: totOut, ret: totRet, inv: totInv }, notRetList: notRet.map(n => ({ id: n.id, plate: n.plate || '', type: n.type || '', d: n.createdAt?.toDate ? n.createdAt.toDate() : null, by: n.createdBy || '' })), scan: { pages: rec.pages, matched: rec.matched.size, outside: outsideRet.length, skipped: skipIds.size, unknown: rec.unknown || [], repeats: rec.repeats || [] }, retIds: ret.filter(n => !skipIds.has(n.id)).map(n => n.id), per, monthN: ours.rows.length };
}

function _washChkRender() {
  const box = document.getElementById('wash-chk-body'), stepsEl = document.getElementById('wash-chk-steps');
  if (!box) return;
  const hasInv = !!(_washChk && _washChk.inv), hasScan = !!(_washRec && _washRec.matched);
  const step = !hasInv ? 1 : !hasScan ? 2 : 3;
  const names = ['החשבונית', 'הפתקים', 'בדיקה', 'תשלום'];
  if (stepsEl) stepsEl.innerHTML = names.map((n, i) => {
    const on = i + 1 === step, done = i + 1 < step;
    return `<div style="flex:1;text-align:center;padding:8px 4px;border-radius:11px;font-size:12.5px;font-weight:900;background:${on ? '#0ea5e9' : done ? '#dcfce7' : 'var(--surface2)'};color:${on ? '#fff' : done ? '#166534' : 'var(--muted)'}">${done ? '✓' : i + 1} ${n}</div>`;
  }).join('');
  if (_washChkAsk) {
    const i = _washChk && _washChk.inv;
    const per = i && i.period ? ` · חודש ${String(i.period.month).padStart(2, '0')}/${i.period.year}` : '';
    const where = hasScan ? 'הועלו חשבונית ופתקים, ומחכה התוצאה' : hasInv ? 'הועלתה החשבונית, חסרים הפתקים' : 'לא הועלה כלום';
    box.innerHTML = `<div class="wchk-wrap"><div style="font-size:15px;font-weight:900;text-align:center;margin-bottom:6px">יש בדיקה שלא הסתיימה</div>
      <div style="font-size:13px;font-weight:700;color:var(--muted);text-align:center;line-height:1.6;margin-bottom:16px">${i ? 'חשבונית ' + esc(i.number || '') + per + '<br>' : ''}${where}</div>
      <button class="btn-submit" onclick="washCheckResume()" style="background:#0ea5e9;color:#fff;margin:0 0 10px;width:100%;font-size:17px;padding:16px 8px">▶️ המשך מאיפה שעצרתי</button>
      <button class="btn-submit" onclick="washCheckRestart()" style="background:var(--surface2);color:var(--text);margin:0;width:100%;font-size:16px;padding:14px 8px">🔄 התחל תהליך חדש</button></div>`;
    return;
  }
  const err = _washChkMsg ? `<div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:10px 13px;font-size:13px;font-weight:800;color:#991b1b;margin-bottom:12px;line-height:1.6">${esc(_washChkMsg)}</div>` : '';
  const big = (color, label, handler, accept, multi) => `<label class="btn-submit wchk-drop" style="background:${color};color:#fff;margin:0;width:100%;text-align:center;cursor:pointer;display:block;font-size:17px;padding:18px 8px"
      ondragover="event.preventDefault()" ondrop="_washChkDrop(event,this)">${label}
      <input type="file" accept="${accept}" ${multi ? 'multiple' : ''} onchange="${handler}(this)" style="display:none"><br><span style="font-size:12px;font-weight:700;opacity:.85">או גרור לכאן את הקובץ</span></label>`;
  const back = `<button class="btn-submit" onclick="washCheckBack()" style="background:var(--surface2);color:var(--text);margin:10px 0 0;width:100%">→ חזרה</button>`;
  if (step === 1) {
    box.innerHTML = '<div class="wchk-wrap">' + err + `<div style="font-size:14px;font-weight:800;color:var(--text);line-height:1.6;margin-bottom:14px;text-align:center">שלב ראשון: העלה את החשבונית שקיבלת מהשטיפה<br><span style="font-size:12.5px;color:var(--muted);font-weight:700">קובץ ה-PDF המקורי</span></div>` +
      big('#0ea5e9', '📄 בחר את החשבונית', 'washCheckInvoice', 'application/pdf', false) + '</div>';
    return;
  }
  const inv = _washChk.inv;
  if (step === 2) {
    box.innerHTML = '<div class="wchk-wrap">' + err + `<div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:10px 13px;font-size:13px;font-weight:800;color:#166534;margin-bottom:14px">✅ החשבונית נקראה${inv.number ? ' · ' + esc(inv.number) : ''} · ${_washMoney(inv.grand || 0)} כולל מע״מ</div>` +
      `<div style="font-size:14px;font-weight:800;color:var(--text);line-height:1.6;margin-bottom:14px;text-align:center">שלב שני: העלה את הפתקים שקיבלת מהשטיפה<br><span style="font-size:12.5px;color:var(--muted);font-weight:700">קובץ PDF אחד או כמה תמונות — כל עמוד הוא פתק</span></div>` +
      big('#6366f1', '📂 בחר את הפתקים', 'washCheckScan', 'application/pdf,image/*', true) + back + '</div>';
    return;
  }
  // שלב 3 — התוצאה, בקצרה
  const a = _washChkAnalyze();
  const m = _washMoney;
  const overRows = a.rows.filter(r => r.diff > 0);
  const overN0 = overRows.reduce((x, r) => x + r.diff, 0);
  const head = {
    ok:   ['#166534', '#f0fdf4', '#86efac', '✅ תקין', 'החשבונית לא חייבה אותך על יותר ממה שקיבלת פתקים.'],
    warn: ['#92400e', '#fffbeb', '#fcd34d', '⚠️ יש עמודים שלא זוהו', 'שייך אותם לרכב כדי לקבל תוצאה מדויקת.'],
    bad:  ['#991b1b', '#fef2f2', '#fca5a5', '❌ לא תקין', overN0 ? `חויבת על ${overN0} רכבים יותר ממה שקיבלת פתקים.` : a.dbl.length ? `ייתכן חיוב כפול על ${a.dbl.length === 1 ? 'רכב אחד' : a.dbl.length + ' רכבים'}.` : 'יש הפרש — ראה בפירוט.'],
  }[a.verdict];
  const th = 'padding:6px 8px;font-size:12px;font-weight:800;color:var(--muted);text-align:center';
  const td = 'padding:8px;font-size:14px;font-weight:900;text-align:center;border-top:1px solid var(--border)';
  const sg = n => (n > 0 ? '+' : '') + n;
  const table = `<table style="width:100%;border-collapse:collapse;background:var(--card);border:2px solid var(--border);border-radius:12px;overflow:hidden;margin:10px 0">
    <tr style="background:var(--surface2)"><td style="${th};text-align:right">סוג</td><td style="${th}">במערכת</td><td style="${th}">פתקים</td><td style="${th}">חשבונית</td><td style="${th}">מצב</td></tr>
    ${a.rows.map(r => {
      const parts = [];
      if (r.diff > 0) parts.push(`חויבת על ${r.diff} יותר`);
      if (r.sysDiff) parts.push(`במערכת ${Math.abs(r.sysDiff)} ${r.sysDiff > 0 ? 'יותר' : 'פחות'}`);
      return `<tr><td style="${td};text-align:right">${esc(r.type)}</td><td style="${td}">${r.out}</td><td style="${td}">${r.ret}</td><td style="${td}">${r.inv}</td><td style="${td};font-size:12px;color:${parts.length ? '#dc2626' : '#16a34a'}">${parts.length ? parts.join('<br>') : '✓'}</td></tr>`;
    }).join('')}
    <tr style="background:var(--surface2)"><td style="${td};text-align:right">סה״כ</td><td style="${td}">${a.tot.out}</td><td style="${td}">${a.tot.ret}</td><td style="${td}">${a.tot.inv}</td><td style="${td}"></td></tr>
  </table>`;
  const legend = '<div style="font-size:11.5px;font-weight:700;color:var(--muted);margin:-4px 0 8px">ההשוואה היא מול עמודת "פתקים" — מה שהתקבל מהשטיפה.</div>';
  const chk = (ok, text) => `<div style="display:flex;align-items:center;gap:8px;background:${ok ? '#f0fdf4' : '#fef2f2'};border:2px solid ${ok ? '#86efac' : '#fca5a5'};border-radius:11px;padding:9px 12px;margin-bottom:6px;font-size:13.5px;font-weight:900;color:${ok ? '#166534' : '#991b1b'}">
      <span style="font-size:18px">${ok ? '✅' : '❌'}</span><span>${text}</span></div>`;
  const invOk = a.rows.every(r => r.diff <= 0);
  const overN = a.rows.reduce((x, r) => x + Math.max(0, r.diff), 0);
  const checks = chk(invOk,
      invOk ? `החשבונית לא חייבה יותר מהפתקים שהתקבלו (${a.tot.inv} מתוך ${a.tot.ret})` : `חויבת על ${overN} רכבים יותר מהפתקים שהתקבלו`) +
    chk(a.tot.out === a.tot.ret && a.rows.every(r => !r.sysDiff),
      a.tot.out === a.tot.ret && a.rows.every(r => !r.sysDiff) ? `הפתקים שהתקבלו זהים למה שהוצא במערכת (${a.tot.ret})` : `הפתקים שהתקבלו (${a.tot.ret}) לא זהים למה שהוצא במערכת (${a.tot.out})`);
  const bullets = arr => arr.length ? arr.map(x => `<div style="font-size:13px;font-weight:800;color:#b91c1c;margin:5px 0;line-height:1.5">• ${esc(x)}</div>`).join('') : '';
  const warnB = arr => arr.length ? arr.map(x => `<div style="font-size:13px;font-weight:800;color:#b45309;margin:5px 0;line-height:1.5">• ${esc(x)}</div>`).join('') : '';
  const diffMoney = a.gotSub != null ? _washChkRound(a.gotSub - a.expSub) : null;
  const sc = a.scan;
  const scanLine = `<div style="background:var(--surface2);border-radius:11px;padding:9px 13px;margin:8px 0;font-size:12.5px;font-weight:800;color:var(--muted);line-height:1.7">
    📂 נסרקו ${sc.pages} עמודים: ${a.retN + sc.skipped} של החודש${sc.skipped ? ` (מהם ${sc.skipped} כפולים שלא חויבו, לא נכללו)` : ''}${sc.outside ? ` · ${sc.outside} של חודש אחר` : ''}${sc.repeats.length ? ` · ${sc.repeats.length} עמודים נוספים לרכב שכבר הוצלב` : ''}${sc.unknown.length ? ` · <span style="color:#dc2626">${sc.unknown.length} לא זוהו</span>` : ''}</div>` ;
  const dstr = d => d ? d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : '';
  const assign = sc.unknown.length ? `<div style="margin:6px 0 10px">` + sc.unknown.map(pg => {
    const img = (_washRec.imgs || [])[pg - 1];
    return `<div style="display:flex;align-items:center;gap:10px;border:2px solid #fca5a5;border-radius:12px;padding:8px 10px;margin-bottom:6px;background:var(--card)">
      ${img ? `<img src="${img}" onclick="openLightbox(this.src)" style="width:64px;height:84px;object-fit:cover;object-position:top;border-radius:7px;border:1px solid var(--border);cursor:zoom-in;flex-shrink:0">` : ''}
      <div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:900;margin-bottom:5px">עמוד ${pg} — לאיזה רכב הפתק?</div>
      <select onchange="washCheckAssign(${pg}, this.value)" style="width:100%;padding:8px;border-radius:9px;border:2px solid var(--border);font-family:inherit;font-size:13px;font-weight:700">
        <option value="">בחר רכב…</option>
        ${a.notRetList.map(n => `<option value="${esc(n.id)}">${esc(n.plate || '(ללא מספר)')} · ${esc(n.type)} · ${dstr(n.d)} · ${esc(n.by)}</option>`).join('')}
        <option value="-">לא שייך לחשבון (התעלם)</option>
      </select></div></div>`;
  }).join('') + `</div>` : '';
  const sums = `<div style="display:flex;justify-content:space-between;gap:8px;background:var(--surface2);border-radius:11px;padding:10px 13px;margin:8px 0;font-size:13px;font-weight:800;flex-wrap:wrap">
    <span>לפי הפתקים: ${m(a.expSub)}</span><span>בחשבונית: ${a.gotSub != null ? m(a.gotSub) : '—'}</span>
    <span style="color:${diffMoney > 0 ? '#dc2626' : '#16a34a'}">${diffMoney == null ? '' : diffMoney > 0 ? 'חויבת ב-' + m(diffMoney) + ' יותר' : diffMoney < 0 ? 'החשבונית נמוכה ב-' + m(-diffMoney) : 'ללא הפרש'}</span></div>`;
  const det = a.details.length ? `<details style="margin:8px 0;font-size:12.5px;font-weight:700;color:var(--muted)"><summary style="cursor:pointer;font-weight:900">פירוט רכבים</summary>${
    a.details.map(x => `<div style="margin-top:6px;line-height:1.6">${esc(x)}</div>`).join('')}</details>` : '';
  const payAnyway = a.verdict === 'bad' ? `<button class="btn-submit" onclick="washCheckPay()" style="background:#fff;color:#0d9488;border:2px solid #0d9488;width:100%;margin-top:12px;font-size:16px;padding:14px 8px">💳 המשך לתשלום בכל זאת (${a.retN} רכבים)</button>` : '';
  const pay = a.verdict !== 'bad'
    ? `<button class="btn-submit" onclick="washCheckPay()" style="background:#0d9488;color:#fff;width:100%;margin-top:12px;font-size:17px;padding:16px 8px">💳 סגור את התשלום (${a.retN} רכבים)</button>`
    : '';
  const monthLine = a.per ? `<div style="font-size:12.5px;font-weight:800;color:var(--muted);margin-bottom:8px">חשבונית לחודש ${String(a.per.month).padStart(2, '0')}/${a.per.year} · ${a.monthN} פתקים נשלחו בחודש</div>` : '';
  const moneyLine = `<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;background:var(--surface2);border-radius:11px;padding:10px 13px;margin:10px 0 0;font-size:13px;font-weight:800">
    <span>לפי הפתקים: ${m(a.expSub)}</span><span>בחשבונית: ${m(a.gotSub)}</span>
    <span style="color:${a.moneyDiff > 0 ? '#dc2626' : '#16a34a'}">${a.moneyDiff > 0 ? 'חויבת ב-' + m(a.moneyDiff) + ' יותר' : a.moneyDiff < 0 ? 'החשבונית נמוכה ב-' + m(-a.moneyDiff) : '✓ הסכום תואם'}</span></div>
    <div style="font-size:11.5px;font-weight:700;color:var(--muted);margin:3px 2px 0">סכומי שטיפות בלבד, לפני מע״מ.</div>`;
  const overTxt = overRows.length ? `<div style="font-size:14px;font-weight:900;color:#b91c1c;margin:10px 2px;line-height:1.7">${overRows.map(r => `${esc(r.type)}: חויבת על ${r.diff} יותר`).join('<br>')}${diffMoney > 0 ? `<br>בערך ${m(diffMoney)} + מע״מ` : ''}</div>` : '';
  const gapTxt = ms => ms < 3600000 ? `${Math.max(1, Math.round(ms / 60000))} דקות` : ms < 86400000 * 1.5 ? `${Math.round(ms / 3600000)} שעות` : `${Math.round(ms / 86400000)} ימים`;
  const dblCars = a.dbl.length ? `<div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:10px 13px;margin:8px 0">
    <div style="font-size:13px;font-weight:900;color:#991b1b;margin-bottom:6px">🚗 רכבים שייתכן שחויבו פעמיים (בערך ${m(a.dbl.reduce((x, d) => x + (d.price || 0), 0))} + מע״מ):</div>` +
    a.dbl.map(x => `<div style="font-size:14px;font-weight:900;margin:4px 0;color:#111">${esc(_washPlateFmt(x.plate) || '(ללא מספר)')} <span style="font-size:12px;font-weight:700;color:var(--muted)">· ${esc(x.type)} · פתק של ${esc(x.by1)}${x.by2 && x.by2 !== x.by1 ? ' ו' + esc(x.by2) : ' פעמיים'} בהפרש ${gapTxt(x.gap)}</span></div>`).join('') + `</div>` : '';
  const dblTxt = a.errors.filter(e => e.startsWith('מחיר')).map(e => `<div style="font-size:13px;font-weight:800;color:#b91c1c;margin:5px 2px;line-height:1.5">• ${esc(e)}</div>`).join('');
  box.innerHTML = '<div class="wchk-wrap">' + monthLine + `<div style="background:${head[1]};border:2px solid ${head[2]};border-radius:14px;padding:12px 15px">
      <div style="font-weight:900;font-size:22px;color:${head[0]}">${head[3]}</div>
      <div style="font-size:13px;font-weight:700;color:${head[0]};margin-top:2px">${head[4]}</div></div>` +
    moneyLine + overTxt + dblCars + dblTxt + assign + pay + payAnyway +
    `<details style="margin-top:14px"><summary style="cursor:pointer;font-size:13px;font-weight:900;color:var(--muted)">פירוט</summary><div style="margin-top:8px">` +
    '<div>' + checks + '</div>' + table + legend + scanLine + sums + bullets(a.errors) + warnB(a.warns) + det + `</div></details>` + back + '</div>';
}

// ממשיך לאותה חלונית אישור תשלום: רק מי שחזר אם הועלתה סריקה, אחרת הכל
function washCheckPay() {
  closeModal('modal-wash-check');
  // משלמים על מה שחזר ואושר בבדיקה; מה שלא חזר נשאר בחשבון הפתוח
  let ids = null;
  try { if (_washChk && _washChk.inv && _washRec && _washRec.matched) ids = new Set(_washChkAnalyze().retIds); } catch (e) {}
  _washPayRest = [];
  _washPayInv = _washChk && _washChk.inv ? _washChk.inv : null;
  _washPayFile = _washChk && _washChk.file ? _washChk.file : null;
  try {
    const per = _washChk && _washChk.inv && _washChk.inv.period;
    if (per) {
      const key = `${per.year}-${String(per.month).padStart(2, '0')}`;
      const sel = ids && ids.size ? ids : null;
      _washPayRest = _washSummaryData().rows.filter(n => _washMonthKey(n) === key && (!sel || !sel.has(n.id)));
    }
  } catch (e) { _washPayRest = []; }
  washMarkPaid(ids && ids.size ? ids : null);
}
window.washCheckPay = washCheckPay;
