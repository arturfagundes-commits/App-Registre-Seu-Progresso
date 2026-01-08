// sw.js — versão corrigida (evita index.html antigo ficar preso)
const CACHE_VERSION = "v3"; // <- MUDE isto quando publicar uma nova versão
const CACHE_NAME = `progresso-pwa-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./sw.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

// Helpers
const isNavigation = (request) => request.mode === "navigate";
const isHTML = (request) => {
  const url = new URL(request.url);
  return url.pathname.endsWith("/") || url.pathname.endsWith("/index.html") || request.destination === "document";
};

// Network-first para HTML (index.html / navegação)
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request, { cache: "no-store" });
    cache.put("./index.html", fresh.clone()); // garante que index.html no cache fica atualizado
    return fresh;
  } catch (e) {
    const cached = await cache.match("./index.html");
    return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

// Stale-while-revalidate para assets (rápido + atualiza)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((resp) => {
    if (resp && resp.ok) cache.put(request, resp.clone());
    return resp;
  }).catch(() => null);

  return cached || (await fetchPromise) || new Response("Offline", { status: 503 });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Só GET
  if (req.method !== "GET") return;

  // Para navegação/HTML: sempre tentar internet primeiro
  if (isNavigation(req) || isHTML(req)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Para o resto: cache com atualização em segundo plano
  event.respondWith(staleWhileRevalidate(req));
});
