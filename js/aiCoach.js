// Construye el prompt del coach con IA a partir de hechos que ya verificó
// Stockfish, y convierte la respuesta en HTML.
//
// La regla de diseño es que el modelo NO calcula ajedrez: calcular es cosa del
// motor. Al modelo se le pasan la evaluación, la mejor jugada, la línea principal
// y la lista de jugadas legales, y su único trabajo es explicar en español por
// qué eso es así. Sin esa correa, cualquier LLM se inventa variantes ilegales.

import { Chess } from '../vendor/chess.mjs';
import { seeOnSquare } from './coach.js';

const PIECE_VAL = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const NAME = { p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey' };

const pawns = (cp) => (cp >= 0 ? '+' : '−') + (Math.abs(cp) / 100).toFixed(2);

// Fase de la partida por material restante (misma idea que el perfil por fases).
export function phaseOf(fen) {
  const chess = new Chess(fen);
  let units = 0, pieces = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.type === 'k') continue;
      units += PIECE_VAL[sq.type] || 0;
      if (sq.type !== 'p') pieces++;
    }
  }
  const ply = parseInt(fen.split(' ')[5], 10) || 1;
  if (ply <= 12 && units >= 60) return 'apertura';
  if (pieces <= 6 || units <= 26) return 'final';
  return 'medio juego';
}

// Recuento de material desde el punto de vista de un bando ("+3 para ti", etc.).
export function materialLine(fen, myColor) {
  const chess = new Chess(fen);
  let mine = 0, theirs = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.type === 'k') continue;
      const v = PIECE_VAL[sq.type] || 0;
      if (sq.color === myColor) mine += v; else theirs += v;
    }
  }
  const d = mine - theirs;
  if (d === 0) return 'material igualado';
  return d > 0 ? `llevas ${d} de material de ventaja` : `vas ${-d} de material por detrás`;
}

// Casillas donde el bando en juego gana material de verdad si captura. Usa el
// SEE de coach.js (agota el intercambio), así que un cambio normal de peones no
// cuenta como "colgar" —solo lo que realmente se gana—. Es el tipo de hecho
// concreto que evita que la explicación suene genérica.
export function hangingPieces(fen) {
  const chess = new Chess(fen);
  const targets = new Set(
    chess.moves({ verbose: true }).filter((m) => m.captured).map((m) => m.to)
  );
  const out = [];
  for (const sq of targets) {
    const gain = seeOnSquare(new Chess(fen), sq);
    if (gain < 2) continue; // menos de eso es ruido táctico, no material colgado
    const victim = chess.get(sq);
    if (victim && victim.type !== 'k') out.push(`${NAME[victim.type]} en ${sq} (se ganan ~${gain})`);
  }
  return out;
}

const list = (arr, empty = '—') => (arr && arr.length ? arr.join(' ') : empty);

export const SYSTEM_PROMPT = `Eres un entrenador de ajedrez español, exigente y concreto, que enseña a un jugador de club.

REGLAS INVIOLABLES:
1. NO calculas ajedrez. Todos los datos numéricos y todas las jugadas que puedes citar te los da Stockfish en el mensaje del usuario. Tu trabajo es EXPLICAR esos datos, no recalcularlos.
2. No menciones ninguna jugada que no aparezca literalmente en los datos que recibes. Si quieres hablar de una continuación que no está listada, descríbela como plan en palabras ("llevar el caballo al centro", "abrir la columna f") en vez de inventar la notación.
3. Nunca contradigas la evaluación del motor. Si el motor dice que la jugada pierde 1.20, la jugada es mala aunque a ti te parezca natural.
4. Habla en segunda persona ("tu alfil", "dejas"), en español de España neutro, sin anglicismos.
5. Sé concreto: nombra casillas y piezas. Prohibido el relleno tipo "es importante controlar el centro" sin decir con qué pieza y hacia dónde.

FORMATO DE LA RESPUESTA (usa exactamente estos encabezados, sin añadir otros):
## Tu jugada
Qué hace en el tablero y qué intención tenía. 2-3 frases.

## Por qué {es buena|falla}
El motivo real, ligado a la evaluación. Si pierde ventaja, di exactamente qué se rompe: qué pieza queda suelta, qué casilla cedes, qué plan del rival habilitas. 3-4 frases.

## Lo que era mejor
Solo si el motor dio una jugada mejor. Explica la IDEA de esa jugada, no la repitas en notación sin más. Si tu jugada ya era la mejor, escribe aquí qué plan sigue después. 2-3 frases.

## La jugada del rival
Qué busca su última jugada y qué amenaza deja. Si no hay jugada del rival todavía, explica qué te va a intentar hacer. 2-3 frases.

## Para recordar
Una sola frase: la regla o patrón que te llevas de esta posición.`;

