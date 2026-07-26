import { classifyMove } from '../js/classifier.js';
import { Chess } from '../vendor/chess.mjs';

let fails = 0;
const eq = (got, want, msg) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg} => ${got}${ok ? '' : ' (esperaba ' + want + ')'}`);
};

// --- Clasificador ---
// Sacrificio sano y (casi) mejor => brillante.
eq(classifyMove({ isBook: false, isBest: true, cpl: 0, sacMaterial: 3, evalBeforeMe: 120, evalAfterMe: 80 }).key,
  'brilliant', 'sac sano + mejor jugada');
// Sacrificio pero me hundo (mal) => no brillante.
eq(classifyMove({ isBook: false, isBest: false, cpl: 400, sacMaterial: 3, evalBeforeMe: 100, evalAfterMe: -300 }).key,
  'blunder', 'entregar material y hundirse = error grave');
// Mejor jugada normal sin sacrificio => best.
eq(classifyMove({ isBook: false, isBest: true, cpl: 0, sacMaterial: 0, evalBeforeMe: 50, evalAfterMe: 50 }).key,
  'best', 'mejor jugada sin sacrificio');
// Ya ganando por goleada: el sacrificio no cuenta como brillante.
eq(classifyMove({ isBook: false, isBest: true, cpl: 0, sacMaterial: 3, evalBeforeMe: 900, evalAfterMe: 850 }).key,
  'best', 'sac mientras ganas por goleada = solo mejor');
// Jugada única: 2ª opción muy peor => gran jugada.
eq(classifyMove({ isBook: false, isBest: true, cpl: 0, sacMaterial: 0, secondBestCp: -250, evalBeforeMe: 30, evalAfterMe: 30 }).key,
  'great', 'unica jugada buena (brecha grande)');
// Mejor jugada pero la 2ª casi igual de buena => no es "gran jugada", solo best.
eq(classifyMove({ isBook: false, isBest: true, cpl: 0, sacMaterial: 0, secondBestCp: -10, evalBeforeMe: 30, evalAfterMe: 30 }).key,
  'best', '2a opcion casi igual = solo mejor');
// Libro manda sobre todo.
eq(classifyMove({ isBook: true, isBest: true, cpl: 0, sacMaterial: 3, evalBeforeMe: 20, evalAfterMe: 20 }).key,
  'book', 'libro tiene prioridad');

// --- SEE de material (misma lógica que main.js) ---
const PIECE_VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
function seeOnSquare(chess, square) {
  const caps = chess.moves({ verbose: true })
    .filter((m) => m.to === square && m.captured)
    .sort((a, b) => PIECE_VAL[a.piece] - PIECE_VAL[b.piece]);
  if (!caps.length) return 0;
  const m = caps[0];
  const victim = PIECE_VAL[m.captured];
  chess.move({ from: m.from, to: m.to, promotion: m.promotion });
  const gain = Math.max(0, victim - seeOnSquare(chess, square));
  chess.undo();
  return gain;
}
function sacrificedMaterial(fen) {
  const chess = new Chess(fen);
  const targets = new Set(chess.moves({ verbose: true }).filter((m) => m.captured).map((m) => m.to));
  let max = 0;
  for (const sq of targets) max = Math.max(max, seeOnSquare(chess, sq));
  return max;
}

// Caballo blanco en d5 atacado por el peón negro de c6 y sin defensa: cxd5 gana 3.
const hangKnight = 'rnbqkbnr/pp1ppppp/2p5/3N4/8/8/PPPPPPPP/R1BQKBNR b KQkq - 0 1';
eq(sacrificedMaterial(hangKnight) >= 3, true, 'SEE detecta caballo colgado (>=3)');

// Posición inicial: nadie puede capturar nada => 0.
eq(sacrificedMaterial(new Chess().fen()), 0, 'SEE: sin capturas en la inicial = 0');

// Peón defendido: tomar no gana material (SEE ~0).
const defendedPawn = 'rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
eq(sacrificedMaterial(defendedPawn) <= 1, true, 'SEE: peon defendido no es sacrificio');

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
