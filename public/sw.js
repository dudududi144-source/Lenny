// Self-destructing service worker.
// Clears all stale caches from previous versions and unregisters,
// so devices stuck on an old cached shell load the fresh site.
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});
self.addEventListener('fetch', (e) => { /* network-only, no caching */ });
