// Sección "Enseñar aperturas": lecciones guiadas, jugada a jugada.
//
// No usa el motor: todo el temario está escrito en courses.js, así que la
// respuesta es inmediata y funciona igual sin conexión. El entrenador comparte
// el tablero y la instancia de chess.js con la partida (igual que el modo
// puzzle) y se activa con la clase `opening-mode` en el body.
//
// Ciclo de una lección:
//   1. El rival juega solo sus jugadas, explicando cada una.
//   2. Cuando te toca, te hace una pregunta guía en vez de darte la jugada.
//   3. Si aciertas, te explica el porqué; si fallas, te explica qué falla en tu
//      jugada (y si es un error típico, te enseña el castigo en el tablero).
//   4. Al terminar, resume las ideas y guarda el progreso.
import { Chess } from '../vendor/chess.mjs';
import { COURSES, getCourse, getLine, lineSteps, moveLabel } from './courses.js';
import { playMove } from './sounds.js';

const KEY = 'entrenador-ajedrez-aperturas';
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RIVAL_PAUSE = 700;   // pausa antes de cada jugada del rival
const WRONG_PAUSE = 950;   // cuánto se ve tu jugada equivocada
const PUNISH_PAUSE = 1900; // cuánto se ve el castigo del error

const PIEZAS = { p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey' };

// ---- Progreso en localStorage ----
function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch (_) { return {}; }
}

function saveProgress(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (_) {}
}

export function lineProgress(lineId) {
  return loadProgress()[lineId] || null;
}

function recordDone(lineId, solo) {
  const map = loadProgress();
  const prev = map[lineId] || { veces: 0, solo: false };
  map[lineId] = { veces: prev.veces + 1, solo: prev.solo || !!solo, fecha: Date.now() };
  saveProgress(map);
  return map[lineId];
}

// Lecciones completadas de un curso (y cuántas sin ninguna ayuda).
export function courseStats(course) {
  const map = loadProgress();
  let done = 0;
  let solo = 0;
  for (const line of course.lines) {
    const p = map[line.id];
    if (!p) continue;
    done++;
    if (p.solo) solo++;
  }
  return { done, solo, total: course.lines.length };
}

// ---- Menú del temario (se pinta en el modal) ----
export function renderCourseMenu(container, onStart) {
  container.innerHTML = '';
  for (const course of COURSES) {
    const st = courseStats(course);
    const box = document.createElement('div');
    box.className = 'tc-course';
    box.innerHTML =
      `<div class="tc-head">` +
      `<div><div class="tc-title">${course.title}</div>` +
      `<div class="tc-sub">${course.subtitle}</div></div>` +
      `<div class="tc-count">${st.done}/${st.total}</div>` +
      `</div>` +
      `<div class="tc-intro">${course.intro}</div>` +
      `<details class="tc-ideas"><summary>Ideas clave de la apertura</summary><ul>` +
      course.ideas.map((i) => `<li>${i}</li>`).join('') +
      `</ul></details>`;

    const list = document.createElement('div');
    list.className = 'tc-lines';
    course.lines.forEach((line, i) => {
      const p = lineProgress(line.id);
      const row = document.createElement('button');
      row.className = 'tc-line' + (p ? ' tc-done' : '');
      row.dataset.course = course.id;
      row.dataset.line = line.id;
      const marca = p ? (p.solo ? '🏆' : '✓') : String(i + 1);
      const estado = p
        ? (p.solo ? 'Completada sin ayudas' : `Completada ${p.veces} ${p.veces === 1 ? 'vez' : 'veces'}`)
        : 'Sin empezar';
      row.innerHTML =
        `<span class="tc-mark">${marca}</span>` +
        `<span class="tc-linebody">` +
        `<span class="tc-linetitle">${line.title}</span>` +
        `<span class="tc-lineshort">${line.short}</span>` +
        `<span class="tc-linestate">${estado} · ${lineSteps(line).length} jugadas</span>` +
        `</span>` +
        `<span class="tc-go">▶</span>`;
      row.addEventListener('click', () => onStart(course.id, line.id));
      list.appendChild(row);
    });

    box.appendChild(list);
    container.appendChild(box);
  }
}

