/* סביבת הדגמה — שומר רשת.
   נטען ראשון בכל דף. חוסם כל פנייה החוצה שעלולה לשנות משהו אמיתי
   (שרת, WhatsApp, SMS, טלגרם, התראות), ומאפשר רק קבצים סטטיים. */
(function () {
  'use strict';
  window.__DEMO__ = true;
  var ALLOW = /^(https?:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|cdn\.sheetjs\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\/)/;
  function ok(url, method) {
    try {
      var u = new URL(url, location.href);
      if (u.protocol === 'data:' || u.protocol === 'blob:') return true;
      if (u.origin === location.origin) return !method || /^(GET|HEAD)$/i.test(method);
      return ALLOW.test(u.href) && (!method || /^(GET|HEAD)$/i.test(method));
    } catch (e) { return false; }
  }
  var lastAct = 0;
  ['pointerdown', 'keydown'].forEach(function (ev) { addEventListener(ev, function () { lastAct = Date.now(); }, true); });
  function note(url) {
    console.warn('[demo] חסום: ' + url);
    // הודעה רק כשהמשתמש לחץ על משהו — לא על בדיקות רקע
    if (Date.now() - lastAct < 4000) try { window.showToast && window.showToast('🧪 סביבת הדגמה — הפעולה לא נשלחה'); } catch (e) {}
  }
  /* צ׳אט ה-AI בהדגמה: תשובות מדומות ומסומנות, בלי שום פנייה לשרת */
  function demoAI(init) {
    var body = {}; try { body = JSON.parse(init && init.body || '{}'); } catch (e) {}
    var plate = String(body.plate || '');
    var fmt = function (p) { return p.length === 7 ? p.slice(0, 2) + '-' + p.slice(2, 5) + '-' + p.slice(5) : p.slice(0, 3) + '-' + p.slice(3, 5) + '-' + p.slice(5); };
    var car = null;
    try { window.__demoStore.forEach(function (col) { col.forEach(function (d) { if (!car && d && d.plate === fmt(plate) && (d.maker || d.brand)) car = d; }); }); } catch (e) {}
    var vehicle = car ? { plate: plate, maker: car.maker || car.brand, model: car.model, year: car.year, color: car.color, trim: 'Premium', fuel: 'בנזין', engine: 'G4FG', fetchedAt: new Date().toISOString() } : null;
    var out = body.action === 'identify' ? (vehicle ? { found: true, vehicle: vehicle } : { found: false })
      : { vehicle: vehicle, answer: vehicle ? '(הדגמה — תשובה מדומה) לרכב ' + vehicle.maker + ' ' + vehicle.model + ' ' + vehicle.year + ' מתאים בדרך כלל מצבר 60Ah, קוטב פלוס מימין. בתא המטען יש גלגל חלופי מצומצם מתחת לרצפה. לאישור סופי כדאי לצלם את התווית של המצבר הקיים.' : 'המספר לא נמצא במרשם (הדגמה).',
          sources: vehicle ? [{ title: 'מקור לדוגמה — ספר הרכב', url: 'https://example.com/manual' }] : [] };
    return new Promise(function (r) { setTimeout(function () { r(new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } })); }, body.action === 'identify' ? 500 : 1500); });
  }
  var _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    var method = (init && init.method) || (input && input.method) || 'GET';
    if (/\/vehicleAI$/.test(url)) return demoAI(init);
    if (ok(url, method)) return _fetch(input, init);
    note(url);
    return Promise.resolve(new Response(JSON.stringify({ ok: false, demo: true, error: 'blocked in demo' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
  };
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (!ok(url, method)) { note(url); arguments[1] = 'data:application/json,%7B%22demo%22%3Atrue%7D'; arguments[0] = 'GET'; }
    return _open.apply(this, arguments);
  };
  if (navigator.sendBeacon) navigator.sendBeacon = function (u) { note(u); return true; };
  window.WebSocket = function (u) { note(u); throw new Error('blocked in demo'); };
  window.EventSource = function (u) { note(u); throw new Error('blocked in demo'); };
  var _wopen = window.open;
  window.open = function (url) {
    if (url && !ok(url)) { note(url); return null; }
    return _wopen.apply(window, arguments);
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a && !ok(a.href) && !/^(#|javascript:)/.test(a.getAttribute('href'))) { e.preventDefault(); note(a.href); }
  }, true);
  /* בלי Service Worker — שלא יישאר קוד ישן במטמון */
  if ('serviceWorker' in navigator) {
    try { navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); }); } catch (e) {}
    var fakeReg = { active: null, installing: null, waiting: null, scope: location.origin + '/ops/', update: function () { return Promise.resolve(); }, unregister: function () { return Promise.resolve(true); }, addEventListener: function () {}, pushManager: { getSubscription: function () { return Promise.resolve(null); }, subscribe: function () { return Promise.reject(new Error('demo')); } } };
    try {
      Object.defineProperty(navigator.serviceWorker, 'register', { value: function () { return Promise.resolve(fakeReg); } });
      Object.defineProperty(navigator.serviceWorker, 'getRegistration', { value: function () { return Promise.resolve(undefined); } });
    } catch (e) {}
  }
  if (window.Notification) try { Notification.requestPermission = function () { return Promise.resolve('denied'); }; } catch (e) {}

  /* משתמש: ?as=גיל / ?as=משה וכו׳. ברירת מחדל — המנהל */
  var ROLES = { 'ליאל': 'manager', 'גיל': 'driver', 'עופר': 'driver', 'איתי': 'driver', 'משה': 'pickup_agent', 'הילה': 'pickup_driver', 'איברהים': 'bodyshop' };
  try {
    var as = new URLSearchParams(location.search).get('as');
    var cur = JSON.parse(localStorage.getItem('anak_user') || 'null');
    if (as && ROLES[as]) cur = { name: as, role: ROLES[as] };
    if (!cur || !cur.name) cur = { name: 'ליאל', role: 'manager' };
    localStorage.setItem('anak_user', JSON.stringify(cur));
    localStorage.setItem('anak_real_user', JSON.stringify(cur));
  } catch (e) {}

  /* תווית קבועה */
  function badge() {
    if (document.getElementById('demo-badge') || window.top !== window) return;  // בתוך מסגרת הטלפון התווית כבר מוצגת בצד
    var b = document.createElement('div');
    b.id = 'demo-badge';
    b.textContent = '🧪 הדגמה — שום דבר לא נשמר';
    b.title = 'סביבת הדגמה: נתונים מדומים, שום שינוי לא מגיע לאפליקציה האמיתית. רענון מחזיר את הנתונים להתחלה.';
    b.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);border-radius:0 0 10px 10px;z-index:2147483647;background:#7c3aed;color:#fff;font:700 11px/1 Heebo,Arial,sans-serif;padding:4px 12px;box-shadow:0 2px 8px #0004;pointer-events:none;opacity:.85';
    document.body.appendChild(b);
  }
  if (document.body) badge(); else document.addEventListener('DOMContentLoaded', badge);
})();
