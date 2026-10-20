/* Presentation only. Keep the original renderers, permissions, forms and actions.
   Removing .bsm-design restores the original manager screen. No worker UI hooks. */
(() => {
  'use strict';
  const screen = document.getElementById('screen-bodyshop-mgr');
  if (!screen) return;
  const wrap = screen.querySelector('.bshop-wrap');
  const hero = document.createElement('section');
  hero.className = 'bsd-hero';
  hero.innerHTML = '<div><button type="button" class="bsd-back" aria-label="חזרה" onclick="goHome()">→</button><h2>פחחות</h2><p>כל רכב יוצא מכאן במיטבו — מראה מושלם עד הפרט האחרון.</p></div>' +
    '<img src="img/bodyshop-team.jpg" alt="תמונת הצוות" width="1536" height="1152">' +
    '<button type="button" class="bsd-more" onclick="bsmMMore()">⋯<span>פעולות</span></button>';
  wrap.prepend(hero);
  const nav = document.createElement('nav');
  nav.className = 'bsd-nav';
  nav.setAttribute('aria-label', 'שלבי פחחות');
  nav.innerHTML = [['draft', '➤', 'לשליחה'], ['open', '🔧', 'אצל הפחח'], ['done', '✓', 'סיימנו']]
    .map(([view, icon, label]) => `<button type="button" data-view="${view}" onclick="bsmShowView('${view}')"><i>${icon}</i>${label}</button>`).join('') +
    '<button type="button" class="bsd-add" aria-label="יצירת פתק" onclick="openBsmSendModal()">+</button>';
  screen.append(nav);
  const hosts = {};
  for (const [key, id] of [['draft', 'bsm-drafts'], ['open', 'bsm-open'], ['done', 'bsm-returned']]) {
    const original = document.getElementById(id);
    const host = document.createElement('div');
    host.className = 'bsd-grid';
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', key === 'draft' ? 'פתקים לשליחה' : key === 'open' ? 'רכבים אצל הפחח' : 'רכבים שסיימנו');
    host.tabIndex = 0;
    original.after(host);
    hosts[key] = host;
  }
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const millis = value => value?.toMillis?.() || (typeof value === 'string' ? Date.parse(value) : 0) || 0;
  function lists() {
    const data = _bsmMLists(); // Existing live/held filtering and oldest-first shop rules.
    return {
      draft: [...data.draft].sort((a, b) => millis(a.createdAt) - millis(b.createdAt)),
      open: data.open,
      done: [...data.ret].sort((a, b) => millis(b.returnedAt || b.createdAt) - millis(a.returnedAt || a.createdAt))
    };
  }
  function desktopCard(job) {
    // Reuse the real role-aware renderer and its exact inline handlers, never
    // reimplement sending, printing, freeze, estimate, return or price actions.
    const template = document.createElement('template');
    template.innerHTML = _bshopJobCard(job, false);
    const original = template.content.firstElementChild;
    const card = document.createElement('article');
    card.className = 'bsd-card';
    card.dataset.job = job.id;
    if (job.status === 'at_shop' && job.mgrDone) card.classList.add('bsd-mgrdone');   // סימנתי "סיימנו" — כחול בהיר
    const header = original.firstElementChild;
    header.classList.add('bsd-card-head');
    card.append(header);
    const detail = document.createElement('button');
    detail.type = 'button';
    detail.className = 'bsd-card-detail';
    detail.setAttribute('aria-label', `פתיחת פתק ${job.plate}`);
    detail.addEventListener('click', () => window.bsmOpenJob(job.id));
    const photo = original.querySelector(':scope > img');
    if (photo) {
      photo.removeAttribute('id'); // Original image ID stays on the original renderer.
      photo.alt = `רכב ${job.plate || ''}`;
      detail.append(photo);
    } else detail.innerHTML = '<span class="bsd-no-photo">🚘</span>';
    const meta = original.querySelector('.bs-meta');
    if (meta) detail.append(meta);
    const notes = [...original.querySelectorAll('.bs-note')];
    if (notes.length) {
      const note = document.createElement('span');
      note.className = 'bsd-note';
      note.textContent = notes.map(el => el.textContent.trim()).join(' · ');
      note.title = note.textContent;
      detail.append(note);
    }
    card.append(detail);
    const actions = document.createElement('div');
    actions.className = 'bsd-card-actions';
    original.querySelectorAll('button').forEach(button => actions.append(button));
    card.append(actions);
    return card;
  }
  function mobileRows(jobs) {
    const rows = document.createElement('div');
    rows.className = 'bsd-rows';
    rows.setAttribute('role', 'region');
    rows.setAttribute('aria-label', 'רשימת רכבי פחחות');
    rows.tabIndex = 0;
    jobs.forEach(job => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'bsd-row' + (job.status === 'at_shop' && job.mgrDone ? ' bsd-mgrdone' : '');
      row.dataset.job = job.id;
      row.addEventListener('click', () => window.bsmMOpen(job.id));
      const photo = _bsmMPhoto(job);
      const price = _bsmMPrice(job);
      const days = job.status === 'draft' ? Math.max(0, Math.floor((Date.now() - (millis(job.createdAt) || Date.now())) / 86400000)) : _bshopDays(job);
      const status = job.status === 'returned' || (job.status === 'at_shop' && job.mgrDone) ? 'סיימנו' : days == null ? '' : `${days} ימים`;
      const warn = job.photoFailed || job.reportFailed || (job.status === 'returned' && (job.items || []).some(item => item.price == null || item.price === ''));
      row.innerHTML = (photo ? `<img src="${escape(photo)}" alt="" style="object-position:${escape(_bshopFocusCss(job))}" loading="lazy">` : '<span class="bsd-row-car">🚘</span>') +
        `<span class="bsd-row-info"><b dir="ltr">${escape(job.plate)}</b><span>${escape(job.desc)}</span><small>${(job.items || []).length} חלקים${warn ? ' · ⚠️ דורש בדיקה' : ''}</small></span>` +
        `<span class="bsd-row-status"><b>${escape(status)}</b><small>${escape(price.txt || '')}</small></span><span aria-hidden="true">‹</span>`;
      rows.append(row);
    });
    return rows;
  }
  let frame = 0;
  const mobileScroll = {};
  const watch = new MutationObserver(schedule);
  function observe() {
    watch.observe(screen, {attributes:true, attributeFilter:['class']});
    watch.observe(document.getElementById('bsmm'), {childList:true});
    for (const id of ['bsm-drafts', 'bsm-open', 'bsm-returned']) watch.observe(document.getElementById(id), {childList:true});
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  function render() {
    frame = 0;
    if (!screen.classList.contains('bsm-design') || !screen.classList.contains('active') || typeof _bsmMLists !== 'function') return;
    watch.disconnect();
    try {
      const data = lists();
      const mobile = matchMedia('(max-width:900px)').matches;
      nav.querySelectorAll('[data-view]').forEach(button => {
        button.setAttribute('aria-current', button.dataset.view === _bsmView ? 'page' : 'false');
      });
      if (mobile) {
        const box = document.getElementById('bsmm');
        box.querySelector('.bsd-rows')?.remove();
        const old = box.querySelector('.bsmm-grid');
        if (old && data[_bsmView]) {
          const view = _bsmView;
          const rows = mobileRows(data[view]);
          old.after(rows);
          rows.addEventListener('scroll', () => { mobileScroll[view] = rows.scrollTop; }, {passive:true});
        }
      } else {
        for (const [key, host] of Object.entries(hosts)) {
          if (key !== _bsmView) continue;
          const scroll = host.scrollTop;
          host.replaceChildren(...data[key].map(desktopCard));
          if (!data[key].length) host.innerHTML = '<p class="bsd-empty">אין רכבים בשלב זה</p>';
          host.scrollTop = scroll;
        }
      }
      fit();
      if (mobile) {
        const rows = screen.querySelector('.bsd-rows');
        if (rows) rows.scrollTop = mobileScroll[_bsmView] || 0;
      }
    } finally { observe(); }
  }
  function fit() {
    const mobile = matchMedia('(max-width:900px)').matches;
    const list = mobile ? screen.querySelector('.bsd-rows') : hosts[_bsmView];
    if (!list || !list.getClientRects().length) return;
    const bottom = mobile ? nav.getBoundingClientRect().top - 8 : innerHeight - 66;
    const payment = mobile ? screen.querySelector('.bsmm-pay') : document.getElementById('bsm-pay-wrap');
    const paymentHeight = payment?.getClientRects().length ? payment.getBoundingClientRect().height + 8 : 0;
    const space = Math.floor(bottom - list.getBoundingClientRect().top - paymentHeight);
    const gap = mobile ? 6 : 10;
    const count = mobile ? 5 : 2;
    // Short/zoomed viewports retain readable touch targets and page scrolling.
    const row = Math.max(mobile ? (innerHeight <= 650 ? 52 : 60) : 172, Math.floor((space - gap * (count - 1)) / count));
    list.style.setProperty('--bsd-row', row + 'px');
    list.style.height = (row * count + gap * (count - 1)) + 'px';
  }
  observe();
  addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
})();
