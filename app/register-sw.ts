/**
 * =========================================
 * REGISTRO DEL SERVICE WORKER
 * =========================================
 * 
 * Este archivo se ejecuta en el navegador (client-side)
 * y registra el Service Worker que está en /public/sw.js
 * 
 * El Service Worker permite:
 * - Funcionamiento offline
 * - Caché de recursos
 * - Instalación como PWA
 */

'use client'; // Necesario en Next.js 13+ para código que usa APIs del navegador

// Verificar que el navegador soporta Service Workers
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // Registrar el Service Worker desde la carpeta public
  navigator.serviceWorker
    .register('/sw.js') // Ruta relativa a /public
    .then((registration) => {
      console.log('✅ Service Worker registrado correctamente:', registration);
    })
    .catch((err) => {
      console.error('❌ Error registrando Service Worker:', err);
    });
}
