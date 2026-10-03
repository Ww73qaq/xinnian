/**
 * Service Worker for 心念星辰 PWA
 * 功能：缓存静态资源，实现离线访问
 * 
 * 使用说明：
 * 1. 首次联网访问 GitHub Pages 时，Service Worker will 预缓存关键资源
 * 2. 断网后，浏览器将使用缓存的资源加载页面
 * 3. 更新时，Service Worker 将在后台静默更新资源
 */

const CACHE_NAME = 'xinnian-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/sw.js'
];

// 安装 Service Worker - 预缓存资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: 缓存预热完成');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        // 安装成功后立即激活
        return self.skipWaiting();
      })
  );
});

// 激活 Service Worker - 清理旧缓存，控制页面
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            // 删除旧缓存
            console.log('Service Worker: 删除旧缓存', cache);
            return caches.delete(cache);
          }
        })
      );
    })
    // 立即接管所有控制页面
    .then(() => {
      return self.clients.claim();
    })
  );
});

// 拦截请求 - 缓存优先策略
self.addEventListener('fetch', event => {
  // 只缓存 GET 请求且是同源的
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  
  // 只缓存本项目的资源，排除第三方 API
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 如果有缓存，返回缓存版本
        if (cachedResponse) {
          return cachedResponse;
        }

        // 否则发起网络请求，并缓存结果
        return fetch(event.request).then(networkResponse => {
          // 有效的响应才缓存
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          return networkResponse.clone();
        });
      })
      .catch(() => {
        // 完全离线且无缓存时的兜底方案
        if (event.request.mode === 'navigate' || 
            (event.request.method === 'GET' && 
             event.request.headers.get('accept').includes('text/html'))) {
          // 返回离线首页
          return caches.match('/index.html');
        }
      })
  );
});

// 消息监听 - 与主线程通信
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});