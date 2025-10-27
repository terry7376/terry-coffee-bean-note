const CACHE_NAME = "coffee-notes-cache-v1";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// 설치 단계: 캐시 미리 담기
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 활성화 단계: 오래된 캐시 정리
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 요청 가로채서 캐시 우선 응답
self.addEventListener("fetch", (event) => {
  // mailto:, blob:, data: 등은 캐시 불필요
  if (
    event.request.url.startsWith("mailto:") ||
    event.request.url.startsWith("blob:") ||
    event.request.url.startsWith("data:")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // 캐시에 있으면 그걸 주고, 없으면 네트워크에서 가져오기
      return response || fetch(event.request);
    })
  );
});
