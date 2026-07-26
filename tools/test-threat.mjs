// Prueba la flecha de amenaza del rival:
//  - tras la respuesta del rival aparece una .threat-arrow en tu turno,
//  - el FEN de jugada nula es aceptado por el motor (sin errores de consola),
//  - apagar el ajuste borra la flecha.
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

// Asegura el ajuste encendido y empieza como blancas.
await page.evaluate(() => window.__game && localStorage.setItem('entrenador-ajedrez-config', JSON.stringify({ showThreat: true })));
await page.evaluate(() => window.__game.start('w', 2000));
await page.evaluate(() => window.__game.onMyMove('e2', 'e4'));

// Espera a que el rival responda (vuelva a ser mi turno) y a que se dibuje la flecha.
await page.waitForFunction(() => window.__game.chess.turn() === window.__game.myColor && !window.__game.busy, null, { timeout: 30000 });
await page.waitForFunction(() => document.querySelectorAll('.threat-arrow').length === 1, null, { timeout: 30000 });
check(true, 'aparece exactamente una flecha de amenaza en mi turno');

const threat = await page.evaluate(() => {
  const l = document.querySelector('.threat-arrow');
  return { marker: l.getAttribute('marker-end'), stroke: getComputedStyle(l).stroke };
});
check(threat.marker === 'url(#arrowhead-threat)', 'usa la punta de flecha de amenaza (' + threat.marker + ')');

// Apagar el ajuste debe borrar la flecha.
await page.evaluate(() => { document.getElementById('setThreat').checked = false; document.getElementById('setThreat').dispatchEvent(new Event('change')); });
const afterOff = await page.evaluate(() => document.querySelectorAll('.threat-arrow').length);
check(afterOff === 0, 'apagar el ajuste borra la flecha');

// Jugar otra jugada con el ajuste apagado: no debe reaparecer.
await page.evaluate(() => window.__game.onMyMove('g1', 'f3'));
await page.waitForFunction(() => window.__game.chess.turn() === window.__game.myColor && !window.__game.busy, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const stillOff = await page.evaluate(() => document.querySelectorAll('.threat-arrow').length);
check(stillOff === 0, 'con el ajuste apagado no reaparece la flecha');

if (errors.length) { console.log('\nErrores en la página:'); for (const e of errors) console.log('   ! ' + e); }
console.log(`\nResultado: ${fail === 0 && errors.length === 0 ? 'TODO OK' : (fail + ' fallos, ' + errors.length + ' errores')}`);
await browser.close();
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
