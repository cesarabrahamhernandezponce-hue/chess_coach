import { Chess } from '../vendor/chess.mjs';
import { UciEngine } from './engine.js';
import { Board, pieceSVG } from './board.js';
import { analyzeMove, summarize, cpToPawns, winPercent, CATEGORIES, CATEGORY_ORDER } from './classifier.js';
import { sacrificedMaterial, explainMyMove, explainBest } from './coach.js';
import { lookupOpening, isBookPosition } from './openings.js';
import Sound, { playMove } from './sounds.js';
import { loadSettings, getSettings, setSetting, BOARD_THEMES } from './settings.js';
import { addGame, deleteGame, renderLibrary } from './library.js';
import { renderProfile } from './profile.js';
import { getMyElo, setMyElo, suggestedRivalElo, updateElo, outcomeScore } from './adaptive.js';
import { collectPuzzles } from './puzzles.js';
import { review, reviewQueue, scheduleList, stateFor, intervalLabel } from './srs.js';

const ENGINE_URL = 'vendor/stockfish-18-lite-single.js';
const ANALYST_MS = 1000;   // tiempo de análisis del motor analista
const RIVAL_MS = 1000;     // tiempo de reflexión del rival
const NAV_EVAL_MS = 350;   // evaluación ligera al navegar por el árbol
const STORAGE_KEY = 'entrenador-ajedrez-partida';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Árbol de variantes ----
// Cada posición es un nodo. children[0] es la continuación principal; el resto,
// variantes. `current` es el nodo que se está viendo/jugando.
let __nid = 0;
function makeNode(parent, move, fen) {
  return {
    id: ++__nid,
    parent,
    children: [],
    move,          // { san, from, to, uci, color, promotion? } | null en la raíz
    fen,           // FEN de la posición tras la jugada (o inicial en la raíz)
    ply: parent ? parent.ply + 1 : 0,
    isMine: false,
    category: null,
    cpl: 0,
    accuracy: null,
    bestLine: null,
    why: null,       // explicación del coach (porqué de la jugada)
    evalWhite: null, // evaluación en cp, POV de las blancas, tras esta jugada
  };
}

class Game {
  constructor() {
    this.chess = new Chess();
    this.myColor = 'w';
    this.rivalElo = 2000;
    this.root = makeNode(null, null, this.chess.fen());
    this.current = this.root;
    this.pending = null;      // análisis de la posición actual (mi turno)
    this.bgPromise = null;
    this.bgFen = null;
    this.busy = false;
    this.enginesReady = false;
    this.gameOver = false;
    this.resigned = false;
    this.showArrows = false;
    this.lastOpening = null;
    this.started = false;
    this.archived = false;
    // Modo puzzle (entrenamiento con tus errores).
    this.puzzleMode = false;
    this.puzzle = null;
    this.puzzleList = [];
    this.puzzleIdx = 0;
    this.puzzleSolved = false;
    this.puzzleBusy = false;
    this.puzzleFails = 0;
  }

  // ---- Helpers de árbol ----
  pathTo(node) {
    const path = [];
    for (let n = node; n; n = n.parent) path.unshift(n);
    return path;
  }

  syncChess(node) {
    this.chess.reset();
    for (const n of this.pathTo(node)) if (n.move) this.chess.move(n.move.san);
  }

  _turnAt(node) { return node.fen.split(' ')[1] === 'w' ? 'w' : 'b'; }

  isOnMainline(node) {
    for (let n = node; n.parent; n = n.parent) {
      if (n.parent.children[0] !== n) return false;
    }
    return true;
  }

  lineEndFrom(node) {
    let n = node;
    while (n.children.length) n = n.children[0];
    return n;
  }

  async initEngines() {
    setStatus('Cargando motores…', false);
    this.rival = new UciEngine(ENGINE_URL, 'rival');
    this.analyst = new UciEngine(ENGINE_URL, 'analista');
    await Promise.all([this.rival.init(), this.analyst.init()]);
    this.analyst.setFullStrength();
    this.analyst.setOption('MultiPV', 2); // 2ª mejor línea, para detectar la "jugada única"
    console.log('[app] ambos motores UCI listos');
    setStatus('Motores listos', false);
    this.enginesReady = true;
  }

  async start(color, elo) {
    this.myColor = color;
    this.rivalElo = elo;
    this.chess.reset();
    this.root = makeNode(null, null, this.chess.fen());
    this.current = this.root;
    this.pending = null;
    this.bgPromise = null;
    this.gameOver = false;
    this.resigned = false;
    this.lastOpening = null;
    this.started = true;
    this.archived = false;
    this.lastEloChange = null;

    await Promise.all([this.rival.newGame(), this.analyst.newGame()]);
    this.rival.setElo(elo);
    // El analista ya quedó configurado (fuerza completa + MultiPV) en initEngines;
    // ucinewgame no resetea las opciones UCI, así que no hace falta repetirlas.

    board.setOrientation(this.myColor);
    this.renderAll();
    $('summary').classList.add('hidden');
    setLastClass('♟', 'Haz tu jugada', null);
    updateEvalBar(0);
    this.updateReviewBar();
    Sound.play('start');

    if (this.chess.turn() !== this.myColor) {
      await this.rivalMove(this.current);
    } else {
      this.beginMyTurn();
    }
    this.save();
  }

  renderAll() {
    board.render(this.chess.board());
    if (this.current.move) board.highlightLast(this.current.move.from, this.current.move.to);
    else board.highlightLast(null, null);
    this.renderMoveList();
    this.renderOpening();
    this.renderCaptures();
  }

  renderOpening() {
    const name = lookupOpening(this.chess.fen());
    if (name) this.lastOpening = name;
    $('openingName').textContent = this.lastOpening || '—';
  }

  renderCaptures(boardData) {
    boardData = boardData || this.chess.board();
    const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    const INIT = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const cur = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
    for (const row of boardData) for (const sq of row) if (sq && sq.type !== 'k') cur[sq.color][sq.type]++;
    const missing = (color) => {
      const m = {};
      for (const t of ['q', 'r', 'b', 'n', 'p']) m[t] = Math.max(0, INIT[t] - cur[color][t]);
      return m;
    };
    const lost = { w: missing('w'), b: missing('b') };
    let ptsW = 0, ptsB = 0;
    for (const t of ['q', 'r', 'b', 'n', 'p']) { ptsW += cur.w[t] * VALUE[t]; ptsB += cur.b[t] * VALUE[t]; }
    const diff = ptsW - ptsB;

    const bottom = board.orientation;
    const top = bottom === 'w' ? 'b' : 'w';
    const capturedBy = (side) => (side === 'w' ? lost.b : lost.w);
    const oppColor = (side) => (side === 'w' ? 'b' : 'w');
    const adv = (side) => { const d = side === 'w' ? diff : -diff; return d > 0 ? '+' + d : ''; };
    $('capturesBottom').innerHTML = capturesHtml(capturedBy(bottom), oppColor(bottom), adv(bottom));
    $('capturesTop').innerHTML = capturesHtml(capturedBy(top), oppColor(top), adv(top));
  }

