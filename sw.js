// Service worker: app shell offline. Precachea el núcleo (incluido el motor
// WASM ~7 MB) para que la app funcione sin conexión tras la primera carga.
const CACHE = 'entrenador-ajedrez-v6';

const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'css/style.css',
  'js/main.js',
  'js/board.js',
  'js/engine.js',
  'js/classifier.js',
  'js/coach.js',
  'js/openings.js',
  'js/sounds.js',
  'js/settings.js',
  'js/library.js',
  'vendor/chess.mjs',
  'vendor/stockfish-18-lite-single.js',
  'vendor/stockfish-18-lite-single.wasm',
  'vendor/pieces/cburnett/wK.svg',
  'vendor/pieces/cburnett/wQ.svg',
  'vendor/pieces/cburnett/wR.svg',
  'vendor/pieces/cburnett/wB.svg',
  'vendor/pieces/cburnett/wN.svg',
  'vendor/pieces/cburnett/wP.svg',
  'vendor/pieces/cburnett/bK.svg',
  'vendor/pieces/cburnett/bQ.svg',
  'vendor/pieces/cburnett/bR.svg',
  'vendor/pieces/cburnett/bB.svg',
  'vendor/pieces/cburnett/bN.svg',
  'vendor/pieces/cburnett/bP.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first para GET del mismo origen; añade al caché lo nuevo que se pida.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
