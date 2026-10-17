/* ═══ עיצוב חדש למחשב — נהגים ואנשי איסוף ═══════════════════════════════
   המנהל מקבל את העיצוב שב-ui2-dashboard.js. כאן: סרגל צד עם המסכים של
   המשתמש עצמו, וצבעי ירוק/חול/זהב על המסכים הקיימים. כל פריט בסרגל לוחץ
   על הכרטיס המקורי במסך הבית — אותה פעולה ואותה הרשאה בדיוק.
   איברהים (פחחות) לא נכלל. אותו מתג כמו אצל המנהל: "חזרה לעיצוב הישן". */
(function () {
  'use strict';
  const KEY = 'anak_ui2';
  const ROLES = ['driver', 'pickup_agent', 'pickup_driver'];
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const VER = (SRC.match(/[?&]v=(\d+)/) || [])[1] || '1';
  const flag = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } };

  const P = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    tasks: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-6"/>',
    car: '<path d="M3 13l2-6a2 2 0 0 1 2-1.5h10a2 2 0 0 1 2 1.5l2 6v5h-3v-2H6v2H3z"/><circle cx="7.5" cy="14.5" r="1"/><circle cx="16.5" cy="14.5" r="1"/>',
    battery: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2M6 12h4M8 10v4"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    pit: '<ellipse cx="12" cy="15" rx="9" ry="4"/><path d="M3 15V9M21 15V9"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/>',
    park: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
    truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h4l4 3v4h-8z"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.5 2.5-2.2-.5-.5-2.2z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  };
  const svg = k => `<svg aria-hidden="true" viewBox="0 0 24 24">${P[k]}</svg>`;

  /* [מזהה הכרטיס המקורי, שם, אייקון, מזהה המונה] — מוצג רק כשהכרטיס מוצג במסך הבית */
  const ITEMS = [
    ['menu-card-tasks', 'המשימות שלי', 'tasks', 'stat-tasks'],
    ['menu-card-vehicles', 'קליטות ורענון', 'car', 'stat-intake-driver-count'],
    ['stat-intake-driver-card', 'קליטות ורענון', 'car', 'stat-intake-driver-count'],
    ['menu-card-driver-battery-install', 'מצברים', 'battery', ''],
    ['stat-pits-driver-card', 'בורות', 'pit', 'stat-pits-driver-count'],
    ['stat-inventory-driver-card', 'בדיקת מלאי', 'box', 'stat-inventory-driver-count'],
    ['stat-battery-driver-card', 'רכבים לטעינה', 'bolt', 'stat-battery-driver-count'],
    ['stat-td-driver-card', 'נסיעות מבחן', 'gauge', 'stat-td-driver-count'],
    ['stat-yard-driver-card', 'סידור מגרש', 'park', ''],
    ['menu-card-pickup', 'מכוניות לאיסוף', 'truck', ''],
    ['menu-card-pickup-hila', 'רכבים לאיסוף', 'truck', 'stat-pickup-driver-count'],
    ['stat-pickup-driver-card', 'רכבים לאיסוף', 'truck', 'stat-pickup-driver-count'],
    ['menu-card-bodyshop-mgr', 'פחחות', 'wrench', ''],
    ['menu-card-wash', 'פתק שטיפה', 'drop', ''],
    ['menu-card-request-task', 'הצעת משימה', 'plus', ''],
  ];
  const ROLE_NAME = { driver: 'נהג', pickup_agent: 'איסוף', pickup_driver: 'איסוף' };

  let on = false, side = null, last = '', lastKey = '';
  const user = () => (typeof currentUser !== 'undefined' ? currentUser : null);
  const shown = el => !!el && !el.hidden && getComputedStyle(el).display !== 'none';
  function eligible() {
    const u = user();
    return window.innerWidth > 900 && flag() && !!u && ROLES.includes(u.role);
  }

  function loadCss() {
    if (document.getElementById('ui2-staff-css')) return;
    const l = document.createElement('link');
    l.id = 'ui2-staff-css'; l.rel = 'stylesheet'; l.href = 'css/ui2-staff.css?v=' + VER;
    document.head.appendChild(l);
  }

  function items() {
    const seen = new Set(), out = [];
    for (const [id, label, icon, cnt] of ITEMS) {
      if (seen.has(label) || !shown(document.getElementById(id))) continue;
      seen.add(label);
      const n = cnt ? (document.getElementById(cnt)?.textContent || '').trim() : '';
      out.push({ id, label, icon, n: /^\d+$/.test(n) && n !== '0' ? n : '' });
    }
    return out;
  }

  function render() {
    if (!side) return;
    const u = user() || {};
    const homeOn = document.getElementById('screen-home')?.classList.contains('active');
    if (homeOn) lastKey = '';
    const list = items();
    const html = `<div class="u2s-brand"><b>ענק <span>הרכבים</span></b><small>ניהול תפעול רכבים</small>
        <div class="u2s-user"><i>${(u.name || '?').slice(0, 1)}</i><div><b>${u.name || ''}</b><small>${ROLE_NAME[u.role] || ''}</small></div></div></div>
      <nav><button type="button" class="u2s-item${homeOn ? ' on' : ''}" data-home="1">${svg('home')}<span>מסך הבית</span></button>
        ${list.map(x => `<button type="button" class="u2s-item${!homeOn && lastKey === x.id ? ' on' : ''}" data-card="${x.id}">${svg(x.icon)}<span>${x.label}</span>${x.n ? `<em>${x.n}</em>` : ''}</button>`).join('')}</nav>
      <div class="u2s-foot"><button type="button" class="u2s-item" data-act="push">${svg('bell')}<span>התראות</span></button>
        <button type="button" class="u2s-old" data-act="old">↩ חזרה לעיצוב הישן</button></div>`;
    if (html !== last) { side.innerHTML = html; last = html; }
  }

  function build() {
    side = document.createElement('aside');
    side.id = 'ui2s-side';
    side.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.home) { lastKey = ''; window.goHome?.(); }
      else if (b.dataset.card) {
        // הכרטיס המקורי במסך הבית מבצע את הפעולה; מהמסך הנוכחי חוזרים קודם לבית
        const id = b.dataset.card;
        if (!document.getElementById('screen-home')?.classList.contains('active')) window.goHome?.();
        lastKey = id;
        setTimeout(() => document.getElementById(id)?.click(), 0);
      } else if (b.dataset.act === 'push') window.openPushSettings?.();
      else if (b.dataset.act === 'old') { try { localStorage.setItem(KEY, '0'); } catch (err) {} sync(); }
      setTimeout(render, 50);
    });
    document.body.appendChild(side);
  }

  function sync() {
    const want = eligible();
    if (want && !on) {
      loadCss(); if (!side) build(); on = true;
      document.body.classList.add('ui2s');
    } else if (!want && on) {
      on = false; document.body.classList.remove('ui2s');
      side?.remove(); side = null; last = '';
    }
    if (on) render();
  }

  function start() {
    const mo = new MutationObserver(sync);
    document.querySelectorAll('.screen').forEach(s => mo.observe(s, { attributes: true, attributeFilter: ['class'] }));
    window.addEventListener('resize', sync);
    // המשתמש והמונים מתעדכנים בלי אירוע מסודר — בדיקה קלה כל שתי שניות
    setInterval(sync, 2000);
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