  // ---- Lista de jugadas con variantes (estilo PGN clicable) ----
  renderMoveList() {
    const box = $('moveList');
    box.innerHTML = '';
    this._renderLineInto(box, this.root, true);
    if (this.isOnMainline(this.current)) box.scrollTop = box.scrollHeight;
    this.updateReviewBar();
    this.updateNavButtons();
    this.renderEvalGraph();
  }

  // Curva de evaluación (win% de las blancas) a lo largo de la línea principal.
  renderEvalGraph() {
    const card = $('evalGraphCard');
    const host = $('evalGraph');
    if (!card || !host) return;

    // Nodos de la línea principal desde la raíz.
    const line = [this.root];
    let n = this.root;
    while (n.children.length) { n = n.children[0]; line.push(n); }

    if (line.length < 2) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');

    // Serie de win% (0-100 desde POV blancas); arrastra el último valor conocido.
    let last = 50;
    const pts = line.map((node) => {
      if (node.evalWhite != null) last = winPercent(node.evalWhite);
      else if (node === this.root) last = 50;
      return last;
    });

    const W = 100, H = 40, N = pts.length - 1;
    const x = (i) => (N === 0 ? 0 : (i / N) * W);
    const y = (v) => H - (v / 100) * H;
    let d = `M ${x(0).toFixed(2)} ${y(pts[0]).toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${x(i).toFixed(2)} ${y(pts[i]).toFixed(2)}`;
    const area = `${d} L ${W} ${H} L 0 ${H} Z`;

    // Índice del nodo actual dentro de la línea principal (si está en ella).
    const curIdx = line.indexOf(this.current);

    const svg =
      `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="evalgraph-svg">` +
      `<line class="eg-mid" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"/>` +
      `<path class="eg-area" d="${area}"/>` +
      `<path class="eg-line" d="${d}"/>` +
      (curIdx >= 0 ? `<line class="eg-cursor" x1="${x(curIdx).toFixed(2)}" y1="0" x2="${x(curIdx).toFixed(2)}" y2="${H}"/>` +
        `<circle class="eg-dot" cx="${x(curIdx).toFixed(2)}" cy="${y(pts[curIdx]).toFixed(2)}" r="1.6"/>` : '') +
      `</svg>`;
    host.innerHTML = svg;

    // Clic para navegar a la jugada correspondiente.
    const svgEl = host.querySelector('svg');
    svgEl.onclick = (e) => {
      const rect = svgEl.getBoundingClientRect();
      const frac = (e.clientX - rect.left) / rect.width;
      const idx = Math.round(Math.max(0, Math.min(1, frac)) * N);
      if (line[idx]) this.goTo(line[idx]);
    };
  }

  _renderLineInto(container, fromNode, forceNum) {
    let node = fromNode;
    let force = forceNum;
    while (node.children.length) {
      const main = node.children[0];
      this._emitMove(container, main, force);
      force = false;
      if (node.children.length > 1) {
        for (let i = 1; i < node.children.length; i++) {
          const v = document.createElement('div');
          v.className = 'mv-variation';
          v.appendChild(document.createTextNode('( '));
          this._emitMove(v, node.children[i], true);
          this._renderLineInto(v, node.children[i], false);
          v.appendChild(document.createTextNode(') '));
          container.appendChild(v);
        }
        force = true; // tras una variante, la siguiente jugada negra necesita número
      }
      node = main;
    }
  }

  _emitMove(container, node, forceNum) {
    const isWhite = node.move.color === 'w';
    const moveNo = Math.ceil(node.ply / 2);
    const tok = document.createElement('span');
    tok.className = 'mv-tok';
    if (isWhite || forceNum) {
      const n = document.createElement('span');
      n.className = 'mv-num-inline';
      n.textContent = moveNo + (isWhite ? '. ' : '… ');
      tok.appendChild(n);
    }
    const san = document.createElement('span');
    san.className = 'mv-san' + (node === this.current ? ' mv-current' : '');
    san.textContent = node.move.san + (node.category && node.category.short ? node.category.short : '');
    san.addEventListener('click', () => this.goTo(node));
    tok.appendChild(san);
    if (node.isMine && node.category) {
      const dot = document.createElement('span');
      dot.className = 'mv-dot ' + node.category.clase;
      tok.appendChild(document.createTextNode(' '));
      tok.appendChild(dot);
      if (node.cpl > 0 && cpToPawns(node.cpl) !== '0.0') {
        const cpl = document.createElement('span');
        cpl.className = 'mv-cpl';
        cpl.textContent = '−' + cpToPawns(node.cpl);
        tok.appendChild(cpl);
      }
    }
    container.appendChild(tok);
    container.appendChild(document.createTextNode(' '));
  }

  // ---- Navegación por el árbol ----
  goTo(node) {
    if (!node) return;
    this.current = node;
    this.syncChess(node);
    this.gameOver = this.chess.isGameOver();
    board.clearBadges();
    board.clearArrows();
    board.render(this.chess.board());
    if (node.move) board.highlightLast(node.move.from, node.move.to);
    else board.highlightLast(null, null);
    this.renderCaptures();
    this.renderOpening();
    this.renderMoveList();
    this.updateEvalForCurrent();
    this.updateNavButtons();
    this.updateReviewBar();
    this.hideRetry();
    // Reengancha el análisis si toca mover y la posición no es terminal.
    if (!this.busy && !this.gameOver && this.chess.turn() === this.myColor) {
      setLastClass('♟', 'Tu turno', null);
      this.beginMyTurn();
    } else if (!this.gameOver) {
      setLastClass('◎', 'Revisando', null);
    }
  }

  navPrev() { if (this.current.parent) this.goTo(this.current.parent); }
  navNext() { if (this.current.children.length) this.goTo(this.current.children[0]); }
  navStart() { this.goTo(this.root); }
  navEnd() { this.goTo(this.lineEndFrom(this.current)); }

  // Deshacer = retroceder hasta mi turno anterior (para replantear; la jugada
  // anterior queda como variante si juego otra cosa).
  undo() {
    if (!this.current.parent) return;
    let n = this.current.parent;
    while (n.parent && this._turnAt(n) !== this.myColor) n = n.parent;
    this.goTo(n);
  }

  // Rehacer = avanzar por la línea principal hasta mi siguiente turno.
  redo() {
    if (!this.current.children.length) return;
    let n = this.current.children[0];
    if (this._turnAt(n) !== this.myColor && n.children.length) n = n.children[0];
    this.goTo(n);
  }

  updateEvalForCurrent() {
    const node = this.current;
    if (node.evalWhite != null) { updateEvalBar(node.evalWhite); return; }
    if (node === this.root) { updateEvalBar(0); return; }
    const fen = node.fen;
    this.analyst.analyze({ fen, movetime: NAV_EVAL_MS }).then((r) => {
      const white = this._turnAt(node) === 'w' ? r.scoreCp : -r.scoreCp;
      node.evalWhite = white;
      if (this.current === node) updateEvalBar(white);
    }).catch(() => {});
  }

  // ---- Acciones sobre variantes ----
  promote() {
    // Convierte la línea actual en la principal en cada punto de bifurcación.
    for (const n of this.pathTo(this.current)) {
      const p = n.parent;
      if (!p) continue;
      const idx = p.children.indexOf(n);
      if (idx > 0) { p.children.splice(idx, 1); p.children.unshift(n); }
    }
    this.renderMoveList();
    this.updateReviewBar();
    this.save();
    setLastClass('⤴', 'Promovida a línea principal', null);
  }

