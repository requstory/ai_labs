const CACHE_VERSION = 'fitsplit-v1';
const APP_SHELL = [
  './',
  './plan/',
  './plan/monday/',
  './plan/tuesday/',
  './plan/wednesday/',
  './plan/thursday/',
  './plan/friday/',
  './exercises/',
  './manifest.webmanifest',
  './favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const scopeUrl = new URL(self.registration.scope);
      const cache = await caches.open(CACHE_VERSION);
      const urls = APP_SHELL.map((path) => new URL(path, scopeUrl).toString());
      try {
        await cache.addAll(urls);
      } catch {
        // A missing shell URL shouldn't block installation of what we could cache.
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => undefined);

      if (cached) return cached;

      const response = await network;
      if (response) return response;

      if (request.mode === 'navigate') {
        const fallback = await cache.match(new URL('./', self.registration.scope).toString());
        if (fallback) return fallback;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })(),
  );
});
