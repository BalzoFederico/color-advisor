const CACHE = 'balzebuzz-v1';
const CORE = ['/', '/index.html', '/manifest.json', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith((async () => {
    try {
      const net = await fetch(e.request);
      const cache = await caches.open(CACHE);
      cache.put(e.request, net.clone());
      return net;
    } catch {
      const cached = await caches.match(e.request);
      return cached || Response.error();
    }
  })());
});
