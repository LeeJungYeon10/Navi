const CACHE_NAME = "hello-naviya-pwa-v54";
const NAVI_TAIL_IDLE_FRAMES = Array.from(
  { length: 22 },
  (_, index) => `./assets/navi_tail_idle/navi-${String(index + 1).padStart(2, "0")}.png`,
);
const NAVI_REST_IDLE_FRAMES = Array.from(
  { length: 7 },
  (_, index) => `./assets/navi_rest_idle/navi_rest_idle_${index + 1}.png`,
);
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./supabase-client.js",
  "./supabase-config.js",
  "./manifest.webmanifest",
  "./assets/navi-face.png",
  "./assets/navi.png",
  "./assets/navi_rest.png",
  ...NAVI_TAIL_IDLE_FRAMES,
  ...NAVI_REST_IDLE_FRAMES,
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // OAuth 복귀(?code=)는 캐시/가로채기 없이 네트워크로 처리
  if (url.searchParams.has("code") || url.hash.includes("access_token")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
