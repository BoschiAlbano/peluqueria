// Service worker mínimo: solo lo necesario para que Chrome/Android considere
// la app "instalable" y para que los assets estáticos carguen más rápido.
// No cachea datos de negocio (ventas, caja) — las páginas del dashboard
// siempre van a la red primero, así el cajero nunca ve datos viejos.
const CACHE_NAME = "el-maestro-v2";
const PRECACHE_URLS = ["/", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Navegación (cargar una página): red primero, con fallback a "/" si no hay conexión.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("/"))),
    );
    return;
  }

  // Nunca cachear la API (datos de negocio: ventas, caja, reportes, etc.).
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Ojo: cuando Next.js navega del lado del cliente (con <Link>) para traer
  // una página del dashboard actualizada, hace un fetch() a esa misma ruta
  // (ej. /ventas) — ese pedido NO es "navigate" para el navegador, así que
  // sin este chequeo caía en la rama de "cache primero" de más abajo y el
  // cajero podía ver el estado de la caja desactualizado (bug real: pasaba
  // solo con la PWA instalada, nunca en dev, porque el SW solo corre en
  // producción). Por eso acá solo se cachea lo que es realmente estático
  // (con hash de contenido, íconos, manifest) — nunca una página.
  const esAssetEstatico =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon") ||
    url.pathname.startsWith("/apple-icon") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico";

  if (!esAssetEstatico) {
    return;
  }

  // Assets estáticos (JS/CSS/imágenes): cache primero, para que abra rápido.
  if (request.method === "GET") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
  }
});
