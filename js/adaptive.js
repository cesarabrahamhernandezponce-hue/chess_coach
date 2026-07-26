// Elo adaptativo: la app mantiene una estimación de TU nivel en localStorage y,
// tras cada partida terminada, la actualiza con la fórmula de Elo según el
// resultado contra el rival. La próxima partida sugiere un rival a tu altura.

const KEY = 'entrenador-ajedrez-elo';
const DEFAULT_ELO = 1200;
const MIN = 800, MAX = 2800;      // rango del estimado del jugador
export const ENGINE_MIN = 1320;    // suelo de fuerza del motor (UCI_Elo)
const K = 40;                      // factor K: convergencia rápida con pocas partidas

function clampMy(elo) { return Math.min(MAX, Math.max(MIN, Math.round(elo))); }

// Estimación actual de tu nivel (Elo).
export function getMyElo() {
  try {
    const v = parseInt(localStorage.getItem(KEY), 10);
    if (Number.isFinite(v)) return clampMy(v);
  } catch (_) {}
  return DEFAULT_ELO;
}

// Fija la estimación (p. ej. al elegir manualmente una fuerza). Devuelve el valor guardado.
export function setMyElo(elo) {
  const v = clampMy(elo);
  try { localStorage.setItem(KEY, String(v)); } catch (_) {}
  return v;
}

// Elo de rival recomendado para la próxima partida (respeta el suelo del motor).
export function suggestedRivalElo() {
  return Math.min(MAX, Math.max(ENGINE_MIN, getMyElo()));
}

const SCORE = { win: 1, draw: 0.5, loss: 0 };
export function outcomeScore(outcome) { return SCORE[outcome]; }

// Actualiza tu estimación tras una partida contra un rival de `rivalElo`.
// `score`: 1 victoria, 0.5 tablas, 0 derrota (desde tu POV). Devuelve el nuevo Elo.
export function updateElo(rivalElo, score) {
  const my = getMyElo();
  const expected = 1 / (1 + Math.pow(10, (rivalElo - my) / 400));
  return setMyElo(my + K * (score - expected));
}
