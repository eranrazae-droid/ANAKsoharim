/* Desktop UI2 presentation only. Existing screen nodes, actions and routing stay intact.
   The screen host is styled as a page in CSS; no business function is wrapped/replaced. */
(function () {
  'use strict';
  const scriptUrl = document.currentScript && document.currentScript.src;
  const version = ((scriptUrl || '').match(/[?&]v=(\d+)/) || [])[1] || '554';
  let running = false, owner = '', hidden = new Set(), picker = null, board = null;
  let scheduled = false;
  /* מצב הלוח: 'high' — דחיפות גבוהה בלבד, 'all' — כל המשימות */
  const HIGH_COLS = ['משימות בעדיפות עליונה', 'משימות ללקוחות ומוסך'];
  let mode = 'all';
  function readMode() { try { mode = localStorage.getItem('anak_ui2_task_mode:' + owner) === 'high' ? 'high' : 'all'; } catch (e) { mode = 'all'; } }
  function saveMode() { try { localStorage.setItem('anak_ui2_task_mode:' + owner, mode); } catch (e) {} }
  const originals = new WeakMap();
  const pageModals = ['modal-screen-host', 'modal-settings', 'modal-all-screens'];
  const columnsObserver = new MutationObserver(schedule);
  const uiObserver = new MutationObserver(schedule);

  function eligible() {
    return window.innerWidth > 900 && document.body.classList.contains('ui2') &&
      typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'manager';
  }
  function preferenceKey() { return 'anak_ui2_hidden_columns_v1:' + owner; }
  function readPreference() {
    try {
      const value = JSON.parse(localStorage.getItem(preferenceKey()) || '[]');
      hidden = new Set(Array.isArray(value) ? value.filter(x => typeof x === 'string') : []);
    } catch (e) { hidden = new Set(); }
  }
  function savePreference() {
    try { localStorage.setItem(preferenceKey(), JSON.stringify(Array.from(hidden))); } catch (e) {}
  }
  function loadCss() {
    if (document.getElementById('ui2-system-css')) return;
    const link = document.createElement('link');
    link.id = 'ui2-system-css'; link.rel = 'stylesheet';
    link.media = 'screen and (min-width:901px)';
    link.href = 'css/ui2-system.css?v=' + version;
    document.head.appendChild(link);
  }
  function columns() {
    return board ? Array.from(board.children).filter(el => el.classList.contains('task-col')) : [];
  }
  function columnKey(col) {
    const title = col.querySelector('.task-col-title');
    return title ? title.textContent.trim() : '';
  }
  function remember(col) {
    if (!originals.has(col)) originals.set(col, {
      hidden: col.hidden, key: col.getAttribute('data-u2-column-key'), tone: col.getAttribute('data-u2-tone')
    });
  }
  function tone(key) {
    if (key.indexOf('עדיפות') >= 0) return 'gold';
    if (key.indexOf('לקוחות') >= 0) return 'teal';
    if (key === 'משימות כלליות' || key === 'ולאדי') return 'blue';
    if (key === 'נהגים') return 'sage';
    return 'lavender';
  }
  function restoreColumns() {
    columns().forEach(col => {
      const prev = originals.get(col); if (!prev) return;
      col.hidden = prev.hidden;
      [['data-u2-column-key', prev.key], ['data-u2-tone', prev.tone]].forEach(([key, value]) => {
        if (value === null) col.removeAttribute(key); else col.setAttribute(key, value);
      });
      originals.delete(col);
    });
  }
  function buildPicker() {
    if (picker && picker.isConnected) return;
    const screen = document.getElementById('screen-tasks');
    if (!screen || !board) return;
    picker = document.createElement('section');
    picker.id = 'ui2-column-tools';
    picker.setAttribute('aria-label', 'תצוגת עמודות משימות');
    picker.innerHTML = '<div class="u2-mode" role="radiogroup" aria-label="תצוגת משימות">' +
      '<button type="button" role="radio" data-u2-mode="high">🔥 דחיפות גבוהה</button>' +
      '<button type="button" role="radio" data-u2-mode="all">כל המשימות</button></div>' +
      '<div class="u2-column-status" role="status" aria-live="polite"></div>' +
      '<details class="u2-column-picker"><summary>הצגת עמודות <span aria-hidden="true">▾</span></summary>' +
      '<div class="u2-column-popover"><h3>אילו עמודות להציג?</h3><div class="u2-column-options"></div>' +
      '<div class="u2-column-footer"><small>הסתרה משנה תצוגה בלבד</small>' +
      '<button type="button" data-u2-show-all>הצגת כולן</button></div></div></details>' +
      '<div class="u2-columns-empty" hidden>כל העמודות מוסתרות. אפשר להחזיר אותן דרך ״הצגת עמודות״.</div>';
    board.before(picker);
    picker.addEventListener('change', e => {
      const input = e.target.closest('input[data-u2-column]'); if (!input) return;
      if (input.checked) hidden.delete(input.dataset.u2Column); else hidden.add(input.dataset.u2Column);
      savePreference(); updateColumns();
    });
    picker.addEventListener('click', e => {
      const m = e.target.closest('[data-u2-mode]');
      if (m) { mode = m.dataset.u2Mode; saveMode(); updateColumns(); return; }
      if (!e.target.closest('[data-u2-show-all]')) return;
      hidden.clear(); savePreference(); updateColumns();
    });
    picker.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const details = picker.querySelector('details'); details.open = false;
        details.querySelector('summary').focus();
      }
    });
  }
  function updateColumns() {
    if (!board || !picker) return;
    const all = columns(), available = [];
    all.forEach(col => {
      const key = columnKey(col); if (!key) return;
      remember(col); col.dataset.u2ColumnKey = key; col.dataset.u2Tone = tone(key);
      col.hidden = originals.get(col).hidden || (mode === 'high' ? !HIGH_COLS.includes(key) : hidden.has(key));
      available.push(key);
    });
    const signature = JSON.stringify(available);
    const options = picker.querySelector('.u2-column-options');
    if (options.dataset.signature !== signature) {
      options.replaceChildren();
      available.forEach(key => {
        const label = document.createElement('label'), input = document.createElement('input');
        input.type = 'checkbox'; input.dataset.u2Column = key;
        label.appendChild(input); label.appendChild(document.createTextNode(key)); options.appendChild(label);
      });
      options.dataset.signature = signature;
    }
    options.querySelectorAll('input[data-u2-column]').forEach(input => { input.checked = !hidden.has(input.dataset.u2Column); });
    picker.querySelectorAll('[data-u2-mode]').forEach(b => {
      const on = b.dataset.u2Mode === mode;
      b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    picker.classList.toggle('u2-high', mode === 'high');
    board.classList.toggle('u2-high', mode === 'high');
    const count = all.filter(col => !col.hidden).length;
    picker.querySelector('.u2-column-status').textContent = count + ' מתוך ' + all.length + ' עמודות מוצגות' +
      (count < all.length ? ' · יש עמודות שהסתרת' : ' · אין עמודות מוסתרות');
    picker.querySelector('.u2-columns-empty').hidden = all.length === 0 || count > 0;
  }
  function activeNavigation() {
    // The legacy host keeps the home active behind it. Mark the hosted screen instead.
    const host = document.getElementById('modal-screen-host');
    const active = host && host.classList.contains('open') ? host.querySelector('.screen.active') :
      document.querySelector('.screen.active');
    const screen = active ? active.id : '';
    const map = { home: ['home'], tasks: ['tasks'], vehicles: ['vehicles', 'refresh'], shop: ['bodyshop-mgr'],
      pickup: ['pickup'], battery: ['battery-stock', 'battery-stats'], wash: ['wash'], td: ['test-drive'],
      yard: ['yard'], charge: ['battery'], recall: ['recall'], own: ['ownership'], inv: ['inventory'], plate: ['plate-search'] };
    document.querySelectorAll('#ui2-side .u2-item[data-k]').forEach(button => {
      const selected = (map[button.dataset.k] || []).some(name => screen === 'screen-' + name);
      if (button.classList.contains('on') !== selected) button.classList.toggle('on', selected);
    });
  }
  function pageLayers() {
    // Keep the original openModal stacking order, but reserve the sidebar above pages.
    // Action dialogs retain their original z-index above both the page and sidebar.
    const open = pageModals.map(id => document.getElementById(id)).filter(el => el && el.classList.contains('open'));
    open.sort((a, b) => (parseInt(a.style.zIndex, 10) || 200) - (parseInt(b.style.zIndex, 10) || 200));
    open.forEach((el, index) => el.style.setProperty('--u2-page-depth', String(110 + index)));
    pageModals.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('open')) el.style.removeProperty('--u2-page-depth');
    });
  }
  function stop() {
    columnsObserver.disconnect(); restoreColumns();
    pageModals.forEach(id => { const el = document.getElementById(id); if (el) el.style.removeProperty('--u2-page-depth'); });
    if (board) board.classList.remove('u2-high');
    if (picker) picker.remove(); picker = null; board = null; running = false; owner = '';
  }
  function sync() {
    scheduled = false;
    if (!eligible()) { if (running) stop(); return; }
    const name = currentUser.name || '';
    if (owner !== name) {
      if (running) stop(); owner = name; readPreference(); readMode();
    }
    running = true; loadCss();
    const next = document.getElementById('task-list-container');
    if (board !== next) {
      columnsObserver.disconnect(); board = next;
      if (board) columnsObserver.observe(board, { childList: true });
    }
    buildPicker(); updateColumns(); pageLayers(); activeNavigation();
  }
  function schedule() {
    if (scheduled) return; scheduled = true;
    Promise.resolve().then(sync);
  }
  function start() {
    uiObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.querySelectorAll('.screen').forEach(el => uiObserver.observe(el, { attributes: true, attributeFilter: ['class'] }));
    pageModals.forEach(id => {
      const el = document.getElementById(id);
      if (el) uiObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    // Dismiss only navigation-level panels when the existing sidebar action takes over.
    document.addEventListener('click', e => {
      if (!eligible()) return;
      const button = e.target.closest('#ui2-side button[data-k],#ui2-side button[data-act]');
      if (!button || button.dataset.act === 'old') return;
      [['modal-settings', 'settings'], ['modal-all-screens', 'all']].forEach(([id, act]) => {
        const panel = document.getElementById(id);
        if (button.dataset.act !== act && panel && panel.classList.contains('open')) closeModal(id);
      });
    }, true);
    document.addEventListener('click', e => {
      if (picker && picker.isConnected && !picker.contains(e.target)) picker.querySelector('details').open = false;
    });
    window.addEventListener('resize', schedule); schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
