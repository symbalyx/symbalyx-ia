// Symbalyx — Service Worker minimal (cache app-shell + push fallback)
const CACHE = 'symbalyx-v1';
const SHELL = ['./index.html', './manifest.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).catch(() => caches.match('./index.html')))
  );
});
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) {}
  const title = data.title || 'Symbalyx';
  const opts = { body: data.body || '', tag: data.tag || 'symbalyx', icon: undefined, data };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    if (list && list.length) return list[0].focus();
    return self.clients.openWindow('./index.html');
  }));
});
