// Genera puzzles a partir de TUS errores en partidas archivadas.
// Cada puzzle es la posición ANTES de una jugada tuya mala (imprecisión, error
// o error grave), con tu turno para mover: el reto es encontrar algo mejor.
import { listGames } from './library.js';

// Peso por gravedad para ordenar (peores primero).
const BAD = { inaccuracy: 1, mistake: 2, blunder: 3 };

// Recorre el árbol serializado; `parentFen` es la posición antes de `node`.
function walk(node, game, out, parentFen) {
  if (!node) return;
  if (node.mine && BAD[node.cat] && parentFen) {
    out.push({
      fen: parentFen,                 // posición a resolver (tu turno)
      turn: parentFen.split(' ')[1],  // 'w' | 'b' = tu color en esta partida
      playedSan: node.m ? node.m.san : '',
      solutionSan: node.line && node.line[0] ? node.line[0] : null,
      cpl: node.cpl || 0,
      cat: node.cat,
      date: game.date,
      rivalElo: game.rivalElo,
    });
  }
  for (const k of (node.kids || [])) walk(k, game, out, node.fen);
}

// Devuelve la lista de puzzles: peores primero y sin posiciones repetidas.
// Acepta un array de partidas para poder probarla sin localStorage.
export function collectPuzzles(games = listGames()) {
  const out = [];
  for (const g of games) walk(g.tree, g, out, undefined);
  out.sort((a, b) => (BAD[b.cat] - BAD[a.cat]) || (b.cpl - a.cpl));
  const seen = new Set();
  const dedup = [];
  for (const p of out) {
    if (seen.has(p.fen)) continue;
    seen.add(p.fen);
    dedup.push(p);
  }
  return dedup;
}
