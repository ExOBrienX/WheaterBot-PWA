/**
 * =========================================
 * SERVICE WORKER - WEATHERBOT PWA
 * =========================================
 * 
 * Este archivo es fundamental para hacer la PWA funcionar offline.
 * Intercepta todas las peticiones y utiliza una estrategia de caché.
 * 
 * Estrategia: Network-First + Fallback a Caché
 * - Intenta conectarse a internet primero
 * - Si falla, usa datos en caché
 * - Si no hay caché, devuelve error offline
 */

// Nombre único del caché (cambiar para forzar actualización)
const CACHE_NAME = 'weatherbot-v1';

// Archivos estáticos que se cachean en la instalación
const urlsToCache = [
  '/',                          // Página principal
  '/manifest.json',             // Manifest PWA
  '/icon-192.png',              // Icono pequeño
  '/icon-512.png',              // Icono grande
  '/icon-maskable.png'          // Icono adaptativo
];

// =========================================
// EVENTO: INSTALL (Primera vez que se instala el SW)
// =========================================
self.addEventListener('install', event => {
  // Esperar a que se complete el caché de archivos estáticos
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('🔧 Service Worker: Cacheando archivos estáticos');
      return cache.addAll(urlsToCache);
    })
  );
  // Activar inmediatamente sin esperar otras pestañas
  self.skipWaiting();
});

// =========================================
// EVENTO: ACTIVATE (Cuando se activa el SW)
// =========================================
self.addEventListener('activate', event => {
  event.waitUntil(
    // Obtener todos los cachés existentes
    caches.keys().then(cacheNames => {
      return Promise.all(
        // Eliminar cachés viejos (versiones anteriores)
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🧹 Service Worker: Limpiando cache antiguo', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Tomar control de todas las pestañas abiertas
  self.clients.claim();
});

// =========================================
// EVENTO: FETCH (Cuando se realiza una petición)
// =========================================
self.addEventListener('fetch', event => {
  // Solo cachear peticiones GET (no POST, DELETE, etc)
  if (event.request.method !== 'GET') return;

  // Estrategia: Network-First
  event.respondWith(
    // 1. Intentar obtener de internet
    fetch(event.request)
      .then(response => {
        // 2. Si la respuesta es exitosa (status 200)
        if (response.status === 200) {
          // Guardar en caché para uso futuro
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        // Devolver la respuesta del servidor
        return response;
      })
      .catch(() => {
        // 3. Si la red falla (sin conexión)
        return caches.match(event.request)
          .then(response => {
            // Si hay algo en caché, devolverlo
            if (response) {
              return response;
            }
            // Si no hay caché, devolver error offline
            return new Response('Offline - contenido no disponible', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});
