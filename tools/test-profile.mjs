// Prueba de la lógica del perfil de debilidades por fase (sin navegador).
//   node tools/test-profile.mjs
import { phaseOf, buildProfile } from '../js/profile.js';

let fail = 0;
function eq(actual, expected, msg) {
  const ok = actual === expected;
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'XX '} ${msg} → ${actual}${ok ? '' : ` (esperado ${expected})`}`);
}
function near(actual, expected, msg, tol = 0.5) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'XX '} ${msg} → ${actual}${ok ? '' : ` (esperado ~${expected})`}`);
}

// FENs de referencia.
const OPEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'; // material completo
const MID  = 'r3k2r/pppq1ppp/2n2n2/3pp3/3PP3/2N2N2/PPPQ1PPP/R3K2R w KQkq - 0 12'; // 10 piezas, con damas
const ENDq = '1rbn1rk1/5ppp/8/8/8/8/5PPP/1RBN1RK1 w - - 0 30'; // 8 piezas, sin damas
const END  = '8/5k2/8/8/8/8/5K2/8 w - - 0 40'; // reyes solos

console.log('--- phaseOf ---');
eq(phaseOf(OPEN, 1), 'opening', 'material completo, ply bajo');
eq(phaseOf(OPEN, 30), 'middlegame', 'material completo, ply alto');
eq(phaseOf(MID, 30), 'middlegame', '10 piezas con damas, ply alto');
eq(phaseOf(ENDq, 30), 'endgame', 'sin damas y <=10 piezas');
eq(phaseOf(END, 3), 'endgame', 'reyes solos, ply bajo');

// Construye una partida sintética (línea principal encadenada por kids[0]).
function n(mine, cat, acc, cpl, fen, kid) {
  return { mine, cat, acc, cpl, fen, kids: kid ? [kid] : [] };
}
// Se encadena de la última a la primera.
const p8 = n(true,  'excellent', 90, 20,  END);
const p7 = n(true,  'mistake',   30, 200, END,  p8);
const p6 = n(false, 'best',      100, 0,  END,  p7);
const p5 = n(true,  'blunder',   10, 400, END,  p6);
const p4 = n(false, 'good',      80, 40,  OPEN, p5);
const p3 = n(true,  'good',      80, 40,  OPEN, p4);
const p2 = n(false, 'best',      100, 0,  OPEN, p3);
const p1 = n(true,  'best',      95, 0,   OPEN, p2);
const root = { mine: false, fen: OPEN, kids: [p1] };
const games = [{ tree: root }];

console.log('\n--- buildProfile ---');
const prof = buildProfile(games);
eq(prof.totalGames, 1, 'partidas contadas');
eq(prof.totalMoves, 5, 'jugadas mías contadas');
eq(prof.enoughData, true, 'hay datos suficientes');

const by = Object.fromEntries(prof.phases.map((p) => [p.key, p]));
eq(by.opening.moves, 2, 'jugadas en apertura');
near(by.opening.accuracy, 87.5, 'precisión apertura');
eq(by.middlegame.moves, 0, 'jugadas en medio juego');
eq(by.middlegame.accuracy, null, 'precisión medio juego sin datos');
eq(by.endgame.moves, 3, 'jugadas en final');
near(by.endgame.accuracy, 43.33, 'precisión final');
eq(by.endgame.bad, 2, 'jugadas flojas en final');
eq(prof.weakest.key, 'endgame', 'fase más floja');

// Sin datos: perfil vacío.
const empty = buildProfile([]);
eq(empty.enoughData, false, 'sin partidas → sin datos suficientes');
eq(empty.weakest, null, 'sin partidas → sin fase más floja');

console.log(`\n${fail ? `FALLARON ${fail} comprobaciones` : 'TODO OK'}`);
process.exit(fail ? 1 : 0);
