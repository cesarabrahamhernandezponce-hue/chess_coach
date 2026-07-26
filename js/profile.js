// Perfil de debilidades por fase.
// Recorre la LÍNEA PRINCIPAL (lo que realmente jugaste, kids[0]) de cada partida
// archivada y agrega TUS jugadas por fase (apertura / medio juego / final) para
// mostrarte en qué momento de la partida fallas más.
import { listGames } from './library.js';
import { CATEGORIES, CATEGORY_ORDER } from './classifier.js';

const PHASES = [
  { key: 'opening', label: 'Apertura' },
  { key: 'middlegame', label: 'Medio juego' },
  { key: 'endgame', label: 'Final' },
];
const BAD = { inaccuracy: true, mistake: true, blunder: true };

// Determina la fase a partir del FEN (posición tras la jugada) y el ply.
// Final: pocas piezas (heurística de material). Apertura: primeras 10 jugadas.
// Resto: medio juego.
export function phaseOf(fen, ply) {
  const board = (fen || '').split(' ')[0];
  let npm = 0, queens = 0; // npm = piezas no-peón no-rey (ambos bandos)
  for (const ch of board) {
    if (ch === 'q' || ch === 'Q') { queens++; npm++; }
    else if (ch === 'r' || ch === 'R' || ch === 'b' || ch === 'B' || ch === 'n' || ch === 'N') npm++;
  }
  if (npm <= 6 || (queens === 0 && npm <= 10)) return 'endgame';
  if (ply <= 20) return 'opening';
  return 'middlegame';
}

function emptyPhase(key, label) {
  const counts = {};
  for (const k of Object.keys(CATEGORIES)) counts[k] = 0;
  return { key, label, moves: 0, accSum: 0, accCount: 0, cplSum: 0, bad: 0, counts };
}

// Agrega estadísticas por fase sobre un array de partidas archivadas.
export function buildProfile(games = listGames()) {
  const phases = {};
  for (const p of PHASES) phases[p.key] = emptyPhase(p.key, p.label);
  let totalGames = 0, totalMoves = 0;

  for (const g of games) {
    if (!g || !g.tree) continue;
    totalGames++;
    let node = g.tree, ply = 0;
    while (node) {
      if (node.mine && node.cat) {
        const ph = phases[phaseOf(node.fen, ply)];
        ph.moves++; totalMoves++;
        ph.counts[node.cat] = (ph.counts[node.cat] || 0) + 1;
        if (node.acc != null) { ph.accSum += node.acc; ph.accCount++; }
        ph.cplSum += (node.cpl || 0);
        if (BAD[node.cat]) ph.bad++;
      }
      node = node.kids && node.kids[0] ? node.kids[0] : null;
      ply++;
    }
  }

  const list = PHASES.map((p) => {
    const ph = phases[p.key];
    return {
      key: ph.key,
      label: ph.label,
      moves: ph.moves,
      accuracy: ph.accCount ? ph.accSum / ph.accCount : null,
      avgCpl: ph.moves ? ph.cplSum / ph.moves : 0,
      bad: ph.bad,
      badRate: ph.moves ? ph.bad / ph.moves : 0,
      counts: ph.counts,
    };
  });

  // Fase más floja: entre las que tienen >= 3 jugadas, la de menor precisión.
  const eligible = list.filter((p) => p.moves >= 3 && p.accuracy != null);
  const weakest = eligible.length
    ? eligible.reduce((a, b) => (a.accuracy <= b.accuracy ? a : b))
    : null;

  return { totalGames, totalMoves, phases: list, weakest, enoughData: totalMoves >= 5 };
}

// Renderiza el perfil dentro de `host`.
export function renderProfile(host, games = listGames()) {
  const data = buildProfile(games);
  host.innerHTML = '';

  if (!data.enoughData) {
    host.innerHTML = '<div class="lib-empty">Aún no hay datos suficientes.<br>' +
      'Juega algunas partidas —al terminar se archivan solas— y aquí verás en qué fase fallas más.</div>';
    return;
  }

  const summary = document.createElement('div');
  summary.className = 'prof-summary';
  const ng = `<b>${data.totalGames}</b> ${data.totalGames === 1 ? 'partida' : 'partidas'}`;
  const nm = `<b>${data.totalMoves}</b> jugadas tuyas`;
  summary.innerHTML = data.weakest
    ? `Sobre ${ng} y ${nm}. Tu fase más floja es <b>${data.weakest.label.toLowerCase()}</b> ` +
      `(precisión ${data.weakest.accuracy.toFixed(0)}%).`
    : `Sobre ${ng} y ${nm}.`;
  host.appendChild(summary);

  for (const ph of data.phases) {
    const card = document.createElement('div');
    card.className = 'prof-phase';
    if (data.weakest && ph.key === data.weakest.key) card.classList.add('prof-weak');
    if (!ph.moves) card.classList.add('prof-empty-phase');

    const head = document.createElement('div');
    head.className = 'prof-head';
    const acc = ph.accuracy != null ? ph.accuracy.toFixed(0) + '%' : '—';
    head.innerHTML = `<span class="prof-label">${ph.label}</span><span class="prof-acc">${acc}</span>`;
    card.appendChild(head);

    const meta = document.createElement('div');
    meta.className = 'prof-meta';
    meta.textContent = ph.moves
      ? `${ph.moves} jugadas · ${ph.bad} flojas · pérdida media ${(ph.avgCpl / 100).toFixed(2)}`
      : 'sin jugadas todavía';
    card.appendChild(meta);

    if (ph.moves) {
      const bar = document.createElement('div');
      bar.className = 'prof-bar';
      for (const k of CATEGORY_ORDER) {
        const n = ph.counts[k];
        if (!n) continue;
        const seg = document.createElement('div');
        seg.className = 'prof-seg ' + CATEGORIES[k].clase;
        seg.style.flex = String(n);
        seg.title = `${CATEGORIES[k].label}: ${n}`;
        bar.appendChild(seg);
      }
      card.appendChild(bar);
    }
    host.appendChild(card);
  }
}
