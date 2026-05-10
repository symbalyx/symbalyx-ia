// Symbalyx — Service Worker (cache app-shell + network-first webhooks + push)
const CACHE = 'symbalyx-v2';
const SHELL = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Clean up old caches
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Network-first pour les webhooks et les APIs (Sheets, Supabase, n8n)
  // → toujours frais quand ça passe, fallback cache sinon.
  if (url.pathname.includes('/webhook/') || url.hostname.includes('googleapis.com') ||
      url.hostname.includes('supabase') || url.hostname.includes('n8n')) {
    e.respondWith(
      fetch(req).then(r => {
        // Ne cache pas les webhooks (données dynamiques)
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first pour le shell
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(r => {
        // Mise à jour silencieuse du cache si même origin et succès
        if (r.ok && url.origin === location.origin) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{});
        }
        return r;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) {}
  const title = data.title || 'Symbalyx';
  const opts = {
    body: data.body || '',
    tag: data.tag || 'symbalyx',
    icon: undefined,
    badge: undefined,
    data,
    requireInteraction: data.severity === 'critical'
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const deep = e.notification.data && e.notification.data.deeplink;
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    if (list && list.length) {
      const c = list[0]; c.focus();
      if (deep && c.postMessage) c.postMessage({ type: 'deeplink', url: deep });
      return;
    }
    return self.clients.openWindow('./index.html' + (deep || ''));
  }));
});