export class OpeningTrainer {
  // opts: { chess, board:()=>Board, setStatus(text,thinking), onExit(), onMenu() }
  constructor(opts) {
    this.chess = opts.chess;
    this.getBoard = opts.board;
    this.setStatus = opts.setStatus || (() => {});
    this.onExitCb = opts.onExit || (() => {});
    this.onMenuCb = opts.onMenu || (() => {});

    this.active = false;
    this.busy = false;
    this.finished = false;
    this.course = null;
    this.line = null;
    this.steps = [];
    this.ply = 0;          // índice de la jugada que toca ahora
    this.guided = true;    // "guiarme": dibuja la flecha y revela la jugada
    this.usedHelp = false;
    this.errors = 0;
    this.wrong = null;     // { san, text, punishSan } mientras se explica un fallo
    this.hintLevel = 0;
    this.lastRivalIdx = -1; // última jugada del rival (para ofrecer sus alternativas)
    this.focusIdx = -1;     // jugada cuya explicación se muestra
  }

  get board() { return this.getBoard(); }

  // ---- Ciclo de vida ----
  start(courseId, lineId, { guided, fromPly = 0 } = {}) {
    const course = getCourse(courseId);
    const line = getLine(courseId, lineId);
    if (!course || !line) return false;

    this.course = course;
    this.line = line;
    this.steps = lineSteps(line);
    this.ply = 0;
    this.finished = false;
    this.busy = false;
    this.usedHelp = false;
    this.errors = 0;
    this.wrong = null;
    this.hintLevel = 0;
    this.lastRivalIdx = -1;
    this.focusIdx = -1;
    if (typeof guided === 'boolean') this.guided = guided;
    else if (fromPly === 0) this.guided = !lineProgress(line.id); // guía la primera vez

    this.active = true;
    document.body.classList.add('opening-mode');
    $('trainerPanel').classList.remove('hidden');
    $('trGuided').checked = this.guided;

    // Posición inicial (o avance instantáneo al saltar a una variante).
    this.chess.reset();
    for (let i = 0; i < fromPly && i < this.steps.length; i++) {
      const s = this.steps[i];
      this.chess.move(s.san);
      this.ply = i + 1;
      this.focusIdx = i;
      if (s.color !== this.course.side) this.lastRivalIdx = i;
    }

    const b = this.board;
    b.setOrientation(course.side);
    b.clearBadges();
    b.clearArrows();
    b.render(this.chess.board());
    const last = this.ply > 0 ? this.steps[this.ply - 1] : null;
    if (last) b.highlightLast(last.from, last.to);
    else b.clearLast();

    this.render();
    this._advance();
    return true;
  }

  restart() {
    if (!this.active) return;
    this.start(this.course.id, this.line.id, { guided: this.guided });
  }

  // Salta a la lección que cubre una respuesta alternativa del rival,
  // reanudando desde la misma posición.
  jumpToAlt(lineId, plyIdx) {
    if (!this.active) return;
    this.start(this.course.id, lineId, { guided: this.guided, fromPly: plyIdx });
  }

  // Pasa a la lección siguiente del curso; si era la última, vuelve al temario.
  next() {
    if (!this.active || !this.finished) return;
    const lines = this.course.lines;
    const i = lines.findIndex((l) => l.id === this.line.id);
    if (i >= 0 && i < lines.length - 1) {
      const siguiente = lines[i + 1];
      this.start(this.course.id, siguiente.id, { guided: !lineProgress(siguiente.id) });
    } else {
      this.exit();
      this.onMenuCb();
    }
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.busy = false;
    this.finished = false;
    document.body.classList.remove('opening-mode');
    $('trainerPanel').classList.add('hidden');
    const b = this.board;
    b.clearArrows();
    b.clearBadges();
    this.onExitCb();
  }

  // Color que puede mover: solo el tuyo, solo cuando toca.
  movableColor() {
    if (!this.active || this.busy || this.finished) return null;
    const step = this.steps[this.ply];
    if (!step || step.color !== this.course.side) return null;
    return this.course.side;
  }

  setGuided(on) {
    this.guided = !!on;
    if (!this.active) return;
    const step = this.steps[this.ply];
    if (!this.finished && !this.busy && step && step.color === this.course.side) {
      if (this.guided) this.board.showArrow(step.from, step.to, 'best');
      else this.board.clearArrows();
    }
    this.render();
  }

