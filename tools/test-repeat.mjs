// Prueba el modo "Repetir hasta acertar":
//  - con el ajuste activo, una jugada floja se deshace y no deja responder al rival,
//  - una buena jugada sí avanza la partida.
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

await page.goto(URL);
await page.waitForFunction(() => window.__game && window.__game.analyst && window.__game.rival, null, { timeout: 60000 });

// Activa "Repetir hasta acertar".
await page.evaluate(() => { const c = document.getElementById('setRepeat'); c.checked = true; c.dispatchEvent(new Event('change')); });
check(await page.evaluate(() => window.__game.constructor && true), 'app lista');

// Empieza como blancas y juega 1.e4 (de libro), espera respuesta del rival.
await page.evaluate(() => window.__game.start('w', 2000));
await page.evaluate(() => window.__game.onMyMove('e2', 'e4'));
await page.waitForFunction(() => window.__game.chess.turn() === window.__game.myColor && !window.__game.busy && window.__game.current.ply >= 2, null, { timeout: 30000 });

const beforeSan = await page.evaluate(() => window.__game.current.move.san);
const beforePly = await page.evaluate(() => window.__game.current.ply);

// Juega Rey e2 (Bongcloud): una jugada floja fiable. Debe deshacerse.
await page.evaluate(() => window.__game.onMyMove('e1', 'e2'));
await page.waitForFunction(() => !window.__game.busy && window.__game.chess.turn() === window.__game.myColor, null, { timeout: 30000 });

const afterSan = await page.evaluate(() => window.__game.current.move.san);
const afterPly = await page.evaluate(() => window.__game.current.ply);
const hasKe2 = await page.evaluate(() => window.__game.current.children.some((c) => c.move && c.move.uci === 'e1e2'));
const guidance = await page.textContent('.lastclass-text');

check(afterSan === beforeSan, `tras la jugada floja vuelve a mi turno anterior (${afterSan})`);
check(afterPly === beforePly, 'la partida no avanza: el rival no responde');
check(!hasKe2, 'la jugada floja no se guarda en el árbol');
check(/intentarlo/i.test(guidance), 'la tarjeta invita a repetir (' + guidance.trim() + ')');
check(await page.evaluate(() => window.__game.chess.turn() === window.__game.myColor), 'sigue siendo mi turno');

// Ahora juega la MEJOR jugada: debe aceptarse y el rival responder.
const best = await page.evaluate(async () => {
  const f = window.__game.chess.fen();
  const r = await window.__game.analyst.analyze({ fen: f, movetime: 1000 });
  return r.bestmove;
});
await page.evaluate((bm) => window.__game.onMyMove(bm.slice(0, 2), bm.slice(2, 4), bm.slice(4) || undefined), best);
await page.waitForFunction(() => !window.__game.busy && window.__game.chess.turn() === window.__game.myColor, null, { timeout: 30000 });
const advanced = await page.evaluate((bp) => window.__game.current.ply > bp, beforePly);
check(advanced, 'una buena jugada sí avanza y el rival responde');

if (errors.length) { console.log('\nErrores en la página:'); for (const e of errors) console.log('   ! ' + e); }
console.log(`\nResultado: ${fail === 0 && errors.length === 0 ? 'TODO OK' : (fail + ' fallos, ' + errors.length + ' errores')}`);
await browser.close();
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
