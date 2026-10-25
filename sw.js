/* ═══════════════════════════════════════════════════════════
   UBAD Academy — Service Worker (v3.1.0)
   Offline application shell + strict privacy-aware caching.
   Never caches authenticated API/storage requests or private data.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const VERSION = 'v3.1.0';
const CACHE   = 'ubad-academy-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './analytics-config.js',
  './firebase-auth.js',
  './manifest.json',
  './assets/icons/icon.svg',
  './assets/icons/icon-maskable.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/pdfjs/build/pdf.js',
  './assets/pdfjs/build/pdf.worker.js'
];

// Never cache dynamic auth, Firestore, Firebase Storage, or Worker endpoints
const NEVER_CACHE_PATTERNS = [
  /\/upload(\b|\/|\?)/i,
  /\/download(\b|\/|\?)/i,
  /\/delete(\b|\/|\?)/i,
  /\/public-asset(\b|\/|\?)/i,
  /firestore\.googleapis\.com/i,
  /identitytoolkit\.googleapis\.com/i,
  /securetoken\.googleapis\.com/i,
  /firebasestorage\.googleapis\.com/i,
  /backblazeb2\.com/i,
  /workers\.dev/i
];

function isCacheableStaticRequest(req, url) {
  if (req.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (req.headers.get('Authorization') || req.headers.get('Range')) return false;
  if (url.search && /token|auth|key|download|assetId|path=/i.test(url.search)) return false;
  for (const pat of NEVER_CACHE_PATTERNS) {
    if (pat.test(url.href)) return false;
  }
  return true;
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map((u) => cache.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Allow application logout flow to purge any non-shell cached entries immediately
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CLEAR_AUTH_CACHE') {
    e.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const keys = await cache.keys();
      const shellUrls = new Set(SHELL.map((u) => new URL(u, self.location.origin).href));
      await Promise.all(
        keys
          .filter((req) => !shellUrls.has(req.url))
          .map((req) => cache.delete(req))
      );
    })());
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (!isCacheableStaticRequest(req, url)) return;

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
        }
        return res;
      } catch (_) {
        const hit = await caches.match('./index.html');
        return hit || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      const cacheControl = (res && res.headers && res.headers.get('Cache-Control')) || '';
      if (
        res &&
        res.status === 200 &&
        res.type === 'basic' &&
        !/no-store|private/i.test(cacheControl)
      ) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (_) {
      return hit || Response.error();
    }
  })());
});
