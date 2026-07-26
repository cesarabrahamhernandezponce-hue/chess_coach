// Coach local: explica el "porqué" de una jugada razonando con el motor y el
// tablero (chess.js). No usa red: todo se deduce de la posición, el material y
// la evaluación que ya tenemos. Prioriza afirmaciones concretas y verificables.

import { Chess } from '../vendor/chess.mjs';

const PIECE_VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const NAME = { p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey' };
const CENTER = new Set(['d4', 'e4', 'd5', 'e5', 'c4', 'c5', 'f4', 'f5']);
const CENTER_PAWN = new Set(['d4', 'e4', 'd5', 'e5', 'c4', 'c5']);

// Static Exchange Evaluation sobre una casilla: material neto que gana, por la
// fuerza, el bando en juego si captura ahí y se agota el intercambio.
export function seeOnSquare(chess, square) {
  const caps = chess.moves({ verbose: true })
    .filter((m) => m.to === square && m.captured)
    .sort((a, b) => PIECE_VAL[a.piece] - PIECE_VAL[b.piece]); // atacante menos valioso primero
  if (!caps.length) return 0;
  const m = caps[0];
  const victim = PIECE_VAL[m.captured];
  chess.move({ from: m.from, to: m.to, promotion: m.promotion });
  const gain = Math.max(0, victim - seeOnSquare(chess, square));
  chess.undo();
  return gain;
}

// Máximo material que el bando en juego puede ganar de inmediato en `fen`.
export function sacrificedMaterial(fen) {
  const chess = new Chess(fen);
  const targets = new Set(chess.moves({ verbose: true }).filter((m) => m.captured).map((m) => m.to));
  let max = 0;
  for (const sq of targets) max = Math.max(max, seeOnSquare(chess, sq));
  return max;
}

// Mejor captura del bando en juego en `fen` (la de mayor material neto). null si ninguna gana.
function topCapture(fen) {
  const chess = new Chess(fen);
  const targets = new Set(chess.moves({ verbose: true }).filter((m) => m.captured).map((m) => m.to));
  let best = null;
  for (const sq of targets) {
    const gain = seeOnSquare(chess, sq);
    if (gain > 0 && (!best || gain > best.gain)) {
      const victim = chess.get(sq);
      best = { square: sq, gain, victim: victim ? victim.type : null };
    }
  }
  return best;
}

function isBackRank(square, color) {
  return square[1] === (color === 'w' ? '1' : '8');
}

const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Describe la respuesta del rival: si captura (y qué), si da jaque, si toma el centro.
function describeReply(fen, uci) {
  try {
    const c = new Chess(fen);
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || 'q' });
    if (!m) return null;
    return {
      san: m.san,
      isCapture: !!m.captured,
      capturedName: m.captured ? NAME[m.captured] : null,
      isCheck: c.inCheck(),
      centerGrab: m.piece === 'p' && CENTER_PAWN.has(m.to),
    };
  } catch (_) { return null; }
}

// Defecto posicional evidente de MI jugada (para explicar el porqué), si lo hay.
function positionalFlaw(move) {
  if (move.piece === 'n' && (move.to[0] === 'a' || move.to[0] === 'h')) {
    return `tu caballo en ${move.to} queda pasivo en el borde y hace poco`;
  }
  return null;
}

const pawns = (cp) => (cp / 100).toFixed(1);

