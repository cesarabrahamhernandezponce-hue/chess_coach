// Prueba end-to-end del árbol de variantes:
//  - juega una jugada, retrocede y juega otra distinta => se crea una variante,
//  - comprueba que la lista muestra la variante,
//  - promueve la variante a línea principal,
//  - borra desde un nodo,
//  - recarga y verifica que el árbol persiste.
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
const myTurn = () => page.waitForFunction(() => !window.__game.busy && window.__game.chess.turn() === window.__game.myColor, null, { timeout: 60000 });

await page.goto(URL);
await page.waitForFunction(() => window.__game && window.__game.analyst && window.__game.rival, null, { timeout: 60000 });

// Partida limpia como blancas contra Elo mínimo.
await page.evaluate(() => window.__game.start('w', 1320));
await myTurn();

// 1) Juego 1.e4 y espero la respuesta del rival.
await page.evaluate(() => window.__game.onMyMove('e2', 'e4'));
await myTurn();
check(await page.evaluate(() => window.__game.root.children.length === 1), '1.e4 crea la línea principal');

// 2) Vuelvo a la posición inicial y juego 1.d4 => debe ramificar.
await page.evaluate(() => window.__game.goTo(window.__game.root));
await page.evaluate(() => window.__game.onMyMove('d2', 'd4'));
await myTurn();
check(await page.evaluate(() => window.__game.root.children.length === 2), '1.d4 crea una segunda rama (variante)');
check(await page.evaluate(() => window.__game.root.children[0].move.uci.startsWith('e2e4')), 'la principal sigue siendo 1.e4');
check(await page.evaluate(() => document.querySelectorAll('#moveList .mv-variation').length >= 1), 'la lista muestra la variante');

// La posición actual está en la línea de 1.d4 (una variante).
check(await page.evaluate(() => !window.__game.isOnMainline(window.__game.current)), 'estoy en una variante');

// 3) Promuevo la variante 1.d4 a línea principal.
await page.evaluate(() => window.__game.promote());
check(await page.evaluate(() => window.__game.root.children[0].move.uci.startsWith('d2d4')), 'tras promover, 1.d4 es la principal');
check(await page.evaluate(() => window.__game.isOnMainline(window.__game.current)), 'ahora estoy en la línea principal');

// 4) Guardo el estado esperado y borro la variante que quedó (1.e4).
const before = await page.evaluate(() => window.__game.root.children.length);
await page.evaluate(() => { const e4 = window.__game.root.children.find((c) => c.move.uci.startsWith('e2e4')); window.__game.goTo(e4); });
await page.evaluate(() => window.__game.deleteFromHere());
check(await page.evaluate(([b]) => window.__game.root.children.length === b - 1, [before]), 'borrar variante reduce las ramas');
check(await page.evaluate(() => window.__game.current === window.__game.root), 'tras borrar, el foco vuelve al padre');

// 5) Persistencia: recargar y comprobar que el árbol sobrevive.
const mainUci = await page.evaluate(() => window.__game.root.children[0].move.uci);
await page.reload();
await page.waitForFunction(() => window.__game && window.__game.started && window.__game.root, null, { timeout: 60000 });
check(await page.evaluate(([u]) => window.__game.root.children.length >= 1 && window.__game.root.children[0].move.uci === u, [mainUci]), 'el árbol persiste tras recargar');

check(errors.length === 0, 'sin errores de consola/página' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

await browser.close();
console.log(fail === 0 ? '\nTODO OK ✅' : `\n${fail} fallo(s) ❌`);
process.exit(fail === 0 ? 0 : 1);
