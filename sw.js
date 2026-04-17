const CACHE = 'calpedicbd-20260417194852';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/calculator.js',
  '/js/app.js',
  '/data/oral.json',
  '/data/injection.json',
  '/data/tb.json',
  '/data/renal.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
