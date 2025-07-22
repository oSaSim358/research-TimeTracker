// キャッシュ名
const CACHE = "tracker-cache-v1";
// インストール時に必須ファイルを保存
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      "./",           // ルート
      "./index.html",
      "./manifest.json",
      "./icon-192.png",
      "./icon-512.png",
      "./style.css",  // あれば
      "./main.js"     // あれば
    ]))
  );
});
// オフライン時はキャッシュを返す
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(r => r || fetch(event.request))
  );
});
