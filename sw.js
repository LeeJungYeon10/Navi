const CACHE_NAME = "hello-naviya-pwa-v22";
const NAVI_FRAMES = Array.from(
  { length: 22 },
  (_, index) => `./assets/navi-frames/navi-${String(index + 1).padStart(2, "0")}.png`,
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
  "./assets/navi-lying-face-front.png",
  "./assets/navi-lying-face-aspect.png",
  ...NAVI_FRAMES,
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