  deleteFromHere() {
    const node = this.current;
    if (!node.parent) return;
    const p = node.parent;
    const idx = p.children.indexOf(node);
    if (idx >= 0) p.children.splice(idx, 1);
    this.goTo(p);
    this.save();
    setLastClass('🗑', 'Variante borrada', null);
  }

  updateNavButtons() {
    const undo = $('btnUndo'), redo = $('btnRedo');
    if (undo) undo.disabled = !this.current.parent;
    if (redo) redo.disabled = !this.current.children.length;
  }

  updateReviewBar() {
    const bar = $('reviewBar');
    if (!bar) return;
    if (!this.started) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    const end = this.lineEndFrom(this.current);
    const onMain = this.isOnMainline(this.current);
    $('revLabel').textContent = `Jugada ${this.current.ply} / ${end.ply}` + (onMain ? '' : ' · variante');
    $('revStart').disabled = !this.current.parent;
    $('revPrev').disabled = !this.current.parent;
    $('revNext').disabled = !this.current.children.length;
    $('revEnd').disabled = !this.current.children.length;
    $('revPromote').disabled = onMain;
    $('revDelete').disabled = !this.current.parent;
  }

  beginMyTurn() {
    if (this.gameOver) return;
    this.startBackgroundAnalysis();
    this.maybeShowThreat();
  }

  // Dibuja la amenaza principal del rival: su mejor jugada si le tocara mover
  // ahora (búsqueda sobre la posición con el turno invertido, "null move").
  async maybeShowThreat() {
    if (!getSettings().showThreat) return;
    const fen = this.chess.fen();
    if (this.chess.turn() !== this.myColor) return;
    // Si estoy en jaque la amenaza ya está sobre el tablero: no aporta señalarla.
    if (this.chess.inCheck()) return;
    // Espera al análisis de mi mejor jugada para no cortarlo (el motor es único).
    try { await this.bgPromise; } catch (_) {}
    if (this.gameOver || this.busy) return;
    if (this.chess.fen() !== fen || this.chess.turn() !== this.myColor) return;
    const r = await this.analyst.analyze({ fen: nullMoveFen(fen), movetime: ANALYST_MS });
    if (!r.bestmove) return;
    // La posición pudo cambiar mientras pensaba: no dibujes una flecha obsoleta.
    if (this.gameOver || this.chess.fen() !== fen || this.chess.turn() !== this.myColor) return;
    board.showArrow(r.bestmove.slice(0, 2), r.bestmove.slice(2, 4), 'threat');
  }

  startBackgroundAnalysis() {
    if (this.gameOver) return;
    const fen = this.chess.fen();
    const node = this.current; // posición a evaluar (mi turno, tras la jugada del rival)
    this.bgFen = fen;
    setStatus('Analizando la posición…', true);
    this.bgPromise = this.analyst.analyze({ fen, movetime: ANALYST_MS }).then((r) => {
      const res = { ...r, fen };
      if (this.bgFen === fen && !this.gameOver && !this.puzzleMode) {
        this.pending = res;
        // Cachea el eval a fuerza completa en el nodo: así navegar de vuelta no lo
        // recalcula a menor profundidad (NAV_EVAL_MS) y la barra/curva no "saltan".
        if (node && node.fen === fen && node.evalWhite == null) node.evalWhite = this.toWhite(res.scoreCp);
        updateEvalBar(this.toWhite(res.scoreCp));
        setStatus('Tu turno', false);
      }
      return res;
    });
  }

  toWhite(cpMine) { return this.myColor === 'w' ? cpMine : -cpMine; }

  async onMyMove(from, to, promo) {
    if (this.busy || this.gameOver) return;
    if (this.chess.turn() !== this.myColor) return;
    const parent = this.current;

    // Comprueba la jugada sobre una copia para obtener SAN/UCI.
    const tmp = new Chess(parent.fen);
    const move = tmp.move({ from, to, promotion: promo || 'q' });
    if (!move) return;
    const myUci = move.from + move.to + (move.promotion || '');
    playMove(move);
    const existing = parent.children.find((c) => c.move && c.move.uci === myUci);

    // Si ya existe esa jugada, camina por la línea conocida sin llamar al motor.
    if (existing) {
      this.hideRetry();
      let land = existing;
      if (existing.children.length && this._turnAt(existing) !== this.myColor) {
        land = existing.children[0]; // respuesta del rival ya conocida
      }
      this.goTo(land);
      if (existing.category) {
        board.showBadge(existing.move.to, existing.category);
        this.showBigClass({ category: existing.category, cpl: existing.cpl, bestLine: existing.bestLine, why: existing.why });
      }
      return;
    }

    // Rama nueva: clasifica y deja responder al rival. El try/finally garantiza
    // que `busy` se libere aunque el motor falle o agote el timeout: si no, el
    // tablero quedaría bloqueado hasta recargar.
    this.busy = true;
    this.hideRetry();
    try {
      const preFen = parent.fen;
      const postFen = tmp.fen();

      const node = makeNode(parent, {
        san: move.san, from: move.from, to: move.to, uci: myUci,
        color: move.color, promotion: move.promotion,
      }, postFen);
      node.isMine = true;
      parent.children.push(node);
      this.current = node;

      this.syncChess(node);
      board.render(this.chess.board());
      board.highlightLast(move.from, move.to);
      board.clearArrows();
      setStatus('Clasificando tu jugada…', true);

      // Evaluación ANTES de mover (mi POV).
      let pre = this.pending && this.pending.fen === preFen ? this.pending : null;
      if (!pre && this.bgPromise) {
        const r = await this.bgPromise;
        if (r.fen === preFen) pre = r;
      }
      if (!pre) pre = { ...(await this.analyst.analyze({ fen: preFen, movetime: ANALYST_MS })), fen: preFen };

      const isBest = !!pre.bestmove && myUci === pre.bestmove;
      const isBook = isBookPosition(postFen);
      const evalBeforeMe = pre.scoreCp;

      let evalAfterMe;
      let oppReplyUci = null; // mejor respuesta del rival (para explicar jugadas flojas)
      if (isBest) {
        evalAfterMe = evalBeforeMe;
      } else {
        const post = await this.analyst.analyze({ fen: postFen, movetime: ANALYST_MS });
        evalAfterMe = -post.scoreCp;
        oppReplyUci = post.bestmove;
      }

      // Material que el rival podría ganar tras mi jugada: si es alto y la evaluación
      // aguanta, fue un sacrificio sano (brillante). secondCp ya viene desde MI POV
      // (yo muevo en preFen), y sirve para detectar la "jugada única".
      const sacMaterial = isBook ? 0 : sacrificedMaterial(postFen);
      const secondBestCp = pre.secondCp;

      const analysis = analyzeMove({ evalBeforeMe, evalAfterMe, isBook, isBest, sacMaterial, secondBestCp });
      if (!isBest && !isBook && pre.bestmove) {
        analysis.bestLine = bestLineSan(preFen, pre.pv, pre.bestmove);
      }
      analysis.why = isBook
        ? 'Jugada de apertura conocida: sigue la teoría.'
        : explainMyMove({ categoryKey: analysis.category.key, move, postFen, cpl: analysis.cpl, sacMaterial, oppReplyUci });

      node.category = analysis.category;
      node.cpl = analysis.cpl;
      node.accuracy = analysis.accuracy;
      node.bestLine = analysis.bestLine || null;
      node.why = analysis.why;
      node.evalWhite = this.toWhite(evalAfterMe);

      board.showBadge(move.to, analysis.category);
      this.showBigClass(analysis);
      updateEvalBar(node.evalWhite);
      this.renderCaptures();
      this.renderMoveList();
      this.renderOpening();

      if (this.showArrows && pre.bestmove && !isBest) {
        board.showArrow(pre.bestmove.slice(0, 2), pre.bestmove.slice(2, 4));
      }

      this.pending = null;
      this.save();

      if (this.current === node && this.checkGameOver()) return;

      const bad = ['inaccuracy', 'mistake', 'blunder'].includes(analysis.category.key);
      if (bad && getSettings().repeatUntilGood && !this.gameOver) {
        await this.repeatMove(node, analysis);
        return;
      }

      await this.rivalMove(node);
    } catch (e) {
      console.error('error clasificando la jugada:', e);
      setStatus('Error analizando; tu turno', false);
    } finally {
      this.busy = false;
      this.updateNavButtons();
    }
  }

