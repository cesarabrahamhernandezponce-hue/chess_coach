// Prueba el flujo de UI del "Perfil de debilidades por fase" en Chromium:
//  - siembra una partida con jugadas en apertura y final,
//  - abre el modal de perfil y verifica el resumen y las tarjetas de fase.
import pw from '/home/cesar/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js';
const { chromium } = pw;

const URL = 'http://localhost:5050/';
const OPEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
const END = '8/5k2/8/8/8/8/5K2/8 w - - 0 40';

function n(mine, cat, acc, cpl, fen, kid) {
  return { m: mine ? { san: 'x' } : null, fen, mine, cat, acc, cpl, kids: kid ? [kid] : [] };
}
const p8 = n(true, 'excellent', 90, 20, END);
const p7 = n(true, 'mistake', 30, 200, END, p8);
const p6 = n(false, 'best', 100, 0, END, p7);
const p5 = n(true, 'blunder', 10, 400, END, p6);
const p4 = n(false, 'good', 80, 40, OPEN, p5);
const p3 = n(true, 'good', 80, 40, OPEN, p4);
const p2 = n(false, 'best', 100, 0, OPEN, p3);
const p1 = n(true, 'best', 95, 0, OPEN, p2);
const game = {
  id: 'test1', date: Date.now(), result: 'Test', myColor: 'w', rivalElo: 2000, plies: 8, accuracy: 60,
  tree: { m: null, fen: OPEN, mine: false, cat: null, kids: [p1] },
};

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });

let fail = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fail++; };

await page.goto(URL);
await page.waitForFunction(() => window.__game && window.__game.analyst && window.__game.rival, null, { timeout: 60000 });

await page.evaluate((g) => localStorage.setItem('entrenador-ajedrez-biblioteca', JSON.stringify([g])), game);
await page.click('#btnProfile');
check(!(await page.locator('#profileModal').getAttribute('class')).includes('hidden'), 'el modal de perfil se abre');

const summary = await page.textContent('.prof-summary');
check(/1 partida/.test(summary), 'el resumen cuenta 1 partida');
check(/5.*jugadas/.test(summary), 'el resumen cuenta 5 jugadas mías');
check(/final/.test(summary), 'el resumen nombra el final como fase más floja');

const phases = await page.locator('.prof-phase').count();
check(phases === 3, 'muestra las 3 fases (' + phases + ')');
check((await page.locator('.prof-weak').count()) === 1, 'marca la fase más floja');

const accTexts = await page.locator('.prof-acc').allTextContents();
check(accTexts.includes('88%') || accTexts.includes('87%'), 'apertura muestra ~88% (' + accTexts.join(',') + ')');
check(accTexts.includes('43%'), 'final muestra 43%');

const segs = await page.locator('.prof-bar .prof-seg').count();
check(segs >= 4, 'dibuja segmentos de barra por categoría (' + segs + ')');

// Cierra con Escape.
await page.keyboard.press('Escape');
check((await page.locator('#profileModal').getAttribute('class')).includes('hidden'), 'Escape cierra el modal');

if (errors.length) { console.log('\nErrores en la página:'); for (const e of errors) console.log('   ! ' + e); }
console.log(`\nResultado: ${fail === 0 && errors.length === 0 ? 'TODO OK' : (fail + ' fallos, ' + errors.length + ' errores')}`);
await browser.close();
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
