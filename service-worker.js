// 간단 캐시 이름 (버전 바꿀 때마다 문자열만 바꿔주면 됨)
const CACHE_NAME = "coffee-notes-cache-v1";

// 처음 설치될 때 어떤 파일들을 캐시에 담을지
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
  // 아이콘 파일들도 나중에 여기 추가할 수 있어요. 예: "./icon-192.png", "./icon-512.png"
];

// service worker 설치 단계
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  // 대기하지 말고 바로 활성화 쪽으로 넘어가도록
  self.skipWaiting();
});

// service worker 활성화 단계
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      // 이전 버전 캐시는 지우고 최신 버전만 남기기
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

// fetch 가 일어날 때 (파일 요청할 때) 캐시 먼저 시도
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // 캐시에 있으면 그걸 반환하고, 없으면 실제 네트워크로 요청
      return response || fetch(event.request);
    })
  );
});
