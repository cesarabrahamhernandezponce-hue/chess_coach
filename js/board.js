// Tablero renderizado con CSS Grid y piezas SVG.
// Soporta arrastrar-y-soltar y clic-origen/clic-destino, resaltado de casillas
// legales, diálogo de coronación, flechas y badges de clasificación.

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PIECE_BASE = 'vendor/pieces/cburnett/';

// Pieza como imagen SVG del set Cburnett (el mismo de Lichess). El src se
// resuelve contra el documento (index.html), no contra este módulo.
export function pieceSVG(type, color) {
  const name = color + type.toUpperCase(); // p.ej. wN, bQ
  return `<img class="piece-svg" src="${PIECE_BASE}${name}.svg" alt="" draggable="false">`;
}

function squareName(fileIdx, rankIdx) {
  return FILES[fileIdx] + (rankIdx + 1);
}

export class Board {
  // opts: { onMove(from,to,promo), legalTargets(sq)->[sq], needsPromotion(from,to)->bool,
  //         movableColor()-> 'w'|'b'|null, orientation:'w'|'b' }
  constructor(rootEl, opts) {
    this.root = rootEl;
    this.opts = opts;
    this.orientation = opts.orientation || 'w';
    this.cells = new Map();       // square -> celda DOM
    this.selected = null;
    this.dragging = null;         // { from, ghost }
    this.lastMove = null;         // { from, to }
    this.boardData = null;        // último chess.board()
    this._build();
  }

  _build() {
    this.root.classList.add('board');
    this.root.innerHTML = '';

    this.grid = document.createElement('div');
    this.grid.className = 'board-grid';
    this.root.appendChild(this.grid);

    // Capa SVG para flechas.
    this.arrowLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.arrowLayer.setAttribute('class', 'arrow-layer');
    this.arrowLayer.setAttribute('viewBox', '0 0 8 8');
    this.arrowLayer.innerHTML =
      `<defs>` +
      `<marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto">` +
      `<path d="M0,0 L4,2 L0,4 Z" fill="#e8a33d"/></marker>` +
      `<marker id="arrowhead-threat" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto">` +
      `<path d="M0,0 L4,2 L0,4 Z" fill="#d5484c"/></marker>` +
      `</defs>`;
    this.root.appendChild(this.arrowLayer);

    this._buildCells();
    this._bindPointer();
  }

  _buildCells() {
    this.grid.innerHTML = '';
    this.cells.clear();
    const ranks = this.orientation === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    const files = this.orientation === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    for (const r of ranks) {
      for (const f of files) {
        const sq = squareName(f, r);
        const cell = document.createElement('div');
        cell.className = 'cell ' + ((f + r) % 2 === 0 ? 'dark' : 'light');
        cell.dataset.square = sq;
        // Coordenadas en el borde.
        if (f === (this.orientation === 'w' ? 0 : 7)) {
          const rk = document.createElement('span');
          rk.className = 'coord rank';
          rk.textContent = r + 1;
          cell.appendChild(rk);
        }
        if (r === (this.orientation === 'w' ? 0 : 7)) {
          const fl = document.createElement('span');
          fl.className = 'coord file';
          fl.textContent = FILES[f];
          cell.appendChild(fl);
        }
        this.grid.appendChild(cell);
        this.cells.set(sq, cell);
      }
    }
  }

  setOrientation(color) {
    this.orientation = color;
    this._buildCells();
    if (this.boardData) this.render(this.boardData);
    if (this.lastMove) this.highlightLast(this.lastMove.from, this.lastMove.to);
  }

  flip() {
    this.setOrientation(this.orientation === 'w' ? 'b' : 'w');
  }

  render(boardData) {
    this.boardData = boardData;
    for (const [sq, cell] of this.cells) {
      const piece = cell.querySelector('.piece');
      if (piece) piece.remove();
    }
    // boardData: [rank8..rank1][fileA..fileH]
    for (let ri = 0; ri < 8; ri++) {
      for (let fi = 0; fi < 8; fi++) {
        const p = boardData[ri][fi];
        if (!p) continue;
        const sq = squareName(fi, 7 - ri);
        const cell = this.cells.get(sq);
        const el = document.createElement('div');
        el.className = 'piece';
        el.innerHTML = pieceSVG(p.type, p.color);
        cell.appendChild(el);
      }
    }
    this._restoreDecorations();
  }

