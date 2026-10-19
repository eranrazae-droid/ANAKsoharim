/* דוחות במסך הבית (עיצוב חדש, מנהל, מחשב).
   השליש הימני של מסך הבית: תשלומים לבעלי מקצוע וזמני ביצוע של הנהגים.
   קורא נתונים קיימים; הכתיבה היחידה היא רישום תשלום ידני (pro_payments). */
(function () {
  'use strict';
  const DRIVERS = ['גיל', 'עופר', 'איתי'];
  const KINDS = [['intake', 'קליטות'], ['inventory', 'בדיקת מלאי'], ['testdrive', 'נסיעות מבחן']];
  const EXPECT = { intake: [5 * 60e3, 10 * 60e3], testdrive: [5 * 60e3, 10 * 60e3] };   // קליטה ונסיעת מבחן: 5–10 דקות
  const FROM_FIRST_MARK = ['intake', 'testdrive'];   // הספירה מתחילה מהסימון הראשון של הנהג, לא מפתיחת הטופס
  const IDLE = 90e3;            // הפסקה ארוכה מזה לא נספרת כזמן עבודה
  const LONG_IDLE = 3 * 60e3;   // הפסקה ארוכה מזה מסומנת בדוח
  const SEND_WAIT = 60e3;       // סיים למלא ולא שלח מעבר לזה — דפוס חריג
  const FAST_GAP = 2000, FAST_RUN = 6;   // 6 סעיפים ברצף, פחות מ-2 שניות בין אחד לשני
  const D = { logs: [], jobs: [], shopArch: [], washNotes: [], washPays: [], installs: [], orders: [], pro: [] };
  let tab = 'pay', kind = 'intake', started = false;
  const esc2 = s => (typeof esc === 'function' ? esc(String(s ?? '')) : String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const ms = t => t?.toMillis ? t.toMillis() : (typeof t === 'number' ? t : (t ? +new Date(t) : 0));
  const fmt = v => { v = Math.max(0, Math.round(v / 1000)); const m = Math.floor(v / 60), s = v % 60; return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} ש׳` : `${m}:${String(s).padStart(2, '0')}`; };
  const range = ex => `<bdi dir="ltr">${Math.round(ex[0] / 60e3)}–${Math.round(ex[1] / 60e3)}</bdi> דקות`;
  const words = v => { v = Math.round(v / 1000); const m = Math.floor(v / 60), s = v % 60; return m ? `${m === 1 ? 'דקה' : m + ' דקות'}${s ? ` ו-${s} שניות` : ''}` : `${s} שניות`; };
  const gapTxt = v => { const t = Math.round(v / 100) / 10; return t < 60 ? `${t} שנ׳` : words(v); };
  const nis = n => '₪' + Math.round(n || 0).toLocaleString('he-IL');
  const day = t => t ? new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : '';

  /* ── ניתוח רשומת זמנים ── */
  function analyze(L) {
    const marks = Object.values(L.marks || {}).sort((a, b) => a - b);
    const open = FROM_FIRST_MARK.includes(L.kind) && marks.length ? marks[0] : L.openedAt, end = L.submittedAt || open;
    const pts = [open, ...(L.acts || []).filter(t => t >= open && t <= end), end].sort((a, b) => a - b);
    let active = 0, idleMax = 0;
    for (let i = 1; i < pts.length; i++) { const g = pts[i] - pts[i - 1]; active += Math.min(g, IDLE); idleMax = Math.max(idleMax, g); }
    const gaps = marks.slice(1).map((t, i) => t - marks[i]);
    // ממוצע בין סימון לסימון; הפסקה ארוכה (מעל דקה וחצי) לא נכנסת לממוצע
    const work = gaps.filter(g => g <= IDLE);
    const meanGap = work.length ? work.reduce((t, g) => t + g, 0) / work.length : 0;
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
    /* ── דפוסים חריגים (פר קליטה) ── */
    const codes = [];
    if (best + 1 >= FAST_RUN) codes.push('fast');
    if (gaps.length >= 8) {                                     // קצב אחיד מדי
      const mean = gaps.reduce((t, g) => t + g, 0) / gaps.length;
      const sd = Math.sqrt(gaps.reduce((t, g) => t + (g - mean) ** 2, 0) / gaps.length);
      if (mean <= 8000 && sd / (mean || 1) < 0.3) { codes.push('rhythm'); flags.push(['rhythm', `קצב אחיד מדי: ${gaps.length + 1} סימונים במרווחים של כ-${Math.round(mean / 1000)} שניות בכל אחד`]); }
    }
    if (L.kind === 'intake' && typeof _ciLabels !== 'undefined' && L.changes === 0) {   // כל הסעיפים בסדר הטופס, בלי תיקון
      const order = Object.keys(_ciLabels), byTime = Object.entries(L.marks || {}).filter(([k]) => order.includes(k)).sort((a, b) => a[1] - b[1]).map(e => e[0]);
      const inForm = byTime.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
      if (byTime.length >= 10 && byTime.every((k, i) => k === inForm[i])) { codes.push('order'); flags.push(['order', `סימן ${byTime.length} סעיפים בסדר מושלם מלמעלה למטה, בלי תיקון אחד`]); }
    }
    for (let i = 0, j = 0; i < marks.length; i++) {              // סימון בבת אחת
      while (marks[i] - marks[j] > 20e3) j++;
      if (i - j + 1 >= 8) { codes.push('burst'); flags.push(['burst', `${i - j + 1} סעיפים סומנו תוך ${Math.max(1, Math.round((marks[i] - marks[j]) / 1000))} שניות`]); break; }
    }
    if (marks.length && L.openedAt && marks[0] - L.openedAt > 10 * 60e3 && end - marks[0] < 4 * 60e3) {   // נפתח מוקדם, מולא בדקות האחרונות
      codes.push('early'); flags.push(['early', `הטופס נפתח ${words(marks[0] - L.openedAt)} לפני הסימון הראשון, והסימון כולו ארך ${words(end - marks[0])}`]);
    }
    if (L.readyAt && end - L.readyAt > SEND_WAIT) {              // סיים למלא ולא שלח
      codes.push('late'); flags.push(['late', `סיים למלא ${words(end - L.readyAt)} לפני ששלח`]);
    }
    let opinion = '';
    if (gaps.length >= 3) {
      const s = Math.round(median / 1000);
      opinion = `בממוצע ${s} שניות בין סעיף לסעיף — ` + (median < 3000 ? 'מהיר מאוד, כנראה סימון בלי בדיקה בפועל'
        : median < 8000 ? 'מהיר, כדאי לבדוק מדגמית' : median <= 45000 ? 'קצב סביר של בדיקה אמיתית' : 'איטי, עם הפסקות בין הסעיפים');
    }
    return { codes, start: marks[0] || open, total: end - open, active, idleMax, marks, median, meanGap, gaps: work.length, flags, opinion, suspicious: flags.some(f => f[0] === 'fast' || f[0] === 'short'), open, end };
  }

  /* ── דפוסים שנראים רק בין כמה קליטות של אותו נהג ── */
  const PATTERNS = [
    ['fast', '⚡', 'רצף מהיר'], ['rhythm', '🎼', 'קצב אחיד'], ['order', '📑', 'סדר מושלם'], ['burst', '💥', 'סימון בבת אחת'],
    ['overlap', '🔀', 'חפיפה בזמן'], ['batch', '🗂', 'קליטות צמודות'], ['early', '🌅', 'פתיחה מוקדמת'], ['base', '🏃', 'מהיר מהרגיל'], ['late', '⏳', 'עיכוב בשליחה'],
  ];
  const ICON = Object.fromEntries(PATTERNS.map(p => [p[0], p[1]]).concat([['idle', '⏸'], ['short', '⏱'], ['long', '🐢']]));
  function analyzeAll(driver, k) {
    const rows = D.logs.filter(l => l.kind === k && l.driver === driver).map(l => ({ l, a: analyze(l) })).sort((x, y) => x.a.end - y.a.end);
    const add = (r, code, text) => { if (!r.a.codes.includes(code)) { r.a.codes.push(code); r.a.flags.push([code, text]); } };
    rows.forEach(r => {
      rows.forEach(o => {                                      // שתי קליטות שונות בו־זמנית
        if (o === r || (o.l.refId || o.l.plate) === (r.l.refId || r.l.plate)) return;
        if (Math.min(r.a.end, o.a.end) - Math.max(r.a.start, o.a.start) > 30e3) add(r, 'overlap', `חפיפה בזמן עם קליטה של ${o.l.plate || 'רכב אחר'}`);
      });
      const near = rows.filter(o => Math.abs(o.a.end - r.a.end) <= 5 * 60e3).length;   // כמה קליטות נשלחו כמעט יחד
      if (near >= 3) add(r, 'batch', `${near} קליטות נשלחו בתוך 5 דקות`);
      const others = rows.filter(o => o !== r).map(o => o.a.active).sort((x, y) => x - y);   // מהיר בהרבה מהרגיל שלו
      if (others.length >= 5) {
        const med = others[Math.floor(others.length / 2)];
        if (med > 0 && r.a.active < med * 0.5) add(r, 'base', `מהיר פי ${(med / Math.max(r.a.active, 1000)).toFixed(1).replace('.0', '')} מהרגיל שלו (בדרך כלל ${words(med)})`);
      }
    });
    return rows;
  }
  function patternSummary(k) {
    const since = Date.now() - 30 * 864e5;
    return DRIVERS.map(name => {
      const rows = analyzeAll(name, k).filter(r => (r.l.submittedAt || 0) >= since), counts = {};
      rows.forEach(r => r.a.codes.forEach(c => { counts[c] = (counts[c] || 0) + 1; }));
      return { name, n: rows.length, counts, flagged: rows.filter(r => r.a.codes.length).length };
    });
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
      // בבדיקת מלאי: ממוצע הזמן בין סימון לסימון; בשאר: זמן העבודה בפועל
      const val = x => k === 'inventory' ? x.a.meanGap : x.a.active;
      const counted = k === 'inventory' ? logs.filter(x => x.a.gaps) : logs;
      const avg = counted.length ? counted.reduce((s, x) => s + val(x), 0) / counted.length : 0;
      return { name, n: logs.length, avg, sus: logs.filter(x => x.a.suspicious).length };
    });
  }
  function timeHtml() {
    const st = timeStats(kind), ex = EXPECT[kind];
    const top = Math.max(ex ? ex[1] * 1.3 : 0, ...st.map(s => s.avg * 1.15), kind === 'inventory' ? 5e3 : 60e3);
    const band = ex ? `<div class="u2r-band" style="bottom:${ex[0] / top * 100}%;height:${(ex[1] - ex[0]) / top * 100}%"><span>טווח תקין ${range(ex)}</span></div>` : '';
    const bars = st.map(s => {
      const h = s.avg / top * 100;
      const cls = !s.n ? 'none' : ex && s.avg < ex[0] ? 'low' : ex && s.avg > ex[1] ? 'high' : 'ok';
      return `<button type="button" class="u2r-bar ${cls}" data-driver="${esc2(s.name)}" ${s.n ? '' : 'disabled'}>
          ${s.sus ? `<em class="u2r-sus" title="פעולות חשודות">⚠ ${s.sus} חשודות</em>` : ''}
          <span class="u2r-bar-v">${s.n ? (kind === 'inventory' ? gapTxt(s.avg) : fmt(s.avg)) : '—'}</span>
          <span class="u2r-bar-f" style="height:${s.n ? Math.max(h, 3) : 0}%"></span>
          <b>${esc2(s.name)}</b><small>${s.n} פעולות</small></button>`;
    }).join('');
    return `<div class="u2r-kinds">${KINDS.map(([k, t]) => `<button type="button" data-kind="${k}" class="${k === kind ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="u2r-chart">${band}${bars}</div>
      <div class="u2r-pats"><div class="u2r-pats-h">🔎 דפוסים חריגים · 30 ימים</div>${patternSummary(kind).map(s => {
        const chips = PATTERNS.filter(p => s.counts[p[0]]).map(p => `<span class="u2r-chip" title="${p[2]}">${p[1]} ${p[2]} <b>${s.counts[p[0]]}</b></span>`).join('');
        return `<button type="button" class="u2r-prow" data-driver="${esc2(s.name)}" ${s.n ? '' : 'disabled'}><b>${esc2(s.name)}</b>
          <span>${!s.n ? 'אין פעולות' : chips || '<em>אין דפוסים חריגים</em>'}</span><small>${s.n ? s.flagged + ' מתוך ' + s.n : ''}</small></button>`;
      }).join('')}</div>
      <div class="u2r-note">${kind === 'inventory'
        ? 'ממוצע הזמן בין סימון לסימון ב-30 הימים האחרונים. הפסקה של יותר מדקה וחצי לא נספרת. לחיצה על נהג — פירוט.'
        : 'ממוצע זמן עבודה בפועל ב-30 הימים האחרונים, מהסימון הראשון של הנהג ועד השליחה. זמן שהטופס עמד פתוח בלי פעולה לא נספר. לחיצה על נהג — פירוט.'}</div>`;
  }
  function driverReport(name) {
    const logs = analyzeAll(name, kind).sort((x, y) => y.l.submittedAt - x.l.submittedAt).slice(0, 15);
    const title = KINDS.find(k => k[0] === kind)[1];
    const items = logs.map(({ l, a }) => {
      const dots = a.marks.map(t => `<i style="right:${a.total ? (t - a.open) / a.total * 100 : 0}%"></i>`).join('');
      return `<div class="u2r-act${a.suspicious ? ' sus' : ''}">
        <div class="u2r-act-h"><b>${esc2(l.plate || title)}</b><span>${new Date(l.submittedAt).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
        ${kind === 'inventory' && a.gaps ? `<div class="u2r-act-t">ממוצע ${gapTxt(a.meanGap)} בין סימון לסימון</div>` : ''}
        <div class="u2r-act-t">ארכה ${words(a.active)}${a.total - a.active > 30e3 ? ` <small>(פתוח ${words(a.total)} בסך הכל)</small>` : ''}</div>
        <div class="u2r-tl" title="כל נקודה = סעיף שסומן">${dots}</div>
        ${a.flags.map(f => `<div class="u2r-flag ${f[0]}">${ICON[f[0]] || '•'} ${f[1]}</div>`).join('')}
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
  /* היסטוריית התשלומים של בעל מקצוע אחד */
  function history(act) {
    const full = t => t ? new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' }) : '';
    const rows = (arr, when, amount, note) => arr.slice().sort((a, b) => when(b) - when(a))
      .map(x => `<div class="u2r-hrow"><b>${nis(amount(x))}</b><span>${full(when(x))}</span><small>${esc2(note(x) || '')}</small></div>`).join('');
    let title, body, top = '';
    if (act === 'shop') {
      title = '🔨 איברהים · תשלומים';
      body = rows(D.shopArch, x => ms(x.paidAt) || ms(x.createdAt), x => x.total, x => `${(x.cars || []).length} רכבים${x.title ? ' · ' + x.title : ''}`);
    } else if (act === 'wash') {
      title = '🧽 שטיפות · תשלומים';
      body = rows(D.washPays, x => ms(x.paidAt), x => x.total, x => `${x.count || 0} רכבים${x.invoiceNumber ? ' · חשבונית ' + x.invoiceNumber : ''}`);
    } else if (act === 'battery') {
      title = '🔋 מצברים · הזמנות';
      body = rows(D.orders, x => ms(x.createdAt) || ms(x.at), x => x.total, x => `${x.units || 0} מצברים`);
    } else {
      title = '🪟 חביב · תשלומים';
      top = `<button type="button" class="u2r-btn wide" onclick="window._u2rHabibAdd()">➕ רישום תשלום</button>`;
      body = rows(D.pro.filter(p => p.who === 'חביב'), x => ms(x.date) || ms(x.createdAt), x => x.amount, x => x.note);
    }
    showModal(title, top + `<div class="u2r-hist">${body || '<div class="u2r-empty">אין עדיין תשלומים</div>'}</div>`);
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
      const b = e.target.closest('.u2r-bar[data-driver],.u2r-prow[data-driver]'); if (b) { driverReport(b.dataset.driver); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      e.stopPropagation();
      const act = a.dataset.act;
      if (act === 'habib-add') habibAdd();
      else history(act);
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
