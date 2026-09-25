// v436 — force update
/* מטמון האפליקציה.
   כל קובץ קוד נטען עם ?v=<גרסה> בכתובת, ולכן גרסה חדשה היא כתובת
   חדשה — בטוח לחלוטין להגיש אותו מהמטמון בלי לשאול את השרת.
   שם המטמון נושא את הגרסה: העלאת גרסה מוחקת הכל ומתמלא מחדש.
   הדף עצמו (HTML) נשאר תמיד מהשרת, כדי שגרסה ישנה לא תיתקע. */
const CACHE = 'anak-v436';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => e.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
  await clients.claim();
})()));

/* מה נשמר: אך ורק הקבצים שלנו מהשרת שלנו — קוד האפליקציה, תמונות
   וגופנים. ספריות חיצוניות (Firebase וכו') ממשיכות בדיוק כמו קודם,
   בלי שנתערב בהן, כדי שלא נוכל לשבור את ההתחברות לשרת. */
function _cacheable(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.endsWith('/sw.js')) return false;
  return /\.(js|css|png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // הדף עצמו — תמיד מהשרת, ומהמטמון רק אם אין רשת בכלל
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (!_cacheable(url)) return;

  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    // נשמר רק מה שהגיע שלם ותקין — תשובה חלקית או שגויה לא נתקעת במטמון
    if (res && res.status === 200 && res.type === 'basic') {
      const copy = res.clone();
      (await caches.open(CACHE)).put(req, copy).catch(() => {});
    }
    return res;
  })().catch(() => caches.match(req)));
});

/* התראה שמגיעה מהשרת. גוף ההודעה נושא גם כתובת, כדי שלחיצה תפתח
   את המסך הרלוונטי ולא רק את מסך הבית. */
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch (_) { data = { body: e.data ? e.data.text() : '' }; }
  const url = data.url || '/ops/';
  e.waitUntil(
    self.registration.showNotification(data.title || 'מחלקת תפעול', {
      body: data.body || '',
      icon: '/ops/icon-192.png',
      badge: '/ops/icon-192.png',
      dir: 'rtl',
      lang: 'he',
      tag: data.tag || undefined,
      data: { url },
    })
  );
});

/* חלון שכבר פתוח מקבל מיקוד ועובר לכתובת, במקום להיפתח חלון שני. */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/ops/';
  e.waitUntil((async () => {
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.includes('/ops/')) {
        try { await c.navigate(url); } catch (_) {}
        return c.focus();
      }
    }
    return clients.openWindow(url);
  })());
});