  _restoreDecorations() {
    if (this.lastMove) this.highlightLast(this.lastMove.from, this.lastMove.to);
  }

  // Desliza la pieza que ahora está en `to` desde la casilla `from`.
  // Debe llamarse justo después de render(), con la pieza ya colocada en destino.
  animateMove(from, to) {
    const fromCell = this.cells.get(from);
    const toCell = this.cells.get(to);
    if (!fromCell || !toCell) return;
    const pieceEl = toCell.querySelector('.piece');
    if (!pieceEl) return;
    const a = fromCell.getBoundingClientRect();
    const b = toCell.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (!dx && !dy) return;
    pieceEl.style.transition = 'none';
    pieceEl.style.transform = `translate(${dx}px, ${dy}px)`;
    pieceEl.style.zIndex = '6';
    pieceEl.getBoundingClientRect(); // fuerza reflow
    pieceEl.style.transition = 'transform 0.18s ease-out';
    pieceEl.style.transform = 'translate(0, 0)';
    const clear = () => {
      pieceEl.style.transition = '';
      pieceEl.style.transform = '';
      pieceEl.style.zIndex = '';
    };
    pieceEl.addEventListener('transitionend', clear, { once: true });
  }

  // ---- Resaltados ----
  clearSelection() {
    this.selected = null;
    for (const cell of this.cells.values()) {
      cell.classList.remove('selected', 'target', 'target-capture');
    }
  }

  selectSquare(sq) {
    this.clearSelection();
    this.selected = sq;
    this.cells.get(sq).classList.add('selected');
    const targets = this.opts.legalTargets(sq) || [];
    for (const t of targets) {
      const cell = this.cells.get(t);
      const hasPiece = cell.querySelector('.piece');
      cell.classList.add(hasPiece ? 'target-capture' : 'target');
    }
  }

  highlightLast(from, to) {
    this.lastMove = { from, to };
    for (const cell of this.cells.values()) cell.classList.remove('last-from', 'last-to');
    if (this.cells.get(from)) this.cells.get(from).classList.add('last-from');
    if (this.cells.get(to)) this.cells.get(to).classList.add('last-to');
  }

  // ---- Badges de clasificación ----
  clearBadges() {
    for (const cell of this.cells.values()) {
      const b = cell.querySelector('.badge');
      if (b) b.remove();
    }
  }

  showBadge(square, category) {
    this.clearBadges();
    const cell = this.cells.get(square);
    if (!cell) return;
    const b = document.createElement('div');
    b.className = 'badge ' + category.clase;
    b.textContent = category.icon;
    b.title = category.label;
    cell.appendChild(b);
  }

  // ---- Flechas ----
  _center(sq) {
    const f = FILES.indexOf(sq[0]);
    const r = parseInt(sq[1], 10) - 1;
    const col = this.orientation === 'w' ? f : 7 - f;
    const row = this.orientation === 'w' ? 7 - r : r;
    return { x: col + 0.5, y: row + 0.5 };
  }

  clearArrows() {
    for (const l of [...this.arrowLayer.querySelectorAll('line')]) l.remove();
  }

