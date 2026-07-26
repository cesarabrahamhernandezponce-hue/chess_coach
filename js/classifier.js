// Clasificación de jugadas al estilo Chess.com / Lichess.
// Todo el cálculo se hace en centipawns desde MI perspectiva (la del que acaba de mover).

export const CATEGORIES = {
  book:        { key: 'book',        label: 'Jugada de libro', short: '',   icon: '📖', clase: 'cat-book' },
  brilliant:   { key: 'brilliant',   label: 'Brillante',       short: '!!', icon: '💎', clase: 'cat-brilliant' },
  great:       { key: 'great',       label: 'Gran jugada',     short: '!',  icon: '❗', clase: 'cat-great' },
  best:        { key: 'best',        label: 'Mejor jugada',    short: '',   icon: '⭐', clase: 'cat-best' },
  excellent:   { key: 'excellent',   label: 'Excelente',       short: '',   icon: '✓', clase: 'cat-excellent' },
  good:        { key: 'good',        label: 'Buena',           short: '',   icon: '·', clase: 'cat-good' },
  inaccuracy:  { key: 'inaccuracy',  label: 'Imprecisión',     short: '?!', icon: '⚠️', clase: 'cat-inaccuracy' },
  mistake:     { key: 'mistake',     label: 'Error',           short: '?',  icon: '✕', clase: 'cat-mistake' },
  blunder:     { key: 'blunder',     label: 'Error grave',     short: '??', icon: '⁉️', clase: 'cat-blunder' },
};

// Orden canónico de mejor a peor, para tablas de resumen y perfiles.
export const CATEGORY_ORDER = ['book', 'brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];

// Parámetros de detección de brillante / gran jugada. Conservadores a propósito:
// preferimos NO premiar de más antes que dar un falso positivo.
const BRILLIANT = {
  maxCpl: 30,        // la jugada debe ser la mejor o casi (pérdida <= 0.3)
  minSacMaterial: 2, // material entregado (SEE) >= ~una pieza menor / calidad
  minEvalAfter: -30, // el sacrificio debe ser sano: no me hundo por debajo de la igualdad
  maxEvalBefore: 700,// si ya ganaba por goleada (>7), un sacrificio no es "brillante"
};
const GREAT = {
  minGap: 250,        // la 2ª mejor jugada debe ser >= 2.5 peor: era la única buena
  maxEvalBefore: 900, // no premiar en posiciones ya totalmente decididas
};

// Umbrales de pérdida en centipawns (cpl).
const UMBRALES = [
  { max: 25,  key: 'excellent' },
  { max: 60,  key: 'good' },
  { max: 120, key: 'inaccuracy' },
  { max: 270, key: 'mistake' },
];

// ¿La jugada es un sacrificio sano y brillante?
//   sacMaterial:  material que el rival puede ganar por captura tras mi jugada (SEE, >=0).
//   evalBeforeMe/evalAfterMe: cp desde mi POV antes/después.
//   cpl, isBest:  calidad de la jugada.
function isBrilliant({ sacMaterial, evalBeforeMe, evalAfterMe, cpl, isBest }) {
  if (!(isBest || cpl <= BRILLIANT.maxCpl)) return false;   // debe ser (casi) la mejor
  if (sacMaterial < BRILLIANT.minSacMaterial) return false; // debe entregar material real
  if (evalAfterMe < BRILLIANT.minEvalAfter) return false;   // el sacrificio debe ser sano
  if (evalBeforeMe > BRILLIANT.maxEvalBefore) return false; // no si ya ganaba por goleada
  return true;
}

// ¿Era la única jugada buena? (necesita la 2ª mejor del motor).
//   secondBestCp: eval de la 2ª mejor jugada, desde MI POV (>= mejor sería raro).
function isGreat({ isBest, secondBestCp, evalBeforeMe }) {
  if (!isBest || secondBestCp == null) return false;
  if (Math.abs(evalBeforeMe) > GREAT.maxEvalBefore) return false;
  return evalBeforeMe - secondBestCp >= GREAT.minGap; // la 2ª opción es mucho peor
}

// Clasifica una jugada.
//   isBook: la posición resultante está en el libro de aperturas.
//   isBest: la jugada coincide con la mejor línea del motor.
//   cpl:    pérdida en centipawns respecto a la mejor jugada (>= 0).
export function classifyMove({ isBook, isBest, cpl, sacMaterial = 0, secondBestCp = null, evalBeforeMe = 0, evalAfterMe = 0 }) {
  if (isBook) return CATEGORIES.book;
  if (isBrilliant({ sacMaterial, evalBeforeMe, evalAfterMe, cpl, isBest })) return CATEGORIES.brilliant;
  if (isGreat({ isBest, secondBestCp, evalBeforeMe })) return CATEGORIES.great;
  if (isBest) return CATEGORIES.best;
  for (const u of UMBRALES) {
    if (cpl <= u.max) return CATEGORIES[u.key];
  }
  return CATEGORIES.blunder;
}

// Convierte una evaluación (centipawns desde mi POV) a probabilidad de victoria (0-100).
// Fórmula de Lichess.
export function winPercent(cp) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

// Precisión (0-100) de una jugada a partir de la caída de win% (fórmula de Lichess).
export function moveAccuracy(winBefore, winAfter) {
  const drop = Math.max(0, winBefore - winAfter);
  const acc = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

// Calcula el análisis de una de mis jugadas.
//   evalBeforeMe: cp de la posición ANTES de mover, desde mi POV (yo estoy por mover).
//   evalAfterMe:  cp de la posición DESPUÉS de mover, desde mi POV.
//   isBook, isBest: banderas.
export function analyzeMove({ evalBeforeMe, evalAfterMe, isBook, isBest, sacMaterial = 0, secondBestCp = null }) {
  const cpl = Math.max(0, evalBeforeMe - evalAfterMe);
  const category = classifyMove({ isBook, isBest, cpl, sacMaterial, secondBestCp, evalBeforeMe, evalAfterMe });
  const winBefore = winPercent(evalBeforeMe);
  const winAfter = winPercent(evalAfterMe);
  const accuracy = moveAccuracy(winBefore, winAfter);
  return { cpl, category, winBefore, winAfter, accuracy };
}

// Resumen final: precisión media y conteo por categoría, para MIS jugadas.
export function summarize(myMoves) {
  const counts = {};
  for (const k of Object.keys(CATEGORIES)) counts[k] = 0;
  let accSum = 0;
  for (const m of myMoves) {
    counts[m.category.key]++;
    accSum += m.accuracy;
  }
  const accuracy = myMoves.length ? accSum / myMoves.length : 100;
  return { counts, accuracy, total: myMoves.length };
}

// Formatea centipawns como ventaja en peones con signo (para textos tipo "perdiste 3.2").
export function cpToPawns(cp) {
  return (cp / 100).toFixed(1);
}
