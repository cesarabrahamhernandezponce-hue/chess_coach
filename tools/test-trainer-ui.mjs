// Prueba de UI de "Enseñar aperturas" (Playwright).
// Requiere el servidor estático en :5050  ->  python3 -m http.server 5050
//
// Comprueba: el temario se abre y lista los cursos, una lección arranca con el
// rival jugando solo, se puede jugar la jugada correcta arrastrando piezas, un
// error típico muestra su explicación y devuelve el turno, las variantes del
// rival saltan de lección, y al terminar se guarda el progreso.
// Playwright: si no está instalado en el proyecto, se usa el de la caché de npx
// (la misma ruta que usan los demás tests de navegador).
const pw = await import('playwright').catch(() =>
  import('/home/cesar/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'));
const { chromium } = pw.default || pw;

const URL = process.env.URL || 'http://localhost:5050/';
let ok = 0;
let fail = 0;

function check(cond, msg) {
  if (cond) { ok++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ ' + msg); }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', (e) => { fail++; console.error('  ✗ error de página: ' + e.message); });

await page.goto(URL);
await page.waitForSelector('#board .cell');

// El entrenador no necesita el motor: debe estar disponible enseguida.
await page.waitForFunction(() => !!window.__trainer, null, { timeout: 15000 });
check(true, 'el entrenador está listo sin esperar al motor');

// Empieza limpio (el progreso se guarda en localStorage).
await page.evaluate(() => {
  localStorage.removeItem('entrenador-ajedrez-aperturas');
  localStorage.removeItem('entrenador-ajedrez-partida');
});
await page.reload();
await page.waitForSelector('#board .cell');
await page.waitForFunction(() => !!window.__trainer);

// Espera a que los motores acaben de cargar: así el modal de inicio ya está en
// su sitio y no puede aparecer en medio de la lección tapando el tablero.
await page.waitForFunction(
  () => window.__game.enginesReady || document.getElementById('status').textContent.includes('No se pudo'),
  null, { timeout: 90000 });

// Desde el modal de inicio se puede llegar a las lecciones (es lo primero que
// se ve al abrir la app, así que la sección tiene que ser alcanzable desde ahí).
check(await page.isVisible('#newGameModal'), 'el modal de inicio está abierto tras cargar');
await page.click('#btnLearnFromModal');
await page.waitForSelector('#trainerModal:not(.hidden)');
check(!(await page.isVisible('#newGameModal')), 'el botón del modal de inicio abre el temario y cierra el modal');
await page.click('#trainerClose');
await page.waitForSelector('#trainerModal', { state: 'hidden' });

// ---- 1. El temario ----
await page.click('#btnTrainer');
await page.waitForSelector('#trainerModal:not(.hidden)');
const cursos = await page.$$eval('.tc-course .tc-title', (n) => n.map((x) => x.textContent));
check(cursos.length === 2, `el temario lista 2 cursos (${cursos.join(' / ')})`);
check(cursos.some((t) => /Gambito de Dama/i.test(t)), 'hay un curso del Gambito de Dama');
check(cursos.some((t) => /Eslava/i.test(t)), 'hay un curso de la Defensa Eslava');
const lecciones = await page.$$('.tc-line');
check(lecciones.length === 7, `hay 7 lecciones en total (${lecciones.length})`);

// ---- 2. Arranca la primera lección del Gambito de Dama ----
await page.click('.tc-line[data-course="gd-blancas"][data-line="gda"]');
await page.waitForSelector('#trainerPanel:not(.hidden)');
check(await page.evaluate(() => document.body.classList.contains('opening-mode')),
  'el body entra en modo lección');
check(await page.evaluate(() => document.querySelector('.moves-card').offsetParent === null),
  'se oculta la lista de jugadas de la partida');
check(await page.evaluate(() => window.__board().orientation === 'w'),
  'el tablero se orienta al bando que se aprende (blancas)');

// La primera vez la guía está activada.
check(await page.isChecked('#trGuided'), 'la guía se activa la primera vez');

// Te toca la primera jugada (1.d4), sin esperar al rival.
await page.waitForFunction(() => window.__trainer.ply === 0 && !window.__trainer.busy);
check(/Te toca/.test(await page.textContent('#trStep')), 'te pide tu jugada');
check(/d4/.test(await page.textContent('#trStep')), 'con la guía puesta, revela la jugada (d4)');

// ---- 3. Jugar arrastrando ----
async function drag(from, to) {
  const a = await page.locator(`.cell[data-square="${from}"]`).boundingBox();
  const b = await page.locator(`.cell[data-square="${to}"]`).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

await drag('d2', 'd4');
// El rival contesta solo 1…d5 y espera tu 2.c4.
await page.waitForFunction(() => window.__trainer.ply === 2 && !window.__trainer.busy, null, { timeout: 8000 });
check(true, '1.d4 aceptada y el rival responde solo 1…d5');
check(/1…d5/.test(await page.textContent('#trLast')), 'explica la jugada del rival');
check(/por qué|centro|sólida/i.test(await page.textContent('#trLast')), 'la explicación está en español');

// ---- 4. Un error típico: 3.e3 en vez de 3.Nf3 (con castigo en el tablero) ----
await drag('c2', 'c4');   // 2.c4
await page.waitForFunction(() => window.__trainer.ply === 4 && !window.__trainer.busy, null, { timeout: 8000 });
check(true, 'el rival acepta el gambito (2…dxc4)');

const altas = await page.$$eval('.tr-alt-san', (n) => n.map((x) => x.textContent.trim()));
check(altas.length >= 3, `ofrece las respuestas alternativas del rival (${altas.join(' ')})`);

await drag('e2', 'e3');   // error: permite …e5
await page.waitForSelector('#trWrong:not(.hidden)');
check(/e3/.test(await page.textContent('#trWrong')), 'detecta el error y lo nombra');
check(/e5/.test(await page.textContent('#trWrong')), 'explica por qué falla (…e5)');
await page.waitForFunction(() => window.__trainer.wrong && window.__trainer.wrong.punishSan, null, { timeout: 5000 });
check(true, 'muestra el castigo del error en el tablero');
// Y te devuelve el turno en la misma posición.
await page.waitForFunction(() => !window.__trainer.busy && window.__trainer.ply === 4, null, { timeout: 6000 });
check(await page.evaluate(() => window.__game.chess.fen().startsWith('rnbqkbnr/ppp1pppp/8/8/3P4/5N2')) === false,
  'vuelve a tu turno antes de la jugada fallada');
check(/Te toca/.test(await page.textContent('#trStep')), 'te pide otra vez la jugada');

// ---- 5. Pista escalonada ----
await page.uncheck('#trGuided');
check(!/Nf3/.test(await page.textContent('#trStep')), 'sin guía, no revela la jugada');
await page.click('#btnTrHint');
check(/g1/.test(await page.textContent('#trAsk')), 'la primera pista dice qué pieza mover (g1)');
await page.click('#btnTrHint');
check(await page.$$eval('.arrow-layer line', (l) => l.length > 0), 'la segunda pista dibuja la flecha');

// ---- 6. Completar la lección entera ----
await page.check('#trGuided');
for (let i = 0; i < 20; i++) {
  const st = await page.evaluate(() => {
    const t = window.__trainer;
    if (!t.active || t.finished || t.busy) return null;
    const s = t.steps[t.ply];
    if (!s || s.color !== t.course.side) return null;
    return { from: s.from, to: s.to };
  });
  if (!st) {
    if (await page.evaluate(() => window.__trainer.finished)) break;
    await page.waitForTimeout(300);
    continue;
  }
  await drag(st.from, st.to);
  await page.waitForTimeout(250);
}
await page.waitForFunction(() => window.__trainer.finished, null, { timeout: 20000 });
check(true, 'la lección se completa jugando todas tus jugadas');
check(/completada/i.test(await page.textContent('#trStep')), 'anuncia la lección completada');
check(await page.$$eval('.tr-keys li', (n) => n.length >= 3), 'resume las ideas para recordar');
check(await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('entrenador-ajedrez-aperturas') || '{}');
  return !!(p.gda && p.gda.veces >= 1);
}), 'guarda el progreso de la lección');

