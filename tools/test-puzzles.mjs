// Prueba la recolección de puzzles a partir de errores (lógica pura, sin navegador).
import { collectPuzzles } from '../js/puzzles.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_A3 = 'rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR b KQkq - 0 1';
const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/8/P7/1PPPPPPP/RNBQKBNR w KQkq e6 0 2';

// Partida ficticia: yo (blancas) juego a3 (error), rival responde e5, yo juego
// h3 (imprecisión). Debe salir 1 puzzle por cada jugada mía mala.
const game = {
  date: 1700000000000, rivalElo: 2000,
  tree: {
    m: null, fen: START, mine: false, cat: null, kids: [
      { m: { san: 'a3', from: 'a2', to: 'a3', uci: 'a2a3', color: 'w' }, fen: AFTER_A3, mine: true, cat: 'mistake', cpl: 150, line: ['e4', 'e5'], kids: [
        { m: { san: 'e5', from: 'e7', to: 'e5', uci: 'e7e5', color: 'b' }, fen: AFTER_E5, mine: false, cat: null, kids: [
          { m: { san: 'h3', from: 'h2', to: 'h3', uci: 'h2h3', color: 'w' }, fen: 'x', mine: true, cat: 'inaccuracy', cpl: 80, line: ['Nf3'], kids: [] },
        ] },
      ] },
    ],
  },
};

let fail = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fail++; };

const pz = collectPuzzles([game]);
check(pz.length === 2, 'extrae 2 puzzles de las 2 jugadas malas (' + pz.length + ')');
check(pz[0].cat === 'mistake', 'ordena el error antes que la imprecisión');
check(pz[0].fen === START, 'la posición del puzzle es la de ANTES de mi jugada');
check(pz[0].turn === 'w', 'el turno del puzzle es mi color (w)');
check(pz[0].playedSan === 'a3', 'guarda la jugada mala que jugué (a3)');
check(pz[0].solutionSan === 'e4', 'guarda la mejor jugada como referencia (e4)');

// No cuenta jugadas buenas ni las del rival.
const good = { date: 1, rivalElo: 1500, tree: {
  m: null, fen: START, mine: false, kids: [
    { m: { san: 'e4' }, fen: AFTER_A3, mine: true, cat: 'best', cpl: 0, kids: [] },
    { m: { san: 'd4' }, fen: AFTER_E5, mine: false, cat: 'blunder', cpl: 400, kids: [] },
  ],
} };
check(collectPuzzles([good]).length === 0, 'ignora jugadas buenas y jugadas del rival');

// Dedup por posición repetida entre partidas.
check(collectPuzzles([game, game]).length === 2, 'deduplica posiciones repetidas entre partidas');

console.log(`\nResultado: ${fail === 0 ? 'TODO OK' : fail + ' fallos'}`);
process.exit(fail === 0 ? 0 : 1);