  // Modo "repetir hasta acertar": deshace una jugada floja y te devuelve a tu
  // turno para reintentar. La jugada fallida no se conserva (cada intento parte
  // limpio) y el rival no responde hasta que juegues algo bueno.
  async repeatMove(node, analysis) {
    await sleep(1100); // deja ver el badge y la clasificación un instante
    const parent = node.parent;
    const i = parent.children.indexOf(node);
    if (i >= 0) parent.children.splice(i, 1);
    this.current = parent;
    this.syncChess(parent);
    board.clearBadges();
    board.clearArrows();
    board.render(this.chess.board());
    if (parent.move) board.highlightLast(parent.move.from, parent.move.to);
    else board.highlightLast(null, null);
    this.renderCaptures();
    this.renderMoveList();
    this.updateEvalForCurrent();
    this.updateReviewBar();
    const c = analysis.category;
    const perdida = analysis.cpl > 0 ? ` (−${cpToPawns(analysis.cpl)})` : '';
    setLastClass('↻', `${c.label}${perdida}. Vuelve a intentarlo`, c);
    this.beginMyTurn();
  }

  showBigClass(analysis) {
    const c = analysis.category;
    let text = c.label;
    if (c.key === 'book') text = 'Jugada de libro' + (this.lastOpening ? ' — ' + this.lastOpening : '');
    else if (c.key === 'brilliant') text = '¡Brillante! 💎';
    else if (c.key === 'great') text = '¡Gran jugada! La única buena';
    else if (c.key === 'best') text = '¡Mejor jugada!';
    else if (analysis.cpl > 0) text = `${c.label} — perdiste ${cpToPawns(analysis.cpl)}`;
    setLastClass(c.icon, text, c);

    const whyEl = $('lastWhy');
    if (analysis.why) {
      whyEl.textContent = analysis.why;
      whyEl.classList.remove('hidden');
    } else {
      whyEl.classList.add('hidden');
    }

    const lineEl = $('lastLine');
    if (analysis.bestLine && analysis.bestLine.length) {
      lineEl.innerHTML = 'Mejor era <b>' + analysis.bestLine[0] + '</b>' +
        (analysis.bestLine.length > 1 ? '  ' + analysis.bestLine.slice(1).join(' ') : '');
      lineEl.classList.remove('hidden');
    } else {
      lineEl.classList.add('hidden');
    }

    const bad = ['inaccuracy', 'mistake', 'blunder'].includes(c.key);
    $('btnRetry').classList.toggle('hidden', !bad);
  }

  hideRetry() {
    $('btnRetry').classList.add('hidden');
    $('lastLine').classList.add('hidden');
  }

  // ---- Coach / Pista ----
  async hint() {
    if (this.busy || this.gameOver) return;
    if (this.chess.turn() !== this.myColor) {
      setLastClass('💡', 'La pista aparece en tu turno', null);
      return;
    }
    const fen = this.chess.fen();
    setStatus('Pensando una pista…', true);
    let best = null, pv = null;
    // Reusa el análisis en background si es de esta misma posición.
    if (this.pending && this.pending.fen === fen && this.pending.bestmove) {
      best = this.pending.bestmove; pv = this.pending.pv;
    } else if (this.bgPromise && this.bgFen === fen) {
      const r = await this.bgPromise;
      if (r && r.fen === fen) { best = r.bestmove; pv = r.pv; }
    }
    if (!best) {
      const r = await this.analyst.analyze({ fen, movetime: ANALYST_MS });
      best = r.bestmove; pv = r.pv;
    }
    if (!best || this.chess.turn() !== this.myColor) { setStatus('Tu turno', false); return; }
    const sans = bestLineSan(fen, pv, best);
    board.showArrow(best.slice(0, 2), best.slice(2, 4));
    setLastClass('💡', sans.length ? 'Pista: considera ' + sans[0] : 'Pista lista', null);
    const why = explainBest(fen, best);
    if (why) {
      const whyEl = $('lastWhy');
      whyEl.textContent = why;
      whyEl.classList.remove('hidden');
    }
    if (sans.length > 1) {
      const lineEl = $('lastLine');
      lineEl.innerHTML = 'Idea del motor: <b>' + sans[0] + '</b>  ' + sans.slice(1).join(' ');
      lineEl.classList.remove('hidden');
    }
    setStatus('Tu turno', false);
  }

  async retry() {
    if (this.busy) return;
    // Vuelve a mi turno anterior para probar otra jugada (la fallida queda como variante).
    this.undo();
    setLastClass('↻', 'Prueba otra jugada', null);
  }

  async rivalMove(fromNode) {
    if (this.gameOver) return;
    setStatus('El rival está pensando…', true);
    const fen = fromNode.fen;
    const r = await this.rival.analyze({ fen, movetime: RIVAL_MS });
    if (!r.bestmove) { if (this.current === fromNode) this.checkGameOver(); return; }
    const tmp = new Chess(fen);
    const from = r.bestmove.slice(0, 2), to = r.bestmove.slice(2, 4), promo = r.bestmove.slice(4) || undefined;
    const move = tmp.move({ from, to, promotion: promo });
    if (!move) { console.error('jugada del rival ilegal:', r.bestmove); return; }
    const uci = move.from + move.to + (move.promotion || '');

    let node = fromNode.children.find((c) => c.move && c.move.uci === uci);
    if (!node) {
      node = makeNode(fromNode, {
        san: move.san, from: move.from, to: move.to, uci,
        color: move.color, promotion: move.promotion,
      }, tmp.fen());
      node.isMine = false;
      fromNode.children.push(node);
    }

    // Solo mueve el foco si el usuario sigue en el nodo desde el que pensó el rival.
    if (this.current === fromNode) {
      this.current = node;
      this.syncChess(node);
      board.render(this.chess.board());
      board.highlightLast(move.from, move.to);
      board.clearBadges();
      board.animateMove(move.from, move.to);
      playMove(move);
      this.renderCaptures();
      this.renderMoveList();
      this.renderOpening();
      this.updateNavButtons();
      this.save();
      if (this.checkGameOver()) return;
      this.beginMyTurn();
    } else {
      this.renderMoveList();
      this.save();
    }
  }