  // ---- Avance de la línea ----
  async _advance() {
    if (!this.active || this.busy) return;
    this.busy = true;
    try {
      while (this.active && this.ply < this.steps.length) {
        const step = this.steps[this.ply];
        if (step.color === this.course.side) break; // te toca
        this.setStatus('Lección · juega el rival', true);
        await sleep(this.ply === 0 ? 300 : RIVAL_PAUSE);
        if (!this.active) return;
        this._apply(step, true);
        this.render();
      }
    } finally {
      this.busy = false;
    }
    if (!this.active) return;
    if (this.ply >= this.steps.length) this._finish();
    else this._prompt();
  }

  _apply(step, animate) {
    const m = this.chess.move(step.san);
    if (!m) return false;
    const b = this.board;
    b.render(this.chess.board());
    b.highlightLast(m.from, m.to);
    if (animate) b.animateMove(m.from, m.to);
    b.clearArrows();
    playMove(m);
    this.ply = step.idx + 1;
    this.focusIdx = step.idx;
    this.wrong = null;
    this.hintLevel = 0;
    if (step.color !== this.course.side) this.lastRivalIdx = step.idx;
    return true;
  }

  _prompt() {
    const step = this.steps[this.ply];
    if (!step) return;
    if (this.guided) this.board.showArrow(step.from, step.to, 'best');
    this.setStatus('Lección · te toca jugar', false);
    this.render();
  }

  _finish() {
    this.finished = true;
    this.board.clearArrows();
    recordDone(this.line.id, !this.usedHelp);
    this.setStatus('Lección completada', false);
    this.render();
  }

  // ---- Tu jugada ----
  onMove(from, to, promo) {
    if (!this.active || this.busy || this.finished) return;
    const step = this.steps[this.ply];
    if (!step || step.color !== this.course.side) return;
    const acierto = from === step.from && to === step.to &&
      (!step.promotion || step.promotion === promo);
    if (acierto) {
      this._apply(step, false);
      this.render();
      this._advance();
      return;
    }
    this._wrong(from, to, promo);
  }

  async _wrong(from, to, promo) {
    const step = this.steps[this.ply];
    const tmp = new Chess(this.chess.fen());
    let m = null;
    try { m = tmp.move({ from, to, promotion: promo || 'q' }); } catch (_) { m = null; }
    if (!m) return;

    const trap = (step.traps || {})[m.san] || null;
    this.errors++;
    this.usedHelp = true;
    this.busy = true;
    this.wrong = { san: m.san, text: trap ? trap.text : null };

    const b = this.board;
    b.clearArrows();
    this.chess.load(tmp.fen());
    b.render(this.chess.board());
    b.highlightLast(m.from, m.to);
    playMove(m);
    this.render();
    await sleep(WRONG_PAUSE);
    if (!this.active) return;

    // Si es un error típico con castigo, enséñalo en el tablero.
    if (trap && trap.punish) {
      const pg = new Chess(this.chess.fen());
      let pm = null;
      try { pm = pg.move(trap.punish); } catch (_) { pm = null; }
      if (pm) {
        this.chess.load(pg.fen());
        b.render(this.chess.board());
        b.highlightLast(pm.from, pm.to);
        b.animateMove(pm.from, pm.to);
        playMove(pm);
        this.wrong.punishSan = pm.san;
        this.render();
        await sleep(PUNISH_PAUSE);
        if (!this.active) return;
      }
    }

    // Vuelve a tu turno para que lo intentes otra vez.
    this.chess.load(step.fenBefore);
    b.render(this.chess.board());
    const prev = step.idx > 0 ? this.steps[step.idx - 1] : null;
    if (prev) b.highlightLast(prev.from, prev.to);
    else b.clearLast();
    this.busy = false;
    this._prompt();
  }

  // ---- Ayudas ----
  hint() {
    if (!this.active || this.busy || this.finished) return;
    const step = this.steps[this.ply];
    if (!step || step.color !== this.course.side) return;
    this.usedHelp = true;
    this.hintLevel = Math.min(2, this.hintLevel + 1);
    if (this.hintLevel >= 2) this.board.showArrow(step.from, step.to, 'best');
    this.render();
  }

  reveal() {
    if (!this.active || this.busy || this.finished) return;
    const step = this.steps[this.ply];
    if (!step || step.color !== this.course.side) return;
    this.usedHelp = true;
    this.hintLevel = 3; // revelada
    this.board.showArrow(step.from, step.to, 'best');
    this.render();
  }

