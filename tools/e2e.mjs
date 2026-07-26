// Prueba end-to-end en Chromium headless:
//  - carga la página y comprueba que AMBOS motores UCI arrancan,
//  - pide al analista que evalúe una posición,
//  - juega varias jugadas y verifica la clasificación y el libro de aperturas.
import pw from '/home/cesar/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js';
const { chromium } = pw;

const URL = 'http://localhost:5050/';
const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
});

let fail = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fail++; };

console.log('Cargando la app…');
await page.goto(URL);

// Esperar a que ambos motores estén listos.
await page.waitForFunction(() => window.__game && window.__game.analyst && window.__game.rival, null, { timeout: 60000 });
await page.waitForFunction(() => {
  const s = document.getElementById('status').textContent;
  return s.includes('listos') || s.includes('restaurada') || !document.getElementById('newGameModal').classList.contains('hidden');
}, null, { timeout: 60000 });
check(true, 'la página cargó y los objetos de motor existen');

// El analista evalúa la posición inicial.
const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const analysis = await page.evaluate((fen) => window.__game.analyst.analyze({ fen, movetime: 1000 }), startFen);
console.log('  Analista en posición inicial ->', JSON.stringify(analysis).slice(0, 120));
check(!!analysis.bestmove, 'el analista devuelve una mejor jugada');
check(typeof analysis.scoreCp === 'number', 'el analista devuelve un score numérico');

// El motor rival también responde.
const rivalMove = await page.evaluate((fen) => window.__game.rival.analyze({ fen, movetime: 800 }), startFen);
check(!!rivalMove.bestmove, 'el motor rival devuelve una jugada (' + rivalMove.bestmove + ')');

// Empezar partida como blancas a 2000 Elo (salta el modal).
await page.evaluate(() => window.__game.start('w', 2000));
check(true, 'partida iniciada como blancas');

// Jugar 1.e4 -> debe reconocerse como jugada de LIBRO.
await page.evaluate(() => window.__game.onMyMove('e2', 'e4'));
let state = await page.evaluate(() => {
  const first = window.__game.root.children[0];
  return {
    cat: first?.category?.key,
    san: first?.move?.san,
    opening: document.getElementById('openingName').textContent,
    total: window.__game.current.ply,
  };
});
console.log('  Tras 1.e4 ->', JSON.stringify(state));
check(state.san === 'e4', 'mi jugada se registró como e4');
check(state.cat === 'book', '1.e4 se clasificó como jugada de libro');
check(state.opening && state.opening !== '—', 'se muestra el nombre de la apertura (' + state.opening + ')');
check(state.total >= 2, 'el rival respondió (hay ' + state.total + ' jugadas)');

// Jugar 2 jugadas más de desarrollo y comprobar que se clasifican.
await page.evaluate(() => window.__game.onMyMove('g1', 'f3'));
await page.evaluate(() => {
  // elige una jugada legal cualquiera del caballo/alfil para seguir
  const legal = window.__game.chess.moves({ verbose: true });
  const dev = legal.find((m) => ['b1', 'f1', 'd2', 'e2'].includes(m.from)) || legal[0];
  return window.__game.onMyMove(dev.from, dev.to);
});
const myMoves = await page.evaluate(() => window.__game.pathTo(window.__game.current)
  .filter((n) => n.isMine && n.category)
  .map((n) => ({ san: n.move.san, cat: n.category.key, cpl: Math.round(n.cpl) })));
console.log('  Mis jugadas clasificadas ->', JSON.stringify(myMoves));
check(myMoves.length >= 3, 'se clasificaron al menos 3 jugadas mías');
check(myMoves.every((m) => typeof m.cpl === 'number'), 'cada jugada tiene un cpl numérico');
check(myMoves.every((m) => !!m.cat), 'cada jugada tiene una categoría');

// Barra de evaluación actualizada.
const evalText = await page.evaluate(() => document.getElementById('evalText').textContent);
check(!!evalText, 'la barra de evaluación muestra un valor (' + evalText + ')');

// Captura de pantalla para inspección visual (sin el modal encima).
await page.evaluate(() => document.getElementById('newGameModal').classList.add('hidden'));
await page.screenshot({ path: 'tools/e2e-screenshot.png', fullPage: false });
console.log('  Captura guardada en tools/e2e-screenshot.png');

if (errors.length) {
  console.log('\nErrores capturados en la página:');
  for (const e of errors) console.log('   ! ' + e);
}

console.log(`\nResultado e2e: ${fail === 0 ? 'TODO OK' : fail + ' fallos'}`);
await browser.close();
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
