/* מסך הבית, מונים, יומן וסיפור היום
   חלק 2 מתוך 13 של אפליקציית התפעול.
   הקבצים נטענים לפי הסדר ומתנהגים בדיוק כמו קובץ אחד — אין לשנות את הסדר. */
const _todayKey = () => new Date().toLocaleDateString('sv-SE');
let _dailyRecall = null;      // { day, open }
let _dailyInv = null;         // { day, open }
let _dailyInvMark = null;     // { day, missing } — נשמר בנפרד ושורד מחיקה

function _dailyChecksListen() {
  if (window._dailyUnsub) return;
  window._dailyUnsub = true;
  // ריקול: מתי רצה הסריקה האחרונה וכמה ריקולים פתוחים
  _onSnap(_docRef('recall_status', 'current'), snap => {
    const d = snap.exists() ? snap.data() : null;
    const at = d?.updatedAt?.toDate ? d.updatedAt.toDate() : null;
    _dailyRecall = { day: at ? at.toLocaleDateString('sv-SE') : '', open: (d?.cars || []).filter(c => !c.resolved).length };
    _syncAllScreensCount();
  }, () => {});
  // מלאי: בדיקה שהושלמה היום, וכמה עדיין ממתינות
  _onSnap(_colRef('inventory_assignments'), snap => {
    let doneToday = false, open = 0;
    snap.docs.forEach(x => {
      const v = x.data();
      if (v.status !== 'done') { open++; return; }
      const at = v.completedAt?.toDate ? v.completedAt.toDate() : null;
      if (at && at.toLocaleDateString('sv-SE') === _todayKey()) doneToday = true;
    });
    _dailyInv = { day: doneToday ? _todayKey() : '', open };
    _syncAllScreensCount();
  }, () => {});
  // הסימון שהנהג רושם בשליחה — נשאר גם אחרי שהבדיקה נמחקת
  _onSnap(_docRef('config', 'daily_checks'), snap => {
    const d = snap.exists() ? snap.data() : null;
    _dailyInvMark = d?.invDay ? { day: d.invDay, missing: d.invMissing || 0 } : null;
    _syncAllScreensCount();
  }, () => {});
}

// הטקסט שמופיע מתחת לשם הפריט
function _dailyNote(id) {
  const today = _todayKey();
  if (id === 'menu-card-ownership') {
    // ההשוואה לתאריך הקלנדרי, כדי שהכתוב יתאפס בחצות
    const ok = _ownMorningState && _ownMorningState.ackDay === today;
    return ok ? { txt: '✅ נבדק הבוקר · אישרת שהכל תקין', ok: true }
              : { txt: '⏳ טרם אושרה היום', ok: false };
  }
  if (id === 'menu-card-recall') {
    if (!_dailyRecall || _dailyRecall.day !== today) return { txt: '⏳ טרם בוצעה היום', ok: false };
    return _dailyRecall.open
      ? { txt: `⚠️ נבדק הבוקר · ${_dailyRecall.open} ריקולים פתוחים`, ok: false }
      : { txt: '✅ נבדק הבוקר · הכל תקין', ok: true };
  }
  if (id === 'menu-card-inventory') {
    // הבדיקה נחשבת שבוצעה גם אם המנהל כבר מחק אותה — הסימון היומי נשמר בנפרד
    const marked = _dailyInvMark && _dailyInvMark.day === today;
    const done = (_dailyInv && _dailyInv.day === today) || marked;
    if (!done) return { txt: '⏳ טרם בוצעה היום', ok: false };
    if (_dailyInv && _dailyInv.open) return { txt: `⚠️ נבדק הבוקר · ${_dailyInv.open} ממתינות`, ok: false };
    if (marked && _dailyInvMark.missing) return { txt: `⚠️ נבדק הבוקר · ${_dailyInvMark.missing} חסרים`, ok: false };
    return { txt: '✅ נבדק הבוקר · הבדיקה תקינה', ok: true };
  }
  return null;
}

// המספר שמוצג ליד פריט — נלקח מהתגית של הכפתור המקורי
function _screenBadge(it) {
  if (!it.badge) return 0;
  const el = document.getElementById(it.badge);
  if (!el || el.style.display === 'none') return 0;
  return parseInt(String(el.textContent).replace(/\D/g, ''), 10) || 0;
}

// פריט מוצג רק אם הכפתור שמאחוריו פעיל למשתמש הזה
function _screenVisible(it) {
  // פריט פעולה אינו נשען על קובייה — הוא של המנהל בלבד
  if (it.action) return currentUser?.role === 'manager';
  const el = document.getElementById(it.id);
  return !!el && el.style.display !== 'none';
}

function _syncAllScreensCount() {
  const btn = document.getElementById('btn-all-screens');
  const nb = document.getElementById('all-screens-count');
  if (!btn || !nb) return;
  // אצל הנהג אין כפתור "כל המסכים" — מה שפתוח לו מוצג בקוביות הקטנות
  // שליד מספר המשימות, וכל השאר לא אמור להופיע לו בכלל.
  if (currentUser?.role !== 'manager') { btn.style.display = 'none'; return; }
  const items = _ALL_SCREENS.filter(_screenVisible);
  btn.style.display = items.length ? '' : 'none';
  const total = items.reduce((t, it) => t + _screenBadge(it), 0);
  nb.textContent = total;
  nb.style.display = total ? '' : 'none';
  if (document.getElementById('modal-all-screens')?.classList.contains('open')) _renderAllScreens();
}
window._syncAllScreensCount = _syncAllScreensCount;

function _renderAllScreens() {
  const box = document.getElementById('all-screens-list');
  if (!box) return;
  const items = _ALL_SCREENS.filter(_screenVisible);
  box.innerHTML = items.map(it => {
    const n = _screenBadge(it);
    return `<div onclick="${it.action ? `_allScreensAction(&quot;${it.action}&quot;)` : `openFromAllScreens('${it.id}')`}"
      style="display:flex;align-items:center;gap:11px;padding:12px 4px;border-bottom:1px solid var(--border);cursor:pointer">
      <div style="width:38px;height:38px;border-radius:11px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${it.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:14.5px">${it.label}</div>
        ${(() => { const d = _dailyNote(it.id); return d ? `<div style="font-size:11.5px;font-weight:800;margin-top:2px;color:${d.ok ? '#16a34a' : 'var(--muted)'}">${d.txt}</div>` : ''; })()}
      </div>
      ${n ? `<span style="background:#ef4444;color:#fff;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:900">${n}</span>` : ''}
      <span style="color:var(--muted);font-weight:900">‹</span>
    </div>`;
  }).join('');
}

function openAllScreens() { _renderAllScreens(); openModal('modal-all-screens'); }

// פתיחת מסך מתוך הרשימה — כדי שהחזרה תוביל בחזרה לרשימה
function openFromAllScreens(id) {
  closeModal('modal-all-screens');
  _cameFromAllScreens = true;
  document.getElementById(id)?.click();
}
window.openFromAllScreens = openFromAllScreens;

// פריט שמריץ פעולה במקום לפתוח מסך
function _allScreensAction(fn) {
  closeModal('modal-all-screens');
  setTimeout(() => { try { (new Function(fn))(); } catch (e) { console.error('all-screens action', fn, e); } }, 80);
}
window._allScreensAction = _allScreensAction;
window.openAllScreens = openAllScreens;

function renderHome() {
  const isManager = currentUser.role === 'manager';
  const _bd = document.getElementById('home-build');
  if (_bd) _bd.textContent = 'גרסה ' + APP_BUILD;
  const isPickupAgent = currentUser.role === 'pickup_agent';
  // reset calendar layout — only the manager gets the calendar
  const _hb = document.querySelector('#screen-home .home-body');
  if (_hb) { _hb.classList.remove('has-calendar'); _hb.classList.remove('mgr-home'); }
  // הטופס חוזר למסך השטיפה לפני שהבית נבנה מחדש
  try { window._washMount && window._washMount(); } catch (e) {}
  _moveWelcomeBar(false);
  document.getElementById('home-welcome').textContent =
    'שלום, ' + currentUser.name + ' 👋';
  const now = new Date();
  document.getElementById('home-date').textContent =
    now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('home-user-badge').textContent = currentUser.name;
  document.getElementById('stat-vehicles').parentElement.style.display = 'none';
  const settingsBtn = document.getElementById('btn-settings');
  if (settingsBtn) settingsBtn.style.display = (currentUser?.role === 'manager') ? 'inline-flex' : 'none';
  const notifyBtn = document.getElementById('btn-notify-mgr');
  if (notifyBtn) notifyBtn.style.display = (currentUser?.role === 'manager') ? 'inline-flex' : 'none';

  // הילה (pickup_driver) — only sees assigned pickup cars
  if (currentUser.role === 'pickup_driver') {
    // hide tasks stat, show pickup stat card only
    const tasksCard = document.querySelector('#stats-row .stat-card:first-child');
    if (tasksCard) tasksCard.style.display = 'none';
    const vehiclesCard = document.getElementById('stat-vehicles-card');
    if (vehiclesCard) vehiclesCard.style.display = 'none';
    const statsRow = document.getElementById('stats-row');
    if (statsRow) statsRow.style.display = '';
    const tdBtn = document.getElementById('menu-card-test-drive');
    if (tdBtn) tdBtn.style.display = 'none';
    const rcBtn = document.getElementById('menu-card-recall');
    if (rcBtn) rcBtn.style.display = 'none';
    const pcBtn = document.getElementById('btn-parts-home');
    if (pcBtn) pcBtn.style.display = 'none';
    document.getElementById('menu-grid').innerHTML = '';
    _onSnap(_query(_colRef('pickup_cars'), _where('assignedDriver','==',currentUser.name)), snap => {
      const cars = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const card = document.getElementById('stat-pickup-driver-card');
      const cnt = document.getElementById('stat-pickup-driver-count');
      if (card) card.style.display = cars.length ? 'block' : 'none';
      if (cnt) cnt.textContent = cars.length;
      _driverPickupCars = cars;
      const modal = document.getElementById('modal-driver-pickup');
      if (modal && modal.classList.contains('open')) _renderDriverPickupModal();
    });
    return;
  }

  // משה (pickup_agent) — pickup management + task request button
  if (isPickupAgent) {
    // hide stats row and test drive button
    const statsRow = document.getElementById('stats-row');
    if (statsRow) statsRow.style.display = 'none';
    const tdBtn = document.getElementById('menu-card-test-drive');
    if (tdBtn) tdBtn.style.display = 'none';
    const rcBtn = document.getElementById('menu-card-recall');
    if (rcBtn) rcBtn.style.display = 'none';
    const pcBtn = document.getElementById('btn-parts-home');
    if (pcBtn) pcBtn.style.display = 'none';
    document.getElementById('menu-grid').innerHTML =
      `<div class="menu-card" id="menu-card-pickup" onclick="openPickupScreen()">
        <div style="position:relative;display:inline-block">
          <div class="mc-icon">🚙</div>
          <span id="badge-pickup" style="display:none;position:absolute;top:-6px;right:-10px;background:#ef4444;color:#fff;border-radius:999px;font-size:11px;font-weight:900;padding:1px 6px;min-width:18px;text-align:center"></span>
        </div>
        <div class="mc-title">מכוניות לאיסוף</div>
        <div class="mc-sub" id="sub-pickup">ניהול רכבים לאיסוף</div>
      </div>
      <div class="menu-card" onclick="openRequestTaskModal()">
        <div class="mc-icon">📋</div>
        <div class="mc-title">הצעת משימה</div>
        <div class="mc-sub">שלח בקשה למנהל</div>
      </div>`;
    loadManagerBadges();
    return;
  }

  // There is no car-battery emoji, so the cabinet card uses a drawn icon: a
  // squat casing with two terminal posts and the + / − markings.
  const _ICON_CAR_BATTERY = `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" style="display:block;margin:0 auto">
    <rect x="4.5" y="1.6" width="4" height="2.4" rx="0.7" fill="#dc2626"/>
    <rect x="15.5" y="1.6" width="4" height="2.4" rx="0.7" fill="#334155"/>
    <rect x="2" y="4" width="20" height="16" rx="2.6" fill="#1f3a5f"/>
    <rect x="3.6" y="5.6" width="16.8" height="8" rx="1.4" fill="#2f5c8f"/>
    <path d="M6.5 9.6h3M8 8.1v3" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M14.5 9.6h3" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="3.6" y="15.2" width="16.8" height="3.2" rx="1.1" fill="#0f2440"/>
  </svg>`;

  const menuItems = isManager
    ? [
        { icon: '📋', title: 'לוח משימות', sub: 'ניהול משימות לנהגים', screen: 'tasks' },
        { icon: '🚗', title: 'קליטות ורענון רכבים', sub: 'קליטה ורענון במסך אחד', screen: 'vehicles' },
        // row 2 — ההנעות אינן קובייה אצל המנהל: החלונית קופצת מ-08:00
        { icon: _ICON_CAR_BATTERY, title: 'ארון מצברים', sub: 'מלאי, הרכבות וסטטיסטיקה', screen: 'battery-stock' },
        // row 3 — recall is not here, it lives on the floating home button
        { icon: '🚙', title: 'מכוניות לאיסוף', sub: 'ניהול רכבים לאיסוף', screen: 'pickup' },
        // השטיפה אינה קובייה אצל המנהל — היא כפתור רחב באזור הצדדי
        { icon: '🔨', title: 'פחחות', sub: 'עבודות, מחירים וחשבון חודשי', screen: 'bodyshop-mgr' },
      ]
    : [
        // ההנעות אינן קובייה — הן מוצגות כרשימה בתחתית מסך הבית
        { icon: '📋', title: 'המשימות שלי', sub: 'משימות שהוקצו לך', screen: 'tasks' },
        { icon: '🔋', title: 'בדיקת סוללה והטענת רכבים חשמליים', sub: 'מילוי אחוזי טעינה וטווח', screen: 'driver-battery' },
        { icon: _ICON_CAR_BATTERY, title: 'מצברים', sub: 'רישום מצבר שהורכב לרכב', screen: 'driver-battery-install' },
        { icon: '🧽', title: 'פתק שטיפה', sub: 'הכנה והדפסה של פתק לרכב', screen: 'wash' },
      ];


function _cardHtml(m) {
    const _onclick = m.screen === 'driver-battery' ? "goToScreen('driver-battery-unified')"
      : m.screen === 'driver-battery-install' ? "openDriverBatteryInstall()"
      : `goToScreen('${m.screen}')`;
    return `<div class="menu-card" id="menu-card-${m.screen}" onclick="${_onclick}">
      <div style="position:relative;display:inline-block">
        <div class="mc-icon">${m.icon}</div>
        <span id="badge-${m.screen}" style="display:none;position:absolute;top:-6px;right:-10px;background:#ef4444;color:#fff;border-radius:999px;font-size:11px;font-weight:900;padding:1px 6px;min-width:18px;text-align:center"></span>
      </div>
      <div class="mc-title">${m.title}</div>
      <div class="mc-sub" id="sub-${m.screen}">${m.sub}</div>
    </div>`;
  }

  const grid = document.getElementById('menu-grid');
  if (!isManager) {
    /* אצל הנהג כל הקוביות בשורה אחת, ומתחתיהן רשימת ההנעות של הבוקר.
       הקוביות מצטמצמות לפי מספרן כדי שהכול ייכנס למסך בלי גלילה. */
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.gap = '10px';
    grid.innerHTML =
      `<div class="drv-row">${menuItems.map(_cardHtml).join('')}</div>` +
      (currentUser.name === 'גיל'
        ? `<img src="${_GIL_BG}" style="width:100%;border-radius:16px;object-fit:cover;max-height:16vh;display:block">`
        : '') +
      `<div id="home-morning"></div>`;
    _reapplyCardBadges();
    _msRenderHome();
    // גיל צריך לראות כבר מהבית שבדיקת ארון המצברים החודשית ממתינה לו
    if (currentUser.name === _BS_AUDIT_USER) _bsAuditListen();
    _bsAuditHomeSync();
  } else {
    grid.style.display = '';
    grid.style.flexDirection = '';
    grid.style.gap = '';
    grid.innerHTML = menuItems.map(_cardHtml).join('');
    _reapplyCardBadges();
  }

  // בדיקת הטעינה אינה קובייה גדולה יותר — היא קוביה קטנה למעלה שמופיעה
  // רק כשנשלחה לנהג בדיקה או משימת טעינה. הקובייה נשארת בדף מוסתרת כי
  // היא מחזיקה את המצב (בדיקה / טעינה) שקובע לאיזה מסך נכנסים.
  const dbCard = document.getElementById('menu-card-driver-battery');
  if (dbCard) dbCard.style.display = 'none';
  // restore stats row for manager/drivers (may have been hidden by previous role)
  const statsRowMain = document.getElementById('stats-row');
  // אצל המנהל המספרים יושבים על הקוביות עצמן, ולכן שורת הקוביות הקטנות מיותרת
  if (statsRowMain) statsRowMain.style.display = isManager ? 'none' : '';
  const tdBtn = document.getElementById('menu-card-test-drive');
  if (tdBtn) tdBtn.style.display = isManager ? '' : 'none';
  const rcBtn = document.getElementById('menu-card-recall');
  if (rcBtn) rcBtn.style.display = isManager ? '' : 'none';
  // אצל הנהג השטיפה היא קובייה במסך הבית, ולכן הכפתור הרחב מוסתר
  const washBtn = document.getElementById('menu-btn-wash');
  if (washBtn) washBtn.style.display = isManager ? '' : 'none';
  // חיפוש לפי לוחית הוסתר לבקשת המנהל. המסך והפונקציות נשארו במקומם —
  // כדי להחזיר, מספיק להחליף כאן חזרה ל-isManager.
  const psBtn = document.getElementById('menu-card-plate-search');
  if (psBtn) psBtn.style.display = 'none';
  const ownBtn = document.getElementById('menu-card-ownership');
  if (ownBtn) ownBtn.style.display = isManager ? '' : 'none';
  if (isManager) _startOwnMorning();
  // כפתור "כל המסכים" מתעדכן לפי התגיות של הכפתורים שמאחוריו
  if (isManager) _dailyChecksListen();
  _storyListen();
  _crestListen();
  _msListen();
  _renderDailyQuote();
  _syncAllScreensCount();
  clearInterval(window._allScreensTimer);
  window._allScreensTimer = setInterval(_syncAllScreensCount, 2000);
  // The parts catalogue is parked, not removed — the screen and everything in it
  // stay exactly as they are. To bring the button back, put the manager check
  // back in place of the 'none' below.
  const pcBtn = document.getElementById('btn-parts-home');
  if (pcBtn) pcBtn.style.display = 'none';   // isManager ? 'inline-flex' : 'none'

  loadStats();
  if (isManager) { loadManagerBadges(); setTimeout(_restoreTdLivePanelIfNeeded, 800); initManagerCalendar(); }
  else loadDriverBadges();
}

