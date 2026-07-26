// Repetición espaciada (SRS) sobre los puzzles de tus errores.
// Guarda en localStorage un estado por posición (clave = FEN, la misma que usa
// puzzles.js para deduplicar). Tras resolver cada puzzle, programa cuándo te
// toca volver a verlo con un SM-2 simplificado (el algoritmo de Anki):
// cuanto mejor lo resuelves, más se espacia el repaso.

const KEY = 'entrenador-ajedrez-srs';
const DAY = 24 * 60 * 60 * 1000;

const EASE_DEFAULT = 2.5;
const EASE_MIN = 1.3;
const EASE_MAX = 2.8;

// Notas posibles al terminar un puzzle:
//   'good' -> a la primera y sin pista
//   'hard' -> resuelto pero con fallos o pista
//   'fail' -> mostraste la solución (no lo sacaste)
const GRADES = new Set(['good', 'hard', 'fail']);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch (_) { return {}; }
}

function save(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (_) {}
}

function clampEase(e) { return Math.min(EASE_MAX, Math.max(EASE_MIN, e)); }

// Estado SRS de una posición, o null si nunca se ha repasado.
export function stateFor(fen) {
  return load()[fen] || null;
}

// Registra un repaso y reprograma la posición. Devuelve el nuevo estado.
export function review(fen, grade, now = Date.now()) {
  if (!GRADES.has(grade)) grade = 'hard';
  const map = load();
  const s = map[fen] || { ease: EASE_DEFAULT, interval: 0, reps: 0, lapses: 0, due: now };

  if (grade === 'fail') {
    s.reps = 0;
    s.lapses++;
    s.ease = clampEase(s.ease - 0.2);
    s.interval = 1; // vuelve mañana
  } else {
    s.ease = clampEase(s.ease + (grade === 'good' ? 0.1 : -0.15));
    s.reps++;
    if (s.reps === 1) s.interval = 1;
    else if (s.reps === 2) s.interval = 3;
    else s.interval = Math.max(1, Math.round(s.interval * s.ease));
  }

  s.due = now + s.interval * DAY;
  map[fen] = s;
  save(map);
  return s;
}

// Separa los puzzles en los que TOCA repasar hoy (vencidos) y los NUEVOS
// (nunca vistos). Ignora los que aún no vencen. `puzzles` viene de collectPuzzles().
export function reviewQueue(puzzles, now = Date.now()) {
  const map = load();
  const due = [];
  const fresh = [];
  for (const p of puzzles) {
    const s = map[p.fen];
    if (!s) fresh.push(p);
    else if (s.due <= now) due.push({ p, due: s.due });
  }
  due.sort((a, b) => a.due - b.due); // los más vencidos primero
  return { due: due.map((x) => x.p), fresh };
}

// Cola ordenada lista para entrenar: primero vencidos, luego nuevos.
export function scheduleList(puzzles, now = Date.now()) {
  const { due, fresh } = reviewQueue(puzzles, now);
  return due.concat(fresh);
}

// Texto humano del próximo repaso a partir del intervalo en días.
export function intervalLabel(interval) {
  if (!interval || interval < 1) return 'mañana';
  if (interval === 1) return 'mañana';
  if (interval < 7) return `en ${interval} días`;
  if (interval < 30) {
    const w = Math.round(interval / 7);
    return `en ${w} ${w === 1 ? 'semana' : 'semanas'}`;
  }
  const m = Math.round(interval / 30);
  return `en ${m} ${m === 1 ? 'mes' : 'meses'}`;
}
