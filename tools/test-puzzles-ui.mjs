// Prueba el flujo de UI de "Puzzles de tus errores" en Chromium:
//  - siembra una partida con un error, abre el entrenador,
//  - una jugada floja NO resuelve, la mejor jugada SÍ,
//  - "Siguiente" con un solo puzzle sale del modo.
import pw from '/home/cesar/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js';
const { chromium } = pw;

const URL = 'http://localhost:5050/';
// Posición con la dama negra colgada en g4: la mejor jugada blanca es f3xg4.
const PUZ = 'rnb1kbnr/pppp1ppp/8/4p3/6q1/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 1';
const game = {
  id: 'test1', date: Date.now(), result: 'Test', myColor: 'w', rivalElo: 2000, plies: 1, accuracy: 50,
  tree: { m: null, fen: PUZ, mine: false, cat: null, kids: [
    { m: { san: 'a3', from: 'a2', to: 'a3', uci: 'a2a3', color: 'w' }, fen: 'x', mine: true, cat: 'blunder', cpl: 900, line: ['fxg4'], kids: [] },
  ] },
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

// Siembra la biblioteca y abre el entrenador de puzzles.
await page.evaluate((g) => localStorage.setItem('entrenador-ajedrez-biblioteca', JSON.stringify([g])), game);
await page.click('#btnPuzzles');
const intro = await page.textContent('#puzzleIntro');
check(/1\s+posición/.test(intro), 'el modal anuncia 1 posición para entrenar');
check(!(await page.getAttribute('#btnPzStart', 'disabled') != null), 'el botón Empezar está habilitado');

await page.click('#btnPzStart');
await page.waitForFunction(() => window.__game.puzzleMode === true, null, { timeout: 5000 });
check(await page.evaluate(() => window.__game.puzzle.fen) === PUZ, 'carga la posición del puzzle');
check(!(await page.locator('#puzzlePanel').getAttribute('class')).includes('hidden'), 'el panel de puzzle es visible');
check((await page.evaluate(() => document.body.classList.contains('puzzle-mode'))), 'el body entra en modo puzzle');

// Jugada floja: NO debe resolver.
await page.evaluate(() => window.__game.onPuzzleMove('a2', 'a3'));
await page.waitForFunction(() => window.__game.puzzleBusy === false, null, { timeout: 30000 });
check(await page.evaluate(() => window.__game.puzzleSolved) === false, 'una jugada floja no resuelve el puzzle');
check(await page.evaluate(() => window.__game.puzzleFails) >= 1, 'cuenta el intento fallido');

// Mejor jugada f3xg4: debe resolver.
await page.evaluate(() => window.__game.onPuzzleMove('f3', 'g4'));
await page.waitForFunction(() => window.__game.puzzleBusy === false && window.__game.puzzleSolved === true, null, { timeout: 30000 });
check(true, 'capturar la dama resuelve el puzzle');
check((await page.locator('.best-arrow').count()) === 1, 'dibuja la flecha de la jugada acertada');
const lc = await page.textContent('.lastclass-text');
check(/Bien|Correcto/.test(lc), 'muestra retroalimentación de acierto (' + lc.trim() + ')');

// Siguiente con un único puzzle sale del modo.
await page.click('#btnPzNext');
await page.waitForFunction(() => window.__game.puzzleMode === false, null, { timeout: 5000 });
check(true, 'Siguiente en el último puzzle sale del modo entrenamiento');
check((await page.locator('#puzzlePanel').getAttribute('class')).includes('hidden'), 'el panel se oculta al salir');

if (errors.length) { console.log('\nErrores en la página:'); for (const e of errors) console.log('   ! ' + e); }
console.log(`\nResultado: ${fail === 0 && errors.length === 0 ? 'TODO OK' : (fail + ' fallos, ' + errors.length + ' errores')}`);
await browser.close();
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
