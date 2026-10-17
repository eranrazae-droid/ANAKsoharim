/* ═══ עיצוב חדש למחשב (התנסות) ═════════════════════════════════════════
   מתג בהגדרות (מנהל, מסך רחב). כשהוא דלוק: תפריט צד, כותרת עליונה,
   ומסך בית חדש. כל השאר — פונקציות, נתונים ומסכים — הוא הקוד הקיים.
   המתג נשמר במכשיר (localStorage) ולא משפיע על אף משתמש אחר.
   כיבוי מסיר את המחלקה ui2 והכל חוזר בדיוק כמו שהיה.                 */
(function () {
  'use strict';
  const KEY = 'anak_ui2';
  try { const q = new URLSearchParams(location.search).get('ui2'); if (q === '1' || q === '0') localStorage.setItem(KEY, q); } catch (e) {}
  const WIDE = () => window.innerWidth > 900;
  const flag = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  const setFlag = v => { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} };
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const VER = (SRC.match(/[?&]v=(\d+)/) || [])[1] || '1';
  let on = false, clock = null, built = false;

  /* אייקוני קו אחידים */
  const P = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    tasks: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-6"/>',
    car: '<path d="M3 13l2-6a2 2 0 0 1 2-1.5h10a2 2 0 0 1 2 1.5l2 6v5h-3v-2H6v2H3z"/><circle cx="7.5" cy="14.5" r="1"/><circle cx="16.5" cy="14.5" r="1"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.5 2.5-2.2-.5-.5-2.2z"/>',
    truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h4l4 3v4h-8z"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    battery: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2M6 12h4M8 10v4"/>',
    gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/>',
    park: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    doc: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  };
  const svg = k => `<svg aria-hidden="true" viewBox="0 0 24 24">${P[k]}</svg>`;

  /* מפת הניווט. screens = המסכים שבהם הפריט מסומן כפעיל */
  const NAV = [
    ['tasks',   'לוח משימות',      'tasks',   () => goToScreen('tasks'),            ['screen-tasks']],
    ['home',    'מסך הבית',        'home',    () => goHome(),                       ['screen-home']],
    ['vehicles','קליטות ורענון',   'car',     () => goToScreen('vehicles'),         ['screen-vehicles', 'screen-refresh']],
    ['shop',    'פחחות',           'wrench',  () => goToScreen('bodyshop-mgr'),     ['screen-bodyshop-mgr']],
    ['pickup',  'מכוניות לאיסוף',  'truck',   () => goToScreen('pickup'),           ['screen-pickup']],
    ['battery', 'ארון מצברים',     'battery', () => goToScreen('battery-stock'),    ['screen-battery-stock', 'screen-battery-stats']],
    ['wash',    'פתק שטיפה',       'drop',    () => goToScreen('wash'),             ['screen-wash']],
    ['td',      'נסיעות מבחן',     'gauge',   () => goToScreen('test-drive'),       ['screen-test-drive']],
    ['yard',    'סידור מגרש',      'park',    () => goToScreen('yard'),             ['screen-yard']],
    ['charge',  'בדיקת טעינה',     'bolt',    () => goToScreen('battery'),          ['screen-battery']],
    ['recall',  'ריקול',           'warn',    () => goToScreen('recall'),           ['screen-recall']],
    ['inv',     'מלאי',            'box',     () => goToScreen('inventory'),        ['screen-inventory']],
    ['plate',   'חיפוש רכב',       'search',  () => goToScreen('plate-search'),     ['screen-plate-search']],
  ];

  function eligible() {
    try { return flag() && WIDE() && typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'manager'; }
    catch (e) { return false; }
  }

  function loadCss() {
    if (document.getElementById('ui2-css')) return;
    const l = document.createElement('link');
    l.id = 'ui2-css'; l.rel = 'stylesheet'; l.href = `css/ui2.css?v=${VER}`;
    document.head.appendChild(l);
  }

  /* ── בניה ─────────────────────────────────────────────────────── */
  function build() {
    if (built) return;
    const side = document.createElement('aside');
    side.id = 'ui2-side';
    side.innerHTML = `<div class="u2-brand"><b>ענק <span>הרכבים</span></b><small>ניהול תפעול רכבים</small></div>
      <nav>${NAV.map(n => `<button type="button" class="u2-item" data-k="${n[0]}">${svg(n[2])}<span>${n[1]}</span></button>`).join('')}</nav>
      <div class="u2-sep"></div>
      <div class="u2-foot">
        <button type="button" class="u2-item" data-act="settings">${svg('gear')}<span>הגדרות</span></button>
        <button type="button" class="u2-item" data-act="push">${svg('bell')}<span>התראות</span></button>
        <button type="button" class="u2-old" data-act="old">↩ חזרה לעיצוב הישן</button>
      </div>`;
    side.addEventListener('click', e => {
      const b = e.target.closest('[data-k],[data-act]'); if (!b) return;
      if (b.dataset.k) { const n = NAV.find(x => x[0] === b.dataset.k); if (n) n[3](); return; }
      const a = b.dataset.act;
      if (a === 'all') openAllScreens();
      else if (a === 'settings') openSettings();
      else if (a === 'push') { try { openPushSettings(); } catch (e) {} }
      else if (a === 'old') { setFlag(false); apply(); }
    });
    document.body.appendChild(side);

    const home = document.getElementById('screen-home');
    // המשתמש — בסרגל, מתחת ל"ענק הרכבים" (השורה העליונה של מסך הבית הוסרה)
    const u = document.createElement('button');
    u.type = 'button'; u.className = 'u2-user'; u.id = 'u2-h-user';
    u.innerHTML = `<i></i><div><b></b><small>מנהל המערכת</small></div>`;
    u.addEventListener('click', () => logout());
    u.setAttribute('aria-label', 'יציאה מהמערכת');
    side.querySelector('.u2-brand').appendChild(u);

    if (home) {
      const hero = document.createElement('section');
      hero.id = 'ui2-hero';
      hero.innerHTML = `<div class="u2-greet"><span class="u2-eyebrow">ענק הרכבים · מרכז התפעול</span><h1 id="u2-g1"></h1><p>כל מה שצריך לניהול היום, במקום אחד</p></div>
        <div class="u2-date"><small id="u2-d1"></small><small id="u2-d2"></small><b id="u2-d3"></b></div>
        <div class="u2-stats" id="u2-stats"></div>`;
      const body = home.querySelector('.home-body');
      home.insertBefore(hero, body);

      // פתק מהיר: לשוניות + טופס עוברים למסגרת אחת (אותם אלמנטים, אותם מזהים)
      const tabs = document.getElementById('home-panel-tabs'), slot = document.getElementById('home-wash-slot');
      if (tabs && slot) {
        const q = document.createElement('div'); q.id = 'ui2-quick';
        tabs.parentNode.insertBefore(q, tabs); q.innerHTML = '<h2 class="u2-panelhead">עמדת עבודה מהירה</h2>'; q.appendChild(tabs); q.appendChild(slot);
      }
      const mods = document.createElement('section');
      mods.id = 'ui2-modules';
      mods.innerHTML = `<div class="u2-modhead"><b>המחלקות שלך</b><small>גישה מהירה לכל אזורי המערכת</small></div><div class="u2-mods" id="u2-mods"></div>`;
      const layout = document.getElementById('home-layout');
      if (layout) layout.appendChild(mods);
    }
    built = true;
  }

  function unbuild() {
    document.getElementById('ui2-side')?.remove();
    ['u2-h-search', 'u2-h-bell', 'u2-h-gear', 'u2-h-user'].forEach(id => document.getElementById(id)?.remove());
    document.getElementById('ui2-hero')?.remove();
    document.getElementById('ui2-modules')?.remove();
    const q = document.getElementById('ui2-quick');
    if (q) {
      const tabs = document.getElementById('home-panel-tabs'), slot = document.getElementById('home-wash-slot');
      const parent = q.parentNode;
      if (tabs) parent.insertBefore(tabs, q);
      if (slot) parent.insertBefore(slot, q);
      q.remove();
    }
    built = false;
  }

  /* ── תוכן חי: מספרים, ברכה, שעון ──────────────────────────────── */
  const num = k => { try { return (_badgeCache[k] && _badgeCache[k].count) || 0; } catch (e) { return 0; } };
  const tasksN = () => parseInt((document.getElementById('stat-tasks') || {}).textContent, 10) || 0;
  const shopN = () => { try { return _mgrAtShop || 0; } catch (e) { return 0; } };

  function render() {
    if (!on) return;
    const now = new Date(), h = now.getHours();
    const name = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '';
    const g = document.getElementById('u2-g1');
    if (g) g.textContent = `${h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 18 ? 'צהריים טובים' : 'ערב טוב'}, ${name}`;
    const d1 = document.getElementById('u2-d1'), d2 = document.getElementById('u2-d2'), d3 = document.getElementById('u2-d3');
    if (d1) d1.textContent = 'יום ' + now.toLocaleDateString('he-IL', { weekday: 'long' }).replace(/^יום /, '');
    if (d2) d2.textContent = now.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
    if (d3) d3.textContent = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const hu = document.getElementById('u2-h-user');
    if (hu) { hu.querySelector('i').textContent = name.charAt(0); hu.querySelector('b').textContent = name; }

    const stats = [
      [num('vehicles'), 'קליטות לבדיקה', 'car',    () => goToScreen('vehicles'),      '#15803d', '#22c55e', 'rgba(34,197,94,.55)'],
      [shopN(),         'אצל הפחח',      'wrench', () => goToScreen('bodyshop-mgr'),  '#1d4ed8', '#3b82f6', 'rgba(59,130,246,.55)'],
      [num('pickup'),   'רכבים לאיסוף',  'truck',  () => goToScreen('pickup'),        '#c2410c', '#f59e0b', 'rgba(245,158,11,.55)'],
      [tasksN(),        'משימות פתוחות', 'tasks',  () => goToScreen('tasks'),         '#5b21b6', '#8b5cf6', 'rgba(139,92,246,.55)'],
    ];
    const box = document.getElementById('u2-stats');
    if (box) {
      const html = stats.map((s, i) => `<button type="button" class="u2-stat" data-i="${i}" style="--a:${s[4]};--b:${s[5]};--g:${s[6]}">
        <div class="ic">${svg(s[2])}</div><div><span>${s[1]}</span></div><b>${s[0]}</b></button>`).join('');
      if (box.dataset.h !== html) { box.innerHTML = html; box.dataset.h = html; box.onclick = e => { const c = e.target.closest('.u2-stat'); if (c) stats[+c.dataset.i][3](); }; box._s = stats; }
      else box._s = stats;
    }
    const MODS = [
      ['לוח משימות',    'tasks',   tasksN(),       () => goToScreen('tasks'),         'tasks',   '#3b4a78'],
      ['קליטות ורענון', 'car',     num('vehicles'),() => goToScreen('vehicles'),      'intake',  '#3d6b8a'],
      ['פחחות',         'wrench',  shopN(),        () => goToScreen('bodyshop-mgr'),  'shop',    '#5a4a7a'],
      ['מכוניות לאיסוף','truck',   num('pickup'),  () => goToScreen('pickup'),        'pickup',  '#7a5a3a'],
      ['ארון מצברים',   'battery', 0,              () => goToScreen('battery-stock'), 'battery', '#3a6a7a'],
      ['מלאי',          'box',     0,              () => goToScreen('inventory'),     'inventory','#4a5a4a'],
    ];
    const mb = document.getElementById('u2-mods');
    if (mb) {
      const html = MODS.map((m, i) => `<button type="button" class="u2-mod" data-i="${i}" style="--img:url(${new URL(`img/ui2/mod-${m[4]}.jpg`, location.href).href});--ph:linear-gradient(135deg,${m[5]},#121828)">
        <div class="mi">${svg(m[1])}</div><div class="ml">${m[2] ? `<span class="mc">${m[2]}</span>` : ''}<span>${m[0]}</span></div><div class="ma" aria-hidden="true">‹</div></button>`).join('');
      if (mb.dataset.h !== html) { mb.innerHTML = html; mb.dataset.h = html; }
      mb.onclick = e => { const c = e.target.closest('.u2-mod'); if (c) MODS[+c.dataset.i][3](); };
    }
  }

  function markActive() {
    if (!on) return;
    const act = document.querySelector('.screen.active');
    const id = act ? act.id : '';
    document.querySelectorAll('#ui2-side .u2-item[data-k]').forEach(b => {
      const n = NAV.find(x => x[0] === b.dataset.k);
      b.classList.toggle('on', !!n && n[4].includes(id));
    });
  }

  /* ── הפעלה וכיבוי ─────────────────────────────────────────────── */
  function apply() {
    const want = eligible();
    if (want && !on) {
      loadCss(); build(); on = true;
      document.body.classList.add('ui2');
      clock = setInterval(render, 5000);
    } else if (!want && on) {
      on = false; clearInterval(clock); clock = null;
      document.body.classList.remove('ui2');
      unbuild();
    }
    if (on) { render(); markActive(); }
  }

  /* תגובה לשינויי מסך ולשינוי גודל */
  const mo = new MutationObserver(() => { apply(); markActive(); });
  function watch() {
    document.querySelectorAll('.screen').forEach(s => mo.observe(s, { attributes: true, attributeFilter: ['class'] }));
  }
  window.addEventListener('resize', () => apply());

  /* מתג בהגדרות */
  function injectToggle() {
    if (!WIDE() || typeof currentUser === 'undefined' || !currentUser || currentUser.role !== 'manager') return;
    const box = document.querySelector('#modal-settings .modal-box');
    if (!box) return;
    document.getElementById('ui2-toggle-row')?.remove();
    const row = document.createElement('div');
    row.id = 'ui2-toggle-row';
    row.style.cssText = 'display:flex;align-items:center;gap:12px;background:#f6f8fc;border:1px solid #e1e5f0;border-radius:14px;padding:12px 16px;margin:0 0 14px;font-weight:800';
    row.innerHTML = `<span style="font-size:20px">🎨</span><div style="flex:1"><div>עיצוב חדש למחשב (התנסות)</div><div style="font-size:12px;font-weight:600;color:#6b7491">תפריט צד ומסך בית חדש. אפשר לחזור לעיצוב הישן בכל רגע.</div></div>
      <button type="button" id="ui2-sw" style="border:0;border-radius:999px;width:56px;height:30px;cursor:pointer;position:relative;background:${flag() ? '#16a34a' : '#c3c9d9'}">
        <span style="position:absolute;top:3px;${flag() ? 'right:3px' : 'right:29px'};width:24px;height:24px;border-radius:50%;background:#fff;transition:all .15s"></span></button>`;
    const title = box.querySelector('.modal-title');
    title ? title.after(row) : box.prepend(row);
    row.querySelector('#ui2-sw').onclick = () => { setFlag(!flag()); apply(); injectToggle(); };
  }
  // המתג מוזרק בכל פתיחה של חלון ההגדרות, בלי תלות באופן שבו נפתח
  const _os = window.openSettings;
  if (typeof _os === 'function') {
    window.openSettings = async function () {
      try { return await _os.apply(this, arguments); }
      finally { try { injectToggle(); } catch (e) {} }
    };
  }
  function watchSettings() {
    const m = document.getElementById('modal-settings');
    if (!m) return;
    new MutationObserver(() => { if (m.classList.contains('open')) { try { injectToggle(); } catch (e) {} } })
      .observe(m, { attributes: true, attributeFilter: ['class'] });
  }

  /* המספרים בכרטיסים מתעדכנים בכל פעם שהקוד הקיים מעדכן את הכרטיס העליון */
  const _hr = window._mgrHeroRender;
  if (typeof _hr === 'function') {
    window._mgrHeroRender = function () {
      const r = _hr.apply(this, arguments);
      try { render(); } catch (e) {}
      return r;
    };
  }

  const start = () => { watch(); watchSettings(); apply(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window._ui2Apply = apply;
})();


