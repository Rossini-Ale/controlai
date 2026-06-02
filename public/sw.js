const CACHE = "controlai-v1";
const STATIC = [
  "/dashboard.html",
  "/lancamentos.html",
  "/contas.html",
  "/relatorios.html",
  "/cartoes.html",
  "/configuracoes.html",
  "/login.html",
  "/css/global.css",
  "/js/global.js",
  "/js/ui.js",
  "/js/storage.js",
  "/js/voice.js",
  "/js/notifications.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // API e webhook: sempre rede, sem cache
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/bot")) {
    return;
  }

  // CDN externo: cache primeiro, rede como fallback
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.match(e.request).then(
        (cached) =>
          cached ||
          fetch(e.request).then((res) => {
            caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
            return res;
          })
      )
    );
    return;
  }

  // Assets locais: cache primeiro, rede como fallback
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
    )
  );
});
