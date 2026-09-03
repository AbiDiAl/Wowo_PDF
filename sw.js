// sw.js - Cache offline untuk Wowo_PDF
const CACHE_NAME = 'wowo-pdf-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/custom.css',
  './assets/icons/madness.gif',
  './js/ui.js',
  './js/db-helper.js',
  './js/modules/pdf-merger.js',
  './js/modules/pdf-watermark.js',
  './js/modules/pdf-esign.js',
  './js/app.js',
  // Resource CDN Eksternal
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
];

// Install Service Worker & Simpan Aset ke Cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Hapus cache lama jika ada update
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

// Fetch Strategy: Cache-First dengan Fallback ke Network
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).catch(() => {
        // Abaikan jika request gagal saat offline
      });
    })
  );
});