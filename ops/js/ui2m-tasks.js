/* Presentation only. Existing task rows retain their action and drag handlers. */
(() => {
  const tabs = [
    { key: 'priority', title: 'דחיפות גבוהה', labels: ['משימות בעדיפות עליונה', 'משימות ללקוחות ומוסך', 'מוסך'] },
    { key: 'general', title: 'כללי', labels: ['משימות כלליות'] },
    { key: 'trades', title: 'בעלי מקצוע', labels: ['חביב', 'ולאדי', 'רפד', 'זגג', 'רדארים'] },
    { key: 'drivers', title: 'נהגים', labels: ['גיל', 'עופר', 'איתי'] }
  ];
  const shortTitle = label => ({ 'משימות בעדיפות עליונה': 'עדיפות עליונה', 'משימות ללקוחות ומוסך': 'לקוחות ומוסך', 'משימות כלליות': 'כללי' }[label] || label);
  let tabKey = 'priority';
  let frame = 0;
  const eligible = () => document.body.classList.contains('ui2m') && window.innerWidth <= 900 && typeof currentUser !== 'undefined' && currentUser?.role === 'manager';
  // Same display ordering as the source task board; no cache values are changed.
  const sorted = list => [...list].sort((a, b) =>
    Number(a.status === 'done') - Number(b.status === 'done') ||
    Number(!a.color) - Number(!b.color) ||
    (a.sortOrder ?? a.createdAt?.toMillis?.() ?? 0) - (b.sortOrder ?? b.createdAt?.toMillis?.() ?? 0));
  function node(tag, className, text) {
    const el = document.createElement(tag);
    el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function init() {
    const container = document.getElementById('task-list-container');
    if (!container) return;
    function render(force = false) {
      if (!eligible()) {
        if (container.querySelector('.u2tasks') && typeof renderTasksFromCache === 'function') renderTasksFromCache();
        return;
      }
      if (!force && container.querySelector('.u2tasks')) return;
      if (typeof _tkRow !== 'function' || typeof _tkRowsDrag !== 'function' || typeof tasksCache === 'undefined') return;
      if ((typeof _tkPressing !== 'undefined' && _tkPressing) || (typeof _tkDrag !== 'undefined' && _tkDrag)) return;
      const all = tasksCache.filter(t => t.type !== 'divider');
      const known = new Set(tabs.flatMap(t => t.labels));
      // Unknown existing labels remain accessible in General instead of disappearing.
      const extra = [...new Set(all.filter(t => !known.has(t.label)).map(t => t.label || ''))];
      const labelsFor = tab => tab.labels.concat(tab.key === 'general' ? extra : []);
      const wrap = node('div', 'tkr-wrap tkr-mgr u2tasks');
      const nav = node('div', 'u2tasks-tabs');
      nav.setAttribute('role', 'tablist');
      nav.setAttribute('aria-label', 'קבוצות משימות');
      const selected = tabs.find(t => t.key === tabKey) || tabs[0];
      const panel = node('div', 'u2tasks-panel');
      panel.id = 'u2tasks-panel';
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', 'u2tasks-tab-' + selected.key);
      const choose = key => { tabKey = key; render(true); container.querySelector('#u2tasks-tab-' + key)?.focus(); };
      for (const tab of tabs) {
        const count = all.filter(t => labelsFor(tab).includes(t.label || '') && t.status !== 'done').length;
        const button = node('button', 'u2tasks-tab', tab.title);
        button.type = 'button';
        button.id = 'u2tasks-tab-' + tab.key;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(tab.key === selected.key));
        button.setAttribute('aria-controls', panel.id);
        button.tabIndex = tab.key === selected.key ? 0 : -1;
        button.appendChild(node('span', 'u2tasks-count', count));
        button.addEventListener('click', () => choose(tab.key));
        button.addEventListener('keydown', event => {
          const index = tabs.findIndex(t => t.key === tab.key);
          const move = event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0;
          if (move || event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            choose(tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + move + tabs.length) % tabs.length].key);
          }
        });
        nav.appendChild(button);
      }
      wrap.appendChild(nav);
      wrap.appendChild(panel);
      for (const label of labelsFor(selected)) {
        const list = sorted(all.filter(t => (t.label || '') === label));
        if (label === 'רדארים' && !list.length) continue;
        const open = list.filter(t => t.status !== 'done');
        const done = list.filter(t => t.status === 'done');
        const section = node('section', 'u2tasks-group');
        const heading = node('h3', 'u2tasks-heading', shortTitle(label) || 'ללא קטגוריה');
        heading.appendChild(node('span', 'u2tasks-count', open.length));
        section.appendChild(heading);
        const rows = node('div', 'tkr-list');
        rows.dataset.grp = label || 'unlabelled';
        if (!open.length) rows.appendChild(node('div', 'u2tasks-empty', 'אין משימות פתוחות'));
        open.forEach(task => rows.appendChild(_tkRow(task, false, true)));
        section.appendChild(rows);
        if (done.length) {
          const details = node('details', 'u2tasks-done');
          details.appendChild(node('summary', '', 'הושלמו · ' + done.length));
          const completed = node('div', 'tkr-list');
          completed.dataset.grp = label + '-done';
          done.forEach(task => completed.appendChild(_tkRow(task, true, true)));
          details.appendChild(completed);
          section.appendChild(details);
        }
        panel.appendChild(section);
      }
      _tkRowsDrag(wrap);
      container.replaceChildren(wrap);
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; render(); });
    };
    new MutationObserver(schedule).observe(container, { childList: true });
    new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', schedule);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