// Explica una de MIS jugadas ya clasificada. Devuelve una frase corta en español.
//   categoryKey: 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
//   move:        jugada verbosa de chess.js (piece, captured, flags, promotion, color, from, to).
//   postFen:     posición resultante (rival por mover).
//   cpl:         pérdida en centipawns (>=0).
//   sacMaterial: material que el rival puede ganar tras mi jugada (SEE).
//   oppReplyUci: mejor respuesta del rival según el motor (opcional, para jugadas flojas).
export function explainMyMove({ categoryKey, move, postFen, cpl = 0, sacMaterial = 0, oppReplyUci = null }) {
  const post = new Chess(postFen);
  const flags = move.flags || '';
  const movedName = NAME[move.piece] || 'pieza';
  const isCheck = post.inCheck();

  if (post.isCheckmate()) return '¡Jaque mate! Rematas la partida.';

  const good = ['brilliant', 'great', 'best', 'excellent', 'good'].includes(categoryKey);

  if (categoryKey === 'brilliant') {
    const que = sacMaterial >= 5 ? 'material pesado' : 'una pieza';
    return `Sacrificas ${que} (${sacMaterial} de material), pero la táctica lo compensa y conservas la ventaja.`;
  }

  if (good) {
    // Captura que gana material limpio (el rival no lo recupera).
    if (move.captured && sacMaterial < 2) {
      return `Ganas material: capturas ${NAME[move.captured]} y el rival no lo recupera${isCheck ? ', además con jaque' : ''}.`;
    }
    if (flags.includes('k') || flags.includes('q')) {
      return 'Enrocas: pones a salvo al rey y activas la torre.';
    }
    if (categoryKey === 'great') {
      return 'Era la única jugada que aguantaba la posición; cualquier otra la empeoraba bastante.';
    }
    if (flags.includes('p')) {
      return `Coronas: tu peón se convierte en ${NAME[move.promotion] || 'dama'}.`;
    }
    if ((move.piece === 'n' || move.piece === 'b') && isBackRank(move.from, move.color)) {
      let s = `Desarrollas tu ${movedName}${CENTER.has(move.to) ? ' hacia el centro' : ''}`;
      return s + (isCheck ? ', con jaque.' : '.');
    }
    if (move.piece === 'p' && CENTER_PAWN.has(move.to)) {
      return 'Ganas espacio y disputas el centro.';
    }
    if (isCheck) return 'Das jaque y ganas la iniciativa.';
    if (categoryKey === 'best') return 'Es la jugada del motor: mantiene tu plan y tu ventaja.';
    return 'Jugada sólida: conservas el equilibrio.';
  }

  // Jugadas flojas: di CLARAMENTE por qué es mala (defecto + castigo del rival).
  // A) Cuelgas material: la causa más grave y concreta.
  const grab = topCapture(postFen);
  if (grab && grab.gain >= 2) {
    const what = grab.square === move.to
      ? `tu ${movedName} en ${move.to} queda sin protección`
      : `dejas tu ${NAME[grab.victim]} en ${grab.square} sin defensa`;
    return `${cap1(what)}: el rival lo captura y gana ~${grab.gain} de material.`;
  }
  // B) No cuelga nada directo: explica el defecto y cómo lo aprovecha el rival.
  const flaw = positionalFlaw(move);
  const r = oppReplyUci ? describeReply(postFen, oppReplyUci) : null;
  if (r) {
    let punish;
    if (r.isCheck && r.isCapture) punish = `${r.san}, con jaque y ganando ${r.capturedName}`;
    else if (r.isCapture) punish = `${r.san} y te captura ${r.capturedName}`;
    else if (r.isCheck) punish = `${r.san} con jaque`;
    else if (r.centerGrab) punish = `${r.san} y se adueña del centro`;
    else punish = `${r.san}, quedando mejor colocado`;
    const head = flaw ? cap1(flaw) + '. ' : '';
    return `${head}El rival responde ${punish}; cedes ${pawns(cpl)}.`;
  }
  if (flaw) return `${cap1(flaw)}; cedes ${pawns(cpl)} de ventaja.`;
  return `Pierdes ${pawns(cpl)}: había una jugada más precisa (mira la línea sugerida abajo).`;
}

// Explica por qué la jugada sugerida (mejor del motor) es buena, para la pista.
export function explainBest(fen, uci) {
  try {
    const c = new Chess(fen);
    const move = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || 'q' });
    if (!move) return '';
    const postFen = c.fen();
    return explainMyMove({ categoryKey: 'best', move, postFen, sacMaterial: sacrificedMaterial(postFen) });
  } catch (_) { return ''; }
}