// Arma el mensaje de usuario con los hechos del motor. `ctx` lo llena main.js.
export function buildReviewPrompt(ctx) {
  const {
    myColor, opening, phase, material, history,
    myMoveSan, categoryLabel, cpl, evalBefore, evalAfter,
    bestSan, bestLine, legalSans,
    rivalMoveSan, rivalPlan, threatSan, myBestNow, hanging,
    localWhy,
  } = ctx;

  const colorName = myColor === 'w' ? 'blancas' : 'negras';
  const lines = [];

  lines.push(`PARTIDA: juegas con ${colorName}. Fase: ${phase}. Material: ${material}.`);
  if (opening) lines.push(`APERTURA: ${opening}.`);
  lines.push(`ÚLTIMAS JUGADAS: ${list(history)}`);
  lines.push('');

  lines.push(`TU JUGADA: ${myMoveSan}`);
  lines.push(`CLASIFICACIÓN DEL MOTOR: ${categoryLabel}${cpl > 0 ? ` (pierdes ${(cpl / 100).toFixed(2)} peones)` : ''}`);
  lines.push(`EVALUACIÓN ANTES (tu punto de vista): ${pawns(evalBefore)}`);
  lines.push(`EVALUACIÓN DESPUÉS (tu punto de vista): ${pawns(evalAfter)}`);
  lines.push('');

  if (bestSan && bestSan !== myMoveSan) {
    lines.push(`MEJOR JUGADA SEGÚN EL MOTOR: ${bestSan}`);
    lines.push(`LÍNEA PRINCIPAL DEL MOTOR: ${list(bestLine)}`);
  } else {
    lines.push('MEJOR JUGADA SEGÚN EL MOTOR: era la que jugaste.');
    if (bestLine && bestLine.length) lines.push(`CONTINUACIÓN PREVISTA: ${list(bestLine)}`);
  }
  lines.push('');

  if (rivalMoveSan) {
    lines.push(`RESPUESTA REAL DEL RIVAL: ${rivalMoveSan}`);
    if (rivalPlan && rivalPlan.length) lines.push(`PLAN DEL RIVAL SEGÚN EL MOTOR: ${list(rivalPlan)}`);
  }
  if (threatSan) lines.push(`AMENAZA PRINCIPAL DEL RIVAL AHORA: ${threatSan}`);
  if (myBestNow && myBestNow.length) lines.push(`TU MEJOR PLAN AHORA: ${list(myBestNow)}`);
  if (hanging && hanging.length) lines.push(`PIEZAS SIN DEFENSA SUFICIENTE: ${hanging.join(', ')}`);
  lines.push('');

  if (legalSans && legalSans.length) {
    lines.push(`JUGADAS LEGALES QUE TENÍAS (única lista de notación que puedes citar además de las anteriores): ${legalSans.join(' ')}`);
    lines.push('');
  }
  if (localWhy) lines.push(`NOTA DEL ANALIZADOR LOCAL (puedes ampliarla o matizarla): ${localWhy}`);

  lines.push('');
  lines.push('Explica esta posición siguiendo el formato indicado.');

  return lines.join('\n');
}

// ---- Render ----

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Markdown mínimo: solo lo que pedimos en el formato (## títulos, **negrita**,
// listas con guion). Se escapa antes, así que la respuesta del modelo no puede
// inyectar HTML en la página.
export function renderAiHtml(text) {
  const out = [];
  let inList = false;
  for (const raw of esc(text).split('\n')) {
    const line = raw.trim();
    if (!line) { if (inList) { out.push('</ul>'); inList = false; } continue; }

    const bold = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

    if (line.startsWith('## ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h4 class="ai-h">${bold(line.slice(3))}</h4>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) { out.push('<ul class="ai-ul">'); inList = true; }
      out.push(`<li>${bold(line.replace(/^[-*]\s+/, ''))}</li>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${bold(line)}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('');
}