  checkGameOver() {
    if (!this.chess.isGameOver()) return false;
    this.gameOver = true;
    let msg = 'Partida terminada';
    let outcome = 'draw';
    if (this.chess.isCheckmate()) {
      const loser = this.chess.turn();
      const iWon = loser !== this.myColor;
      outcome = iWon ? 'win' : 'loss';
      msg = iWon ? '¡Jaque mate! Ganaste 🎉' : 'Jaque mate. Perdiste';
      Sound.play(iWon ? 'win' : 'lose');
    } else { Sound.play('draw'); }
    if (this.chess.isStalemate()) msg = 'Tablas por ahogado';
    else if (this.chess.isThreefoldRepetition()) msg = 'Tablas por triple repetición';
    else if (this.chess.isInsufficientMaterial()) msg = 'Tablas por material insuficiente';
    else if (this.chess.isDraw()) msg = 'Tablas (regla de 50 movimientos)';
    setStatus(msg, false);
    setLastClass('🏁', msg, null);
    this.archiveGame(msg, outcome);
    this.showSummary();
    this.save();
    return true;
  }

  resign() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.resigned = true;
    Sound.play('lose');
    setStatus('Te rendiste', false);
    setLastClass('🏳️', 'Te rendiste', null);
    this.archiveGame('Te rendiste', 'loss');
    this.showSummary();
    this.save();
  }

  myMovesOnLine() {
    return this.pathTo(this.current)
      .filter((n) => n.isMine && n.category)
      .map((n) => ({ category: n.category, accuracy: n.accuracy != null ? n.accuracy : 0 }));
  }

  showSummary() {
    const s = summarize(this.myMovesOnLine());
    const el = $('summary');
    el.classList.remove('hidden');
    let rows = '';
    for (const k of CATEGORY_ORDER) {
      if (!s.counts[k]) continue;
      const c = CATEGORIES[k];
      rows += `<div class="summary-row"><span class="mv-dot ${c.clase}"></span>` +
        `<span>${c.icon} ${c.label}</span><span class="cnt">${s.counts[k]}</span></div>`;
    }
    let eloRow = '';
    if (this.lastEloChange) {
      const { before, after } = this.lastEloChange;
      const diff = after - before;
      const sign = diff > 0 ? '+' : '';
      const cls = diff > 0 ? 'elo-up' : (diff < 0 ? 'elo-down' : '');
      eloRow = `<div class="summary-elo">Tu nivel: <b>${before}</b> → <b>${after}</b> ` +
        `<span class="${cls}">(${sign}${diff})</span> Elo</div>`;
    }
    el.innerHTML = `<h3>Resumen de la partida</h3>` +
      `<div class="summary-accuracy">${s.accuracy.toFixed(1)}% <small>precisión estimada</small></div>` +
      `<div class="summary-counts">${rows || '<span class="mv-cpl">Sin jugadas analizadas</span>'}</div>` +
      eloRow;
  }

  // Archiva la partida terminada en la biblioteca (una sola vez).
  archiveGame(result, outcome) {
    if (this.archived || !this.started) return;
    const mainlineEnd = this.lineEndFrom(this.root);
    if (mainlineEnd.ply < 1) return; // sin jugadas
    this.archived = true;
    const s = summarize(this.myMovesOnLine());
    try {
      addGame({
        date: Date.now(),
        result,
        myColor: this.myColor,
        rivalElo: this.rivalElo,
        plies: mainlineEnd.ply,
        accuracy: s.accuracy,
        opening: this.lastOpening || null,
        tree: this._serializeNode(this.root),
        currentPath: [],
      });
    } catch (_) {}
    // Elo adaptativo: recalibra tu nivel estimado según el resultado.
    if (outcome && getSettings().adaptiveElo) {
      const before = getMyElo();
      const after = updateElo(this.rivalElo, outcomeScore(outcome));
      this.lastEloChange = { before, after };
    }
  }

  // Abre una partida archivada en modo revisión (no continúa el juego).
  async loadArchived(record) {
    this.myColor = record.myColor || 'w';
    this.rivalElo = record.rivalElo || 2000;
    this.root = this._rebuildNode(record.tree, null);
    this.current = this.root;
    this.started = true;
    this.archived = true;
    this.resigned = false;
    this.gameOver = true;

    this.syncChess(this.current);
    board.setOrientation(this.myColor);
    board.clearBadges();
    board.clearArrows();
    this.renderAll();
    this.navEnd();
    this.updateReviewBar();
    this.showSummary();
    setStatus('Partida de la biblioteca (revisión)', false);
    setLastClass('📚', record.result || 'Revisando partida', null);
  }

  // ---- Puzzles de tus errores ----
  // Umbral de tolerancia: una jugada dentro de este cpl de la mejor cuenta como acierto.
  static get PUZZLE_TOLERANCE() { return 40; }

  startPuzzles({ free = false } = {}) {
    const all = collectPuzzles();
    if (!all.length) return false;
    // Modo normal: solo lo que toca repasar hoy (vencidos + nuevos).
    // Modo libre ("Repasar igual"): todos, ignorando el calendario.
    const list = free ? all : scheduleList(all);
    if (!list.length) return false;
    this.puzzleList = list;
    this.puzzleMode = true;
    closeModal(); // por si el modal de nueva partida estaba abierto
    document.body.classList.add('puzzle-mode');
    $('puzzlePanel').classList.remove('hidden');
    this.loadPuzzle(0);
    return true;
  }

  exitPuzzles() {
    this.puzzleMode = false;
    this.puzzle = null;
    document.body.classList.remove('puzzle-mode');
    $('puzzlePanel').classList.add('hidden');
    board.clearArrows();
    board.clearBadges();
    if (this.started) {
      this.syncChess(this.current);
      board.setOrientation(this.myColor);
      this.renderAll();
      setStatus('Partida', false);
      setLastClass('♟', 'Volviste a la partida', null);
    } else {
      this.syncChess(this.root);
      board.setOrientation('w');
      board.render(this.chess.board());
      updateEvalBar(0);
      setStatus('Motores listos', false);
      setLastClass('♟', 'Pulsa Nueva partida para jugar', null);
      openModal();
    }
  }

  loadPuzzle(i) {
    if (i < 0 || i >= this.puzzleList.length) return;
    const p = this.puzzleList[i];
    this.puzzleIdx = i;
    this.puzzle = p;
    this.puzzleSolved = false;
    this.puzzleBusy = false;
    this.puzzleFails = 0;
    this.chess.load(p.fen);
    board.setOrientation(p.turn);
    board.clearBadges();
    board.clearArrows();
    board.render(this.chess.board());
    updateEvalBar(0);
    this.renderPuzzlePanel();
    const side = p.turn === 'w' ? 'blancas' : 'negras';
    setStatus(`Puzzle ${i + 1} de ${this.puzzleList.length} — juegan ${side}`, false);
    setLastClass('🧩', 'Encuentra la mejor jugada', null);
  }

  renderPuzzlePanel() {
    const p = this.puzzle;
    if (!p) return;
    $('puzzleCounter').textContent = `Puzzle ${this.puzzleIdx + 1} / ${this.puzzleList.length}`;
    const catLabel = CATEGORIES[p.cat] ? CATEGORIES[p.cat].label.toLowerCase() : 'jugada floja';
    const d = new Date(p.date);
    const fecha = isNaN(d) ? '' : d.toLocaleDateString('es', { day: '2-digit', month: 'short' });
    const played = p.playedSan ? ` Jugaste <b>${p.playedSan}</b> (${catLabel}${p.cpl ? `, −${cpToPawns(p.cpl)}` : ''}).` : '';
    let repaso = '';
    if (this.puzzleSolved) {
      const s = stateFor(p.fen);
      if (s) repaso = ` <span class="pz-next">🔁 Próximo repaso ${intervalLabel(s.interval)}.</span>`;
    }
    $('puzzleDetail').innerHTML = `De tu partida${fecha ? ' del ' + fecha : ''}.${played}${repaso}`;
    const isLast = this.puzzleIdx >= this.puzzleList.length - 1;
    $('btnPzNext').textContent = isLast ? '🏁 Terminar' : '⏭ Siguiente';
  }

  // Analiza la posición del puzzle una sola vez (mejor jugada + evaluación).
  async puzzlePre() {
    const p = this.puzzle;
    if (!p._pre) p._pre = await this.analyst.analyze({ fen: p.fen, movetime: ANALYST_MS });
    return p._pre;
  }

  async onPuzzleMove(from, to, promo) {
    if (this.puzzleBusy || this.puzzleSolved || !this.puzzle) return;
    const p = this.puzzle;
    const tmp = new Chess(p.fen);
    const move = tmp.move({ from, to, promotion: promo || 'q' });
    if (!move) return;
    this.puzzleBusy = true;

    // Muestra la jugada intentada sobre el tablero.
    this.chess.load(tmp.fen());
    board.render(this.chess.board());
    board.highlightLast(move.from, move.to);
    board.clearArrows();
    playMove(move);
    setStatus('Comprobando tu jugada…', true);

    const pre = await this.puzzlePre();
    const myUci = move.from + move.to + (move.promotion || '');
    const isBest = pre.bestmove && myUci === pre.bestmove;

    let afterMine;
    if (tmp.isCheckmate()) {
      afterMine = 100000; // dar mate es lo mejor posible
    } else {
      const post = await this.analyst.analyze({ fen: tmp.fen(), movetime: ANALYST_MS });
      afterMine = -post.scoreCp; // score viene desde el POV del rival: invierte al mío
    }
    const cpl = Math.max(0, pre.scoreCp - afterMine);
    this.puzzleBusy = false;

    if (isBest || cpl <= Game.PUZZLE_TOLERANCE) {
      this.puzzleSolved = true;
      review(p.fen, this.puzzleFails > 0 ? 'hard' : 'good');
      board.showArrow(move.from, move.to, 'best');
      const withHelp = this.puzzleFails > 0;
      setLastClass('✅', withHelp ? 'Correcto (tras algún intento)' : '¡Bien! Mejoraste tu jugada', CATEGORIES.best);
      setStatus('Resuelto — pulsa Siguiente', false);
      this.renderPuzzlePanel();
    } else {
      this.puzzleFails++;
      setLastClass('✕', `Pierde ${cpToPawns(cpl)}. Inténtalo otra vez`, CATEGORIES.mistake);
      setStatus('No es la mejor — vuelve a intentarlo', false);
      // Devuelve la posición para otro intento.
      this.chess.load(p.fen);
      board.render(this.chess.board());
      board.clearArrows();
    }
  }

  async puzzleHint() {
    if (!this.puzzle || this.puzzleBusy) return;
    if (!this.puzzleSolved) this.puzzleFails++;
    setStatus('Buscando una pista…', true);
    const pre = await this.puzzlePre();
    if (!pre.bestmove || !this.puzzle) { setStatus('Tu turno', false); return; }
    board.showArrow(pre.bestmove.slice(0, 2), pre.bestmove.slice(2, 4), 'best');
    setLastClass('💡', 'La flecha señala una buena casilla de salida', null);
    setStatus('Tu turno', false);
  }

  async puzzleSolution() {
    if (!this.puzzle || this.puzzleBusy) return;
    const p = this.puzzle;
    setStatus('Mostrando la solución…', true);
    const pre = await this.puzzlePre();
    if (!pre.bestmove || !this.puzzle) { setStatus('Tu turno', false); return; }
    const tmp = new Chess(p.fen);
    const m = tmp.move({ from: pre.bestmove.slice(0, 2), to: pre.bestmove.slice(2, 4), promotion: pre.bestmove.slice(4) || undefined });
    this.puzzleSolved = true;
    review(p.fen, 'fail');
    this.chess.load(tmp.fen());
    board.render(this.chess.board());
    if (m) board.highlightLast(m.from, m.to);
    board.showArrow(pre.bestmove.slice(0, 2), pre.bestmove.slice(2, 4), 'best');
    setLastClass('👁', m ? `La mejor era ${m.san}` : 'Solución mostrada', null);
    setStatus('Solución — pulsa Siguiente', false);
    this.renderPuzzlePanel();
  }

  puzzleNext() {
    if (this.puzzleIdx < this.puzzleList.length - 1) this.loadPuzzle(this.puzzleIdx + 1);
    else this.exitPuzzles();
  }

  async copyPgn() {
    const pgn = this.chess.pgn();
    try {
      await navigator.clipboard.writeText(pgn);
      setStatus('PGN copiado', false);
    } catch (_) {
      window.prompt('Copia el PGN:', pgn);
    }
  }

  // ---- Persistencia (serializa el árbol completo) ----
  _serializeNode(node) {
    return {
      m: node.move,
      fen: node.fen,
      mine: node.isMine,
      cat: node.category ? node.category.key : null,
      cpl: node.cpl,
      acc: node.accuracy,
      ev: node.evalWhite,
      line: node.bestLine,
      why: node.why,
      kids: node.children.map((c) => this._serializeNode(c)),
    };
  }

  _rebuildNode(data, parent) {
    const node = makeNode(parent, data.m, data.fen);
    node.isMine = !!data.mine;
    node.category = data.cat ? CATEGORIES[data.cat] : null;
    node.cpl = data.cpl || 0;
    node.accuracy = data.acc != null ? data.acc : null;
    node.evalWhite = data.ev != null ? data.ev : null;
    node.bestLine = data.line || null;
    node.why = data.why || null;
    node.children = (data.kids || []).map((k) => this._rebuildNode(k, node));
    return node;
  }

  save() {
    try {
      const currentPath = [];
      for (let n = this.current; n.parent; n = n.parent) {
        currentPath.unshift(n.parent.children.indexOf(n));
      }
      const data = {
        version: 2,
        tree: this._serializeNode(this.root),
        currentPath,
        myColor: this.myColor,
        rivalElo: this.rivalElo,
        gameOver: this.gameOver,
        resigned: this.resigned,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  async restore(data) {
    this.myColor = data.myColor;
    this.rivalElo = data.rivalElo;
    this.root = this._rebuildNode(data.tree, null);
    this.current = this.root;
    for (const idx of (data.currentPath || [])) {
      if (this.current.children[idx]) this.current = this.current.children[idx];
    }
    this.resigned = !!data.resigned;
    this.started = true;

    await Promise.all([this.rival.newGame(), this.analyst.newGame()]);
    this.rival.setElo(this.rivalElo);
    // El analista conserva su configuración de initEngines (ver nota en start()).

    this.syncChess(this.current);
    this.gameOver = this.chess.isGameOver() || this.resigned;
    board.setOrientation(this.myColor);
    this.renderAll();
    this.updateReviewBar();
    this.updateEvalForCurrent();

    if (this.gameOver) { this.showSummary(); this.checkGameOverText(); return; }
    if (this.chess.turn() === this.myColor) this.beginMyTurn();
    else await this.rivalMove(this.current);
  }

  checkGameOverText() {
    setStatus('Partida restaurada (terminada)', false);
    setLastClass('🏁', 'Partida terminada', null);
  }
}

// ---- Helpers de UI ----
function setStatus(text, thinking) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('thinking', !!thinking);
}

function setLastClass(icon, text, category) {
  const card = $('lastClass');
  card.querySelector('.lastclass-text').textContent = text;
  const iconEl = card.querySelector('.lastclass-icon');
  iconEl.textContent = icon;
  iconEl.className = 'lastclass-icon' + (category ? ' ' + category.clase : '');
  $('lastLine').classList.add('hidden');
  $('lastWhy').classList.add('hidden');
  $('btnRetry').classList.add('hidden');
}

function capturesHtml(counts, pieceColor, adv) {
  let html = '';
  for (const t of ['q', 'r', 'b', 'n', 'p']) {
    if (!counts[t]) continue;
    html += '<span class="cap-group">';
    for (let i = 0; i < counts[t]; i++) html += pieceSVG(t, pieceColor);
    html += '</span>';
  }
  if (adv) html += `<span class="cap-adv">${adv}</span>`;
  return html;
}

// Invierte el turno de un FEN (jugada nula) para preguntar qué haría el rival
// si le tocara mover ahora. Limpia el objetivo de al paso, inválido tras el cambio.
function nullMoveFen(fen) {
  const p = fen.split(' ');
  p[1] = p[1] === 'w' ? 'b' : 'w';
  p[3] = '-';
  return p.join(' ');
}

function bestLineSan(preFen, pv, bestmove) {
  const tmp = new Chess(preFen);
  const sans = [];
  const moves = (pv && pv.length ? pv : (bestmove ? [bestmove] : [])).slice(0, 5);
  for (const uci of moves) {
    const m = tmp.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || undefined });
    if (!m) break;
    sans.push(m.san);
  }
  return sans;
}

