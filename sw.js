/**
 * Service Worker for 心念星辰 PWA v2
 * 相对路径缓存：兼容 GitHub Pages 项目子路径与本地 file/离线。
 */
const CACHE_NAME = 'xinnian-v7';
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-72x72.svg',
  './icons/icon-128x128.svg',
  './icons/icon-152x152.svg',
  './icons/icon-180x180.svg',
  './icons/icon-192x192.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.map(n => (n !== CACHE_NAME ? caches.delete(n) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  var url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: false }).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          var copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return resp;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return caches.match('./index.html');
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
