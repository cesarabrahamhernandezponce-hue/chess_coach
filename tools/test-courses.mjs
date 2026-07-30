// Verifica el temario de "Enseñar aperturas": legalidad de todas las lecciones,
// que cada jugada la haga el bando correcto, que los errores de `traps` y las
// respuestas de `alts` sean jugadas legales, y que los saltos entre lecciones
// (`goto`) apunten a una línea que comparte el mismo prefijo de jugadas.
import { Chess } from '../vendor/chess.mjs';
import { COURSES, getCourse, getLine, lineSteps, moveLabel, totalLines } from '../js/courses.js';

let ok = 0;
let fail = 0;

function check(cond, msg) {
  if (cond) { ok++; } else { fail++; console.error('  ✗ ' + msg); }
}

console.log('Verificando el temario de aperturas...\n');

check(COURSES.length > 0, 'hay cursos');
const ids = COURSES.map((c) => c.id);
check(new Set(ids).size === ids.length, 'los ids de curso son únicos');

for (const course of COURSES) {
  console.log(`  ${course.title} (${course.side === 'w' ? 'blancas' : 'negras'}) — ${course.lines.length} lecciones`);
  check(course.side === 'w' || course.side === 'b', `${course.id}: side válido`);
  check(!!course.intro, `${course.id}: tiene intro`);
  check(Array.isArray(course.ideas) && course.ideas.length >= 3, `${course.id}: tiene ideas clave`);

  const lineIds = course.lines.map((l) => l.id);
  check(new Set(lineIds).size === lineIds.length, `${course.id}: ids de lección únicos`);

  for (const line of course.lines) {
    const tag = `${course.id}/${line.id}`;
    check(!!line.title && !!line.short, `${tag}: tiene título y descripción`);
    check(Array.isArray(line.keys) && line.keys.length >= 3, `${tag}: tiene resumen de ideas (keys)`);

    // 1) Toda la secuencia es legal (lineSteps lanza si no lo es).
    let steps = null;
    try {
      steps = lineSteps(line);
      check(true, `${tag}: secuencia legal (${steps.length} jugadas)`);
    } catch (e) {
      check(false, `${tag}: ${e.message}`);
      continue;
    }

    check(steps.length >= 8, `${tag}: la lección tiene al menos 8 jugadas`);

    for (const step of steps) {
      const esperado = step.idx % 2 === 0 ? 'w' : 'b';
      check(step.color === esperado, `${tag}: ${moveLabel(step.idx)}${step.san} le toca a ${esperado}`);

      const mias = step.color === course.side;

      // 2) Cada jugada tiene explicación; las tuyas, además, pregunta guía.
      check(!!step.why, `${tag}: ${moveLabel(step.idx)}${step.san} tiene "why"`);
      if (mias) check(!!step.ask, `${tag}: ${moveLabel(step.idx)}${step.san} (tuya) tiene "ask"`);

      // 3) `alts` solo en jugadas del rival; `traps` solo en las tuyas.
      if (step.alts) check(!mias, `${tag}: ${moveLabel(step.idx)}${step.san} tiene alts y es del rival`);
      if (step.traps) check(mias, `${tag}: ${moveLabel(step.idx)}${step.san} tiene traps y es tuya`);

      // 4) Los errores típicos son jugadas legales y distintas de la correcta.
      for (const [san, trap] of Object.entries(step.traps || {})) {
        const g = new Chess(step.fenBefore);
        let m = null;
        try { m = g.move(san); } catch (_) { m = null; }
        check(!!m, `${tag}: trampa "${san}" en ${moveLabel(step.idx)} es jugada legal`);
        check(san !== step.san, `${tag}: trampa "${san}" no es la jugada correcta`);
        check(!!(trap && trap.text), `${tag}: trampa "${san}" tiene explicación`);
        if (m && trap && trap.punish) {
          const g2 = new Chess(g.fen());
          let p = null;
          try { p = g2.move(trap.punish); } catch (_) { p = null; }
          check(!!p, `${tag}: castigo "${trap.punish}" tras "${san}" es legal`);
        }
      }

      // 5) Las respuestas alternativas del rival son legales, distintas de la
      //    jugada principal, y si tienen `goto` la lección destino existe,
      //    comparte prefijo y juega justo esa alternativa en ese punto.
      for (const alt of step.alts || []) {
        const g = new Chess(step.fenBefore);
        let m = null;
        try { m = g.move(alt.san); } catch (_) { m = null; }
        check(!!m, `${tag}: alternativa "${alt.san}" en ${moveLabel(step.idx)} es legal`);
        check(alt.san !== step.san, `${tag}: alternativa "${alt.san}" no es la jugada principal`);
        check(!!alt.name && !!alt.note, `${tag}: alternativa "${alt.san}" tiene nombre y nota`);
        if (!alt.goto) continue;
        const dest = getLine(course.id, alt.goto);
        check(!!dest, `${tag}: goto "${alt.goto}" existe en el curso`);
        if (!dest) continue;
        const dSteps = lineSteps(dest);
        check(dSteps.length > step.idx, `${tag}: goto "${alt.goto}" llega hasta la jugada ${step.idx + 1}`);
        if (dSteps.length <= step.idx) continue;
        const prefijoIgual = dSteps.slice(0, step.idx).every((s, i) => s.san === steps[i].san);
        check(prefijoIgual, `${tag}: goto "${alt.goto}" comparte el prefijo de jugadas`);
        check(dSteps[step.idx].san === alt.san,
          `${tag}: goto "${alt.goto}" juega "${alt.san}" en ${moveLabel(step.idx)} (juega "${dSteps[step.idx].san}")`);
        check(dSteps[step.idx].fenBefore === step.fenBefore, `${tag}: goto "${alt.goto}" parte de la misma posición`);
      }
    }
  }
}

// 6) Cada curso empieza por su apertura: 1.d4 d5 2.c4 en las dos.
for (const course of COURSES) {
  for (const line of course.lines) {
    const s = lineSteps(line).map((x) => x.san);
    check(s[0] === 'd4' && s[1] === 'd5' && s[2] === 'c4',
      `${course.id}/${line.id}: empieza con 1.d4 d5 2.c4`);
  }
}

// 7) Helpers.
check(getCourse('gd-blancas') !== null, 'getCourse encuentra el curso del Gambito de Dama');
check(getCourse('no-existe') === null, 'getCourse devuelve null si no existe');
check(getLine('gd-blancas', 'gda') !== null, 'getLine encuentra la lección del GDA');
check(moveLabel(0) === '1.' && moveLabel(1) === '1…' && moveLabel(2) === '2.', 'moveLabel numera bien');
check(totalLines() === COURSES.reduce((n, c) => n + c.lines.length, 0), 'totalLines cuadra');

console.log(`\nResultado: ${ok} correctas, ${fail} fallidas`);
process.exit(fail === 0 ? 0 : 1);