await page.screenshot({ path: 'tools/trainer-screenshot.png' });

// ---- 7. Salto a la variante del rival (Gambito de Dama Rechazado) ----
await page.click('#btnTrRestart');
await page.waitForFunction(() => window.__trainer.ply === 0 && !window.__trainer.busy);
await drag('d2', 'd4');
await page.waitForFunction(() => window.__trainer.ply === 2 && !window.__trainer.busy, null, { timeout: 8000 });
await drag('c2', 'c4');
await page.waitForFunction(() => window.__trainer.ply === 4 && !window.__trainer.busy, null, { timeout: 8000 });
await page.click('.tr-alt-go:has-text("Gambito de Dama Rechazado")');
await page.waitForFunction(() => window.__trainer.line.id === 'gdr', null, { timeout: 8000 });
check(true, 'la variante del rival salta a la lección que la cubre');
// Reanuda en la misma posición y juega ahí la respuesta alternativa.
await page.waitForFunction(() => window.__trainer.ply === 4 && !window.__trainer.busy, null, { timeout: 8000 });
check(await page.evaluate(() => window.__trainer.chess.history().join(' ') === 'd4 d5 c4 e6'),
  'la nueva lección reanuda desde la misma posición con la respuesta alternativa');
check(/Gambito de Dama Rechazado/.test(await page.textContent('#trTitle')), 'el panel pasa a la lección nueva');

// ---- 8. Curso de negras: el tablero se voltea y el rival abre ----
await page.click('#btnTrMenu');
await page.waitForSelector('#trainerModal:not(.hidden)');
await page.click('.tc-line[data-course="eslava-negras"][data-line="esl-base"]');
await page.waitForFunction(() => window.__trainer.line && window.__trainer.line.id === 'esl-base');
check(await page.evaluate(() => window.__board().orientation === 'b'), 'con negras el tablero se voltea');
await page.waitForFunction(() => window.__trainer.ply === 1 && !window.__trainer.busy, null, { timeout: 8000 });
check(true, 'el rival abre solo con 1.d4 y te pasa el turno');

// ---- 9. Salir vuelve a la app normal ----
await page.click('#btnTrExit');
check(!(await page.evaluate(() => document.body.classList.contains('opening-mode'))),
  'al salir se abandona el modo lección');
check(await page.evaluate(() => document.querySelector('.moves-card').offsetParent !== null),
  'reaparece la interfaz de la partida');

await browser.close();
console.log(`\nResultado: ${ok} correctas, ${fail} fallidas`);
process.exit(fail === 0 ? 0 : 1);
