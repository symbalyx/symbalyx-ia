/* =========================================================
 *  Symbalyx — Service Worker minimal pour PWA installable.
 *  Cache uniquement les assets statiques de la UI.
 *  Aucune requête Matrix n'est mise en cache.
 * ========================================================= */

const CACHE = "symbalyx-ui-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./decoy-data.js",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Ne JAMAIS mettre en cache les requêtes Matrix / Element / LiveKit / Whisper :
  // ces flux doivent toujours toucher le réseau pour rester à jour et chiffrés.
  if (
    url.port === "8008" ||  // Synapse
    url.port === "8080" ||  // Element Web
    url.port === "8181" ||  // Element Call
    url.port === "8881" ||  // lk-jwt
    url.port === "7880" ||  // LiveKit
    url.port === "9000" ||  // Whisper
    url.pathname.startsWith("/_matrix") ||
    url.pathname.startsWith("/_synapse")
  ) {
    return;
  }

  // Cache-first pour les assets statiques de Symbalyx
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).catch(() => cached))
  );
});
