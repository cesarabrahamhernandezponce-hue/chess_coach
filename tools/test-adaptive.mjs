// Prueba de la lógica del Elo adaptativo (sin navegador).
//   node tools/test-adaptive.mjs
// Stub de localStorage en memoria (el módulo lo lee de forma perezosa).
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { getMyElo, setMyElo, suggestedRivalElo, updateElo, outcomeScore } =
  await import('../js/adaptive.js');

let fail = 0;
function eq(actual, expected, msg) {
  const ok = actual === expected;
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'XX '} ${msg} → ${actual}${ok ? '' : ` (esperado ${expected})`}`);
}

console.log('--- estimación base y clamp ---');
eq(getMyElo(), 1200, 'estimación por defecto');
eq(setMyElo(1500), 1500, 'fija 1500');
eq(getMyElo(), 1500, 'persiste 1500');
eq(setMyElo(5000), 2800, 'clamp por arriba');
eq(setMyElo(100), 800, 'clamp por abajo');

console.log('\n--- rival sugerido (suelo del motor) ---');
setMyElo(1000);
eq(suggestedRivalElo(), 1320, 'estimado bajo → suelo del motor 1320');
setMyElo(2000);
eq(suggestedRivalElo(), 2000, 'estimado normal → mismo valor');

console.log('\n--- outcomeScore ---');
eq(outcomeScore('win'), 1, 'victoria = 1');
eq(outcomeScore('draw'), 0.5, 'tablas = 0.5');
eq(outcomeScore('loss'), 0, 'derrota = 0');

console.log('\n--- updateElo (K=40) ---');
setMyElo(1500);
eq(updateElo(1500, 1), 1520, 'ganar a un igual: +20');
setMyElo(1500);
eq(updateElo(1500, 0), 1480, 'perder con un igual: −20');
setMyElo(1500);
eq(updateElo(1500, 0.5), 1500, 'tablas con un igual: sin cambio');
setMyElo(1500);
eq(updateElo(1900, 1), 1536, 'ganar a uno más fuerte: gran subida');
setMyElo(1500);
eq(updateElo(1100, 0), 1464, 'perder con uno más débil: gran bajada');

console.log(`\n${fail ? `FALLARON ${fail} comprobaciones` : 'TODO OK'}`);
process.exit(fail ? 1 : 0);