  showArrow(from, to, kind = 'best') {
    this.clearArrows();
    const a = this._center(from);
    const b = this._center(to);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', a.x);
    line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x);
    line.setAttribute('y2', b.y);
    const threat = kind === 'threat';
    line.setAttribute('class', threat ? 'threat-arrow' : 'best-arrow');
    line.setAttribute('marker-end', threat ? 'url(#arrowhead-threat)' : 'url(#arrowhead)');
    this.arrowLayer.appendChild(line);
  }

  // ---- Interacción ----
  _bindPointer() {
    this.grid.addEventListener('pointerdown', (e) => this._onDown(e));
    window.addEventListener('pointermove', (e) => this._onMoveGhost(e));
    window.addEventListener('pointerup', (e) => this._onUp(e));
  }

  _squareFromEvent(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return null;
    const cell = el.closest('.cell');
    return cell ? cell.dataset.square : null;
  }

  _pieceColorAt(sq) {
    if (!this.boardData) return null;
    const f = FILES.indexOf(sq[0]);
    const r = parseInt(sq[1], 10) - 1;
    const p = this.boardData[7 - r][f];
    return p ? p.color : null;
  }

  _onDown(e) {
    const sq = this._squareFromEvent(e);
    if (!sq) return;
    const movable = this.opts.movableColor();

    // Segundo clic: si ya hay selección y esta casilla es destino legal -> mover.
    if (this.selected && this.selected !== sq) {
      const targets = this.opts.legalTargets(this.selected) || [];
      if (targets.includes(sq)) {
        this._attemptMove(this.selected, sq);
        this.clearSelection();
        return;
      }
    }

    if (!movable) { this.clearSelection(); return; }
    const color = this._pieceColorAt(sq);
    if (color !== movable) {
      // Clic en casilla vacía o pieza rival: solo limpia selección.
      if (!this.selected || !((this.opts.legalTargets(this.selected) || []).includes(sq))) {
        this.clearSelection();
      }
      return;
    }

    // Seleccionar y preparar arrastre.
    this.selectSquare(sq);
    e.preventDefault();
    const cell = this.cells.get(sq);
    const pieceEl = cell.querySelector('.piece');
    if (!pieceEl) return;
    const ghost = pieceEl.cloneNode(true);
    ghost.classList.add('ghost');
    document.body.appendChild(ghost);
    this.dragging = { from: sq, ghost, moved: false };
    pieceEl.classList.add('dragging-src');
    this._positionGhost(e);
  }

  _positionGhost(e) {
    if (!this.dragging) return;
    const size = this.grid.getBoundingClientRect().width / 8;
    const g = this.dragging.ghost;
    g.style.width = size + 'px';
    g.style.height = size + 'px';
    g.style.left = (e.clientX - size / 2) + 'px';
    g.style.top = (e.clientY - size / 2) + 'px';
  }

  _onMoveGhost(e) {
    if (!this.dragging) return;
    this.dragging.moved = true;
    this._positionGhost(e);
  }

  _onUp(e) {
    if (!this.dragging) return;
    const { from, ghost, moved } = this.dragging;
    ghost.remove();
    const srcPiece = this.cells.get(from)?.querySelector('.piece');
    if (srcPiece) srcPiece.classList.remove('dragging-src');
    this.dragging = null;
    if (!moved) return; // fue un clic: mantener selección para clic-destino

    const target = this._squareFromEvent(e);
    if (target && target !== from) {
      const targets = this.opts.legalTargets(from) || [];
      if (targets.includes(target)) {
        this._attemptMove(from, target);
        this.clearSelection();
        return;
      }
    }
    this.clearSelection();
  }

  async _attemptMove(from, to) {
    let promo = null;
    if (this.opts.needsPromotion(from, to)) {
      promo = await this._askPromotion(this._pieceColorAt(from));
      if (!promo) return; // cancelado
    }
    this.opts.onMove(from, to, promo);
  }

  _askPromotion(color) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'promo-overlay';
      const box = document.createElement('div');
      box.className = 'promo-box';
      const title = document.createElement('div');
      title.className = 'promo-title';
      title.textContent = 'Corona a:';
      box.appendChild(title);
      const row = document.createElement('div');
      row.className = 'promo-row';
      for (const t of ['q', 'r', 'b', 'n']) {
        const btn = document.createElement('button');
        btn.className = 'promo-choice';
        btn.innerHTML = pieceSVG(t, color);
        btn.addEventListener('click', () => { document.body.removeChild(overlay); resolve(t); });
        row.appendChild(btn);
      }
      box.appendChild(row);
      const cancel = document.createElement('button');
      cancel.className = 'promo-cancel';
      cancel.textContent = 'Cancelar';
      cancel.addEventListener('click', () => { document.body.removeChild(overlay); resolve(null); });
      box.appendChild(cancel);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    });
  }
}