/* ═══════════════════════════════════════════════════════
   HOME CALENDAR (manager)
═══════════════════════════════════════════════════════ */
let _calEvents = [];
let _calMonth = new Date();
let _calSelected = null;
let _calUnsub = null;

function _ymd(dt) {
  const y = dt.getFullYear(), m = String(dt.getMonth()+1).padStart(2,'0'), d = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

/* With the calendar on, the greeting belongs inside the cards column so the
   calendar can start at the very top of the screen — that is where the extra
   room for the day's tasks comes from. */
function _moveWelcomeBar(intoCards) {
  const bar = document.querySelector('#screen-home .welcome-bar');
  const body = document.querySelector('#screen-home .home-body');
  const cards = document.getElementById('home-cards-area');
  if (!bar || !body || !cards) return;
  const target = intoCards ? cards : body;
  if (bar.parentElement !== target) target.prepend(bar);
}

function initManagerCalendar() {
  const hb = document.querySelector('#screen-home .home-body');
  if (hb) { hb.classList.add('has-calendar'); hb.classList.add('mgr-home'); }
  _moveWelcomeBar(true);
  // במסך רחב טופס השטיפה עובר לעמודה האמצעית
  try { window._washMount && window._washMount(); } catch (e) {}
  if (!_calSelected) _calSelected = _ymd(new Date());
  _calMonth = new Date(); _calMonth.setDate(1);
  if (!_calUnsub && window._CONFIG_DONE) {
    try {
      _calUnsub = _onSnap(_colRef('calendar_events'), snap => {
        _calEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCalendar(); renderAgenda();
      });
    } catch(e) { console.warn('calendar listener failed', e); }
  }
  renderCalendar(); renderAgenda();
}

// does event e occur on date string ds (YYYY-MM-DD), considering its repeat rule
function _calOccursOn(e, ds) {
  if (!e.date || ds < e.date) return false;
  const rep = e.repeat || 'none';
  if (rep === 'none') return ds === e.date;
  if (ds === e.date) return true;
  const a = new Date(e.date + 'T00:00'), b = new Date(ds + 'T00:00');
  if (rep === 'daily')   return true;
  if (rep === 'weekly')  return a.getDay() === b.getDay();
  if (rep === 'monthly') return a.getDate() === b.getDate();
  return ds === e.date;
}

/* ממיר שנה עברית (מספר, למשל 5786) לאותיות עבריות מקובלות: ה'תשפ"ו.
   פרטי הגימטריה: ט״ו וט״ז נכתבים טו/טז כדי לא לפגוע בשם ה', וכל
   ארבע מאות נספרות כ-ת נוספת. */
function _hebYearLetters(y) {
  const hundredLetters = ['', 'ק', 'ר', 'ש', 'ת'];
  const tenLetters = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const oneLetters = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const thousandLetters = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו'];
  const thousands = Math.floor(y / 1000);
  let hundreds = Math.floor((y % 1000) / 100), rest = y % 100;
  let letters = '';
  while (hundreds > 4) { letters += 'ת'; hundreds -= 4; }
  letters += hundredLetters[hundreds];
  if (rest === 15) letters += 'טו';
  else if (rest === 16) letters += 'טז';
  else { letters += tenLetters[Math.floor(rest / 10)]; letters += oneLetters[rest % 10]; }
  const withGershayim = letters.length <= 1 ? letters + "'" : letters.slice(0, -1) + '"' + letters.slice(-1);
  return thousandLetters[thousands] + "'" + withGershayim;
}

/* שם החודש העברי שמתאים לחודש הלועזי המוצג. אם החודש הלועזי משתרע על
   שני חודשים עבריים — מוצגים שניהם. אם הדפדפן לא תומך, לא מוצג כלום. */
function _hebMonthLabel(y, m) {
  try {
    const f = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long', year: 'numeric' });
    const parse = s => { const [mo, yr] = s.split(' '); return { mo, yr: _hebYearLetters(parseInt(yr, 10)) }; };
    const a = parse(f.format(new Date(y, m, 1)));
    const b = parse(f.format(new Date(y, m + 1, 0)));
    if (a.mo === b.mo && a.yr === b.yr) return `${a.mo} ${a.yr}`;
    return a.yr === b.yr ? `${a.mo}–${b.mo} ${a.yr}` : `${a.mo} ${a.yr} – ${b.mo} ${b.yr}`;
  } catch (e) { return ''; }
}

function renderCalendar() {
  const title = document.getElementById('cal-title');
  const body = document.getElementById('cal-body');
  if (!body) return;
  const y = _calMonth.getFullYear(), m = _calMonth.getMonth();
  const monthNames = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  if (title) title.textContent = monthNames[m] + ' ' + y;
  // התאריך העברי: חודש לועזי אחד נופל על שני חודשים עבריים, ולכן מוצג טווח
  const heb = document.getElementById('cal-title-heb');
  if (heb) heb.textContent = _hebMonthLabel(y, m);
  const startDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const dows = ['א','ב','ג','ד','ה','ו','ש'];
  const todayStr = _ymd(new Date());
  let cells = dows.map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i=0;i<startDow;i++) cells += `<div class="cal-day empty"></div>`;
  for (let d=1; d<=daysInMonth; d++) {
    const ds = _ymd(new Date(y, m, d));
    const cls = ['cal-day'];
    if (ds === todayStr) cls.push('today');
    if (ds === _calSelected) cls.push('selected');
    // יום שעבר לא מסומן — הסימון נועד להראות מה עוד לפניך, לא מה היה
    const upcoming = ds >= todayStr;
    const barca = upcoming && _calEvents.some(e => e.autoBarca && _calOccursOn(e, ds));
    if (upcoming && _calEvents.some(e => _calOccursOn(e, ds))) cls.push('has-ev');
    if (barca) cls.push('barca');
    cells += `<div class="${cls.join(' ')}" onclick="calSelectDay('${ds}')"><span class="cal-num">${barca ? `<i class="cal-bnum">${d}</i>` : d}</span></div>`;
  }
  body.innerHTML = `<div class="cal-grid">${cells}</div>`;
}

