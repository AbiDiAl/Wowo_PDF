// sw.js - Cache offline untuk Wowo_PDF
const CACHE_NAME = 'wowo-pdf-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/custom.css',
  './assets/icons/madness.gif',
  './assets/videos/rain.mp4',
  './js/ui.js',
  './js/db-helper.js',
  './js/modules/auth.js',
  './js/modules/pdf-merger.js',
  './js/modules/pdf-watermark.js',
  './js/modules/pdf-esign.js',
  './js/app.js',
  // Resource CDN Eksternal
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).catch(() => {
        // Fallback jika offline
      });
    })
  );
});
