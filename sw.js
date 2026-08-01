// Service worker: app shell offline. Precachea el núcleo (incluido el motor
// WASM ~7 MB) para que la app funcione sin conexión tras la primera carga.
const CACHE = 'entrenador-ajedrez-v9';

// El HTML/CSS/JS se sirve **red primero**: son ficheros pequeños que cambian a
// menudo, y con la estrategia anterior (caché primero, sin revalidar) un arreglo
// no llegaba nunca al navegador salvo que se subiera a mano la versión de arriba
// —olvidarlo una vez dejaba la app congelada en la versión vieja—. El caché
// queda de respaldo para funcionar sin conexión. Lo pesado e inmutable (el WASM
// de 7 MB, las piezas SVG, los iconos) se sigue sirviendo desde el caché.
const isAppShell = (url) =>
  url.pathname === '/' || url.pathname.endsWith('/') ||
  /\.(html|css|m?js|webmanifest)$/.test(url.pathname);

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
  'js/ai.js',
  'js/aiCoach.js',
  'js/openings.js',
  'js/sounds.js',
  'js/settings.js',
  'js/library.js',
  'js/profile.js',
  'js/puzzles.js',
  'js/srs.js',
  'js/adaptive.js',
  'js/courses.js',
  'js/openingTrainer.js',
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

const save = (req, res) => {
  if (res && res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
};

// Solo GET del mismo origen; el resto (p. ej. la API del coach IA) pasa de largo.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isAppShell(url)) {
    // Red primero, caché como respaldo si no hay conexión.
    e.respondWith(
      fetch(req).then((res) => save(req, res))
        .catch(() => caches.match(req).then((cached) => cached || Response.error()))
    );
    return;
  }

  // Caché primero para lo pesado e inmutable.
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => save(req, res)))
  );
});