function updateEvalBar(cpWhite) {
  const pct = Math.max(2, Math.min(98, winPercent(cpWhite)));
  $('evalFill').style.height = pct + '%';
  let text;
  if (Math.abs(cpWhite) >= 9000) {
    const mateIn = 10000 - Math.abs(cpWhite);
    text = 'M' + mateIn;
  } else {
    const p = cpWhite / 100;
    text = (p >= 0 ? '+' : '') + p.toFixed(1);
  }
  $('evalText').textContent = text;
}

// ---- Arranque ----
let board;
const game = new Game();

function setupBoard() {
  board = new Board($('board'), {
    orientation: 'w',
    movableColor: () => {
      if (game.puzzleMode) {
        return (game.puzzle && !game.puzzleBusy && !game.puzzleSolved) ? game.chess.turn() : null;
      }
      return (!game.busy && !game.gameOver && game.chess.turn() === game.myColor) ? game.myColor : null;
    },
    legalTargets: (sq) => game.chess.moves({ square: sq, verbose: true }).map((m) => m.to),
    needsPromotion: (from, to) => {
      const moves = game.chess.moves({ square: from, verbose: true });
      const m = moves.find((x) => x.to === to);
      return !!(m && m.promotion);
    },
    onMove: (from, to, promo) => (game.puzzleMode ? game.onPuzzleMove(from, to, promo) : game.onMyMove(from, to, promo)),
  });
}