  // Vuelve a mostrar la explicación de una jugada ya vista.
  showMoveInfo(idx) {
    if (!this.active) return;
    if (idx < 0 || idx >= this.steps.length) return;
    if (idx >= this.ply && !this.finished) return; // aún no la has visto
    this.focusIdx = idx;
    this.render();
  }

  // ---- Pintado del panel ----
  render() {
    if (!this.active) return;
    const total = this.steps.length;
    const hechas = Math.min(this.ply, total);
    $('trTitle').innerHTML =
      `<span class="tr-course">${this.course.title}</span><span class="tr-line">${this.line.title}</span>`;
    $('trBarFill').style.width = Math.round((hechas / total) * 100) + '%';
    $('trBarLabel').textContent = this.finished
      ? '¡Lección completada!'
      : `Jugada ${hechas} de ${total}`;
    this._renderStep();
    this._renderWrong();
    this._renderAsk();
    this._renderLast();
    this._renderAlts();
    this._renderMoves();
    this._renderDone();
    this._renderButtons();
  }

  _myTurn() {
    const step = this.steps[this.ply];
    return !!step && !this.finished && step.color === this.course.side;
  }

  _renderStep() {
    const el = $('trStep');
    if (this.finished) {
      el.className = 'tr-step tr-ok';
      el.innerHTML = '✅ <b>Lección completada</b>';
      return;
    }
    if (this.busy && this.wrong) {
      el.className = 'tr-step tr-bad';
      el.innerHTML = `✕ <b>${this.wrong.san}</b> no es la jugada de esta línea`;
      return;
    }
    if (this._myTurn()) {
      const step = this.steps[this.ply];
      const revelada = this.guided || this.hintLevel >= 3;
      el.className = 'tr-step tr-turn';
      el.innerHTML = revelada
        ? `🎯 Te toca: juega <b>${moveLabel(step.idx)}${step.san}</b>`
        : '🎯 <b>Te toca jugar.</b> Piensa antes de mover';
      return;
    }
    el.className = 'tr-step';
    el.innerHTML = '⏳ Juega el rival…';
  }

