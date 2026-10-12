/* N1 特訓引擎 — 離線快取
   策略：網路優先，失敗時回退快取。
   重新部署後一定拿得到新版（含新題庫），沒網路時仍打得開上次的版本。 */
const CACHE = "n1-v5";
const ASSETS = ["./", "./index.html", "./icon.png", "./data/index.json"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    /* 題庫檔清單寫在 data/index.json，一併預先快取 */
    try {
      const idx = await (await fetch("./data/index.json", { cache: "no-cache" })).json();
      await c.addAll(idx.files.map(f => "./data/" + f));
    } catch (err) {}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).pathname.startsWith("/.netlify/")) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit =>
        hit || (e.request.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});