function wireControls() {
  $('btnResign').addEventListener('click', () => game.resign());
  $('btnHint').addEventListener('click', () => game.hint());
  $('btnUndo').addEventListener('click', () => game.undo());
  $('btnRedo').addEventListener('click', () => game.redo());
  $('btnRetry').addEventListener('click', () => game.retry());
  $('btnCopyPgn').addEventListener('click', () => game.copyPgn());
  $('btnFlip').addEventListener('click', () => board.flip());
  $('arrowToggle').addEventListener('change', (e) => { game.showArrows = e.target.checked; });
  $('btnNew').addEventListener('click', () => openModal());

  // Barra de navegación / variantes.
  $('revStart').addEventListener('click', () => game.navStart());
  $('revPrev').addEventListener('click', () => game.navPrev());
  $('revNext').addEventListener('click', () => game.navNext());
  $('revEnd').addEventListener('click', () => game.navEnd());
  $('revPromote').addEventListener('click', () => game.promote());
  $('revDelete').addEventListener('click', () => game.deleteFromHere());

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Cierra ajustes/biblioteca/puzzles con Escape.
    if (e.key === 'Escape') {
      let closed = false;
      for (const id of ['settingsModal', 'libraryModal', 'puzzleModal', 'profileModal']) {
        if (!$(id).classList.contains('hidden')) { $(id).classList.add('hidden'); closed = true; }
      }
      if (closed) return;
    }
    const modalOpen = !$('newGameModal').classList.contains('hidden');
    if (modalOpen) {
      if (e.key === 'Enter') { e.preventDefault(); $('btnStart').click(); }
      else if (e.key === 'Escape' && game.started) closeModal();
      return;
    }
    if (e.target.matches('input, textarea, button')) return;
    // En modo puzzle solo atajos propios; nada de deshacer/nueva partida.
    if (game.puzzleMode) {
      switch (e.key) {
        case 'h': case 'H': game.puzzleHint(); break;
        case 'ArrowRight': case 'Enter': e.preventDefault(); game.puzzleNext(); break;
        case 'Escape': game.exitPuzzles(); break;
        default: return;
      }
      return;
    }
    switch (e.key) {
      case 'n': case 'N': openModal(); break;
      case 'u': case 'U': game.undo(); break;
      case 'y': case 'Y': game.redo(); break;
      case 'f': case 'F': board.flip(); break;
      case 'a': case 'A': $('arrowToggle').click(); break;
      case 'h': case 'H': game.hint(); break;
      case 'p': case 'P': game.promote(); break;
      case 'Delete': case 'Backspace': e.preventDefault(); game.deleteFromHere(); break;
      case 'ArrowLeft': e.preventDefault(); game.navPrev(); break;
      case 'ArrowRight': e.preventDefault(); game.navNext(); break;
      case 'Home': e.preventDefault(); game.navStart(); break;
      case 'End': e.preventDefault(); game.navEnd(); break;
      default: return;
    }
  });

  let chosenColor = 'w';
  document.querySelectorAll('#colorSeg .seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#colorSeg .seg-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      chosenColor = b.dataset.color;
    });
  });
  $('eloRange').addEventListener('input', (e) => { $('eloValue').textContent = e.target.value; });
  $('btnStart').addEventListener('click', async () => {
    let color = chosenColor;
    if (color === 'r') color = Math.random() < 0.5 ? 'w' : 'b';
    const elo = parseInt($('eloRange').value, 10);
    if (getSettings().adaptiveElo) setMyElo(elo); // el valor elegido recalibra tu estimación
    closeModal();
    await game.start(color, elo);
  });
}

