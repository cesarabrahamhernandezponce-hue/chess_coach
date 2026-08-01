// Prueba el flujo de UI del coach IA sin llamar de verdad a OpenRouter:
// se sustituye window.fetch por un doble que captura la petición y devuelve una
// respuesta fija. Así se valida que main.js reúne bien los datos del motor.
import pw from '/home/cesar/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js';
const { chromium } = pw;

const URL = 'http://localhost:5050/';
const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });

let fail = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fail++; };

const ready = () =>
  page.waitForFunction(() => window.__game && window.__game.analyst && window.__game.rival, null, { timeout: 60000 });
// Ojo: al cargar, `game` ya existe en la raíz con las blancas por mover, así que
// esperar solo por el turno se cumple antes de tiempo. Exige también una jugada.
const myTurn = () =>
  page.waitForFunction(
    () => window.__game.started && window.__game.current.ply > 0 &&
      window.__game.chess.turn() === window.__game.myColor && !window.__game.busy,
    null, { timeout: 30000 });

await page.goto(URL);
await ready();

// --- 1) Sin clave configurada: avisa en vez de fallar ---
await page.evaluate(() => localStorage.removeItem('entrenador-ajedrez-ia'));
await page.reload();
await ready();
await page.evaluate(() => window.__game.start('w', 2000));
await page.evaluate(() => window.__game.onMyMove('e2', 'e4'));
await myTurn();

await page.click('#btnAi');
await page.waitForSelector('#aiCard:not(.hidden)', { timeout: 10000 });
const noKey = await page.evaluate(() => document.getElementById('aiBody').textContent);
check(/clave de OpenRouter/i.test(noKey), 'sin clave, explica cómo configurarla');

// --- 2) Con clave y red simulada: análisis completo ---
await page.evaluate(() => {
  localStorage.setItem('entrenador-ajedrez-ia', JSON.stringify({
    apiKey: 'sk-or-test', model: 'auto', lastGood: null,
    freeModels: [], freeModelsAt: Date.now(),
  }));
});
// Recarga para que la app lea la clave recién guardada, y empieza otra partida.
await page.reload();
await ready();
await page.evaluate(() => window.__game.start('w', 2000));
await page.evaluate(() => window.__game.onMyMove('e2', 'e4'));
await myTurn();

// Doble de fetch: guarda el cuerpo enviado y responde con un análisis de mentira.
await page.evaluate(() => {
  window.__sent = null;
  window.fetch = async (url, opts) => {
    if (String(url).endsWith('/models')) {
      return { ok: true, json: async () => ({ data: [] }) };
    }
    window.__sent = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content:
          '## Tu jugada\nAdelantas el peón de **rey** dos casillas.\n\n' +
          '## Por qué es buena\nOcupa el centro.\n\n' +
          '## Para recordar\nEl centro primero. <b>no-html</b>' } }],
      }),
    };
  };
});

await page.click('#btnAi');
await page.waitForFunction(() => {
  const b = document.getElementById('aiBody');
  return b && b.querySelector('.ai-h');
}, null, { timeout: 60000 });

const sent = await page.evaluate(() => window.__sent);
check(!!sent, 'se envió una petición a OpenRouter');
const user = sent ? sent.messages.find((m) => m.role === 'user').content : '';
const system = sent ? sent.messages.find((m) => m.role === 'system').content : '';

check(/TU JUGADA: e4/.test(user), 'el prompt nombra tu jugada real (e4)');
check(/EVALUACIÓN ANTES/.test(user) && /EVALUACIÓN DESPUÉS/.test(user), 'incluye las dos evaluaciones del motor');
check(/MEJOR JUGADA SEGÚN EL MOTOR/.test(user), 'incluye la mejor jugada del motor');
check(/RESPUESTA REAL DEL RIVAL: \S+/.test(user), 'incluye la respuesta real del rival');
check(/AMENAZA PRINCIPAL DEL RIVAL AHORA/.test(user), 'incluye la amenaza actual del rival');
check(/JUGADAS LEGALES QUE TENÍAS/.test(user), 'incluye las jugadas legales (evita variantes inventadas)');
check(/NO calculas ajedrez/.test(system), 'el system prompt prohíbe al modelo calcular');
check(sent && sent.model.endsWith(':free'), 'usa un modelo gratuito (' + (sent ? sent.model : '—') + ')');

const rendered = await page.evaluate(() => document.getElementById('aiBody').innerHTML);
check(rendered.includes('<h4 class="ai-h">'), 'renderiza los encabezados del análisis');
check(rendered.includes('<b>rey</b>'), 'renderiza la negrita del modelo');
check(rendered.includes('&lt;b&gt;no-html&lt;/b&gt;'), 'escapa el HTML crudo que venga del modelo');

const modelLabel = await page.evaluate(() => document.getElementById('aiModel').textContent);
check(/^Modelo: \S+/.test(modelLabel), 'muestra qué modelo respondió: "' + modelLabel + '"');

// --- 3) Se puede cerrar la tarjeta ---
await page.click('#aiClose');
const closed = await page.evaluate(() => document.getElementById('aiCard').classList.contains('hidden'));
check(closed, 'el botón ✕ cierra la tarjeta del análisis');

if (errors.length) { console.log('\nErrores en la página:'); for (const e of errors) console.log('   ! ' + e); }
console.log(`\nResultado: ${fail === 0 && errors.length === 0 ? 'TODO OK' : (fail + ' fallos, ' + errors.length + ' errores')}`);
await browser.close();
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
