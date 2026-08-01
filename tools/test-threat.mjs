// Prueba la flecha de amenaza del rival, ahora bajo demanda:
//  - por defecto NO aparece sola al empezar tu turno,
//  - el botón ⚠ Amenaza (y la tecla T) la dibuja, con la punta roja,
//  - el FEN de jugada nula es aceptado por el motor (sin errores de consola),
//  - con el ajuste "automática" encendido vuelve a salir sola.
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
const myTurn = () =>
  page.waitForFunction(() => window.__game.chess.turn() === window.__game.myColor && !window.__game.busy,
    null, { timeout: 30000 });
const arrows = () => page.evaluate(() => document.querySelectorAll('.threat-arrow').length);

// --- 1) Por defecto: manual, nada de flecha automática ---
await page.goto(URL);
await ready();
await page.evaluate(() => localStorage.setItem('entrenador-ajedrez-config', JSON.stringify({ threatAuto: false })));
await page.reload();
await ready();
await page.evaluate(() => window.__game.start('w', 2000));
await page.evaluate(() => window.__game.onMyMove('e2', 'e4'));
await myTurn();
await page.waitForTimeout(2500);
check((await arrows()) === 0, 'por defecto la flecha NO aparece sola al empezar mi turno');

// --- 2) El botón la dibuja ---
await page.click('#btnThreat');
await page.waitForFunction(() => document.querySelectorAll('.threat-arrow').length === 1, null, { timeout: 30000 });
check(true, 'el botón ⚠ Amenaza dibuja exactamente una flecha');

const marker = await page.evaluate(() => document.querySelector('.threat-arrow').getAttribute('marker-end'));
check(marker === 'url(#arrowhead-threat)', 'usa la punta de flecha de amenaza (' + marker + ')');

// El panel nombra la jugada amenazada: la flecha sola no dice qué gana el rival.
const label = await page.evaluate(() => document.querySelector('.lastclass-text').textContent);
check(/Amenaza del rival: \S+/.test(label), 'nombra la jugada amenazada: "' + label + '"');

// --- 3) La tecla T hace lo mismo ---
await page.evaluate(() => document.querySelectorAll('.threat-arrow').forEach((e) => e.remove()));
await page.keyboard.press('t');
await page.waitForFunction(() => document.querySelectorAll('.threat-arrow').length === 1, null, { timeout: 30000 });
check(true, 'la tecla T también dibuja la amenaza');

// --- 4) Con el ajuste automático encendido vuelve a salir sola ---
await page.evaluate(() => {
  document.getElementById('setThreat').checked = true;
  document.getElementById('setThreat').dispatchEvent(new Event('change'));
});
await page.evaluate(() => window.__game.onMyMove('g1', 'f3'));
await myTurn();
await page.waitForFunction(() => document.querySelectorAll('.threat-arrow').length === 1, null, { timeout: 30000 });
check(true, 'con "automática" encendida la flecha reaparece sola');

if (errors.length) { console.log('\nErrores en la página:'); for (const e of errors) console.log('   ! ' + e); }
console.log(`\nResultado: ${fail === 0 && errors.length === 0 ? 'TODO OK' : (fail + ' fallos, ' + errors.length + ' errores')}`);
await browser.close();
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
