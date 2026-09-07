/* עובד השירות של דף "משימה חדשה" בלבד.
   הדף נשמר במכשיר ומוגש ממנו מיד, בלי להמתין לרשת — זו הסיבה שהוא
   נפתח באותה שנייה גם כשהחיבור חלש. הוא מוגבל לכתובת task.html
   ולכן אינו נוגע במערכת עצמה ואינו מושפע מעדכוניה.
   ברקע נמשכת גרסה טרייה לפעם הבאה. */
const CACHE = 'quick-task-v2';
const PAGE = 'task.html';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.add(PAGE)).catch(() => {}));
});

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;      // הכתיבה למסד תמיד לרשת
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.endsWith('/task.html') && e.request.mode !== 'navigate') return;

  e.respondWith(
    caches.match(PAGE).then(hit => {
      const fresh = fetch(e.request)
        .then(res => { if (res && res.ok) caches.open(CACHE).then(c => c.put(PAGE, res.clone())); return res; })
        .catch(() => hit);
      return hit || fresh;                      // יש עותק? מגישים מיד
    })
  );
});
