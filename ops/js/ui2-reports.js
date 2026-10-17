/* דוחות במסך הבית (עיצוב חדש, מנהל, מחשב).
   השליש הימני של מסך הבית: תשלומים לבעלי מקצוע וזמני ביצוע של הנהגים.
   קורא נתונים קיימים; הכתיבה היחידה היא רישום תשלום ידני (pro_payments). */
(function () {
  'use strict';
  const DRIVERS = ['גיל', 'עופר', 'איתי'];
  const KINDS = [['intake', 'קליטות'], ['inventory', 'בדיקת מלאי'], ['testdrive', 'נסיעות מבחן']];
  const EXPECT = { intake: [5 * 60e3, 10 * 60e3] };      // קליטה אמורה לקחת 5–10 דקות
  const IDLE = 90e3;            // הפסקה ארוכה מזה לא נספרת כזמן עבודה
  const LONG_IDLE = 3 * 60e3;   // הפסקה ארוכה מזה מסומנת בדוח
  const FAST_GAP = 2000, FAST_RUN = 6;   // 6 סעיפים ברצף, פחות מ-2 שניות בין אחד לשני
  const D = { logs: [], jobs: [], shopArch: [], washNotes: [], washPays: [], installs: [], orders: [], pro: [] };
  let tab = 'pay', kind = 'intake', started = false;
  const esc2 = s => (typeof esc === 'function' ? esc(String(s ?? '')) : String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const ms = t => t?.toMillis ? t.toMillis() : (typeof t === 'number' ? t : (t ? +new Date(t) : 0));
  const fmt = v => { v = Math.max(0, Math.round(v / 1000)); const m = Math.floor(v / 60), s = v % 60; return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} ש׳` : `${m}:${String(s).padStart(2, '0')}`; };
  const range = ex => `<bdi dir="ltr">${Math.round(ex[0] / 60e3)}–${Math.round(ex[1] / 60e3)}</bdi> דקות`;
  const words = v => { v = Math.round(v / 1000); const m = Math.floor(v / 60), s = v % 60; return m ? `${m} דקות${s ? ` ו-${s} שניות` : ''}` : `${s} שניות`; };
  const nis = n => '₪' + Math.round(n || 0).toLocaleString('he-IL');
  const day = t => t ? new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : '';

  /* ── ניתוח רשומת זמנים ── */
  function analyze(L) {
    const open = L.openedAt, end = L.submittedAt || open;
    const pts = [open, ...(L.acts || []).filter(t => t >= open && t <= end), end].sort((a, b) => a - b);
    let active = 0, idleMax = 0;
    for (let i = 1; i < pts.length; i++) { const g = pts[i] - pts[i - 1]; active += Math.min(g, IDLE); idleMax = Math.max(idleMax, g); }
    const marks = Object.values(L.marks || {}).sort((a, b) => a - b);
    const gaps = marks.slice(1).map((t, i) => t - marks[i]);
    let run = 0, best = 0, bestSpan = 0, runStart = 0;
    gaps.forEach((g, i) => { if (g < FAST_GAP) { if (!run) runStart = i; run++; if (run > best) { best = run; bestSpan = marks[i + 1] - marks[runStart]; } } else run = 0; });
    const sorted = gaps.slice().sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const flags = [];
    if (idleMax > LONG_IDLE) flags.push(['idle', `הטופס עמד פתוח ${words(idleMax)} בלי שום פעולה — הזמן הזה לא נספר`]);
    if (best + 1 >= FAST_RUN) flags.push(['fast', `סימן ${best + 1} סעיפים ברצף תוך ${words(bestSpan)} — חשוד כסימון בלי בדיקה`]);
    const ex = EXPECT[L.kind];
    if (ex && active < ex[0]) flags.push(['short', `קצר מהמצופה (${range(ex)})`]);
    if (ex && active > ex[1]) flags.push(['long', `ארוך מהמצופה (${range(ex)})`]);
    let opinion = '';
    if (gaps.length >= 3) {
      const s = Math.round(median / 1000);
      opinion = `בממוצע ${s} שניות בין סעיף לסעיף — ` + (median < 3000 ? 'מהיר מאוד, כנראה סימון בלי בדיקה בפועל'
        : median < 8000 ? 'מהיר, כדאי לבדוק מדגמית' : median <= 45000 ? 'קצב סביר של בדיקה אמיתית' : 'איטי, עם הפסקות בין הסעיפים');
    }
    return { total: end - open, active, idleMax, marks, median, flags, opinion, suspicious: flags.some(f => f[0] === 'fast' || f[0] === 'short'), open, end };
  }

  /* ── נתונים ── */
  function listen() {
    if (started || typeof window._onSnap !== 'function') return;
    started = true;
    const on = (ref, key, map) => { try { window._onSnap(ref, s => { D[key] = s.docs.map(d => ({ id: d.id, ...d.data() })); if (map) D[key] = map(D[key]); render(); }, () => {}); } catch (e) { console.warn('reports', key, e); } };
    const since = Date.now() - 60 * 864e5;
    on(window._query(window._colRef('timing_logs'), window._where('submittedAt', '>=', since)), 'logs');
    on(window._query(window._colRef('bodyshop_jobs'), window._where('paidAt', '==', null)), 'jobs');
    on(window._colRef('bodyshop_archive'), 'shopArch');
    on(window._colRef('wash_notes'), 'washNotes');
    on(window._colRef('wash_payments'), 'washPays');
    on(window._query(window._colRef('battery_installs'), window._where('ordered', '==', false)), 'installs');
    on(window._colRef('battery_orders'), 'orders');
    on(window._colRef('pro_payments'), 'pro');
  }
  const latest = (arr, f) => arr.reduce((b, x) => (ms(f(x)) > ms(f(b || {})) ? x : b), null);
  const jobTotal = j => { try { if (typeof _bshopTotal === 'function') return _bshopTotal(j) || 0; } catch (e) {} return (j.items || []).reduce((s, it) => s + (Number(it.price) || 0), 0); };
  const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };

  /* ── תשלומים לבעלי מקצוע ── */
  function payHtml() {
    const ret = D.jobs.filter(j => j.status === 'returned'), atShop = D.jobs.filter(j => j.status === 'at_shop');
    const shopLast = latest(D.shopArch, x => x.createdAt || x.paidAt);
    const unpaidWash = D.washNotes.filter(n => !n.paidId).length;
    const washLast = latest(D.washPays, x => x.paidAt);
    const instSum = D.installs.reduce((s, v) => s + (Number(v.price) || 0), 0);
    const ordLast = latest(D.orders, x => x.createdAt || x.at);
    const hab = D.pro.filter(p => p.who === 'חביב');
    const habLast = latest(hab, x => x.date || x.createdAt);
    const habMonth = hab.filter(p => ms(p.date || p.createdAt) >= monthStart()).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const row = (ico, name, who, main, sub, last, act, extra) => `<div class="u2r-pay" data-act="${act}" role="button" tabindex="0">
        <div class="u2r-pay-top"><span class="u2r-ico">${ico}</span><div class="u2r-pay-n"><b>${name}</b><small>${who}</small></div>
          <div class="u2r-pay-v">${main}</div></div>
        <div class="u2r-pay-sub">${sub}</div>
        <div class="u2r-pay-last">${last}</div>${extra || ''}</div>`;
    return `<div class="u2r-pays">
      ${row('🔨', 'פחחות', 'איברהים', nis(ret.reduce((s, j) => s + jobTotal(j), 0)),
        `${ret.length} רכבים גמורים לתשלום · ${atShop.length} עדיין אצלו (${nis(atShop.reduce((s, j) => s + jobTotal(j), 0))})`,
        shopLast ? `תשלום אחרון: ${nis(shopLast.total)} · ${day(ms(shopLast.paidAt) || ms(shopLast.createdAt))}` : 'אין תשלומים קודמים', 'shop')}
      ${row('🧽', 'שטיפות', 'השוטף', `${unpaidWash} פתקים`, 'פתקים שעוד לא נכללו בתשלום',
        washLast ? `תשלום אחרון: ${nis(washLast.total)} · ${day(ms(washLast.paidAt))}` : 'אין תשלומים קודמים', 'wash')}
      ${row('🔋', 'מצברים', 'הספק', nis(instSum), `${D.installs.length} מצברים שהורכבו ועוד לא הוזמנו`,
        ordLast ? `הזמנה אחרונה: ${nis(ordLast.total)} · ${day(ms(ordLast.createdAt) || ms(ordLast.at))}` : 'אין הזמנות קודמות', 'battery')}
      ${row('🪟', 'חביב', 'חלונות ומנגנונים', nis(habMonth), 'שולם החודש',
        habLast ? `תשלום אחרון: ${nis(habLast.amount)} · ${day(ms(habLast.date) || ms(habLast.createdAt))}` : 'עוד לא נרשמו תשלומים', 'habib',
        `<button type="button" class="u2r-btn" data-act="habib-add">➕ רישום תשלום</button>`)}
    </div>`;
  }

  /* ── זמני ביצוע ── */
  function timeStats(k) {
    const since = Date.now() - 30 * 864e5;
    return DRIVERS.map(name => {
      const logs = D.logs.filter(l => l.kind === k && l.driver === name && (l.submittedAt || 0) >= since).map(l => ({ l, a: analyze(l) }));
      const avg = logs.length ? logs.reduce((s, x) => s + x.a.active, 0) / logs.length : 0;
      return { name, n: logs.length, avg, sus: logs.filter(x => x.a.suspicious).length };
    });
  }
  function timeHtml() {
    const st = timeStats(kind), ex = EXPECT[kind];
    const top = Math.max(ex ? ex[1] * 1.3 : 0, ...st.map(s => s.avg), 60e3);
    const band = ex ? `<div class="u2r-band" style="bottom:${ex[0] / top * 100}%;height:${(ex[1] - ex[0]) / top * 100}%"><span>טווח תקין ${range(ex)}</span></div>` : '';
    const bars = st.map(s => {
      const h = s.avg / top * 100;
      const cls = !s.n ? 'none' : ex && s.avg < ex[0] ? 'low' : ex && s.avg > ex[1] ? 'high' : 'ok';
      return `<button type="button" class="u2r-bar ${cls}" data-driver="${esc2(s.name)}" ${s.n ? '' : 'disabled'}>
          ${s.sus ? `<em class="u2r-sus" title="פעולות חשודות">⚠ ${s.sus} חשודות</em>` : ''}
          <span class="u2r-bar-v">${s.n ? fmt(s.avg) : '—'}</span>
          <span class="u2r-bar-f" style="height:${s.n ? Math.max(h, 3) : 0}%"></span>
          <b>${esc2(s.name)}</b><small>${s.n} פעולות</small></button>`;
    }).join('');
    return `<div class="u2r-kinds">${KINDS.map(([k, t]) => `<button type="button" data-kind="${k}" class="${k === kind ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="u2r-chart">${band}${bars}</div>
      <div class="u2r-note">ממוצע זמן עבודה בפועל ב-30 הימים האחרונים. זמן שהטופס עמד פתוח בלי פעולה לא נספר. לחיצה על נהג — פירוט.</div>`;
  }
  function driverReport(name) {
    const logs = D.logs.filter(l => l.kind === kind && l.driver === name).sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 15);
    const title = KINDS.find(k => k[0] === kind)[1];
    const items = logs.map(l => {
      const a = analyze(l);
      const dots = a.marks.map(t => `<i style="right:${a.total ? (t - a.open) / a.total * 100 : 0}%"></i>`).join('');
      return `<div class="u2r-act${a.suspicious ? ' sus' : ''}">
        <div class="u2r-act-h"><b>${esc2(l.plate || title)}</b><span>${new Date(l.submittedAt).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
        <div class="u2r-act-t">ארכה ${words(a.active)}${a.total - a.active > 30e3 ? ` <small>(פתוח ${words(a.total)} בסך הכל)</small>` : ''}</div>
        <div class="u2r-tl" title="כל נקודה = סעיף שסומן">${dots}</div>
        ${a.flags.map(f => `<div class="u2r-flag ${f[0]}">${f[0] === 'idle' ? '⏸' : f[0] === 'fast' ? '⚡' : f[0] === 'short' ? '⏱' : '🐢'} ${f[1]}</div>`).join('')}
        ${a.opinion ? `<div class="u2r-op">💬 ${esc2(a.opinion)}</div>` : ''}
      </div>`;
    }).join('') || '<div class="u2r-empty">אין עדיין פעולות מתועדות</div>';
    showModal(`⏱ ${esc2(name)} · ${title}`, `<div class="u2r-acts">${items}</div>`);
  }

  /* ── חלונות ── */
  function showModal(title, html) {
    let m = document.getElementById('modal-ui2-report');
    if (!m) {
      m = document.createElement('div');
      m.className = 'modal-overlay'; m.id = 'modal-ui2-report';
      m.innerHTML = `<div class="modal-box"><div class="modal-title"><span></span><button class="modal-close" onclick="closeModal('modal-ui2-report')">✕</button></div><div class="u2r-mbody"></div></div>`;
      m.addEventListener('click', e => { if (e.target === m) closeModal('modal-ui2-report'); });
      document.body.appendChild(m);
    }
    m.querySelector('.modal-title span').innerHTML = title;
    m.querySelector('.u2r-mbody').innerHTML = html;
    openModal('modal-ui2-report');
    return m;
  }
  function habibHistory() {
    const hab = D.pro.filter(p => p.who === 'חביב').sort((a, b) => ms(b.date || b.createdAt) - ms(a.date || a.createdAt));
    const list = hab.map(p => `<div class="u2r-hrow"><b>${nis(p.amount)}</b><span>${day(ms(p.date) || ms(p.createdAt))}</span><small>${esc2(p.note || '')}</small></div>`).join('')
      || '<div class="u2r-empty">עוד לא נרשמו תשלומים</div>';
    showModal('🪟 חביב · תשלומים', `<button type="button" class="u2r-btn wide" onclick="window._u2rHabibAdd()">➕ רישום תשלום</button><div class="u2r-hist">${list}</div>`);
  }
  function habibAdd() {
    const today = new Date().toISOString().slice(0, 10);
    const m = showModal('🪟 רישום תשלום לחביב', `<div class="u2r-form">
      <label>סכום (₪)<input class="form-input" id="u2r-amt" type="number" inputmode="decimal" min="0"></label>
      <label>תאריך<input class="form-input" id="u2r-date" type="date" value="${today}"></label>
      <label>הערה<input class="form-input" id="u2r-note" placeholder="לא חובה"></label>
      <button type="button" class="btn-submit" id="u2r-save">שמור תשלום</button></div>`);
    setTimeout(() => m.querySelector('#u2r-amt')?.focus(), 100);
    m.querySelector('#u2r-save').onclick = async e => {
      const amt = Number(m.querySelector('#u2r-amt').value);
      if (!(amt > 0)) { try { showToast('נא להזין סכום'); } catch (x) {} return; }
      const btn = e.currentTarget; if (btn.disabled) return; btn.disabled = true;
      try {
        await window._addDoc(window._colRef('pro_payments'), {
          who: 'חביב', amount: amt, date: m.querySelector('#u2r-date').value || today,
          note: m.querySelector('#u2r-note').value.trim(), createdBy: currentUser?.name || '', createdAt: window._serverTs(),
        });
        closeModal('modal-ui2-report');
        try { showToast('✅ התשלום נרשם'); } catch (x) {}
      } catch (err) { btn.disabled = false; try { showToast('שגיאה בשמירה — נסה שוב'); } catch (x) {} }
    };
  }
  window._u2rHabibAdd = habibAdd;

  /* ── בניה והצגה ── */
  function el() { return document.getElementById('ui2-reports'); }
  function build() {
    if (el()) return;
    const layout = document.getElementById('home-layout'); if (!layout) return;
    const s = document.createElement('section');
    s.id = 'ui2-reports';
    s.innerHTML = `<div class="u2r-head"><h2>דוחות</h2><div class="u2r-tabs">
        <button type="button" data-tab="pay">תשלומים</button><button type="button" data-tab="time">זמני ביצוע</button></div></div>
      <div class="u2r-body"></div>`;
    s.addEventListener('click', e => {
      const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; render(); return; }
      const k = e.target.closest('[data-kind]'); if (k) { kind = k.dataset.kind; render(); return; }
      const b = e.target.closest('.u2r-bar[data-driver]'); if (b) { driverReport(b.dataset.driver); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      e.stopPropagation();
      const act = a.dataset.act;
      if (act === 'habib-add') habibAdd();
      else if (act === 'habib') habibHistory();
      else if (act === 'shop') goToScreen('bodyshop-mgr');
      else if (act === 'wash') { try { openWashPayHub(); } catch (x) { goToScreen('wash'); } }
      else if (act === 'battery') goToScreen('battery-stock');
    });
    layout.appendChild(s);
  }
  function render() {
    const s = el(); if (!s) return;
    s.querySelectorAll('.u2r-tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    s.querySelector('.u2r-body').innerHTML = tab === 'pay' ? payHtml() : timeHtml();
  }
  function tick() {
    const ok = document.body.classList.contains('ui2') && window.innerWidth > 900 &&
      typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'manager';
    if (!ok) { el()?.remove(); return; }
    if (!el()) { build(); listen(); render(); }
  }
  setInterval(tick, 1000);
})();