function renderAgenda() {
  const at = document.getElementById('cal-agenda-title');
  const box = document.getElementById('cal-agenda');
  if (!box) return;
  const sel = _calSelected || _ymd(new Date());
  const [yy,mm,dd] = sel.split('-');
  if (at) at.textContent = `משימות ${dd}/${mm}`;
  const items = _calEvents.filter(e => _calOccursOn(e, sel))
    .sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
  if (!items.length) {
    box.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:14px 4px;text-align:center">אין משימות ליום זה</div>`;
    return;
  }
  box.innerHTML = items.map(e => {
    const time = e.startTime ? (e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime) : '';
    const rep = (e.repeat && e.repeat !== 'none') ? ' 🔁' : '';
    const rem = (e.reminderMinutes !== null && e.reminderMinutes !== undefined) ? ' 🔔' : '';
    return `<div onclick="openEditCalEvent('${e.id}')" style="display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid var(--border);border-right:4px solid #7c3aed;border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer">
      ${time ? `<div style="font-size:12px;font-weight:800;color:#7c3aed;white-space:nowrap;min-width:44px">${esc(time)}</div>` : ''}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px">${esc(e.title||'')}${rep}${rem}</div>
        ${e.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">${esc(e.notes)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function calNav(dir) {
  _calMonth = new Date(_calMonth.getFullYear(), _calMonth.getMonth()+dir, 1);
  renderCalendar();
}
window.calNav = calNav;

function calSelectDay(ds) {
  _calSelected = ds;
  renderCalendar(); renderAgenda();
}
window.calSelectDay = calSelectDay;

// ── custom date picker for the task modal (matches the home calendar look) ──
let _calDpMonth = new Date();
const _CAL_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
function _setCalDate(ds) {
  document.getElementById('cal-ev-date').value = ds || '';
  const disp = document.getElementById('cal-ev-date-display');
  if (disp) disp.value = ds ? (() => { const [y,m,d] = ds.split('-'); return `${d}/${m}/${y}`; })() : '';
}
function _openCalDatePicker() {
  const p = document.getElementById('cal-date-picker');
  if (!p) return;
  if (p.style.display === 'block') { p.style.display = 'none'; return; }
  const cur = document.getElementById('cal-ev-date').value;
  _calDpMonth = cur ? new Date(cur + 'T00:00') : new Date();
  _calDpMonth.setDate(1);
  _renderCalDatePicker();
  p.style.display = 'block';
}
window._openCalDatePicker = _openCalDatePicker;
function _renderCalDatePicker() {
  const body = document.getElementById('cal-dp-body');
  const title = document.getElementById('cal-dp-title');
  if (!body) return;
  const y = _calDpMonth.getFullYear(), m = _calDpMonth.getMonth();
  if (title) {
    const selStyle = 'font-family:Heebo,sans-serif;font-weight:900;font-size:15px;border:none;background:var(--surface2);border-radius:8px;padding:4px 8px;cursor:pointer;color:var(--text)';
    const monthOpts = _CAL_MONTHS.map((mn,i) => `<option value="${i}"${i===m?' selected':''}>${mn}</option>`).join('');
    const yNow = new Date().getFullYear();
    let yearOpts = '';
    for (let yy = yNow-3; yy <= yNow+10; yy++) yearOpts += `<option value="${yy}"${yy===y?' selected':''}>${yy}</option>`;
    title.innerHTML = `<select onchange="_calDpSetMonth(this.value)" style="${selStyle}">${monthOpts}</select> <select onchange="_calDpSetYear(this.value)" style="${selStyle}">${yearOpts}</select>`;
  }
  const startDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const dows = ['א','ב','ג','ד','ה','ו','ש'];
  const todayStr = _ymd(new Date());
  const sel = document.getElementById('cal-ev-date').value;
  let cells = dows.map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i=0;i<startDow;i++) cells += `<div class="cal-day empty"></div>`;
  for (let d=1; d<=daysInMonth; d++) {
    const ds = _ymd(new Date(y, m, d));
    const cls = ['cal-day'];
    if (ds === todayStr) cls.push('today');
    if (ds === sel) cls.push('selected');
    cells += `<div class="${cls.join(' ')}" onclick="_calDpSelect('${ds}')"><span class="cal-num">${d}</span></div>`;
  }
  body.innerHTML = `<div class="cal-grid">${cells}</div>`;
}
function _calDpNav(dir) {
  _calDpMonth = new Date(_calDpMonth.getFullYear(), _calDpMonth.getMonth()+dir, 1);
  _renderCalDatePicker();
}
window._calDpNav = _calDpNav;
function _calDpSetMonth(m) { _calDpMonth = new Date(_calDpMonth.getFullYear(), +m, 1); _renderCalDatePicker(); }
window._calDpSetMonth = _calDpSetMonth;
function _calDpSetYear(y) { _calDpMonth = new Date(+y, _calDpMonth.getMonth(), 1); _renderCalDatePicker(); }
window._calDpSetYear = _calDpSetYear;
function _calDpSelect(ds) {
  _setCalDate(ds);
  const p = document.getElementById('cal-date-picker'); if (p) p.style.display = 'none';
}
window._calDpSelect = _calDpSelect;
function _calDpSelectToday() { _calDpSelect(_ymd(new Date())); }
window._calDpSelectToday = _calDpSelectToday;

// normalize a free-typed time into HH:MM (e.g. "845" -> "08:45", "8" -> "08:00")
function _normalizeTime(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  const colon = s.match(/^(\d{1,2})[:.](\d{1,2})$/);
  let h, m;
  if (colon) { h = +colon[1]; m = +colon[2]; }
  else {
    const d = s.replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 1 || d.length === 2) { h = +d; m = 0; }
    else if (d.length === 3) { h = +d.slice(0,1); m = +d.slice(1); }
    else if (d.length === 4) { h = +d.slice(0,2); m = +d.slice(2); }
    else return '';
  }
  if (h > 23 || m > 59) return '';
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
window._normalizeTime = _normalizeTime;

// ── recipients chip-picker for calendar task reminders ──
let _calEvRecipients = [];

function _calRecipientPool() {
  const base = ['עופר','גיל','איתי'];
  const mine = currentUser?.name;
  return mine && !base.includes(mine) ? [mine, ...base] : base;
}

function _renderCalRecipients() {
  const box = document.getElementById('cal-ev-recipients-box');
  const placeholder = document.getElementById('cal-ev-recipients-placeholder');
  if (!box) return;
  box.querySelectorAll('.cal-ev-chip').forEach(el => el.remove());
  if (_calEvRecipients.length) {
    if (placeholder) placeholder.style.display = 'none';
    _calEvRecipients.forEach(name => {
      const chip = document.createElement('span');
      chip.className = 'cal-ev-chip';
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:5px;background:#f0eaff;color:#5b21b6;border-radius:999px;padding:4px 6px 4px 10px;font-size:13px;font-weight:700';
      chip.innerHTML = `${esc(name)} <button type="button" style="background:#5b21b6;color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;line-height:1;cursor:pointer;padding:0">✕</button>`;
      chip.querySelector('button').onclick = (ev) => { ev.stopPropagation(); _removeCalRecipient(name); };
      box.appendChild(chip);
    });
  } else if (placeholder) {
    placeholder.style.display = '';
  }
  _renderRecipientDropdown();
}

function _renderRecipientDropdown() {
  const dd = document.getElementById('cal-ev-recipients-dropdown');
  if (!dd) return;
  const remaining = _calRecipientPool().filter(n => !_calEvRecipients.includes(n));
  dd.innerHTML = remaining.length
    ? remaining.map(name => `<div onclick="event.stopPropagation();_addCalRecipient('${esc(name)}')" style="padding:9px 10px;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">${esc(name)}</div>`).join('')
    : `<div style="padding:9px 10px;color:var(--muted);font-size:13px;text-align:center">כל השמות נבחרו</div>`;
}

function _toggleRecipientPicker(ev) {
  if (ev) ev.stopPropagation();
  const dd = document.getElementById('cal-ev-recipients-dropdown');
  if (!dd) return;
  const open = dd.style.display === 'block';
  if (open) { dd.style.display = 'none'; return; }
  _renderRecipientDropdown();
  dd.style.display = 'block';
}
window._toggleRecipientPicker = _toggleRecipientPicker;

function _addCalRecipient(name) {
  if (!_calEvRecipients.includes(name)) _calEvRecipients.push(name);
  _renderCalRecipients();
}
window._addCalRecipient = _addCalRecipient;

function _removeCalRecipient(name) {
  _calEvRecipients = _calEvRecipients.filter(n => n !== name);
  _renderCalRecipients();
}
window._removeCalRecipient = _removeCalRecipient;

document.addEventListener('click', (ev) => {
  const box = document.getElementById('cal-ev-recipients-box');
  const dd = document.getElementById('cal-ev-recipients-dropdown');
  if (!box || !dd || dd.style.display !== 'block') return;
  if (!box.contains(ev.target) && !dd.contains(ev.target)) dd.style.display = 'none';
});

function openAddCalEvent() {
  document.getElementById('cal-ev-id').value = '';
  document.getElementById('cal-ev-title').value = '';
  _setCalDate(_calSelected || _ymd(new Date()));
  document.getElementById('cal-date-picker').style.display = 'none';
  document.getElementById('cal-ev-start').value = '';
  document.getElementById('cal-ev-notes').value = '';
  document.getElementById('cal-ev-repeat').value = 'none';
  document.getElementById('cal-ev-reminder').value = '';
  _calEvRecipients = [];
  _renderCalRecipients();
  document.getElementById('cal-ev-heading').textContent = 'משימה חדשה';
  document.getElementById('cal-ev-delete-btn').style.display = 'none';
  openModal('modal-cal-event');
}
window.openAddCalEvent = openAddCalEvent;

function openEditCalEvent(id) {
  const e = _calEvents.find(x => x.id === id);
  if (!e) return;
  document.getElementById('cal-ev-id').value = e.id;
  document.getElementById('cal-ev-title').value = e.title || '';
  _setCalDate(e.date || '');
  document.getElementById('cal-date-picker').style.display = 'none';
  document.getElementById('cal-ev-start').value = e.startTime || '';
  document.getElementById('cal-ev-notes').value = e.notes || '';
  document.getElementById('cal-ev-repeat').value = e.repeat || 'none';
  document.getElementById('cal-ev-reminder').value = (e.reminderMinutes === null || e.reminderMinutes === undefined) ? '' : String(e.reminderMinutes);
  _calEvRecipients = [...(e.reminderTo || [])];
  _renderCalRecipients();
  document.getElementById('cal-ev-heading').textContent = 'עריכת משימה';
  document.getElementById('cal-ev-delete-btn').style.display = 'block';
  openModal('modal-cal-event');
}
window.openEditCalEvent = openEditCalEvent;

async function submitCalEvent() {
  const id = document.getElementById('cal-ev-id').value;
  const title = document.getElementById('cal-ev-title').value.trim();
  const date = document.getElementById('cal-ev-date').value;
  const startTime = _normalizeTime(document.getElementById('cal-ev-start').value);
  const notes = document.getElementById('cal-ev-notes').value.trim();
  const repeat = document.getElementById('cal-ev-repeat').value || 'none';
  const reminderRaw = document.getElementById('cal-ev-reminder').value;
  const reminderMinutes = reminderRaw === '' ? null : parseInt(reminderRaw, 10);
  const reminderTo = [..._calEvRecipients];
  if (!title) return showToast('נא להזין כותרת');
  if (!date) return showToast('נא לבחור תאריך');
  if (reminderMinutes !== null && !reminderTo.length) return showToast('נא לבחור למי לשלוח את התזכורת');
  const { addDoc, updateDoc, doc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  try {
    if (id) {
      await updateDoc(doc(window._db,'calendar_events',id), { title, date, startTime, endTime: '', notes, repeat, reminderMinutes, reminderTo, reminderSent: false });
    } else {
      await addDoc(collection(window._db,'calendar_events'), { title, date, startTime, endTime: '', notes, repeat, reminderMinutes, reminderTo, reminderSent: false, createdAt: serverTimestamp() });
    }
    _calSelected = date;
    const [yy,mm] = date.split('-'); _calMonth = new Date(+yy, +mm-1, 1);
    closeModal('modal-cal-event');
    showToast('✅ נשמר');
  } catch(e) { showToast('שגיאה בשמירה: ' + (e.code||e.message)); }
}
window.submitCalEvent = submitCalEvent;

async function deleteCalEvent() {
  const id = document.getElementById('cal-ev-id').value;
  if (!id) return;
  if (!confirm('למחוק משימה זו?')) return;
  const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  try {
    await deleteDoc(doc(window._db,'calendar_events',id));
    closeModal('modal-cal-event');
    showToast('🗑️ נמחק');
  } catch(e) { showToast('שגיאה: ' + (e.code||e.message)); }
}
window.deleteCalEvent = deleteCalEvent;

function goToScreen(name) {
  if (name === 'parts' && currentUser.role !== 'manager') return;
  if (name === 'tasks') openTasksScreen();
  else if (name === 'vehicles') openVehiclesScreen();
  else if (name === 'parts') openPartsScreen();
  else if (name === 'yard') openYardScreen();
  else if (name === 'morning-starts') openMorningStartsScreen();
  else if (name === 'notify-mgr') openNotifyMgr();
  else if (name === 'inventory') openInventoryScreen();
  else if (name === 'battery') openBatteryScreen();
  else if (name === 'driver-battery') openDriverBatteryScreen();
  else if (name === 'driver-charging') openDriverChargingScreen();
  else if (name === 'pits') openPitsScreen();
  else if (name === 'driver-inventory') openDriverInventoryScreen();
  else if (name === '_notify') openSettings();
  else if (name === '_broadcast') openBroadcast();
  else if (name === '_refresh') openRefreshScreen();
  else if (name === 'pickup') { if (currentUser.role === 'pickup_driver') openMyPickupScreen(); else openPickupScreen(); }
  else if (name === 'test-drive') openTestDriveScreen();
  else if (name === 'recall') openRecallScreen();
  else if (name === 'wash') openWashScreen();
  else if (name === 'plate-search') openPlateSearch();
  else if (name === 'ownership') { if (currentUser.role !== 'manager') return; openOwnershipScreen(); }
  else if (name === 'parts-catalog') { if (currentUser.role !== 'manager') return; openPartsCatalogScreen(); }
  else if (name === 'battery-stock') { if (currentUser.role !== 'manager') return; openBatteryStockScreen(); }
  else if (name === 'driver-battery-stock') openDriverBatteryStockScreen();
  else if (name === 'bodyshop-mgr') { if (currentUser.role !== 'manager') return; openBodyShopMgrScreen(); }
  else if (name === 'driver-battery-unified') {
    const card = document.getElementById('menu-card-driver-battery');
    if (card && card.dataset.unifiedMode === 'charging') openDriverChargingScreen();
    else openDriverBatteryScreen();
  }
}

/* ── מאזינים שנפתחים מחדש בכל כניסה למסך הבית ובכל החלפת משתמש ──────
   שלוש הפונקציות שמזינות את המונים פותחות עשרות חיבורים לשרת. עד כה הן
   לא סגרו את הקודמים, והחיבורים נערמו זה על זה: אותם נתונים ירדו כמה
   פעמים במקביל, הסוללה של הנהגים נשחקה, והמסכים צוירו מחדש שוב ושוב.
   עכשיו כל קבוצה נסגרת לפני שהיא נפתחת שוב. ההתנהגות על המסך זהה. */
const _reSubs = {};
function _reSnapReset(group) {
  (_reSubs[group] || []).forEach(un => { try { un(); } catch (e) {} });
  _reSubs[group] = [];
}
function _reSnap(group, ...args) {
  if (!window._onSnap) return () => {};
  const un = window._onSnap(...args);
  (_reSubs[group] = _reSubs[group] || []).push(un);
  return un;
}

function loadStats() {
  if (!window._CONFIG_DONE) {
    document.getElementById('stat-tasks').textContent = '—';
    return;
  }
  _reSnapReset('stats');   // סוגר את המאזינים מהכניסה הקודמת
  const isManager = currentUser?.role === 'manager';
  if (isManager) {
    _reSnap('stats', _query(_colRef('tasks'), _where('status','!=','done')), snap => {
      document.getElementById('stat-tasks').textContent = snap.size || '0';
      // המספר יושב על קוביית לוח המשימות, במקום קובייה נפרדת
      _tasksOpenCount = snap.size || 0;
      _syncTasksBadge();
    });
    _reSnap('stats', _colRef('vehicles'), snap => {
      document.getElementById('stat-vehicles').textContent = snap.size;
    });
    _reSnap('stats', _query(_colRef('parts'), _where('status','==','pending')), snap => {
      document.getElementById('stat-parts').textContent = snap.size;
    });
  } else {
    // Driver: "משימות פתוחות" counts ONLY tasks — exactly like the driver's own
    // column in the manager task board. Other modules have their own cards.
    const name = currentUser.name;
    const update = () => {
      document.getElementById('stat-tasks').textContent = _taskIds.size || '0';
    };
    const _taskIds = new Set();
    _reSnap('stats', _query(_colRef('tasks'), _where('assignedTo','==',name)), snap => {
      snap.docs.forEach(d => { if (d.data().status !== 'done') _taskIds.add(d.id); else _taskIds.delete(d.id); });
      update();
    });
    _reSnap('stats', _query(_colRef('tasks'), _where('label','==',name)), snap => {
      snap.docs.forEach(d => { if (d.data().status !== 'done') _taskIds.add(d.id); else _taskIds.delete(d.id); });
      update();
    });
  }
}

// number shown inside the floating "נסיעות מבחן" button on the home screen
function _setTdHomeCount(n) {
  const el = document.getElementById('td-home-count');
  if (!el) return;
  el.textContent = n || '';
  el.style.display = n ? 'inline-block' : 'none';
}

// צבע הסימון של קוביות מסך הבית — טורקיז
const _HOME_CARD_HL = '#0d9488';


/* ── סיפור היום ──────────────────────────────────────────────────────
   מאגר סיפורים קצרים עם מוסר השכל, מהמקורות: משלי המגיד מדובנא,
   סיפורי הבעל שם טוב, החפץ חיים ומעשי חז״ל — כתובים בניסוח חופשי.
   הסיפור נבחר לפי מספר היום בשנה, כך שכל המכשירים מציגים את אותו
   סיפור, והוא מתחלף בחצות.                                        */
const _DAILY_STORIES = [
  { t: "שני החדרים", s: "אדם אחד ביקש לראות מה ההבדל בין גן עדן לגיהינום. לקחו אותו לחדר גדול, ובמרכזו שולחן ערוך בכל טוב — קדרות מהבילות, לחם טרי, פירות. סביב השולחן ישבו אנשים רזים ורעבים, וצעקו זה על זה. ראה האיש שלכל אחד קשורה לזרוע כף ארוכה מאוד, ארוכה מהיד עצמה. הם הצליחו למלא את הכף, אבל לא הצליחו להביא אותה אל הפה. אמרו לו: זה גיהינום. לקחו אותו לחדר השני. אותו שולחן בדיוק, אותו אוכל, ואותן כפות ארוכות קשורות לזרוע. אבל כאן כולם שבעים, מדברים בנחת וצוחקים. הביט האיש וראה: כל אחד ממלא את הכף שלו ומושיט אותה אל מי שיושב מולו, וזה שמולו מאכיל אותו בחזרה. אמרו לו: זה גן עדן.", n: "הכפות הארוכות הן החיים עצמם: תמיד יש משהו שמקשה ולא נותן להשיג את מה שרוצים לבד. בשני החדרים הקושי זהה — אף אחד לא קיבל כפית קצרה יותר. מי שנשאר רעב הוא זה שניסה בכל כוחו להאכיל את עצמו, ומי שהשביע את עצמו הוא זה שהחליט להאכיל את מי שמולו.", m: "אותו שולחן, אותם כלים, אותו קושי בדיוק. ההבדל היחיד הוא אם אתה מנסה להאכיל את עצמך או את מי שיושב מולך." },
  { t: "הכד הסדוק", s: "בכפר רחוק היה איש שנשא מדי בוקר מוט על כתפיו, ובשני קצותיו שני כדי חרס. אחד הכדים היה שלם ומושלם, והשני היה סדוק. עד שהגיעו הביתה מהנחל, הכד הסדוק כבר איבד חצי ממימיו. שנתיים הלך כך, והתמלא בושה. יום אחד לא התאפק ואמר לאדונו: אני מצטער. בגללי אתה עושה את כל הדרך ומגיע עם חצי כד. אני פגום. אמר לו האיש: בוא איתי. בדרך חזרה אמר לו: תסתכל בצד שלך של השביל. ראה הכד שכל הדרך שלו פורחת בפרחים, ואילו הצד של הכד השלם יבש ואפור. אמר האיש: ידעתי שאתה סדוק, ולכן זרעתי זרעים דווקא בצד שלך. בכל יום, בלי לדעת, השקית אותם. מהפרחים האלה אני מקשט את שולחן ביתי כבר שנתיים.", n: "הכד הסדוק הוא כל אדם שמרגיש שהוא לא מספיק טוב במשהו. הוא בטוח שהחיסרון שלו רק מזיק. מה שהוא לא רואה זה שבעל הבית מכיר אותו טוב, ובנה את הדרך מסביב לחיסרון הזה — עד שהוא הפך למקור של משהו יפה שאף אחד אחר לא היה יוצר.", m: "מה שנראה לך כחיסרון, לפעמים הוא בדיוק הדבר שמצמיח סביבך את מה שהכי יפה." },
  { t: "שתי הבארות", s: "משל מהמגיד מדובנא: שני שכנים יצאו לחפור באר בשדה. הראשון חפר שלושה מטרים, לא ראה מים, אמר לעצמו — כנראה המקום לא טוב, עבר עשרים צעד וחפר שוב שלושה. גם שם לא מצא. וכך עשה שבע פעמים, עד שהשדה כולו היה מלא בורות רדודים. השני בחר מקום אחד וחפר בו. גם הוא לא מצא בשלושה מטרים, ולא בעשרה. בעשרים מטר פרצו המים. ישב הראשון על ערמת העפר שלו ואמר במרירות: חפרתי הרבה יותר ממנו! למה הוא מצא ואני לא? אמרו לו: נכון, הוצאת יותר עפר. אבל אף פעם לא באותו מקום.", n: "הבאר היא כל מטרה שדורשת עומק — מקצוע, עסק, לימוד. הראשון עבד קשה מאוד, אבל כל פעם שלא ראה תוצאה מיד הוא הסיק שהמקום לא מתאים. אחרי שבע התחלות הוא היה עייף כמו מי שחפר עשרים מטר, אבל בלי מים. השני חפר בדיוק אותה כמות עפר — במקום אחד.", m: "עייפות לא נובעת מכמות העבודה אלא מפיזור. מי שמתמיד באותו מקום מגיע למים, גם אם בהתחלה לא רואים כלום." },
  { t: "הרועה שלא ידע להתפלל", s: "יום כיפור היה, ובבית הכנסת של הבעל שם טוב עמדו כל המתפללים בתפילת נעילה. בפינה עמד נער רועים פשוט שלא ידע לקרוא אות אחת. הוא הביט בכולם, ראה איך הם מתפללים, וליבו נשבר שאין לו מה לומר. פתאום הוציא מכיסו את החליל שלו — אותו חליל שבו קרא לעדר — ותקע בו בכל כוחו, קול אחד ארוך. נבהלו המתפללים וכעסו: מי הביא לכאן ילד כזה, הרס לנו את התפילה! אמר להם הבעל שם טוב: אל תיגעו בו. כל היום התפילות שלנו עלו ונעצרו בשער, ולא היה מי שיפתח אותו. הקול של הנער הזה פתח את השער — כי הוא נתן את הדבר היחיד שהיה לו.", n: "התפילות של כל הקהל היו יפות ומדויקות, אבל הן היו מה שהם יודעים לעשות ממילא. הנער נתן את החליל — הדבר היחיד שהיה לו בעולם. לכן דווקא הוא פתח את השער: לא בגלל שהקול היה יפה יותר, אלא בגלל שהוא נתן הכול ולא רק חלק.", m: "אף אחד לא נמדד לפי גודל המתנה שהביא, אלא לפי כמה מעצמו הוא שם בתוכה." },
  { t: "האוצר שמתחת לגשר", s: "רבי אייזיק, יהודי עני מקרקוב, חלם לילה אחר לילה שמתחת לגשר בעיר פראג טמון אוצר גדול. בהתחלה התעלם, אבל החלום חזר. לבסוף לקח את מקלו ונסע ימים רבים עד פראג. כשהגיע ראה שהגשר שמור על ידי חייל, ולא העז לחפור. הסתובב שם ימים, עד ששאל אותו החייל: מה אתה מסתובב פה? סיפר לו רבי אייזיק על החלום. פרץ החייל בצחוק ואמר: חלומות! גם אני חולם כבר שבוע שבקרקוב, בבית של יהודי אחד בשם אייזיק, טמון אוצר מתחת לתנור. אתה רואה אותי נוסע לקרקוב לחפש תנור של יהודי? חזר רבי אייזיק לביתו, הזיז את התנור, חפר — ומצא את האוצר.", n: "האוצר של רבי אייזיק היה מתחת לתנור שלו כל השנים, והוא עבר לידו כל יום. הוא לא היה מוצא אותו לעולם בלי לצאת לדרך הארוכה. לפעמים הנסיעה הרחוקה לא מיותרת — היא זו שנותנת לך את העיניים לראות את מה שהיה מולך מההתחלה.", m: "לפעמים צריך לעשות דרך ארוכה מאוד כדי לגלות שמה שחיפשת היה כל הזמן בבית שלך." },
  { t: "התפר שאיש לא רואה", s: "מלך הזמין חליפה מהחייט הטוב בממלכה, ונתן לו בד יקר שהובא מארץ רחוקה. עבד החייט שבועיים והביא את החליפה. לבש אותה המלך, הסתובב מול המראה, ולפתע עצר: כאן, מתחת לזרוע, יש תפר עקום. אמר החייט: אדוני המלך, זה מתחת לזרוע. אף אדם בממלכה לא יראה את זה לעולם. הביט בו המלך ואמר: נכון. אבל אני אראה. בכל פעם שאלבש אותה אדע שהוא שם. לקח החייט את החליפה, פירם אותה כולה ותפר מחדש. מאותו יום, אמרו עליו שהוא החייט של המלך — לא בגלל מה שרואים בחליפות שלו, אלא בגלל מה שלא רואים.", n: "המלך לא בדק את החייט בתפרים שרואים — אלה תמיד יהיו טובים. הוא בדק אותו במקום שאף אחד לא מסתכל בו. שם מתגלה אם אדם עובד בשביל העין של אחרים או בשביל העבודה עצמה, וזה מה שקובע אם יסמכו עליו בפעם הבאה.", m: "עבודה טובה נמדדת גם במקומות שאף אחד לא בודק. שם בדיוק עובר הגבול בין מקצוען לבין מי שרק גומר." },
  { t: "הפנס בלילה", s: "אדם עמד בראש הגבעה בלילה וצריך היה לרדת אל הכפר. הדרך הייתה חשוכה לגמרי. אמר: לא אזוז מכאן עד שיאירו לי את כל השביל. עבר שם זקן ונתן לו פנס קטן. הדליק האיש את הפנס והתאכזב: הפנס הזה מאיר ארבעה צעדים בלבד, ולכפר יש עוד אלף. אמר לו הזקן: לך את ארבעת הצעדים. כשתגיע לסופם, הפנס יאיר לך ארבעה צעדים חדשים. וכך, בלי שראית אף פעם את כל הדרך, תגיע הביתה.", n: "הפנס הוא כל מה שיש לך עכשיו: מידע חלקי, זמן קצר, כוחות מוגבלים. מי שמחכה שיאירו לו את כל המסלול לא יצא לעולם, כי אף פעם לא מאירים אותו. מי שהולך את מה שהוא רואה — מגלה שהתמונה זזה איתו.", m: "אתה לא צריך לראות את כל הדרך לפני שאתה יוצא. אתה צריך לראות את הצעד הבא — ולעשות אותו." },
  { t: "שניכם צודקים", s: "שני שותפים הגיעו לרב אחרי ריב קשה. הראשון פרש את טענותיו בפרוטרוט. שמע הרב והנהן: אתה צודק. נעלב השני והתחיל לספר את הצד שלו, בפירוט ובכעס. שמע הרב והנהן שוב: גם אתה צודק. אשת הרב, שעמדה מאחורי הדלת, לא התאפקה ונכנסה: כבוד הרב, זה לא ייתכן! אם הראשון צודק, השני לא יכול לצדוק, וההפך! הביט בה הרב ואמר בשקט: את יודעת מה? גם את צודקת.", n: "הרב לא היה מבולבל. הוא הראה שכל צד באמת רואה את הסיפור נכון מהמקום שלו. הריב לא נובע מכך שאחד משקר, אלא מכך שכל אחד רואה חצי. אשת הרב צדקה גם היא — כי מבחוץ באמת נראה שאי אפשר ששניהם צודקים.", m: "לפני שאתה בטוח שהצדק כולו אצלך — שווה לשמוע איך הסיפור נשמע מהצד השני של השולחן." },
  { t: "החמור שבבור", s: "חמור זקן נפל לבור עמוק בשדה. שמע בעליו את הנעירות ורץ, אבל הבור היה עמוק מדי ואי אפשר היה להוציאו. אחרי שעה החליט: החמור זקן ממילא, והבור מסוכן. קרא לשכנים והתחילו לשפוך עפר פנימה כדי לסתום את הבור. בהתחלה נער החמור בבהלה. ואז השתתק. כשהציץ הבעלים פנימה נדהם: בכל פעם שנפלה עליו אתה עפר, החמור ניער אותה מגבו ועלה עליה צעד אחד. הם המשיכו לשפוך, והוא המשיך לנער ולעלות. אחרי כמה שעות יצא החמור מהבור על ארבע רגליו והלך לו.", n: "העפר שנשפך הוא כל מה שמגיע אליך בלי ששאלו אותך: בעיה, אכזבה, הפסד. בעל החמור התכוון לקבור אותו, וכך זה גם הרגיש. ההבדל בין להיקבר לבין לעלות היה תלוי רק בדבר אחד — האם החמור מנער מעצמו את מה שנפל, או עומד מתחתיו.", m: "מה שנשפך עליך יכול לקבור אותך או להרים אותך. כל ההבדל הוא אם אתה מנער ודורך, או עומד ומחכה." },
  { t: "שק הנוצות", s: "אדם דיבר רעות על חברו בפני אנשים. אחרי כמה ימים התחרט מאוד, ובא אל החפץ חיים לשאול איך מתקנים. אמר לו הרב: קח שק מלא נוצות, עלה לגג ופזר את כולן ברוח. הלך האיש ועשה. חזר ואמר: עשיתי. אמר לו הרב: יופי. עכשיו לך ואסוף את כולן בחזרה לשק. אמר האיש: אבל זה בלתי אפשרי! הרוח פיזרה אותן על פני כל העיר, לעולם לא אמצא אותן. אמר הרב: וכך בדיוק המילים שאמרת. גם אתה תתחרט מכל הלב, המילים כבר עברו מאדם לאדם ואתה לא תוכל לאסוף אותן.", n: "הנוצות הן המילים. כשהן בשק — הן בשליטתך לגמרי. ברגע שפיזרת אותן, כל אחד לוקח אחת והלאה, ואתה כבר לא יודע לאן הן הגיעו. לכן החרטה, כנה ככל שתהיה, מגיעה תמיד מאוחר מדי, ועבודת התיקון האמיתית היא לפני שפותחים את השק.", m: "מילה שיצאה מהפה כבר לא שייכת לך. לכן המקום היחיד שבו אפשר להשתלט עליה הוא לפני שאמרת אותה." },
  { t: "החרוב", s: "הלך חוני המעגל בדרך וראה זקן שותל עץ חרוב. שאל אותו: כמה שנים ייקח עד שהעץ הזה ייתן פרי? אמר הזקן: שבעים שנה. אמר לו: וכי אתה בטוח שתחיה עוד שבעים שנה ותאכל ממנו? אמר הזקן: כשבאתי לעולם מצאתי עצי חרוב עמוסים בפרי. לא אני שתלתי אותם — סבא שלי שתל אותם בשבילי. אז גם אני שותל בשביל הנכדים שלי.", n: "הזקן לא ענה לחוני שהוא מקווה לחיות שבעים שנה. הוא ענה תשובה אחרת לגמרי: אני חלק משרשרת. קיבלתי מסבא שלי בלי שביקשתי, ולכן אני חייב להמשיך הלאה. מי שמודד כל מעשה לפי מה שיחזור אליו — לא ייטע אף עץ.", m: "מה שאתה נוטע היום ולא תספיק לאכול ממנו — הוא בדיוק מה שיישאר אחריך." },
  { t: "הכד שנשבר", s: "משרת צעיר בבית עשיר נשא כד חרס יקר, ובדרך מעד והכד נשבר לרסיסים. עמד רועד. חשב לומר שחתול קפץ, או שהכד היה סדוק מראש. במקום זה אסף את השברים, נכנס אל אדונו ואמר: שברתי את הכד. אני מצטער. הביט בו האיש זמן ארוך ואמר: הכד הזה עלה לי הון. אבל אם היית משקר לי עכשיו, זה היה עולה לי בך — ואתה שווה לי הרבה יותר מכד.", n: "הכד היה יקר, אבל הוא רק חפץ. מה שהאדון בדק באמת היה הרגע שאחרי — האם המשרת מספר לו את האמת גם כשזה עולה לו. שברים אפשר להחליף; אדם שאי אפשר להאמין לדיווח שלו כבר לא שווה כלום בשום תפקיד.", m: "טעות עולה כסף, ואפשר לתקן אותה. הסתרה עולה באמון, וזה הדבר שהכי קשה להחזיר." },
  { t: "שני השליחים", s: "מלך שלח שני שליחים לעיר רחוקה להביא תשובה דחופה. אחרי שבוע חזר הראשון בידיים ריקות והתחיל לספר: אדוני, הדרך הייתה בלתי אפשרית. גשר אחד נשבר, בפונדק לא היה מקום, הסוס צלע, ובכניסה לעיר עצרו אותי. שמע המלך והנהן. כעבור יומיים חזר השני והניח על השולחן את התשובה. שאל אותו המלך: תגיד, ואצלך הדרך הייתה קלה? אמר השליח: היו בדיוק אותם מכשולים, אדוני. פשוט לא שלחת אותי להביא את הרשימה שלהם.", n: "שני השליחים פגשו את אותם מכשולים בדיוק. הראשון חשב שהתפקיד שלו הוא להסביר למה לא הצליח, והשני הבין שהתפקיד הוא להביא את התשובה. מכשולים תמיד יהיו, והשאלה היחידה היא אם הם הפכו לסיפור או לעקיפה.", m: "בסוף היום נשאר מה שנעשה. הרשימה של מה שהפריע לא נשארת בשום מקום." },
  { t: "הזרעים המבושלים", s: "מלך זקן שלא היו לו בנים קרא לכל ילדי הממלכה, נתן לכל אחד זרע אחד ואמר: גדלו אותו שנה. מי שיביא אליי את הצמח היפה ביותר — הוא יירש אותי. שנה שלמה השקה ילד אחד את העציץ שלו, ושום דבר לא צמח. החליף אדמה, הזיז לשמש, ובכל זאת — ריק. ביום המיועד הגיעו כל הילדים לארמון עם עציצים פורחים ומרהיבים, והוא בא אחרון עם עציץ ריק, מושפל. עבר המלך בין כולם בפנים חמורות, עד שהגיע אליו. אז חייך ואמר: כל הזרעים שחילקתי היו מבושלים. אף אחד מהם לא היה יכול לצמוח. רק ילד אחד לא הלך והחליף את הזרע שלו — והוא זה שיירש אותי.", n: "כל שאר הילדים נתקלו באותה בעיה בדיוק — הזרע לא צמח. במקום להביא עציץ ריק ולהודות, כל אחד מהם הלך והחליף אותו בזרע אחר. הם קיבלו צמח יפה ואיבדו את המבחן. הילד עם העציץ הריק היה היחיד שהביא למלך את האמת.", m: "יושר לא תמיד נראה מרשים ברגע שמסתכלים. הוא זה שנשאר עומד כשבודקים לעומק." },
  { t: "העגלה הריקה", s: "אמרו חכמים: כששתי עגלות נפגשות בשביל צר, זו שריקה מפנה דרך לזו שעמוסה. שאל תלמיד: למה דווקא הריקה? אמר לו רבו: קודם כול, כי לה קל יותר לזוז. ועוד דבר — שים לב פעם אחת מי משתי העגלות עושה יותר רעש כשהיא עוברת על המרצפות. תמיד הריקה.", n: "העגלה העמוסה היא אדם שיש לו ניסיון ותוכן. הריקה היא מי שאין לו, ולכן הוא גם רועש יותר וגם מתעקש יותר על הזכות שלו לעבור. במחלוקת קטנה, מי שמוותר על הצדק בדרך כלל הוא זה שיש לו מה להפסיד מהעיכוב.", m: "מי שבאמת יודע לא צריך להרים את הקול, וגם לא נלחם על כל צדק קטן בדרך." },
  { t: "הפרה ששמרה שבת", s: "יהודי עני מכר את פרתו לשכנו הגוי. למחרת חזר הקונה כועס: הפרה עובדת יפה כל השבוע, אבל בשבת היא לא זזה ולא מושכת. רימית אותי! בא היהודי לרפת, התקרב לפרה, לחש לה משהו באוזן — והיא קמה מיד והתחילה לעבוד. אמר הגוי: מה אמרת לה? אמר היהודי: אמרתי לה שהיא כבר לא שלי, ומעכשיו מותר לה לעבוד בשבת. עמד הגוי המום ואמר: אם בהמה שגדלה בבית שלך למדה לשמור שבת בלי שאף אחד לימד אותה — מה זה אומר עליי, שיש לי דעת? בסוף אותה שנה התגייר.", n: "הגוי לא התרשם מדרשה ולא מוויכוח. הוא ראה משהו אחר: היהודי לא ניסה להשפיע על אף אחד, הוא פשוט חי כך, וזה חלחל גם לבהמה שלו. ההשפעה החזקה ביותר היא זו שלא מכוונת אל אף אחד.", m: "אנשים לא לומדים ממה שאתה מסביר להם. הם לומדים ממה שרואים אצלך כשאתה לא מנסה ללמד אף אחד." },
  { t: "איך קוראים לך", s: "עשיר עבר כל בוקר באותו רחוב, וכל בוקר ישב שם קבצן. העשיר היה זורק לו מטבע בלי לעצור ובלי להסתכל. יום אחד היה לו זמן, והוא עצר, כרע לידו ושאל: תגיד, איך קוראים לך? הרים הקבצן את הראש, הביט בו רגע ארוך, ואמר את שמו. שנים אחר כך ניגש אל העשיר אדם מסודר ואמר: אתה לא זוכר אותי. ישבתי ברחוב הזה. המטבעות שנתת לי עזרו לי לאותו יום. השאלה שלך מה שמי — היא זו שהזכירה לי שאני עוד בן אדם, ומשם התחלתי לקום.", n: "המטבע פתר לקבצן בעיה של יום אחד. השאלה מה שמו פתרה משהו אחר לגמרי: היא החזירה לו את המעמד של בן אדם שמדברים איתו, ולא של פינה ברחוב שזורקים אליה. מכאן התחילה היכולת שלו לקום.", m: "לפעמים מה שאדם צריך זה לא מה שאתה נותן לו, אלא שתראה אותו." },
  { t: "הגשר הצר", s: "אמר רבי נחמן מברסלב: כל העולם כולו גשר צר מאוד, והעיקר לא לפחד כלל. שאלו אותו התלמידים: רבנו, אם הגשר צר כל כך — אולי דווקא כדאי לפחד? אמר להם: שימו לב מה אמרתי. לא אמרתי שאין ממה לפחד, ולא אמרתי שהגשר רחב. אמרתי שהפחד הוא זה שמפיל. אדם שהולך על גשר צר בביטחון — עובר אותו. אותו אדם בדיוק, כשהוא קופא מפחד באמצע — נופל.", n: "רבי נחמן לא הבטיח שהגשר רחב ולא שאין תהום. הוא אמר שהסכנה האמיתית היא הקיפאון שהפחד גורם. אותו אדם עצמו, על אותו גשר, עובר אותו בביטחון ונופל ממנו בבהלה. השינוי הוא לא בגשר — הוא במה שקורה בראש.", m: "לרוב לא הקושי מפיל אותנו, אלא הסיפור שאנחנו מספרים לעצמנו עליו באמצע הדרך." },
  { t: "המסמרים בגדר", s: "ילד היה כעסן מאוד. נתן לו אביו שקית מסמרים ופטיש ואמר: בכל פעם שאתה מאבד את העשתונות, לך ותקע מסמר בגדר העץ שבחצר. ביום הראשון תקע שלושים ושבעה מסמרים. אחרי כמה שבועות למד להתאפק, ומספר המסמרים ירד לאפס. אמר לו אביו: עכשיו, בכל יום שאתה מצליח לשלוט בעצמך — הוצא מסמר אחד. עברו חודשים והבן הוציא את כולם. קרא לו אביו לגדר ואמר: עשית עבודה יפה מאוד. עכשיו תסתכל טוב על הגדר. הגדר הייתה מנוקבת כולה בחורים. אמר האב: אפשר לבקש סליחה, וזה חשוב. אבל החורים נשארים.", n: "המסמרים הם הרגעים שבהם אדם מאבד שליטה, והחורים הם מה שנשאר אצל האנשים שספגו את זה. האב לא לימד אותו שאסור לכעוס, אלא הראה לו שגם אחרי שהצליח לתקן לגמרי — הגדר כבר לא אותה גדר.", m: "מילה קשה אפשר לתקן. את הסימן שהיא משאירה קצת יותר קשה למחוק." },
  { t: "הפיל והיתד", s: "מטייל ראה במחנה קרקס פיל ענקי שקשור ברגלו בחבל דק, והחבל קשור ליתד קטנה בקרקע. הפיל היה יכול לעקור את היתד בתנועה אחת, אבל עמד במקום. שאל את המאלף: איך זה מחזיק אותו? אמר המאלף: כשהוא היה גור קטן קשרנו אותו בדיוק ככה. אז הוא באמת לא הצליח. הוא ניסה ומשך, יום אחרי יום, עד שהפסיק לנסות. היום הוא ענק, אבל הוא עדיין מאמין שהחבל הזה חזק ממנו.", n: "החבל הדק הוא כל אמונה שנוצרה בגיל צעיר או אחרי כישלון: אני לא טוב במספרים, אני לא יודע לנהל, זה לא בשבילי. היא הייתה נכונה כשנוצרה. הבעיה היא שהיא נשארה גם אחרי שהכוח גדל פי מאה.", m: "לפעמים מה שעוצר אותנו זה לא הכוח של היום, אלא הזיכרון של כישלון ישן שכבר לא רלוונטי." },
  { t: "שק התפוחים", s: "סוחר שלח את בנו לשוק עם שק תפוחים ואמר: מכור אותם. חזר הבן בערב עם השק כמעט מלא. שאל האב: מה קרה? אמר הבן: הראשון הציע מחיר נמוך, אז חיכיתי. השני הציע קצת יותר אבל רצה חצי שק בלבד. השלישי הציע מחיר טוב אבל רצה לשלם מחר. חשבתי שמחר יגיע מישהו טוב יותר. אמר האב: תגיד לי, ביקשתי ממך למצוא את המחיר הטוב בעולם? אמרתי לך: תמכור. אם היית מוכר לראשון, היה לך היום כסף ומחר שק חדש.", n: "האב לא ביקש מהבן להשיג את המחיר הגבוה בעולם, אלא למכור. הבן החליף את המשימה במשימה אחרת, קשה יותר ובלתי אפשרית, ולכן חזר בלי כלום. יש הבדל בין למקסם לבין לסיים, ומי שמבלבל ביניהם נשאר עם שק מלא.", m: "מי שמחכה לעסקה המושלמת חוזר בערב עם שק מלא ובלי שקל. לסגור זה לא אותו דבר כמו להוציא את המקסימום." },
  { t: "הנר שהדליק נר", s: "שאלו את הרב: אדם שמלמד את חברו מקצוע — הרי הוא מכניס לעצמו מתחרה. למה שיעשה את זה? לקח הרב נר דולק והדליק ממנו נר שני. אמר: תסתכל בנר הראשון. הוא איבד משהו? אמר התלמיד: לא, הוא בדיוק אותו נר. אמר הרב: נכון. אבל עכשיו תסתכל על החדר. פתאום רואים בו הרבה יותר טוב, וגם הנר הראשון נהנה מזה.", n: "הפחד מלימוד הוא שהידע יעבור למישהו אחר ואצלי יישאר פחות. אבל ידע הוא לא כמות סגורה, הוא אור. אחרי שהדלקת נר שני, גם אתה עצמך רואה טוב יותר את מה שאתה עושה — כי בחדר מואר קל יותר לכולם.", m: "ידע הוא לא עוגה שמתחלקת. מי שחושש ללמד — בעיקר משאיר את עצמו לבד בחושך." },
  { t: "החלון והמראה", s: "עשיר גדול היה, ולא היה נותן לאיש. הזמין אותו הרב לחדרו, העמיד אותו מול החלון ושאל: מה אתה רואה? אמר העשיר: אנשים ברחוב. ילדים, זקנה שנושאת סל. אחר כך העמיד אותו מול המראה ושאל שוב: ועכשיו מה אתה רואה? אמר: רק את עצמי. אמר הרב: שים לב, שניהם עשויים מאותה זכוכית בדיוק. ההבדל היחיד הוא שכבת הכסף הדקה שמאחורי המראה. ברגע שמורחים כסף מאחורה — מפסיקים לראות אנשים ומתחילים לראות רק את עצמנו.", n: "החלון והמראה זהים בחומר, ומה שמשנה ביניהם הוא שכבת כסף דקה מאוד. כך גם אצל אדם: אף אחד לא הופך אחר בין לילה. הכסף פשוט מכסה לאט את השקיפות, עד שבמקום לראות אנשים רואים רק את ההשתקפות של עצמנו.", m: "כסף לא הופך אדם לרע. הוא רק בודק אם הוא ממשיך להסתכל דרך החלון." },
  { t: "המזוודה על הברכיים", s: "אדם עלה לרכבת עם מזוודה כבדה מאוד. הוא התיישב, הניח את המזוודה על הברכיים והחזיק אותה חזק. עברה שעה, והוא כולו מיוזע ומכווץ. אמר לו הנוסע שממול: סלח לי, למה אתה לא מניח אותה על הרצפה? אמר: אני חייב להחזיק אותה, היא כבדה. אמר לו האיש: הרכבת נושאת אותה בכל מקרה — אותך ואת המזוודה יחד. אתה רק מחליט אם לשאת אותה בנוסף.", n: "הרכבת היא המציאות שממילא נושאת את הכול. המזוודה תגיע ליעד בין אם תחזיק אותה ובין אם לא. כל המאמץ להחזיק אותה חזק לא משנה כלום בתוצאה — הוא רק הופך את הנסיעה לקשה יותר בשבילך.", m: "יש דאגות שאתה סוחב על הברכיים, למרות שהמציאות נושאת אותן ממילא. אתה רק מוסיף את המשקל לעצמך." },
  { t: "הבור שחפרת לעצמך", s: "פועל נשלח לחפור בור בקצה השדה. הוא חפר במרץ, ובאמצע העבודה עלה בו רעיון: אף אחד לא רואה אותי כאן. הוא חפר רדוד יותר, כיסה בעפר וחזר לדווח שסיים. עברה שנה, ובעל השדה נתן לו במתנה חלקת אדמה — בדיוק את החלקה עם הבור. בחורף ירדו גשמים, האדמה שקעה, והוא נאלץ לחפור הכול מחדש בכפול מאמץ.", n: "הפועל היה בטוח שהוא חוסך זמן על חשבון מישהו אחר. מה שהוא לא ידע זה שכל עבודה חוזרת בסוף אל מי שעשה אותה — לפעמים אחרי שנה, ולפעמים ברגע הכי לא מתאים.", m: "העבודה שאתה מרמה בה תמיד חוזרת אליך — לרוב כשכבר אין לך זמן לעשות אותה שוב." },
  { t: "הדבש והדבורה", s: "שאל תלמיד את רבו: הדבורה היא שרץ טמא, ואסור לאכול אותה. אז איך הדבש שלה כשר? אמר הרב: כי הדבש הוא לא ממנה. היא אוספת אותו מהפרחים ומעבירה הלאה, בלי לשנות אותו. מה שיצא ממנה זה לא היא — זה מה שהיא לקחה מהשדה.", n: "הדבורה היא לא הדבש, והיא גם לא מקלקלת אותו. היא רק צינור שמעביר. לכן אפשר לקבל דבר טוב גם ממי שלא היית בוחר ללמוד ממנו — בתנאי שבודקים את הדבר עצמו ולא את מי שהביא אותו.", m: "תבדוק את העצה, לא את מי שנתן אותה." },
  { t: "הכיסים", s: "תלמידי הבעל שם טוב פגשו יהודי עני שרקד בשמחת תורה בכל כוחו. שאלו אותו: על מה אתה כל כך שמח? יש לך בית קטן ואין לך כמעט כלום. אמר להם: יש לי גג מעל הראש, יש לחם, ויש לי היום הזה. חזרו התלמידים ושאלו את רבם: איך זה שהוא שמח יותר מכולנו? אמר להם הבעל שם טוב: שימו לב, יש לו בדיוק אותם שני כיסים כמו לכם. ההבדל הוא שהוא סופר מה יש בהם, ואתם סופרים מה חסר.", n: "לשני הצדדים יש בדיוק אותם שני כיסים. אחד סופר את מה שיש בפנים והשני את מה שחסר, ושניהם מגיעים למספר נכון. הכיסים לא קובעים את השמחה — הספירה קובעת.", m: "עושר הוא לא כמה יש לך אלא כמה אתה צריך כדי להיות מרוצה." },
  { t: "מי שאין לו מה לתת לך", s: "רב אחד היה בודק אנשים לפני שהיה נותן להם תפקיד. הוא לא שאל אותם שאלות בהלכה ולא בדק כמה הם יודעים. הוא היה יוצא איתם לרחוב ומסתכל איך הם מדברים עם המוכר בחנות, עם השוער, עם הילד שמבקש עזרה. אמר: את מי שיש לו מה לתת לי — אני יודע איך אני מתנהג אליו. השאלה היחידה היא איך אני מתנהג אל מי שלא יכול לתת לי כלום.", n: "מול אדם חשוב כולם מתנהגים יפה, ולכן זה לא אומר כלום. מול מי שאין לו מה להציע נחשפת ההתנהגות האמיתית, כי אין שום סיבה חיצונית להתאמץ. שם רואים מי האדם באמת.", m: "היחס שלך למי שלא יכול להועיל לך — הוא זה שמעיד עליך יותר מהכול." },
  { t: "הסולם של יעקב", s: "בחלום ראה יעקב סולם מוצב ארצה וראשו מגיע השמימה, ומלאכי אלוקים עולים ויורדים בו. שאל תלמיד: למה דווקא סולם? היה יכול לראות מדרגות רחבות, או הר. אמר לו הרב: כי בסולם אי אפשר לדלג. אתה עולה שלב אחד בכל פעם, ואם תנסה לקפוץ שניים — תיפול. ועוד דבר: סולם צריך שיהיה מוצב ארצה. אם אין מי שמחזיק אותו למטה — הוא לא מגיע לשום מקום.", n: "הסולם הוא הדרך לכל דבר גדול. הוא צר, עולים בו שלב אחד בכל פעם, ומי שמנסה לדלג נופל. ולא פחות חשוב — הוא חייב להישען על הקרקע ועל מישהו שמחזיק אותו, אחרת הוא נופל גם אם הראש שלו בשמיים.", m: "אין קיצור דרך למעלה, ואף אחד לא מגיע לשם לבד." },
  { t: "שני הנהגים", s: "שאלו נהג ותיק: מה בעצם ההבדל בינך לבין נהג צעיר עם רישיון טרי? אמר: הצעיר יודע לצאת מהבור מהר ממני, כי יש לו יותר כוח. אמרו: אז מה היתרון שלך? אמר: אני מזהה את הבור מרחוק, ולא נכנס אליו בכלל. הוא ילמד את זה — אבל רק אחרי שייכנס לכמה.", n: "הצעיר חזק יותר ומהיר יותר, וזה יתרון אמיתי. אבל כל הכוח הזה מושקע בלצאת מבורות. הוותיק משקיע הרבה פחות אנרגיה, כי הוא מזהה את הבור מרחוק. זה כל ההבדל בין לעבוד קשה לבין לעבוד נכון.", m: "ניסיון הוא לא רק לדעת לתקן מהר. הוא בעיקר לדעת מה לא לעשות מלכתחילה." },
  { t: "האבן בדרך", s: "מלך רצה לבדוק את אנשי ממלכתו. לילה אחד הניח אבן גדולה באמצע הדרך הראשית, והתחבא בצד. בבוקר הגיע סוחר עשיר עם עגלה, קילל את האבן, עקף אותה והמשיך. אחריו עברו חיילים, אמרו זה לזה שזו בושה שאף אחד לא מטפל בזה, והמשיכו. כך עבר יום שלם. לפנות ערב הגיע איכר זקן עם שק ירקות. הוא הניח את השק, ניגש לאבן, ודחף אותה בכל כוחו הצידה. כשקם, ראה במקום שבו עמדה האבן כיס עור ובו מטבעות זהב ופתק מהמלך: זה שייך למי שהזיז את האבן.", n: "כל מי שעבר בדרך ראה את אותה בעיה בדיוק, וכולם צדקו בטענה שמישהו היה צריך לטפל בה. ההבדל היחיד היה מי הפסיק לדבר על זה והתכופף. הזהב לא היה שכר על מזל — הוא היה מונח שם כל היום, מתחת לתלונות של כולם.", m: "מי שמזיז את האבן במקום להתלונן עליה, מגלה מה היה מתחתיה. השאר רק עוקפים." },
  { t: "שלושה בונים", s: "עבר אדם ליד אתר בנייה וראה שלושה פועלים עושים בדיוק אותה עבודה — מניחים אבן על אבן. שאל את הראשון: מה אתה עושה? ענה: לא רואה? מניח אבנים. עבודה שוברת גב. שאל את השני: ואתה? ענה: אני מפרנס משפחה. יש לי ארבעה ילדים בבית וזה מה שיש. שאל את השלישי, שעבד באותו קצב אבל בפנים אחרות: ואתה? ענה: אני בונה בית כנסת. עוד שנתיים יעמדו כאן אנשים ויתפללו, והקיר הזה יהיה הקיר שלהם. אמר האיש: שלושתכם עשיתם היום בדיוק אותה עבודה. אבל רק אחד מכם עבד יום שלם ולא התעייף.", n: "אף אחד מהשלושה לא שיקר. באמת מניחים אבנים, ובאמת צריך לפרנס. אבל מי שרואה רק את האבן שבידו נשחק, ומי שרואה את הקיר שייבנה ממנה מחזיק מעמד. אותה עבודה בדיוק, שני מצבי רוח שונים לגמרי בסוף היום.", m: "אותה עבודה יכולה להיות סבל או בנייה. ההבדל הוא רק בשאלה אם אתה רואה את הקיר או רק את האבן." },
  { t: "הכתם השחור", s: "מורה נכנס לכיתה, תלה על הלוח דף לבן גדול, ובמרכזו נקודה שחורה קטנה. שאל את התלמידים: מה אתם רואים? קם אחד ואמר: נקודה שחורה. קם שני ואמר: כתם. וכך אמרו כולם. חייך המורה ואמר: כולכם ראיתם נקודה קטנה. אף אחד מכם לא ראה את הדף הלבן הענק שמסביבה, למרות שהוא תופס תשעים ותשעה אחוזים מהשטח. ככה בדיוק אנחנו מסתכלים על אנשים ועל ימים שלמים.", n: "הנקודה השחורה בולטת כי היא חריגה, וזה בדיוק מה שגורם לעין להיתקע בה. אבל מי ששופט לפי מה שבולט מפספס את כל השאר — את היום שהיה בסדר, את העובד שעשה תשע עבודות טובות ואחת לא, את היחסים שהיו טובים עד שיצאה משפט אחד לא במקום.", m: "הנקודה השחורה תמיד תבלוט. זה לא הופך אותה לתמונה." },
  { t: "הציפור בידיים", s: "נער חכם רצה להוכיח שהזקן של הכפר לא באמת יודע הכול. הוא תפס ציפור קטנה, סגר עליה את כפות ידיו והלך אליו. חשב לעצמו: אשאל אותו אם הציפור חיה או מתה. אם יאמר חיה — אמעך אותה. אם יאמר מתה — אפתח את הידיים והיא תעוף. כך או כך אני צודק. הגיע ושאל: הציפור שבידיי, חיה או מתה? הביט בו הזקן ארוכות ואמר: בני, התשובה בידיים שלך.", n: "הנער בנה מלכודת שאין ממנה מוצא, אבל הזקן לא נכנס לתוכה. הוא לא ניסה לנחש נכון — הוא החזיר לנער את מה שהיה שלו מלכתחילה. יש הרבה מצבים שנראים כמו שאלה על העולם, ובאמת הם שאלה על מה שאתה מתכוון לעשות.", m: "הרבה דברים שנראים כמו גורל הם באמת החלטה. התשובה בידיים שלך." },
  { t: "שני הימים", s: "בארץ ישראל יש שני ימים, ושניהם מקבלים מים מאותו נהר — הירדן. הראשון הוא הכינרת. המים נכנסים אליו מצפון ויוצאים ממנו בדרום, וסביבו דגים, ציפורים, עצים וכפרים. השני הוא ים המלח. גם אליו נכנסים אותם מים בדיוק, אבל ממנו לא יוצא כלום. הכול נשאר בפנים ומתאדה, והמלח מצטבר. סביבו אין דג אחד ואין עץ אחד. שני הימים מקבלים אותו נהר. ההבדל היחיד הוא שאחד גם נותן והשני רק אוגר.", n: "ים המלח לא עשה שום דבר רע. הוא פשוט שמר לעצמו את כל מה שקיבל. דווקא זה מה שהרג בו כל חיים. הכינרת נותנת הלאה בדיוק את מה שקיבלה, ולכן היא נשארת חיה ומזרימה — ולא נהיית פחות מלאה בגלל זה.", m: "מה שאתה מעביר הלאה שומר עליך חי. מה שאתה רק אוגר, בסוף מולח אותך מבפנים." },
  { t: "שתי העיזים", s: "שתי עיזים נפגשו על גשר צר מאוד מעל נחל עמוק. הגשר היה רחב לעז אחת בלבד. עמדו שתיהן זו מול זו. הראשונה אמרה: תפני לי, אני עברתי חצי גשר. השנייה אמרה: גם אני. דחפו זו את זו בקרניים, ושתיהן כמעט נפלו למים. לבסוף כרעה אחת מהן ארצה ונשכבה על הגשר. חברתה דרכה עליה בזהירות ועברה. אחר כך קמה הראשונה, ניערה את עצמה, והמשיכה גם היא בדרכה. שתיהן הגיעו ליעד.", n: "העז שנשכבה נראתה כאילו הפסידה — היא ויתרה והשנייה דרכה עליה. אבל היא זו שהצילה את שתיהן, וגם היא הגיעה לצד השני. מי שמתעקש לנצח בוויכוח על גשר צר, לרוב לא מנצח — הוא רק בוחר שגם הוא ייפול.", m: "לפעמים מי שמתכופף ראשון הוא היחיד שדואג ששניכם תגיעו לצד השני." },
  { t: "הנעל השנייה", s: "אדם עלה לרכבת, וברגע שהתיישב נפלה אחת הנעליים שלו מהחלון החוצה. הרכבת כבר זזה ואי אפשר היה לעצור. חשב רגע, ואז הוריד את הנעל השנייה וזרק גם אותה מהחלון, בערך לאותו מקום. הביטו בו הנוסעים בפליאה. אמר להם: נעל אחת לא שווה לי כלום, ולא תשמש אף אדם. אבל אם מי שימצא אותן יקבל זוג שלם — לפחות מישהו ירוויח מזה. אני כבר איבדתי את שלי בכל מקרה.", n: "האיש לא ניסה לתקן את מה שכבר קרה, ולא בזבז את הנסיעה על כעס. הוא שאל שאלה אחת מעשית: מהמצב הנוכחי, מה עוד אפשר להציל. הנעל הראשונה הייתה אבודה בין כה וכה. השאלה היחידה שנשארה בשליטתו היא מה עושים עם השנייה.", m: "מה שאבד כבר אבד. השאלה היחידה ששווה משהו היא מה אתה עושה עם מה שנשאר בידיים." },
  { t: "הפרצה בסכר", s: "בהולנד ילד קטן חזר מבית הספר לאורך הסכר וראה חור קטן, בגודל אצבע, שדרכו נזל קילוח דק של מים. הוא ידע שמעבר לסכר יש ים שלם, ושחור קטן הופך במהירות לחור גדול. תקע את אצבעו בחור ועמד. עבר ערב, עברה לילה קר, והוא לא זז. בבוקר מצאו אותו אנשי העיר קפוא ומחזיק. סתמו את הפרצה ואמרו: הילד הזה הציל את כולנו, כשהיא עוד הייתה בגודל אצבע.", n: "הים לא פרץ בבת אחת. הוא התחיל מחור בגודל אצבע, שאפשר היה לעבור לידו ולא לשים לב. מי שמטפל בפרצה כשהיא קטנה משלם באי נוחות של לילה אחד. מי שממתין משלם בעיר שלמה.", m: "כל בעיה גדולה הייתה פעם בגודל אצבע. ההבדל הוא רק מי עצר לידה אז." },
  { t: "גם זו לטובה", s: "נחום איש גם זו נשלח לשאת מתנה לקיסר — תיבה מלאה אבנים טובות. בלילה, בפונדק שבו לן, גנבו את התכשיטים ומילאו את התיבה בעפר. בבוקר ראה זאת ואמר כדרכו: גם זו לטובה. הגיע לקיסר, פתחו את התיבה ומצאו עפר. כעס הקיסר וביקש להרוג אותו. באותו רגע נזכר אחד מיועציו וסיפר שיש מסורת על אברהם אבינו, שכשנלחם — העפר שזרק היה נהפך לחרבות. שלח הקיסר את העפר לשדה הקרב, ניצח בקרב שלא הצליח לנצח בו שנים, והחזיר את נחום לביתו בכבוד ובמתנות.", n: "ברגע שבו הכול קרס אי אפשר היה לדעת מה יהיה בסוף, ונחום גם לא ידע. הוא לא אמר שהעפר טוב — הוא אמר שהוא לא מוכן להכריע שזה רע לפני שראה את הסוף. רוב הכעס שלנו נאמר באמצע הסיפור, כשעוד אין לנו את כל המידע.", m: "אל תסכם את הסיפור באמצע. הרבה דברים שנראו אסון בבוקר קיבלו שם אחר לגמרי בערב." },
  { t: "הנר, התרנגול והחמור", s: "רבי עקיבא היה הולך בדרך ועימו חמור, תרנגול ונר. הגיע לעיר וביקש ללון, ולא הכניסו אותו באף בית. אמר: כל מה שעושה הקדוש ברוך הוא — לטובה. יצא ולן בשדה. בלילה בא רוח וכיבה את הנר, בא חתול ואכל את התרנגול, בא אריה ואכל את החמור. בכל פעם אמר: גם זו לטובה. באותו לילה הגיע גדוד לעיר ולקח את כל תושביה בשבי. אמר: אילו היה נר דולק היו רואים אותי, אילו קרא התרנגול או נער החמור היו שומעים אותי. כל מה שאיבדתי הוא מה שהציל אותי.", n: "כל אחד מהשלושה נראה באותו רגע כמו הפסד נקי — אור, שעון מעורר, כלי תחבורה. רק בבוקר התברר שהם היו בדיוק הדברים שהיו מסגירים אותו. אי אפשר לדעת את זה מראש, ולכן כל מה שנשאר הוא לא למהר לקבוע.", m: "לפעמים מה שנלקח ממך הוא בדיוק מה שהיה מסגיר אותך. את זה רואים רק בבוקר." },
  { t: "האבן שנשחקה", s: "רבי עקיבא היה בן ארבעים ולא ידע לקרוא אות אחת. יום אחד עמד ליד באר וראה אבן גדולה שבמרכזה שקע עמוק. שאל: מי חצב את האבן הזאת? אמרו לו: אף אחד. המים שנוטפים עליה טיפה טיפה, כל יום, שנים רבות. אמר בליבו: אם מים רכים שוחקים אבן קשה — לא כל שכן שדברי תורה, שהם קשים, ייכנסו בליבי שהוא בשר. באותו יום הלך עם בנו הקטן לבית הספר, והתיישב ללמוד את האותיות מההתחלה, עם הילדים.", n: "האבן לא נשברה במכה אחת חזקה, אלא מטיפות שכל אחת מהן לבדה לא עשתה כלום. עקיבא לא הסיק שהוא צריך יום אחד גדול, אלא שהוא צריך הרבה מאוד ימים קטנים. זה גם מה שהחזיק אותו — הוא לא חיפש קפיצה, רק את הטיפה של היום.", m: "לא הכוח של המכה שוחק את האבן, אלא זה שהטיפה חוזרת כל יום." },
  { t: "השעון בערמת השחת", s: "אדם איבד את שעונו בערמת שחת גדולה. קרא לילדי הכפר והבטיח פרס למי שימצא. עשרה ילדים קפצו לתוך הערמה, הפכו אותה, צעקו, זרקו חציר לכל עבר — ולא מצאו כלום. התייאשו והלכו. נשאר ילד אחד קטן. הוא ביקש להישאר עוד רגע לבד. נכנס לערמה, שכב בשקט לגמרי ולא זז. אחרי דקה שמע תקתוק דק, הושיט יד ומשך את השעון. שאל אותו האיש: איך? אמר: הם חיפשו. אני הקשבתי.", n: "עשרה ילדים חזקים ומהירים לא מצאו, וילד אחד בשקט מצא — לא כי היה חכם מהם, אלא כי הבין שהבעיה לא דורשת יותר תנועה אלא פחות רעש. יש דברים שברגע שמפסיקים לרוץ סביבם, הם מודיעים על עצמם.", m: "יש תשובות שלא מוצאים בכוח של חיפוש, אלא ברגע אחד של שקט." },
  { t: "הפיל והעיוורים", s: "שישה אנשים עיוורים שמעו שהביאו פיל לכפר, ורצו לדעת מהו. ניגש הראשון ונגע ברגל ואמר: הפיל הוא כמו עמוד. השני נגע בחדק ואמר: לא, הוא כמו נחש עבה. השלישי נגע באוזן ואמר: אתם טועים, הוא כמו מניפה גדולה. הרביעי נגע בזנב ואמר: הוא כמו חבל. החמישי נגע בשן ואמר: הוא קשה וחלק כמו רומח. השישי נגע בגוף ואמר: הוא קיר. הם רבו ביניהם עד הערב. עבר שם אדם רואה ואמר: כולכם צודקים לגמרי. פשוט כל אחד מכם מחזיק חלק אחר.", n: "אף אחד מהשישה לא שיקר, וכל אחד מהם יכול היה להישבע על מה שמישש. הטעות לא הייתה במה שהם אמרו אלא במילה הפיל הוא — כשהם התכוונו החלק שאני מחזיק הוא. רוב הוויכוחים הקשים בנויים בדיוק ככה.", m: "לפעמים אתם לא חלוקים על העובדות. פשוט כל אחד מחזיק חלק אחר של אותו פיל." },
  { t: "מערת ההדים", s: "ילד הלך עם אביו בהרים, מעד ונפל, וצעק מכאב. פתאום שמע קול מרחוק שצועק בדיוק אותו דבר. נבהל וצעק: מי אתה? והקול חזר: מי אתה? כעס וצעק: פחדן! והקול ענה: פחדן! פנה לאביו בבכי. אמר לו האב: תקשיב. וצעק אל ההר: אתה אלוף! והקול חזר: אתה אלוף! צעק: אני מעריך אותך! וחזר: אני מעריך אותך! אמר האב לבנו: אנשים קוראים לזה הד. אני קורא לזה חיים. הם מחזירים לך בדיוק את מה ששלחת.", n: "הילד היה בטוח שיש מישהו בהר שמתגרה בו, וכעס עליו. באמת לא היה שם אף אחד חוץ ממנו. רוב מה שחוזר אלינו מאנשים הוא לא החלטה שלהם עלינו, אלא ההמשך של הטון שבו פתחנו.", m: "העולם בדרך כלל מחזיר את הטון שבו פנית אליו, לא את זה שהתכוונת אליו." },
  { t: "הגרזן הקהה", s: "שני חוטבי עצים יצאו ליער בבוקר. הראשון היה צעיר וחזק, וכרת בלי הפסקה מהבוקר עד הערב. השני היה מבוגר, וכל שעה היה יושב לרבע שעה. בערב ספרו: למבוגר היה כפול. כעס הצעיר ואמר: לא ייתכן! ראיתי אותך יושב ומנוח כל שעה! אמר לו המבוגר: לא נחתי. ישבתי והשחזתי את הגרזן. אתה כרתת כל היום עם להב קהה יותר ויותר, והשקעת פי שניים כוח על כל חתך.", n: "הצעיר עבד יותר שעות ובאמת התאמץ יותר. אבל הוא ראה בהשחזה בזבוז זמן, כי בזמן הזה לא נופל אף עץ. מי שלא עוצר לתחזק את הכלי — בין אם זה גרזן, רכב, סדר עבודה או ראש — משלם על זה בכל חתך, בלי לשים לב.", m: "הזמן שבו אתה משחיז לא נראה כמו עבודה. הוא זה שקובע כמה תספיק בשאר היום." },
  { t: "האבנים והצנצנת", s: "מורה הניח על השולחן צנצנת זכוכית ריקה, ומילא אותה באבנים גדולות עד שלא נכנסה עוד אחת. שאל: הצנצנת מלאה? אמרו: כן. שפך פנימה חצץ, שהתגלגל בין האבנים. שאל שוב: עכשיו מלאה? אמרו: כן. שפך חול, שנכנס לכל הפינות. שאל שוב, ואז שפך כוס מים. אמר: זו הצנצנת שלכם. אם הייתם שמים קודם את החול, לא הייתה נכנסת אף אבן גדולה. שימו את האבנים הגדולות ראשונות — השאר תמיד ימצא לעצמו מקום.", n: "החול והחצץ הם הדברים הקטנים שממלאים יום שלם וגם באמת צריך לעשות אותם. הבעיה היא רק הסדר: הם מתפשטים לכל מקום פנוי, ואם נותנים להם להיכנס ראשונים, פשוט לא נשאר מקום לדבר הגדול באמת.", m: "לא חסר לך זמן. השאלה היחידה היא מה נכנס לצנצנת ראשון." },
  { t: "הכוס והאגם", s: "בא תלמיד אל רבו וסיפר שהצרה שנפלה עליו מרה מנשוא. לקח הרב מלח, שפך חופן שלם לכוס מים וביקש ממנו לשתות. שתה התלמיד וירק: זה בלתי אפשרי. למחרת לקח אותו הרב לאגם, שפך לתוכו חופן מלח זהה בדיוק וביקש ממנו לשתות. שתה ואמר: מתוק. שאל הרב: אותה כמות מלח בדיוק. מה השתנה? אמר התלמיד: הכלי. אמר לו הרב: הכאב הוא המלח. הכמות שלו לא בידיים שלך. גודל הכלי שאתה שם אותו בתוכו — כן.", n: "הרב לא אמר שהצרה קטנה ולא ניסה להקטין אותה, כי כמות המלח לא השתנתה. הוא דיבר על הכלי — כמה עוד יש בחיים סביב הכאב הזה. מי שכל עולמו מצטמצם לכוס יטעם רק מלח, גם אם זו בדיוק אותה כמות.", m: "אתה לא תמיד יכול להפחית את המלח. אתה כן יכול להגדיל את הכלי." },
  { t: "הבית האחרון", s: "נגר ותיק הודיע לבעל החברה שהוא פורש. אמר לו בעל הבית: תבנה לי בבקשה בית אחד אחרון ואז תלך. הסכים הנגר, אבל ליבו כבר לא היה בעבודה. הוא קיצר פינות, קנה חומרים זולים, ולא בדק את מה שלא רואים. כשסיים, בא בעל הבית, עבר בין החדרים, ואז הושיט לו את המפתח ואמר: זו מתנת הפרישה שלך. הבית הזה הוא שלך. עמד הנגר ולא ידע מה לומר. הוא בנה בית שהוא עצמו יגור בו — וידע בדיוק איפה כל קיצור דרך.", n: "הנגר לא רימה אף אחד חוץ מעצמו, אבל הוא לא ידע את זה בזמן העבודה. הוא חשב שהוא חוסך מאמץ על חשבון מישהו אחר. כל עבודה שאדם עושה בונה בסוף את הבית שהוא עצמו יגור בו — המוניטין שלו, ההרגלים שלו, מה שאומרים עליו.", m: "אף אחד לא באמת חוסך על חשבון מישהו אחר. החשבון תמיד חוזר בשם שלך." }
];

function _todayStory() {
  // שישי ושבת הם סיפור אחד: הסופר מתקדם בכל יום חוץ משבת, ולכן בשבת
  // נשאר הסיפור של שישי. 1.1.1970 היה יום חמישי, כך שכל שבת היא d≡2 (mod 7).
  const now = new Date();
  const d = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const saturdays = Math.floor((d + 5) / 7);
  return _DAILY_STORIES[(d - saturdays) % _DAILY_STORIES.length];
}

/* האם הסיפור של היום כבר נקרא. נשמר בשרת, כך שקריאה מהטלפון נספרת
   גם במחשב. מתאפס בחצות, יחד עם החלפת הסיפור. */
let _storyReadDay = null;

// הסמל שהמנהל העלה נשמר ב-config/barca ומוחל על כל המכשירים
function _crestListen() {
  if (window._crestUnsub) return;
  window._crestUnsub = true;
  _onSnap(_docRef('config', 'barca'), snap => {
    const url = snap.exists() ? (snap.data().crest || '') : '';
    if (url) document.documentElement.style.setProperty('--fcb-crest', `url("${url}")`);
    else document.documentElement.style.removeProperty('--fcb-crest');
    document.body.classList.toggle('has-crest', !!url);
    try { renderCalendar(); } catch (e) {}
  }, () => {});
}

function _storyListen() {
  if (window._storyUnsub) return;
  window._storyUnsub = true;
  _onSnap(_docRef('config', 'daily_story'), snap => {
    _storyReadDay = (snap.exists() ? snap.data().readDay : '') || '';
    _renderDailyQuote();
  }, () => {});
}

/* בין 07:00 ל-10:00 שורת סיפור היום מוחלפת בחניות שהנהג צריך להניע הבוקר.
   מ-10:00 ואילך חוזר סיפור היום, ולמחרת ב-07:00 שוב החניות. */
function _msQuoteSlot() {
  if (currentUser?.role === 'manager') return null;
  const h = new Date().getHours();
  if (h < 7 || h >= 10) return null;
  if (_msThirdOf() === null) return { empty: 'שבת — אין הנעות היום' };
  if (!(_msToday && _msToday.day === _msDayKey())) return { empty: 'המנהל עדיין לא חילק את ההנעות' };
  const list = (_msToday.byDriver && _msToday.byDriver[currentUser?.name]) || [];
  if (!list.length) return { empty: 'אין לך רכבים להנעה הבוקר' };
  return { list };
}

function _renderDailyQuote() {
  const ms = _msQuoteSlot();
  if (ms) {
    const head = document.getElementById('daily-quote');
    if (head) {
      head.textContent = ms.empty ? `\u{1F511} \u05d4\u05e0\u05e2\u05d5\u05ea \u05d4\u05d1\u05d5\u05e7\u05e8 — ${ms.empty}` : `\u{1F511} \u05d4\u05d7\u05e0\u05d9\u05d5\u05ea \u05e9\u05dc\u05da \u05dc\u05d4\u05d9\u05d5\u05dd: ${_msRange(ms.list)}`;
      head.title = ''; head.style.cursor = 'default';
      head.style.color = 'var(--gold)'; head.style.fontWeight = '900';
      head.onclick = null;
    }
    const box = document.getElementById('daily-quote-m');
    if (box) {
      box.innerHTML = ms.empty
        ? `<div style="font-weight:900;font-size:13.5px">\u{1F511} \u05d4\u05e0\u05e2\u05d5\u05ea \u05d4\u05d1\u05d5\u05e7\u05e8</div>
           <div style="font-weight:700;color:var(--muted);margin-top:2px">${esc(ms.empty)}</div>`
        : `<div style="font-weight:900;font-size:13.5px">\u{1F511} \u05d4\u05d7\u05e0\u05d9\u05d5\u05ea \u05e9\u05dc\u05da \u05dc\u05d4\u05d9\u05d5\u05dd</div>
           <div style="font-weight:900;font-size:15px;direction:ltr;text-align:right;margin-top:4px">${esc(_msRange(ms.list))}</div>
           <div style="font-size:12px;font-weight:700;color:var(--muted);margin-top:3px">${ms.list.length} \u05d7\u05e0\u05d9\u05d5\u05ea</div>`;
      box.style.cursor = 'default';
      box.onclick = null;
    }
    return;
  }
  const st = _todayStory();
  if (!st) return;
  const read = _storyReadDay === _todayKey();
  const line = read ? `📖 סיפור היום: ${st.t}` : '📖 סיפור היום — עדיין לא קראת, הגיע הזמן לקרוא';
  const head = document.getElementById('daily-quote');
  if (head) {
    head.textContent = line;
    head.title = read ? 'לחץ לקריאה חוזרת' : 'לחץ לקריאת הסיפור';
    head.style.cursor = 'pointer';
    head.style.color = read ? 'rgba(255,255,255,.85)' : 'var(--gold)';
    head.style.fontWeight = read ? '700' : '900';
    head.onclick = openDailyStory;
  }
  const box = document.getElementById('daily-quote-m');
  if (box) {
    box.innerHTML = read
      ? `<div style="font-weight:900;font-size:13.5px">📖 סיפור היום: ${esc(st.t)}</div>
         <div style="font-size:12px;font-weight:800;color:#0d6ab0;margin-top:6px">לקריאה חוזרת ▶</div>`
      : `<div style="font-weight:900;font-size:13.5px">📖 סיפור היום</div>
         <div style="font-weight:700;color:var(--muted);margin-top:2px">עדיין לא קראת — הגיע הזמן לקרוא</div>
         <div style="font-size:12px;font-weight:800;color:#0d6ab0;margin-top:6px">לקריאת הסיפור ▶</div>`;
    box.style.cursor = 'pointer';
    box.onclick = openDailyStory;
  }
}
window._renderDailyQuote = _renderDailyQuote;

function openDailyStory() {
  const st = _todayStory();
  const box = document.getElementById('daily-story-body');
  if (!st || !box) return;
  box.innerHTML = `<div style="font-weight:900;font-size:19px;margin-bottom:12px">${esc(st.t)}</div>
    <div style="font-size:15px;font-weight:600;line-height:1.9">${esc(st.s)}</div>
    ${st.n ? `<div style="margin-top:16px">
      <div style="font-size:12.5px;font-weight:900;color:var(--muted);margin-bottom:5px">הנמשל</div>
      <div style="font-size:14.5px;font-weight:600;line-height:1.85">${esc(st.n)}</div>
    </div>` : ''}
    <div style="margin-top:16px;background:var(--surface2);border-right:4px solid var(--gold);border-radius:10px;padding:12px 14px">
      <div style="font-size:12.5px;font-weight:900;color:var(--muted);margin-bottom:4px">מוסר ההשכל</div>
      <div style="font-size:15px;font-weight:800;line-height:1.7">${esc(st.m)}</div>
    </div>`;
  openModal('modal-daily-story');
  // מסמנים שנקרא היום
  if (_storyReadDay !== _todayKey()) {
    _storyReadDay = _todayKey();
    _renderDailyQuote();
    try { window._setDoc(_docRef('config', 'daily_story'), { readDay: _storyReadDay }, { merge: true }); }
    catch (e) {}
  }
}
window.openDailyStory = openDailyStory;

const _badgeCache = {};
function _reapplyCardBadges() {
  for (const [screen, v] of Object.entries(_badgeCache)) _setCardBadge(screen, v.count, v.color);
}
window._reapplyCardBadges = _reapplyCardBadges;

// קוביית לוח המשימות: המספר הוא סך כל המשימות הפתוחות, והצבע נהיה סגול
// כשממתינות גם בקשות משימה לאישור.
let _tasksOpenCount = 0, _tasksReqCount = 0;
function _syncTasksBadge() {
  _setCardBadge('tasks', _tasksOpenCount, _tasksReqCount > 0 ? '#7c3aed' : null);
}

/* קוביה שיש בה משהו שמחכה נצבעת בצבע הקבוע שלה. קוביה ריקה נשארת לבנה,
   כך שהצבע עצמו הוא הסימן שיש שם עבודה. */
const _HOME_CARD_TINT = {
  'battery-stock': '#1e3a8a',   // ארון מצברים — כחול כהה
  'pickup':        '#0d9488',   // מכוניות לאיסוף — טורקיז
  'vehicles':      '#dc2626',   // קליטות ורענון — אדום
  'bodyshop-mgr':  '#b45309',   // פחחות — כתום־חום, בצבע העבודה
  'tasks':         '#6d28d9',   // לוח משימות — סגול
  'morning-starts':'#0369a1',   // הנעות הבוקר — כחול בהיר
};

function _paintHomeCard(card, tint) {
  if (!card) return;
  const title = card.querySelector('.mc-title');
  const sub   = card.querySelector('.mc-sub');
  const icon = card.querySelector('.mc-icon');
  if (tint) {
    if (icon) {
      icon.style.background = 'rgba(255,255,255,.92)';
      icon.style.borderRadius = '14px';
      icon.style.padding = '6px 10px';
      icon.style.display = 'inline-block';
    }
    card.style.background = tint;
    card.style.borderColor = tint;
    card.style.color = '#fff';
    if (title) title.style.color = '#fff';
    if (sub)   sub.style.color = 'rgba(255,255,255,.93)';
  } else {
    if (icon) { icon.style.background = ''; icon.style.borderRadius = ''; icon.style.padding = ''; icon.style.display = ''; }
    card.style.background = '';
    card.style.borderColor = '';
    card.style.color = '';
    if (title) title.style.color = '';
    if (sub)   sub.style.color = '';
  }
}

function _setCardBadge(screen, count, color) {
  _badgeCache[screen] = { count, color };
  const card = document.getElementById('menu-card-' + screen);
  const badge = document.getElementById('badge-' + screen);
  // הקוביות אולי עוד לא נבנו — הערך נשמר ויוחל ברגע שהן ייבנו
  if (!card || !badge) return;
  if (count > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = count;
    badge.style.background = color || '#ef4444';
  } else {
    badge.style.background = '';
    badge.style.display = 'none';
  }
  _paintHomeCard(card, count > 0 ? _HOME_CARD_TINT[screen] : null);
}

// קוביית ארון המצברים: המספר תמיד מופיע מתחת לכותרת, והצבע נדלק רק
// כשמצטברו שלושה מצברים להזמנה או יותר — כלומר כשכבר שווה להזמין.
const _BS_CARD_MIN = 3;
/* קוביית ארון המצברים במסך הבית. המלל מסומן בצהוב כשהגיע הזמן להזמין:
   שלושה מצברים ומעלה בסך הכל, או שניים מאותו סוג. */
function _setBatteryStockCard(units, maxSameType) {
  const card = document.getElementById('menu-card-battery-stock');
  const sub  = document.getElementById('sub-battery-stock');
  if (!card || !sub) return;
  sub.textContent = !units ? 'אין מה להזמין'
    : units === 1 ? 'מצבר אחד להזמנה' : `${units} מצברים להזמנה`;
  // הצביעה נדלקת רק כשבאמת שווה להזמין: שלושה מצברים בסך הכל, או שניים
  // מאותו סוג. מצבר בודד אינו סיבה לצבוע את הקוביה.
  const mark = units >= _BS_CARD_MIN || (maxSameType || 0) >= 2;
  _paintHomeCard(card, mark ? _HOME_CARD_TINT['battery-stock'] : null);
  if (mark) {
    sub.style.background = '#fde68a';
    sub.style.color = '#78350f';
    sub.style.fontWeight = '900';
    sub.style.borderRadius = '8px';
    sub.style.padding = '3px 10px';
    sub.style.display = 'inline-block';
  } else {
    sub.style.background = '';
    sub.style.color = '';
    sub.style.fontWeight = '';
    sub.style.borderRadius = '';
    sub.style.padding = '';
    sub.style.display = '';
  }
}

/* קוביית הפחחות: כמה רכבים שאיברהים סיים עדיין מחכים לעדכון עלויות
   בתוכנה השנייה. הקובייה נצבעת רק כשיש מה לעדכן, ונכבית כשהכל מעודכן. */
function _setBodyshopSwCard(n) {
  const card = document.getElementById('menu-card-bodyshop-mgr');
  const sub  = document.getElementById('sub-bodyshop-mgr');
  // הצבע והמונה מטופלים במנגנון הקוביות המשותף; כאן רק המשפט שמתחת
  _setCardBadge('bodyshop-mgr', n, n > 0 ? '#b45309' : null);
  if (!card || !sub) return;
  sub.textContent = n
    ? (n === 1 ? '💳 רכב אחד לעדכון בתוכנה' : `💳 ${n} רכבים לעדכון בתוכנה`)
    : 'עבודות, מחירים וחשבון חודשי';
}

// badge קובייה מאוחדת (נהג): קליטות ממתינות + רענונים ממתינים
function _setDriverVehiclesBadge() {
  const intakes = (_driverIntakeDocs || []).filter(v => v.status === 'pending').length;
  const refs    = (_refreshCache || []).filter(r => r.status === 'pending').length;
  const total = intakes + refs;
  _setCardBadge('vehicles', total);
  // for the driver there is no big cube — a small one that shows up only when
  // something is actually waiting
  const el  = document.getElementById('stat-intake-driver-card');
  const cnt = document.getElementById('stat-intake-driver-count');
  if (el)  el.style.display = total ? 'block' : 'none';
  if (cnt) cnt.textContent = total;
}

function loadDriverBadges() {
  if (!window._CONFIG_DONE || !currentUser) return;
  _reSnapReset('driverBadges');   // סוגר את המאזינים מהכניסה הקודמת
  const name = currentUser.name;
  try {
    const _badgeTaskIds = new Set();
    _reSnap('driverBadges', _query(_colRef('tasks'), _where('assignedTo','==',name)), snap => {
      snap.docs.forEach(d => { if (d.data().status !== 'done') _badgeTaskIds.add(d.id); else _badgeTaskIds.delete(d.id); });
      _tasksOpenCount = _badgeTaskIds.size;
      _syncTasksBadge();
    });
    _reSnap('driverBadges', _query(_colRef('tasks'), _where('label','==',name)), snap => {
      snap.docs.forEach(d => { if (d.data().status !== 'done') _badgeTaskIds.add(d.id); else _badgeTaskIds.delete(d.id); });
      _tasksOpenCount = _badgeTaskIds.size;
      _syncTasksBadge();
    });
    _reSnap('driverBadges', _query(_colRef('intake_assignments'), _where('assignedTo','==',name)), snap => {
      _driverIntakeDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _setDriverVehiclesBadge();
      const screen = document.getElementById('screen-vehicles');
      if (screen && screen.classList.contains('active') && currentUser?.role !== 'manager') {
        _intakeCache = _driverIntakeDocs;
        _renderIntakeList(_driverIntakeDocs);
      }
    });
    _reSnap('driverBadges', _query(_colRef('refreshes'), _where('assignedTo','==',name)), snap => {
      _refreshCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _setDriverVehiclesBadge();
      const screen = document.getElementById('screen-vehicles');
      if (screen && screen.classList.contains('active') && currentUser?.role !== 'manager') {
        _renderIntakeList(_driverIntakeDocs || []);
      }
    });
    // בדיקת מלאי — קוביה קטנה שמופיעה רק כשיש מלאי שהוקצה לנהג ונעלמת כששלח
    _reSnap('driverBadges', _query(_colRef('inventory_assignments'), _where('assignedTo','==',name)), snap => {
      const pending = snap.docs.filter(d => d.data().status === 'pending').length;
      const card = document.getElementById('stat-inventory-driver-card');
      const cnt  = document.getElementById('stat-inventory-driver-count');
      if (card) card.style.display = pending ? 'block' : 'none';
      if (cnt) cnt.textContent = pending;
    });
    let _battPending = 0;
    const _dcTasks = {};
    // הקובייה הגדולה של בדיקת הטעינה הוסתרה. במקומה מופיעה קוביה קטנה
    // למעלה, ורק כשנשלחה לנהג בדיקת טעינה או משימת טעינה.
    function _battTile(count, label, bg) {
      const t = document.getElementById('stat-battery-driver-card');
      const n = document.getElementById('stat-battery-driver-count');
      const l = document.getElementById('stat-battery-driver-lbl');
      if (!t) return;
      if (label == null) { t.style.display = 'none'; return; }
      t.style.display = 'block';
      t.style.background = bg || 'linear-gradient(135deg,#0891b2,#0e7490)';
      if (n) n.textContent = count;
      if (l) l.textContent = label;
    }
    function _renderUnifiedBatteryCard() {
      const card  = document.getElementById('menu-card-driver-battery');
      if (card) card.style.display = 'none';
      const sub   = document.getElementById('sub-driver-battery');
      const allCars = Object.values(_dcTasks).flat();
      const chargingPending = allCars.filter(c => !c.charged).length;
      const hasCharging = Object.keys(_dcTasks).length > 0;
      if (_battPending > 0) {
        // יש בדיקות סוללה פעילות — עדיפות
        if (card) { card.style.background = ''; card.style.color = ''; card.querySelectorAll('.mc-title,.mc-sub').forEach(el => el.style.color = ''); card.classList.remove('driver-battery-awaiting'); card.dataset.unifiedMode = 'battery'; }
        if (sub) sub.textContent = 'מילוי אחוזי טעינה וטווח';
        _setCardBadge('driver-battery', _battPending);
        _battTile(_battPending, '🔋 בדיקת טעינה');
      } else if (hasCharging && chargingPending === 0) {
        // כל הטעינות בוצעו
        if (card) { card.style.background = '#16a34a'; card.style.color = '#fff'; card.querySelectorAll('.mc-title,.mc-sub').forEach(el => el.style.color = '#fff'); card.classList.remove('driver-battery-awaiting'); card.dataset.unifiedMode = 'charging'; }
        if (sub) sub.textContent = 'כל הטעינות בוצעו בהצלחה ✅';
        _setCardBadge('driver-battery', 0);
        _battTile('✅', 'כל הטעינות בוצעו', 'linear-gradient(135deg,#16a34a,#15803d)');
      } else if (hasCharging && chargingPending > 0) {
        // יש משימות טעינה פעילות
        if (card) { card.style.background = ''; card.style.color = ''; card.querySelectorAll('.mc-title,.mc-sub').forEach(el => el.style.color = ''); card.classList.remove('driver-battery-awaiting'); card.dataset.unifiedMode = 'charging'; }
        if (sub) sub.textContent = 'רכבים לטעינה';
        _setCardBadge('driver-battery', chargingPending, _HOME_CARD_HL);
        _battTile(chargingPending, '⚡ רכבים לטעינה');
      } else {
        // מצב רגיל — אין בדיקות ואין טעינה
        if (card) { card.style.background = ''; card.style.color = ''; card.querySelectorAll('.mc-title,.mc-sub').forEach(el => el.style.color = ''); card.classList.remove('driver-battery-awaiting'); card.dataset.unifiedMode = 'battery'; }
        if (sub) sub.textContent = 'מילוי אחוזי טעינה וטווח';
        _setCardBadge('driver-battery', 0);
        _battTile(0, null);
      }
    }
    _reSnap('driverBadges', _query(_colRef('battery_assignments'), _where('assignedTo','==',name)), snap => {
      const pending  = snap.docs.filter(d => d.data().status === 'pending' && !d.data().converted).length;
      const awaiting = snap.docs.filter(d => d.data().status === 'done'    && !d.data().converted).length;
      const card  = document.getElementById('menu-card-driver-battery');
      const isAwaiting = awaiting > 0 && pending === 0;
      if (isAwaiting) {
        if (card) card.classList.add('driver-battery-awaiting');
        const sub = document.getElementById('sub-driver-battery');
        if (sub) sub.textContent = 'ממתין להקמת משימה';
        _setCardBadge('driver-battery', 0);
        if (card) card.style.display = 'none';
        _battTile('⏳', 'ממתין להקמת משימה', 'linear-gradient(135deg,#64748b,#475569)');
      } else {
        _battPending = pending;
        _renderUnifiedBatteryCard();
      }
    });
    _reSnap('driverBadges', _query(_colRef('charging_tasks'), _where('status','==','active')), snap => {
      snap.docs.forEach(d => { _dcTasks[d.id] = d.data().carsJson ? JSON.parse(d.data().carsJson) : []; });
      snap.docChanges().filter(c => c.type === 'removed').forEach(c => delete _dcTasks[c.doc.id]);
      _renderUnifiedBatteryCard();
    });
    _reSnap('driverBadges', _query(_colRef('charging_tasks'), _where('status','==','done')), snap => {
      snap.docs.forEach(d => { _dcTasks[d.id] = d.data().carsJson ? JSON.parse(d.data().carsJson) : []; });
      snap.docChanges().filter(c => c.type === 'removed').forEach(c => delete _dcTasks[c.doc.id]);
      _renderUnifiedBatteryCard();
    });
    // בורות וסידור מגרש — קוביות קטנות שמופיעות רק כשיש עבודה ונעלמות בסיום
    const _showSmall = (card, count, screen) => {
      const el = document.getElementById(`stat-${card}-driver-card`);
      const cnt = document.getElementById(`stat-${card}-driver-count`);
      if (el) el.style.display = count ? 'block' : 'none';
      if (cnt) cnt.textContent = count;
      _setCardBadge(screen, count);
    };
    _reSnap('driverBadges', _docRef('yard','current'), snap => {
      const status = snap.exists() ? snap.data().status : null;
      _showSmall('yard', status === 'pending' ? 1 : 0, 'yard');
    });
    _reSnap('driverBadges', _query(_colRef('pit_checks'), _where('status','==','pending')), snap => {
      _showSmall('pits', snap.size, 'pits');
    });
    // pickup cars assigned to this driver
    _reSnap('driverBadges', _query(_colRef('pickup_cars'), _where('assignedDriver','==',name)), snap => {
      const cars = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const card = document.getElementById('stat-pickup-driver-card');
      const cnt = document.getElementById('stat-pickup-driver-count');
      if (card) card.style.display = cars.length ? 'block' : 'none';
      if (cnt) cnt.textContent = cars.length;
      _driverPickupCars = cars;
      // if modal already open, re-render
      const modal = document.getElementById('modal-driver-pickup');
      if (modal && modal.classList.contains('open')) _renderDriverPickupModal();
    });
    // test drive assigned — auto-open fill modal, persist across refresh
    _reSnap('driverBadges', _query(_colRef('test_drives'), _where('assignedTo','==',name), _where('status','==','pending')), snap => {
      const badge = document.getElementById('badge-test-drive');
      if (badge) { badge.textContent = snap.size; badge.style.display = snap.size ? 'block' : 'none'; }
      _setTdHomeCount(snap.size);
      // הקוביה הקטנה ליד מספר המשימות — מופיעה רק כשיש נסיעה שממתינה
      const tdCard = document.getElementById('stat-td-driver-card');
      const tdCnt = document.getElementById('stat-td-driver-count');
      if (tdCard) tdCard.style.display = snap.size ? 'block' : 'none';
      if (tdCnt) tdCnt.textContent = snap.size;
      if (!snap.size) {
        const cancelledId = localStorage.getItem('anak_td_active');
        localStorage.removeItem('anak_td_active');
        if (cancelledId) {
          _tdAllForms = _tdAllForms.filter(x => x.id !== cancelledId);
          const modal = document.getElementById('modal-fill-test-drive');
          if (modal?.classList.contains('open') && document.getElementById('tdf-id')?.value === cancelledId) {
            closeModal('modal-fill-test-drive');
          }
        }
        return;
      }
      const firstDoc = snap.docs[0];
      const f = { id: firstDoc.id, ...firstDoc.data() };
      const _tdDone = JSON.parse(localStorage.getItem('anak_td_done')||'[]');
      if (_tdDone.includes(f.id)) return; // already submitted — don't re-open
      localStorage.setItem('anak_td_active', f.id);
      if (!_tdAllForms.find(x => x.id === f.id)) _tdAllForms.push(f);
      // open if not already open
      const overlay = document.getElementById('modal-fill-test-drive');
      if (!overlay?.classList.contains('open')) openFillTestDriveModal(f.id);
    });
  } catch(e) { console.warn('loadDriverBadges error', e); }
}

/* ── Task done notifications ── */
const _taskNotifQueue = [];
let _taskNotifSeenIds = null;
function _getNotifSeenIds() {
  if (_taskNotifSeenIds) return _taskNotifSeenIds;
  try { _taskNotifSeenIds = new Set(JSON.parse(localStorage.getItem('anak_notif_done') || '[]')); }
  catch { _taskNotifSeenIds = new Set(); }
  return _taskNotifSeenIds;
}
function _saveNotifSeenIds() {
  try { localStorage.setItem('anak_notif_done', JSON.stringify([..._taskNotifSeenIds].slice(-200))); } catch {}
}
function _pushTaskNotif(driverName, taskTitle) {
  _taskNotifQueue.push({ driverName, taskTitle });
  if (_taskNotifQueue.length === 1) _showNextTaskNotif();
}
function _showNextTaskNotif() {
  const stack = document.getElementById('task-notif-stack');
  if (!stack || !_taskNotifQueue.length) return;
  const { driverName, taskTitle } = _taskNotifQueue[0];
  const bar = document.createElement('div');
  bar.style.cssText = 'width:100%;max-width:520px;background:#1e293b;color:#f8fafc;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;pointer-events:all;box-shadow:0 4px 18px rgba(0,0,0,.35);border-bottom:3px solid #22c55e;font-family:Heebo,sans-serif;animation:slideDown .3s ease';
  bar.innerHTML = `<span style="font-size:14px;font-weight:700;flex:1">✅ <strong style="color:#86efac">${esc(driverName)}</strong> סיים את המשימה: <span style="color:#fde68a">${esc(taskTitle)}</span></span><button onclick="this.closest('div').remove();_taskNotifQueue.shift();_showNextTaskNotif()" style="background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer;line-height:1;padding:0 4px;flex-shrink:0">✕</button>`;
  stack.innerHTML = '';
  stack.appendChild(bar);
}
let _taskDoneListenerInit = false;
function listenForTaskDone() {
  if (_taskDoneListenerInit || currentUser?.role !== 'manager') return;
  _taskDoneListenerInit = true;
  const seen = _getNotifSeenIds();
  let firstRun = true;
  _onSnap(_query(_colRef('tasks'), _where('status','==','done')), snap => {
    if (firstRun) {
      // seed seen IDs on first load so we don't flood on page open
      snap.docs.forEach(d => seen.add(d.id));
      _saveNotifSeenIds();
      firstRun = false;
      return;
    }
    snap.docs.forEach(d => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        _saveNotifSeenIds();
        const data = d.data();
        const driver = data.doneBy || data.assignedTo || 'נהג';
        const title  = data.title || 'משימה';
        _pushTaskNotif(driver, title);
      }
    });
  });
}

function loadManagerBadges() {
  if (!window._CONFIG_DONE) return;
  _reSnapReset('mgrBadges');   // סוגר את המאזינים מהכניסה הקודמת
  try {
    // מאזין מלא: מחמם את _intakeCache כדי שמסך קליטת רכב ייטען מיידית, וגם מזין את ה-badge
    _reSnap('mgrBadges', _colRef('intake_assignments'), snap => {
      _intakeCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (b.createdAt?.toMillis?.()??0) - (a.createdAt?.toMillis?.()??0));
      _setCardBadge('vehicles', _intakeCache.filter(v => v.status === 'done').length);
      const screen = document.getElementById('screen-vehicles');
      if (screen && screen.classList.contains('active') && currentUser.role === 'manager') {
        _renderIntakeList(_intakeCache);
      }
    });
    _reSnap('mgrBadges', _query(_colRef('pit_checks'), _where('status','==','sent')), snap => {
      _setCardBadge('pits', snap.size);
    });
    _reSnap('mgrBadges', _query(_colRef('inventory_assignments'), _where('status','==','done')), snap => {
      _setCardBadge('inventory', snap.size);
    });
    // ארון המצברים: כמה מצברים ממתינים להזמנה — כל מצבר שיצא מהארון ועדיין
    // לא הוזמן חזרה. אותו חישוב בדיוק כמו רשימת ההזמנה שבמסך המצברים.
    // השרת מחזיר רק את מה שעוד לא הוזמן, במקום את כל היסטוריית ההרכבות.
    // כל הרכבה נשמרת עם ordered:false, ולכן הסינון בשרת מחזיר בדיוק את
    // מה שהסינון באפליקציה החזיר קודם.
    _reSnap('mgrBadges', _query(_colRef('battery_installs'), _where('ordered', '==', false)), snap => {
      // גם הסך הכל וגם הכמות הגדולה ביותר מאותו סוג — לפי מק״ט או דגם
      const pend = snap.docs.map(d => d.data());
      const by = {};
      pend.forEach(v => { const k = v.sku || v.model || '—'; by[k] = (by[k] || 0) + 1; });
      _setBatteryStockCard(pend.length, Math.max(0, ...Object.values(by)));
    });
    // פחחות: רכבים שסיימנו ועדיין לא עודכנו בתוכנה השנייה. נספרים רק
    // רכבים שיושבים כרגע במסך "מכוניות שסיימנו" — סגירת חשבון מסמנת
    // paidAt ומשאירה את הסטטוס, ולכן בלי הסינון הזה רכבים ששולמו
    // מזמן ממשיכים להיספר לנצח.
    _reSnap('mgrBadges', _query(_colRef('bodyshop_jobs'), _where('paidAt', '==', null)), snap => {
      _setBodyshopSwCard(snap.docs.filter(d => {
        const j = d.data();
        return j.status === 'returned' && !j.swUpdated;
      }).length);
    });
    _reSnap('mgrBadges', _docRef('recall_status', 'current'), snap => {
      const cars = snap.exists() ? (snap.data().cars || []) : [];
      const openRecalls = cars.filter(c => !c.resolved).length;
      _setCardBadge('recall', openRecalls, '#ef4444');
      _recallUpdateHomeButton(openRecalls);
    });
    let _batteryAssignmentsDone = 0;
    const _mcTasks = {};
    function _renderMgrChargingCard() {
      const card = document.getElementById('menu-card-battery');
      const sub = document.getElementById('sub-battery');
      const badge = document.getElementById('badge-battery');
      const allCars = Object.values(_mcTasks).flat();
      const hasTasks = Object.keys(_mcTasks).length > 0;
      const pending = allCars.filter(c => !c.charged).length;
      if (hasTasks && pending === 0) {
        if (card) { card.style.background = '#16a34a'; card.style.color = '#fff'; card.querySelectorAll('.mc-title,.mc-sub').forEach(el => el.style.color = '#fff'); }
        if (sub) sub.textContent = 'כל הטעינות בוצעו בהצלחה ✅';
        if (badge) badge.style.display = 'none';
      } else if (pending > 0) {
        if (card) { card.style.background = '#1e40af'; card.style.color = '#fff'; card.querySelectorAll('.mc-title,.mc-sub').forEach(el => el.style.color = '#fff'); }
        if (sub) sub.textContent = 'אחוזי טעינה וטווח נסיעה';
        if (badge) { badge.style.display = 'inline-block'; badge.textContent = _batteryAssignmentsDone || ''; }
      } else {
        if (card) { card.style.background = ''; card.style.color = ''; card.querySelectorAll('.mc-title,.mc-sub').forEach(el => el.style.color = ''); }
        if (sub) sub.textContent = 'אחוזי טעינה וטווח נסיעה';
        if (badge) { badge.style.display = _batteryAssignmentsDone > 0 ? 'inline-block' : 'none'; if (_batteryAssignmentsDone > 0) badge.textContent = _batteryAssignmentsDone; }
      }
    }
    _reSnap('mgrBadges', _query(_colRef('battery_assignments'), _where('status','==','done')), snap => {
      _batteryAssignmentsDone = snap.size;
      _renderMgrChargingCard();
    });
    _reSnap('mgrBadges', _query(_colRef('charging_tasks'), _where('status','==','active')), snap => {
      snap.docs.forEach(d => { _mcTasks[d.id] = d.data().carsJson ? JSON.parse(d.data().carsJson) : []; });
      snap.docChanges().filter(c => c.type === 'removed').forEach(c => delete _mcTasks[c.doc.id]);
      _renderMgrChargingCard();
    });
    _reSnap('mgrBadges', _query(_colRef('charging_tasks'), _where('status','==','done')), snap => {
      snap.docs.forEach(d => { _mcTasks[d.id] = d.data().carsJson ? JSON.parse(d.data().carsJson) : []; });
      snap.docChanges().filter(c => c.type === 'removed').forEach(c => delete _mcTasks[c.doc.id]);
      _renderMgrChargingCard();
    });
    // מאזין מלא לרענונים: מחמם את _refreshCache למסך המאוחד ומרנדר אם המסך פעיל
    _reSnap('mgrBadges', _colRef('refreshes'), snap => {
      _refreshCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (b.createdAt?.toMillis?.()??0) - (a.createdAt?.toMillis?.()??0));
      const screen = document.getElementById('screen-vehicles');
      if (screen && screen.classList.contains('active') && currentUser.role === 'manager') {
        _renderIntakeList(_intakeCache || []);
      }
    });
    listenForTaskDone();
    _reSnap('mgrBadges', _query(_colRef('task_requests'), _where('status','==','pending')), snap => {
      // בקשות משימה לא דורסות את מספר המשימות — הן רק צובעות אותו בסגול
      _tasksReqCount = snap.size || 0;
      _syncTasksBadge();
    });
    if (currentUser.role === 'manager') _listenTaskRequests();
    _reSnap('mgrBadges', _colRef('pickup_cars'), snap => {
      _setCardBadge('pickup', snap.size, snap.size > 0 ? _HOME_CARD_HL : null);
    });
    // test drive badge — red badge = still being filled, button count = every
    // drive that still needs the manager (being filled OR awaiting his decision)
    _reSnap('mgrBadges', _colRef('test_drives'), snap => {
      const all = snap.docs.map(d => d.data());
      const pending = all.filter(d => d.status === 'pending').length;
      const active = all.filter(d => d.status === 'pending' || d.status === 'done').length;
      const badge = document.getElementById('badge-test-drive');
      if (badge) { badge.textContent = pending; badge.style.display = pending ? 'block' : 'none'; }
      _setTdHomeCount(active);
    });
    // listen for submitted test drives
    let _tdMgrSeen = new Set(), _tdMgrFirst = true;
    _reSnap('mgrBadges', _query(_colRef('test_drives'), _where('status','==','done')), snap => {
      if (_tdMgrFirst) { snap.docs.forEach(d => _tdMgrSeen.add(d.id)); _tdMgrFirst = false; return; }
      snap.docs.forEach(d => {
        if (!_tdMgrSeen.has(d.id)) {
          _tdMgrSeen.add(d.id);
          // only show popup if live panel isn't already showing this form
          if (_tdLivePanelId !== d.id) _showTdResultModal(d.id, d.data());
        }
      });
    });
  } catch(e) { console.warn('loadManagerBadges error', e); }
}

/* ═══════════════════════════════════════════════════════
   TASKS SCREEN
═══════════════════════════════════════════════════════ */
function getSeenTasks() {
  try { return new Set(JSON.parse(localStorage.getItem('anak_seen_tasks') || '[]')); }
  catch { return new Set(); }
}
function markLabelSeen(label) {
  const seen = getSeenTasks();
  const labelFilters = ['משימות בעדיפות עליונה','משימות כלליות','חביב','ולאדי','רפד','זגג','רדארים','מוסך'];
  let tasks = tasksCache;
  if (labelFilters.includes(label)) tasks = tasks.filter(t => t.label === label);
  tasks.forEach(t => seen.add(t.id));
  localStorage.setItem('anak_seen_tasks', JSON.stringify([...seen]));
}
function unreadCountByLabel() {
  const seen = getSeenTasks();
  const counts = {};
  tasksCache.forEach(t => {
    if (!seen.has(t.id) && t.label) {
      counts[t.label] = (counts[t.label] || 0) + 1;
    }
  });
  return counts;
}
function renderTaskTabs() {
  const tabEl = document.getElementById('task-filter-tabs');
  if (!tabEl) return;
  const isManager = currentUser?.role === 'manager';
  const labelTabs = ['משימות בעדיפות עליונה','משימות כלליות','חביב','ולאדי','רפד','זגג','רדארים','מוסך'];
  const tabs = isManager ? labelTabs : ['שלי', ...labelTabs];
  const counts = isManager ? unreadCountByLabel() : {};
  tabEl.innerHTML = tabs.map(t => {
    const n = counts[t];
    const label = n ? `${t} (${n})` : t;
    const active = activeTaskFilter === t ? ' active' : '';
    return `<button class="ftab${active}" onclick="filterTasks('${t}',this)">${label}</button>`;
  }).join('');
}

function openTasksScreen() {
  const isManager = currentUser.role === 'manager';
  document.getElementById('tasks-user-badge').textContent = currentUser.name;
  document.getElementById('fab-new-task').style.display = isManager ? 'flex' : 'none';
  // הארכיון הוא כלי ניהולי — מוצג למנהל בלבד
  const _arcBtn = document.getElementById('btn-tasks-archive');
  if (_arcBtn) _arcBtn.style.display = isManager ? 'inline-flex' : 'none';
  const _fabReq = document.getElementById('fab-request-task');
  const _showFabReq = !isManager || currentUser.role === 'pickup_agent';
  if (_fabReq) { _fabReq.style.cssText = _showFabReq ? 'display:flex !important;position:fixed;bottom:24px;left:16px;transform:none;background:#7c3aed;z-index:999' : 'display:none'; }
  console.log('[FAB] isManager=', isManager, 'fab=', !!_fabReq);
  activeTaskFilter = isManager ? 'משימות כלליות' : 'שלי';
  showScreen('tasks');
  loadTasks();
  if (!isManager) _checkDriverNotifications();
  if (isManager) {
    // check for pending task requests and show popup
    setTimeout(() => _renderTaskReqPills(), 800);
  }
}

let activeTaskFilter = 'הכל';

function filterTasks(f, el) {
  markLabelSeen(f);
  activeTaskFilter = f;
  renderTasksFromCache();
  renderTaskTabs();
}

let tasksCache = [];

function loadTasks() {
  const container = document.getElementById('task-list-container');
  if (!window._CONFIG_DONE) {
    if (container) container.innerHTML = demoTasksHTML();
    return;
  }
  if (taskUnsub) taskUnsub();

  // Timeout fallback — if Firestore doesn't respond in 8s, show empty state
  const timeout = setTimeout(() => {
    if (container && container.querySelector('.loading')) {
      container.innerHTML = `<div class="empty-state"><div class="es-icon">📭</div><h3>אין משימות</h3><p>עדיין לא נפתחו משימות</p></div>`;
      renderTaskTabs();
    }
  }, 8000);

  const q = _colRef('tasks');
  taskUnsub = _onSnap(q, snap => {
    clearTimeout(timeout);
    tasksCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.createdAt?.toMillis?.()??0) - (a.createdAt?.toMillis?.()??0));
    console.log('[TASKS] loaded', tasksCache.length, 'tasks');
    renderTasksFromCache();
  }, err => {
    clearTimeout(timeout);
    console.error('[TASKS] error', err.code, err.message);
    // show error to user
    const c = document.getElementById('task-list-container');
    if (c) c.innerHTML = `<div style="padding:32px;text-align:center;color:var(--danger)"><div style="font-size:36px">⚠️</div><div style="font-weight:700;margin-top:8px">שגיאת חיבור</div><div style="font-size:13px;color:var(--muted);margin-top:4px">${err.code||err.message}</div></div>`;
  });
}

// ── Drag state ──────────────────────────────────────────
let _dragTaskId   = null;
