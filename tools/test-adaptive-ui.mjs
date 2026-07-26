// Prueba de UI del Elo adaptativo en Chromium:
//  - el modal de nueva partida presetea el slider a tu nivel estimado y lo anuncia,
//  - al rendirte tras jugar, tu nivel baja y el resumen muestra el cambio.
import pw from '/home/cesar/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js';
const { chromium } = pw;

const URL = 'http://localhost:5050/';
const ELO_KEY = 'entrenador-ajedrez-elo';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });

// Siembra el nivel estimado ANTES de cargar la app (1620 cae en la rejilla del slider).
await page.addInitScript((k) => localStorage.setItem(k, '1620'), ELO_KEY);

let fail = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fail++; };

await page.goto(URL);
await page.waitForFunction(() => window.__game && window.__game.analyst && window.__game.rival, null, { timeout: 60000 });

// El modal de nueva partida aparece al arrancar (sin partida restaurada).
await page.waitForSelector('#newGameModal:not(.hidden)', { timeout: 10000 });
check(true, 'el modal de nueva partida está abierto');
check(await page.inputValue('#eloRange') === '1620', 'el slider se presetea a tu nivel estimado (1620)');
const hint = await page.textContent('#eloHint');
check(/1620/.test(hint) && /[Aa]daptativo/.test(hint), 'el modal anuncia el modo adaptativo y tu estimación');
check(await page.textContent('#eloValue') === '1620', 'el valor mostrado coincide con el slider');

// Comienza como blancas al Elo preseteado, juega una jugada y ríndete.
await page.click('#btnStart');
await page.waitForFunction(() => window.__game.started === true, null, { timeout: 10000 });
await page.evaluate(async () => { await window.__game.onMyMove('e2', 'e4'); });
await page.evaluate(() => window.__game.resign());
await page.waitForFunction(() => window.__game.gameOver === true, null, { timeout: 10000 });

const newElo = await page.evaluate((k) => parseInt(localStorage.getItem(k), 10), ELO_KEY);
check(newElo === 1600, 'perder baja tu nivel 1620 → 1600 (' + newElo + ')');
const sumElo = await page.textContent('.summary-elo');
check(/1620/.test(sumElo) && /1600/.test(sumElo), 'el resumen muestra el cambio de nivel (' + (sumElo || '').trim() + ')');

// Al abrir de nuevo el modal, el slider (paso 20) ya sugiere 1600 exacto.
await page.click('#btnNew');
await page.waitForSelector('#newGameModal:not(.hidden)', { timeout: 10000 });
check(await page.inputValue('#eloRange') === '1600', 'el siguiente modal ya sugiere 1600 exacto (paso 20)');
check(/1600/.test(await page.textContent('#eloHint')), 'el hint anuncia tu nivel 1600');

if (errors.length) { console.log('\nErrores en la página:'); for (const e of errors) console.log('   ! ' + e); }
console.log(`\nResultado: ${fail === 0 && errors.length === 0 ? 'TODO OK' : (fail + ' fallos, ' + errors.length + ' errores')}`);
await browser.close();
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
