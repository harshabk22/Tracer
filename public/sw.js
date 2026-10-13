const CACHE_NAME = 'tracer-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[Tracer SW] Pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Do not intercept non-GET or cross-origin external API calls (e.g. Gemini API)
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // If external origin or chrome-extension, skip service worker
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests: Network-first, fallback to /index.html cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cachedNav = await caches.match(request);
          if (cachedNav) return cachedNav;
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
          return new Response('Tracer Offline Mode — Network unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })
    );
    return;
  }

  // Static Assets (JS, CSS, SVG, Web Fonts): Cache-first with stale-while-revalidate update
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || fetchPromise.then((res) => res || new Response('', { status: 404 }));
    })
  );
});

// Background Sync: handle offline mutation sync when connectivity resumes
self.addEventListener('sync', (event) => {
  if (event.tag === 'tracer-sync-mutations') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'SW_BACKGROUND_SYNC_TRIGGERED' });
        }
      })
    );
  }
});

// Message listener for health & ready checks
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_OFFLINE_READY') {
    event.ports[0]?.postMessage({ ready: true, cache: CACHE_NAME });
  }
});
