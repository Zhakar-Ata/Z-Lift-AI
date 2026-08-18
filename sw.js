/* Z Lift AI — service worker (offline-first shell) */
const CACHE = 'zliftai-v2';
const CORE = ['./', './index.html', './brain.js', './standards.js', './engine.js', './app.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const url = new URL(e.request.url);
      if (res.ok && (url.origin === location.origin || url.href.includes('cdn.jsdelivr.net'))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => { if (e.request.mode === 'navigate') return caches.match('./index.html'); }))
  );
});
