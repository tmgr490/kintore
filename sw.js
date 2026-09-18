// Service Worker。
//
// 方針: ネットワーク優先（network-first）。
// push した内容がリロードで必ず反映されるよう、常にサーバーへ問い合わせる。
// キャッシュは「オフライン／通信失敗時の保険」としてだけ使う。
// さらに cache:'no-store' を指定して、ブラウザのHTTPキャッシュに古い JS/CSS が
// 居座るのも防ぐ。

const CACHE = 'kintore-v1';
const PRECACHE = [
  './',
  './index.html',
  './css/app.css',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE).catch(err => console.warn('プリキャッシュ失敗', err)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    // no-store でHTTPキャッシュを迂回し、常に最新を取りに行く
    const fresh = await fetch(req, { cache: 'no-store' });
    if (fresh && fresh.ok && fresh.type === 'basic') {
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // ページ遷移ならアプリシェルを返してオフラインでも起動できるようにする
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html') || await cache.match('./');
      if (shell) return shell;
    }
    throw err;
  }
}