function openModal() {
  if (game.puzzleMode) return;
  syncEloModal();
  $('newGameModal').classList.remove('hidden');
}
function closeModal() { $('newGameModal').classList.add('hidden'); }

// Ajusta el slider y el texto de ayuda del modal según el modo adaptativo.
function syncEloModal() {
  const range = $('eloRange');
  if (getSettings().adaptiveElo) {
    range.value = String(suggestedRivalElo());
    $('eloHint').textContent = `Adaptativo activado · tu nivel estimado: ${getMyElo()} Elo. Se ajusta al terminar cada partida.`;
  } else {
    $('eloHint').textContent = '';
  }
  $('eloValue').textContent = range.value; // refleja el valor real del slider
}

function wireSettings() {
  const cfg = getSettings();
  // Rejilla de temas.
  const grid = $('themeGrid');
  grid.innerHTML = '';
  for (const [key, t] of Object.entries(BOARD_THEMES)) {
    const sw = document.createElement('button');
    sw.className = 'theme-swatch' + (cfg.boardTheme === key ? ' active' : '');
    sw.dataset.theme = key;
    sw.innerHTML =
      `<div class="theme-mini">` +
      `<span style="background:${t.light}"></span><span style="background:${t.dark}"></span>` +
      `<span style="background:${t.dark}"></span><span style="background:${t.light}"></span>` +
      `</div><div class="theme-name">${t.label}</div>`;
    sw.addEventListener('click', () => {
      setSetting('boardTheme', key);
      grid.querySelectorAll('.theme-swatch').forEach((x) => x.classList.remove('active'));
      sw.classList.add('active');
    });
    grid.appendChild(sw);
  }
  $('setCoords').checked = cfg.coords;
  $('setSound').checked = cfg.sound;
  $('setThreat').checked = cfg.showThreat;
  $('setRepeat').checked = cfg.repeatUntilGood;
  $('setAdaptive').checked = cfg.adaptiveElo;
  $('setCoords').addEventListener('change', (e) => setSetting('coords', e.target.checked));
  $('setSound').addEventListener('change', (e) => setSetting('sound', e.target.checked));
  $('setThreat').addEventListener('change', (e) => {
    setSetting('showThreat', e.target.checked);
    if (!e.target.checked) board.clearArrows();
  });
  $('setRepeat').addEventListener('change', (e) => setSetting('repeatUntilGood', e.target.checked));
  $('setAdaptive').addEventListener('change', (e) => setSetting('adaptiveElo', e.target.checked));

  $('btnSettings').addEventListener('click', () => $('settingsModal').classList.remove('hidden'));
  $('settingsClose').addEventListener('click', () => $('settingsModal').classList.add('hidden'));
  $('settingsModal').addEventListener('click', (e) => {
    if (e.target === $('settingsModal')) $('settingsModal').classList.add('hidden');
  });
}

function wireLibrary() {
  const modal = $('libraryModal');
  const open = () => {
    renderLibrary($('libraryList'), {
      onLoad: async (record) => { modal.classList.add('hidden'); await game.loadArchived(record); },
      onDelete: (id) => deleteGame(id),
    });
    modal.classList.remove('hidden');
  };
  $('btnLibrary').addEventListener('click', open);
  $('libraryClose').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
}

function wireProfile() {
  const modal = $('profileModal');
  $('btnProfile').addEventListener('click', () => {
    renderProfile($('profileBody'));
    modal.classList.remove('hidden');
  });
  $('profileClose').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
}

function wirePuzzles() {
  const modal = $('puzzleModal');
  const close = () => modal.classList.add('hidden');
  let freeMode = false;
  $('btnPuzzles').addEventListener('click', () => {
    const all = collectPuzzles();
    const { due, fresh } = reviewQueue(all);
    const n = due.length + fresh.length;
    freeMode = false;
    if (!all.length) {
      $('puzzleIntro').innerHTML = `Aún no hay errores que entrenar. Juega alguna partida —al terminar se archiva sola— y aquí ` +
        `aparecerán tus posiciones para mejorar.`;
      $('btnPzStart').textContent = 'Empezar a entrenar';
      $('btnPzStart').disabled = true;
    } else if (n === 0) {
      $('puzzleIntro').innerHTML = `<b>¡Todo al día!</b> 🎉 Ya repasaste tus posiciones pendientes. ` +
        `Vuelve mañana para el siguiente repaso, o practica libremente con todas tus posiciones.`;
      $('btnPzStart').textContent = '🔄 Repasar igual';
      $('btnPzStart').disabled = false;
      freeMode = true;
    } else {
      const parts = [];
      if (due.length) parts.push(`${due.length} ${due.length === 1 ? 'vencida' : 'vencidas'}`);
      if (fresh.length) parts.push(`${fresh.length} ${fresh.length === 1 ? 'nueva' : 'nuevas'}`);
      $('puzzleIntro').innerHTML = `Tienes <b>${n}</b> ${n === 1 ? 'posición' : 'posiciones'} para repasar hoy ` +
        `(${parts.join(' · ')}). Cada puzzle te pone justo antes de tu jugada floja: <b>encuentra algo mejor</b>.`;
      $('btnPzStart').textContent = 'Empezar a entrenar';
      $('btnPzStart').disabled = false;
    }
    modal.classList.remove('hidden');
  });
  $('btnPzStart').addEventListener('click', () => { close(); game.startPuzzles({ free: freeMode }); });
  $('puzzleModalClose').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  $('btnPzHint').addEventListener('click', () => game.puzzleHint());
  $('btnPzSolution').addEventListener('click', () => game.puzzleSolution());
  $('btnPzNext').addEventListener('click', () => game.puzzleNext());
  $('btnPzExit').addEventListener('click', () => game.exitPuzzles());
}

async function main() {
  loadSettings();
  setupBoard();
  wireControls();
  wireSettings();
  wireLibrary();
  wireProfile();
  wirePuzzles();

  try {
    await game.initEngines();
  } catch (e) {
    console.error('no se pudieron cargar los motores:', e);
    setStatus('No se pudo cargar el motor', false);
    setLastClass('⚠️', 'Motor no disponible', null);
    const card = $('lastClass');
    card.querySelector('.lastclass-text').innerHTML =
      'No se pudo cargar el motor de ajedrez. Ábrela una vez <b>con conexión</b> ' +
      'para que se guarde sin conexión, y luego recarga.';
    return; // sin motor no hay partida posible
  }

  let restored = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.tree) {
        await game.restore(data);
        restored = true;
        if (!game.gameOver) setStatus('Partida restaurada', false);
      }
    }
  } catch (e) {
    console.warn('no se pudo restaurar la partida:', e);
  }

  if (!restored) openModal();
}

// Registra el service worker (PWA offline). No bloquea el arranque.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW no registrado:', e));
  });
}

main();

// Exponer para pruebas automatizadas (Playwright/consola).
window.__game = game;
window.__board = () => board;
