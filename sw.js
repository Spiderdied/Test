/* ═══════════════════════════════════════════════════════════
   UBAD ACADEMY HUB — service worker
   offline shell + runtime caching. Optional assets (audio)
   are cached on first successful fetch — missing files never
   break anything.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const VERSION = 'v1.15.2';                 /* bumped — Google Forms/Summaries, custom Focus/Break
                                              durations, new local click/alarm sounds, nav-flicker fix, PDF.js 3.11 classic build/content tabs, Blogger section, GA4 analytics */
const CACHE   = 'ubad-hub-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './analytics-config.js',
  './manifest.json',
  './assets/icons/icon.svg',
  './assets/icons/icon-maskable.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/sounds/Click_1.mp3',
  './assets/sounds/Alarm.mp3',
  './assets/pdfjs/build/pdf.js',
  './assets/pdfjs/build/pdf.worker.js'
];

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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== location.origin) return; /* never touch cross-origin */

  /* navigations: network-first → offline falls back to cached shell */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        const hit = await caches.match('./index.html');
        return hit || Response.error();
      }
    })());
    return;
  }

  /* static assets (js, css, icons, audio, …): cache-first + runtime cache */
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      /* 200 only — never attempt to cache 206 partial audio ranges */
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      return hit || Response.error();
    }
  })());
});