  _renderWrong() {
    const el = $('trWrong');
    if (!this.wrong) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const w = this.wrong;
    const step = this.steps[this.ply];
    let html = `<div class="tr-wrong-head">Tu jugada: <b>${w.san}</b></div>`;
    if (w.text) {
      html += `<div class="tr-wrong-text">${w.text}</div>`;
      if (w.punishSan) html += `<div class="tr-punish">Míralo en el tablero: el rival responde <b>${w.punishSan}</b>.</div>`;
    } else {
      html += `<div class="tr-wrong-text">No es un error garrafal necesariamente, pero <b>no es la jugada de esta línea</b>. ` +
        `La idea que toca aquí es otra: ${step && step.ask ? step.ask : 'piénsalo otra vez'}</div>`;
    }
    html += `<div class="tr-retry">↩ Vuelves a tu turno: inténtalo de nuevo.</div>`;
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  _renderAsk() {
    const el = $('trAsk');
    if (!this._myTurn() || this.busy) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const step = this.steps[this.ply];
    let html = `<div class="tr-ask-q">🤔 ${step.ask || '¿Qué jugarías aquí?'}</div>`;
    if (this.hintLevel >= 1 && this.hintLevel < 3) {
      const pieza = PIEZAS[this._pieceTypeAt(step.from)] || 'pieza';
      html += `<div class="tr-hint">💡 Pista: mueve el <b>${pieza}</b> de <b>${step.from}</b>.` +
        (this.hintLevel >= 2 ? ' La flecha te marca a dónde.' : ' Pulsa Pista otra vez para ver a dónde.') +
        `</div>`;
    }
    if (this.hintLevel >= 3) {
      html += `<div class="tr-hint">👁 La jugada es <b>${step.san}</b>. Hazla en el tablero para seguir.</div>`;
    }
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  _pieceTypeAt(square) {
    const p = this.chess.get(square);
    return p ? p.type : null;
  }

  _renderLast() {
    const el = $('trLast');
    const idx = this.focusIdx;
    if (idx < 0 || idx >= this.steps.length) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const step = this.steps[idx];
    const mia = step.color === this.course.side;
    // focusIdx solo apunta a jugadas ya jugadas, así que aquí nunca se revela
    // la explicación de la jugada que todavía tienes que encontrar.
    let html =
      `<div class="tr-last-head">` +
      `<span class="tr-mv">${moveLabel(idx)}${step.san}</span>` +
      `<span class="tr-who">${mia ? 'tu jugada' : 'el rival'}</span>` +
      (step.tag === 'clave' ? `<span class="tr-chip">★ jugada clave</span>` : '') +
      `</div>` +
      `<div class="tr-why">${step.why}</div>`;
    if (step.plan) html += `<div class="tr-plan">🧭 ${step.plan}</div>`;
    if (step.also) html += `<div class="tr-also">ℹ️ ${step.also}</div>`;
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  _renderAlts() {
    const el = $('trAlts');
    const idx = this.lastRivalIdx;
    const step = idx >= 0 ? this.steps[idx] : null;
    const alts = step && step.alts ? step.alts : null;
    if (!alts || !alts.length || this.busy) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.innerHTML =
      `<div class="tr-alts-label">¿Y si el rival juega otra cosa en ${moveLabel(idx)}?</div>` +
      `<div class="tr-alts-list"></div>`;
    const list = el.querySelector('.tr-alts-list');
    for (const alt of alts) {
      const row = document.createElement(alt.goto ? 'button' : 'div');
      row.className = 'tr-alt' + (alt.goto ? ' tr-alt-go' : '');
      row.innerHTML =
        `<span class="tr-alt-san">${moveLabel(idx)}${alt.san}</span>` +
        `<span class="tr-alt-body"><b>${alt.name}</b> — ${alt.note}` +
        (alt.goto ? `<span class="tr-alt-cta">Ver esta lección ▶</span>` : '') +
        `</span>`;
      if (alt.goto) row.addEventListener('click', () => this.jumpToAlt(alt.goto, idx));
      list.appendChild(row);
    }
    el.classList.remove('hidden');
  }

  _renderMoves() {
    const el = $('trMoves');
    const revelar = this.guided || this.finished;
    let html = '';
    this.steps.forEach((step, i) => {
      if (i % 2 === 0) html += `<span class="tr-num">${Math.floor(i / 2) + 1}.</span>`;
      const jugada = i < this.ply;
      const clases = ['tr-tok'];
      if (jugada) clases.push('tr-tok-played');
      if (i === this.focusIdx) clases.push('tr-tok-focus');
      if (step.color === this.course.side) clases.push('tr-tok-mine');
      if (!jugada && !revelar) {
        html += `<span class="tr-tok tr-tok-hidden">···</span>`;
        return;
      }
      html += `<span class="${clases.join(' ')}" data-idx="${i}">${step.san}</span>`;
    });
    el.innerHTML = html;
    el.querySelectorAll('.tr-tok-played').forEach((tok) => {
      tok.addEventListener('click', () => this.showMoveInfo(parseInt(tok.dataset.idx, 10)));
    });
  }

  _renderDone() {
    const el = $('trDone');
    if (!this.finished) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    let nota;
    if (!this.usedHelp) nota = '🏆 <b>Perfecta:</b> la línea entera de memoria, sin fallos ni ayudas.';
    else if (this.errors === 0) nota = '👍 Completada con ayuda. Repítela sin la guía para fijarla.';
    else nota = `👍 Completada con <b>${this.errors}</b> ${this.errors === 1 ? 'intento fallido' : 'intentos fallidos'}. Repítela hasta que salga sola.`;
    el.innerHTML =
      `<div class="tr-done-note">${nota}</div>` +
      `<div class="tr-keys-label">Lo que tienes que recordar</div>` +
      `<ul class="tr-keys">${this.line.keys.map((k) => `<li>${k}</li>`).join('')}</ul>` +
      `<div class="tr-done-tip">Pulsa una jugada de arriba para releer su explicación.</div>`;
    el.classList.remove('hidden');
  }

  _renderButtons() {
    const puedeAyuda = this._myTurn() && !this.busy;
    $('btnTrHint').disabled = !puedeAyuda;
    $('btnTrShow').disabled = !puedeAyuda || this.hintLevel >= 3;
    const lines = this.course.lines;
    const i = lines.findIndex((l) => l.id === this.line.id);
    const ultima = i >= lines.length - 1;
    const next = $('btnTrNext');
    next.disabled = !this.finished;
    // Solo destaca como acción principal cuando de verdad se puede pulsar.
    next.classList.toggle('primary', this.finished);
    next.textContent = ultima ? '🏁 Volver al temario' : '⏭ Siguiente lección';
  }
}
