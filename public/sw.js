const CACHE_NAME = 'weatherbot-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png'
];

// INSTALAR: cachear archivos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('🔧 Service Worker: Cacheando archivos estáticos');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// ACTIVAR: limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🧹 Service Worker: Limpiando cache antiguo', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// FETCH: Estrategia Network-First con fallback a caché
self.addEventListener('fetch', event => {
  // Solo cachear requests GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si es exitosa (status 200), guardar en caché
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si la red falla, intentar usar caché
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            // Fallback offline (opcional)
            return new Response('Offline - contenido no disponible', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});
