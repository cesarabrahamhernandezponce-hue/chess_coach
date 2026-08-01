// Prueba el coach IA sin tocar la red:
//  - el prompt lleva los hechos del motor y la lista de jugadas legales,
//  - el render escapa el HTML que devuelva el modelo (no puede inyectar nada),
//  - la cadena de modelos baja al siguiente cuando uno da 404 (OpenRouter rota
//    sus modelos gratis) y refresca la lista cuando se le acaban,
//  - un 401 no reintenta: la clave mal puesta no se arregla cambiando de modelo.

// Shims mínimos: ai.js está escrito para el navegador.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.location = { origin: 'http://localhost:5050' };

const { Chess } = await import('/home/cesar/proyectos/chess/vendor/chess.mjs');
const coach = await import('/home/cesar/proyectos/chess/js/aiCoach.js');
const ai = await import('/home/cesar/proyectos/chess/js/ai.js');

let fail = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fail++; };

// ---------- aiCoach: prompt ----------
console.log('\nPrompt del coach');
const c = new Chess();
for (const m of ['e4', 'e5', 'Nf3', 'Qh4']) c.move(m);
const prompt = coach.buildReviewPrompt({
  myColor: 'w', opening: 'Apertura del peón de rey', phase: coach.phaseOf(c.fen()),
  material: coach.materialLine(c.fen(), 'w'), history: ['e4', 'e5', 'Nf3', 'Qh4'],
  myMoveSan: 'Nf3', categoryLabel: 'Mejor jugada', cpl: 0,
  evalBefore: 30, evalAfter: 28, bestSan: 'Nf3', bestLine: ['Nf3', 'Nc6'],
  legalSans: ['Nf3', 'd4', 'Nc3'], rivalMoveSan: 'Qh4', rivalPlan: ['Qh4', 'Nxh4'],
  threatSan: 'Qxe4+', myBestNow: ['Nxh4'], hanging: coach.hangingPieces(c.fen()),
  localWhy: 'Desarrollas tu caballo.',
});
check(prompt.includes('+0.30') && prompt.includes('+0.28'), 'incluye las evaluaciones del motor');
check(prompt.includes('JUGADAS LEGALES'), 'incluye la lista de jugadas legales (ata al modelo)');
check(prompt.includes('dama en h4'), 'detecta el material colgado con SEE');
check(coach.SYSTEM_PROMPT.includes('NO calculas ajedrez'), 'el system prompt prohíbe calcular');

console.log('\nDetección de material colgado');
check(coach.hangingPieces('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2').length === 0,
  'un cambio normal de peones no cuenta como material colgado');
check(coach.phaseOf('8/5k2/8/8/8/3K4/4P3/8 w - - 0 40') === 'final', 'reconoce el final');

// ---------- aiCoach: render seguro ----------
console.log('\nRender de la respuesta');
const html = coach.renderAiHtml('## Tu jugada\nSacas el **caballo**.\n\n## Riesgo\n- <img src=x onerror=alert(1)>');
check(html.includes('<h4 class="ai-h">Tu jugada</h4>'), 'convierte los ## en encabezados');
check(html.includes('<b>caballo</b>'), 'convierte **negrita**');
check(!html.includes('<img') && html.includes('&lt;img'), 'escapa el HTML que venga del modelo');

// ---------- ai: cadena de modelos ----------
console.log('\nCadena de modelos');
ai.loadAiConfig();
ai.setAiConfig({ apiKey: 'sk-or-test', model: 'auto', lastGood: null, freeModels: [], freeModelsAt: Date.now() });
check(ai.modelChain()[0] === ai.SEED_CHAIN[0], 'sin historial empieza por el primero de la semilla');
ai.setAiConfig({ lastGood: 'algun/modelo:free' });
check(ai.modelChain()[0] === 'algun/modelo:free', 'prioriza el último modelo que funcionó');
check(new Set(ai.modelChain()).size === ai.modelChain().length, 'no repite ids en la cadena');
ai.setAiConfig({ model: 'fijo/modelo:free' });
check(ai.modelChain().length === 1, 'un modelo fijado a mano desactiva la cadena');

// ---------- ai: fallback ante 404 ----------
console.log('\nFallback cuando OpenRouter retira un modelo');
ai.setAiConfig({ model: 'auto', lastGood: null });

const tried = [];
const okBody = { choices: [{ message: { content: 'listo' } }] };
// Los dos primeros modelos ya no existen (404); el tercero responde.
globalThis.fetch = async (url, opts) => {
  if (String(url).endsWith('/models')) return { ok: true, json: async () => ({ data: [] }) };
  const model = JSON.parse(opts.body).model;
  tried.push(model);
  if (tried.length <= 2) {
    return { ok: false, status: 404, json: async () => ({ error: { message: 'No endpoints found' } }) };
  }
  return { ok: true, json: async () => okBody };
};
const res = await ai.chat({ system: 's', user: 'u' });
check(tried.length === 3, `probó 3 modelos antes de acertar (${tried.length})`);
check(res.text === 'listo', 'devuelve el texto del modelo que sí respondió');
check(ai.getAiConfig().lastGood === tried[2], 'recuerda el modelo que funcionó');

console.log('\nRefresco de la lista cuando se agota la cadena');
let refreshed = false;
globalThis.fetch = async (url, opts) => {
  if (String(url).endsWith('/models')) {
    refreshed = true;
    return { ok: true, json: async () => ({ data: [{ id: 'nuevo/modelo:free', name: 'Nuevo', context_length: 1000 }] }) };
  }
  const model = JSON.parse(opts.body).model;
  if (model === 'nuevo/modelo:free') return { ok: true, json: async () => okBody };
  return { ok: false, status: 404, json: async () => ({ error: { message: 'gone' } }) };
};
ai.setAiConfig({ lastGood: null, freeModels: [], freeModelsAt: Date.now() });
const res2 = await ai.chat({ system: 's', user: 'u' });
check(refreshed, 'pidió a la API la lista de modelos gratis actual');
check(res2.model === 'nuevo/modelo:free', 'se recuperó con un modelo descubierto en vivo');

console.log('\nErrores que no se reintentan');
let calls = 0;
globalThis.fetch = async (url) => {
  if (String(url).endsWith('/models')) return { ok: true, json: async () => ({ data: [] }) };
  calls++;
  return { ok: false, status: 401, json: async () => ({ error: { message: 'No auth' } }) };
};
ai.setAiConfig({ lastGood: null, freeModelsAt: Date.now() });
let msg = '';
try { await ai.chat({ system: 's', user: 'u' }); } catch (e) { msg = e.message; }
check(calls === 1, 'un 401 corta al primer intento (no recorre la cadena)');
check(/inválida|permisos/.test(msg), 'el mensaje explica que la clave está mal: "' + msg + '"');

console.log(`\nResultado: ${fail === 0 ? 'TODO OK' : fail + ' fallos'}`);
process.exit(fail === 0 ? 0 : 1);