/* תהליכים שרצים ברקע — פס התקדמות עם אחוזים בפריט המתאים בסרגל.
   קורא בלבד: מה שכבר מוצג על המסך (או נשמר בשרת), בלי לגעת בתהליך עצמו. */
(function () {
  'use strict';
  const pctIn = el => {
    if (!el || !el.isConnected) return null;
    const m = (el.textContent || '').match(/(\d{1,3})\s*%/);
    return m ? Math.min(100, +m[1]) : null;
  };
  const shown = el => !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
  let recall = null;           // מצב סריקת הריקול מהשרת
  let recallUnsub = null;
  const SOURCES = {
    // קריאת פתקי שטיפה (סגירת חשבון)
    wash: () => {
      const b = document.getElementById('wash-chk-body');
      return b && b.textContent.includes('קורא את הפתקים') ? pctIn(b) : null;
    },
    // קליטת רכבים לאיסוף מתמונה / משיכת נתוני רכב
    pickup: () => {
      const l = document.getElementById('freetext-img-loading');
      return shown(l) ? pctIn(l) : null;
    },
    // סריקת ריקול בשרת
    recall: () => {
      if (!recall || !recall.running) return null;
      const at = recall.at && recall.at.toDate ? recall.at.toDate() : (recall.at ? new Date(recall.at) : null);
      if (!at || Date.now() - at.getTime() > 3 * 60000) return null;
      const total = recall.total || 0, done = Math.min(recall.done || 0, total);
      return total ? Math.round(done / total * 100) : 0;
    },
  };
  function listenRecall() {
    if (recallUnsub || typeof window._onSnap !== 'function' || typeof window._docRef !== 'function') return;
    try { recallUnsub = window._onSnap(window._docRef('recall_status', 'progress'), s => { recall = s.exists() ? s.data() : null; }, () => {}); } catch (e) {}
  }
  function paint(key, pct) {
    const btn = document.querySelector(`#ui2-side .u2-item[data-k="${key}"]`);
    if (!btn) return;
    let bar = btn.querySelector('.u2-prog');
    if (pct == null) { if (bar) bar.remove(); btn.classList.remove('u2-busy'); return; }
    if (!bar) {
      bar = document.createElement('span');
      bar.className = 'u2-prog';
      bar.innerHTML = '<i></i><b></b>';
      btn.appendChild(bar);
    }
    btn.classList.add('u2-busy');
    bar.querySelector('i').style.width = pct + '%';
    bar.querySelector('b').textContent = pct + '%';
    bar.setAttribute('aria-label', 'בתהליך: ' + pct + '%');
  }
  function tick() {
    if (!document.body.classList.contains('ui2') || !document.getElementById('ui2-side')) return;
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'manager') listenRecall();
    for (const key in SOURCES) { let v = null; try { v = SOURCES[key](); } catch (e) {} paint(key, v); }
  }
  setInterval(tick, 700);
})();
