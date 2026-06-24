var CACHE = 'anak-sales-v53';
var FILES = [
  '/index.html',
  '/finance.html',
  '/finance-used.html',
  '/quote.html',
  '/quotes.html',
  '/sign.html',
  '/view.html',
  '/delivery.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(FILES); })
  );
  self.skipWaiting();
});
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  // HTML — network first, fallback to cache
  if (e.request.destination === 'document' || url.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).then(function(resp) {
        var clone = resp.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        return resp;
      }).catch(function() {
        return caches.match(e.request).then(function(r){ return r || caches.match('/index.html'); });
      })
    );
    return;
  }
  // שאר הקבצים — cache first
  e.respondWith(
    caches.match(e.request).then(function(r) {
      return r || fetch(e.request).catch(function(){ return caches.match('/index.html'); });
    })
  );
});
