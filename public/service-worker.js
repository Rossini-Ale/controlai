// service-worker.js
const CACHE_NAME = "controlai-v1.1";

// Arquivos estáticos que ficam em cache
const STATIC_ASSETS = [
  "/",
  "/dashboard.html",
  "/lancamentos.html",
  "/contas.html",
  "/cartoes.html",
  "/relatorios.html",
  "/configuracoes.html",
  "/login.html",
  "/css/global.css",
  "/js/global.js",
  "/js/ui.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js",
];

// ── Install: faz cache dos assets estáticos ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Cacheando assets estáticos...");
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Alguns assets não puderam ser cacheados:", err);
      });
    }),
  );
  self.skipWaiting();
});

// ── Activate: limpa caches antigos ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[SW] Removendo cache antigo:", key);
            return caches.delete(key);
          }),
      ),
    ),
  );
  self.clients.claim();
});

// ── Fetch: estratégia Network First para API, Cache First para assets ──
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API: sempre busca da rede, sem cache
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/bot")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ erro: "Sem conexão com o servidor." }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    return;
  }

  // Assets estáticos: Cache First, fallback para rede
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Cacheia novos assets estáticos automaticamente
          if (
            response.ok &&
            event.request.method === "GET" &&
            !url.pathname.includes("socket")
          ) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback offline para páginas HTML
          if (event.request.destination === "document") {
            return caches.match("/dashboard.html");
          }
        });
    }),
  );
});

// ── Push notifications (preparado para o futuro) ──
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "Controlaí", {
      body: data.body || "",
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      data: { url: data.url || "/dashboard.html" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || "/dashboard.html"),
  );
});
