// Cliente de OpenRouter para el coach con IA.
//
// Todo corre en el navegador: la clave se guarda en localStorage y solo sale de
// esta máquina hacia openrouter.ai. No la pongas en una versión publicada de la
// app: cualquiera que abra la página podría leerla desde la consola.
//
// OpenRouter rota sus modelos gratuitos con frecuencia —un id que hoy responde
// mañana devuelve 404—, así que este módulo no depende de un modelo fijo:
//   - baja por una cadena de modelos de reserva hasta que uno conteste,
//   - si todos fallan, pide a la API la lista real de modelos ":free" y reintenta,
//   - recuerda el último modelo que funcionó para empezar por él la próxima vez.

const KEY = 'entrenador-ajedrez-ia';
const API = 'https://openrouter.ai/api/v1';
const MODELS_TTL = 12 * 60 * 60 * 1000; // refresca la lista de modelos cada 12 h

// Semilla ordenada por capacidad de razonamiento y, sobre todo, por
// disponibilidad real medida: varios modelos "gratis" contestan 429 casi siempre
// y no sirven de nada en la cadena. El orden sigue el benchmark en vivo del
// 2026-07-22 (los Nemotron fueron los únicos consistentes; gemma-4-31b daba 429
// sistemático, así que va el último). refreshFreeModels() amplía esta lista.
export const SEED_CHAIN = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',   // el más grande: mejor para explicar planes
  'nvidia/nemotron-3-super-120b-a12b:free',   // fiable en la medición
  'nvidia/nemotron-3-nano-30b-a3b:free',      // fiable y el más rápido
  'openai/gpt-oss-20b:free',                  // responde siempre, pero lento
  'inclusionai/ling-3.0-flash:free',
  'google/gemma-4-26b-a4b-it:free',           // rápido, pero se rate-limita a menudo
  'google/gemma-4-31b-it:free',               // 429 sistemático en la medición
];

const DEFAULTS = {
  apiKey: '',
  model: 'auto',      // 'auto' = usa la cadena; o un id concreto fijado a mano
  lastGood: null,     // último modelo que respondió bien
  freeModels: [],     // [{ id, name }] descubiertos en la API
  freeModelsAt: 0,    // timestamp del último refresco
};

let cfg = { ...DEFAULTS };

export function loadAiConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) cfg = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (_) { /* usa defaults */ }
  return cfg;
}

export function getAiConfig() { return cfg; }

export function setAiConfig(patch) {
  cfg = { ...cfg, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) {}
  return cfg;
}

export function isConfigured() { return !!(cfg.apiKey && cfg.apiKey.trim()); }

// Orden en que se prueban los modelos: el fijado a mano manda; si no, el último
// que funcionó primero y detrás la cadena (semilla + lo descubierto en la API),
// sin repetir ids.
export function modelChain() {
  if (cfg.model && cfg.model !== 'auto') return [cfg.model];
  const discovered = (cfg.freeModels || []).map((m) => m.id);
  const all = [cfg.lastGood, ...SEED_CHAIN, ...discovered].filter(Boolean);
  return [...new Set(all)];
}

function headers() {
  return {
    'Authorization': `Bearer ${cfg.apiKey.trim()}`,
    'Content-Type': 'application/json',
    // OpenRouter usa estas dos para atribuir la app en su ranking. Son cabeceras
    // propias suyas (no la `Referer` del navegador, que fetch no deja tocar).
    'HTTP-Referer': location.origin,
    'X-Title': 'Entrenador de Ajedrez',
  };
}

// Pide a OpenRouter qué modelos gratuitos existen ahora mismo. Es un GET público
// (no necesita clave), así que sirve incluso antes de configurar nada.
export async function refreshFreeModels() {
  const res = await fetch(`${API}/models`);
  if (!res.ok) throw new Error(`No se pudo leer la lista de modelos (HTTP ${res.status})`);
  const json = await res.json();
  const free = (json.data || [])
    .filter((m) => typeof m.id === 'string' && m.id.endsWith(':free'))
    .map((m) => ({ id: m.id, name: m.name || m.id, context: m.context_length || 0 }))
    .sort((a, b) => b.context - a.context);
  setAiConfig({ freeModels: free, freeModelsAt: Date.now() });
  return free;
}

// Refresca la lista si está vacía o caducada, pero nunca rompe la llamada
// principal: si falla, seguimos con la cadena que ya teníamos.
async function maybeRefresh() {
  const stale = !cfg.freeModels.length || (Date.now() - cfg.freeModelsAt) > MODELS_TTL;
  if (!stale) return;
  try { await refreshFreeModels(); } catch (_) { /* seguimos con la semilla */ }
}

// Un id de modelo puede haber desaparecido (404) o estar saturado (429/502): en
// esos casos toca probar el siguiente. Un 401 es la clave mal puesta y no se
// arregla cambiando de modelo, así que ahí cortamos.
function isRetryable(status) {
  return status === 404 || status === 400 || status === 429 || status >= 500;
}

async function callModel(model, messages, signal) {
  const res = await fetch(`${API}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    signal,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,   // explicaciones consistentes, no creativas
      max_tokens: 900,
    }),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch (_) {}
    const err = new Error(detail || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  // OpenRouter puede devolver 200 con un error dentro del cuerpo.
  if (json.error) {
    const err = new Error(json.error.message || 'Error del proveedor');
    err.status = json.error.code || 502;
    throw err;
  }
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw Object.assign(new Error('Respuesta vacía del modelo'), { status: 502 });
  return text;
}

// Lanza la consulta bajando por la cadena de modelos. `onModel` se llama con el
// id que se está probando, para poder mostrarlo en la UI mientras espera.
export async function chat({ system, user, signal, onModel } = {}) {
  if (!isConfigured()) throw new Error('Falta la clave de OpenRouter (Ajustes → Coach IA).');

  await maybeRefresh();
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  let chain = modelChain();
  let lastErr = null;
  let refreshed = false;

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    if (onModel) onModel(model);
    try {
      const text = await callModel(model, messages, signal);
      setAiConfig({ lastGood: model });
      return { text, model };
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      lastErr = e;
      if (e.status === 401 || e.status === 403) {
        throw new Error('Clave de OpenRouter inválida o sin permisos.');
      }
      if (!isRetryable(e.status)) throw e;
      console.warn(`[ia] ${model} falló (${e.status}): ${e.message}. Probando el siguiente…`);

      // Si se acabó la cadena y aún no habíamos refrescado, pregunta a la API qué
      // modelos gratis existen ahora y sigue con los nuevos. Esto es lo que evita
      // quedarse tirado cuando OpenRouter retira los ids que teníamos cacheados.
      if (i === chain.length - 1 && !refreshed && (!cfg.model || cfg.model === 'auto')) {
        refreshed = true;
        try {
          await refreshFreeModels();
          const fresh = modelChain().filter((m) => !chain.includes(m));
          if (fresh.length) chain = chain.concat(fresh);
        } catch (_) { /* nos quedamos sin más opciones */ }
      }
    }
  }

  throw new Error(
    `Ningún modelo gratuito respondió. Último error: ${lastErr ? lastErr.message : 'desconocido'}. ` +
    'Prueba "Actualizar modelos gratis" en Ajustes.'
  );
}
