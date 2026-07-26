// Wrapper UCI sobre un Web Worker de Stockfish (variante lite single-thread WASM).
// Serializa las búsquedas: solo hay un `go` activo a la vez por motor.

const MATE_SCORE = 10000; // "mate en N" -> 10000 - N (en centipawns equivalentes)

// Convierte un score UCI ({type,value}, POV del que mueve) a centipawns normalizados.
export function scoreToCp(score) {
  if (!score) return 0;
  if (score.type === 'mate') {
    const sign = score.value >= 0 ? 1 : -1;
    return sign * (MATE_SCORE - Math.abs(score.value));
  }
  return score.value;
}

function parseInfo(line) {
  // Ej: "info depth 15 ... multipv 1 ... score cp 34 ... pv e2e4 e7e5 ..."
  const parts = line.split(/\s+/);
  let depth = 0;
  let multipv = 1;
  let score = null;
  let pv = [];
  for (let i = 0; i < parts.length; i++) {
    const t = parts[i];
    if (t === 'depth') depth = parseInt(parts[i + 1], 10);
    else if (t === 'multipv') multipv = parseInt(parts[i + 1], 10);
    else if (t === 'score') {
      const kind = parts[i + 1]; // cp | mate
      const val = parseInt(parts[i + 2], 10);
      score = { type: kind, value: val };
    } else if (t === 'pv') {
      pv = parts.slice(i + 1);
      break;
    }
  }
  return { depth, multipv, score, pv };
}

export class UciEngine {
  constructor(workerUrl, name = 'engine') {
    this.name = name;
    this.worker = new Worker(workerUrl);
    this._listeners = new Set();
    this._chain = Promise.resolve();
    this._searching = false;
    this.worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : (e.data && e.data.data) || '';
      if (!line) return;
      for (const fn of [...this._listeners]) fn(line);
    };
    this.worker.onerror = (e) => {
      console.error(`[${this.name}] error en el worker:`, e.message || e);
    };
  }

  _on(fn) { this._listeners.add(fn); }
  _off(fn) { this._listeners.delete(fn); }
  send(cmd) { this.worker.postMessage(cmd); }

  // Espera a que aparezca una línea que cumpla el predicado.
  _await(predicate, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._off(handler);
        reject(new Error(`[${this.name}] timeout esperando respuesta UCI`));
      }, timeoutMs);
      const handler = (line) => {
        if (predicate(line)) {
          clearTimeout(timer);
          this._off(handler);
          resolve(line);
        }
      };
      this._on(handler);
    });
  }

  async init() {
    this.send('uci');
    await this._await((l) => l.trim() === 'uciok');
    await this.isReady();
    return this;
  }

  async isReady() {
    this.send('isready');
    await this._await((l) => l.trim() === 'readyok');
  }

  setOption(name, value) {
    this.send(`setoption name ${name} value ${value}`);
  }

  async newGame() {
    this.send('ucinewgame');
    await this.isReady();
  }

  // Limita la fuerza a un Elo aproximado (motor rival).
  setElo(elo) {
    this.setOption('UCI_LimitStrength', 'true');
    this.setOption('UCI_Elo', String(elo));
  }

  // Fuerza completa (motor analista).
  setFullStrength() {
    this.setOption('UCI_LimitStrength', 'false');
  }

  stop() {
    if (this._searching) this.send('stop');
  }

  // Ejecuta una búsqueda. Se encola tras cualquier búsqueda previa.
  // opts: { fen, movetime, depth }. Devuelve { bestmove, score, scoreCp, pv, depth }.
  analyze({ fen, movetime = 1000, depth = null }) {
    // Si hay una búsqueda en curso, pídele que pare para liberar la cola antes.
    this.stop();
    const job = this._chain.then(() => this._runSearch({ fen, movetime, depth }));
    this._chain = job.catch(() => {});
    return job;
  }

  _runSearch({ fen, movetime, depth }) {
    return new Promise((resolve) => {
      // Guarda la última info de cada línea (multipv 1 = mejor, 2 = segunda mejor).
      const lines = new Map();
      const handler = (line) => {
        if (line.startsWith('info') && line.includes(' pv ') && line.includes('score')) {
          const info = parseInfo(line);
          const prev = lines.get(info.multipv);
          if (info.score && (!prev || info.depth >= prev.depth)) lines.set(info.multipv, info);
        } else if (line.startsWith('bestmove')) {
          const bm = line.split(/\s+/)[1];
          this._off(handler);
          this._searching = false;
          const best = lines.get(1) || { depth: 0, score: null, pv: [] };
          const second = lines.get(2) || null;
          resolve({
            bestmove: bm && bm !== '(none)' ? bm : null,
            score: best.score,
            scoreCp: scoreToCp(best.score),
            pv: best.pv,
            depth: best.depth,
            // Segunda mejor jugada (cp desde el POV del que mueve). null si no hay.
            secondCp: second && second.score ? scoreToCp(second.score) : null,
            secondPv: second ? second.pv : [],
          });
        }
      };
      this._on(handler);
      this._searching = true;
      this.send(`position fen ${fen}`);
      this.send(depth ? `go depth ${depth}` : `go movetime ${movetime}`);
    });
  }

  terminate() {
    try { this.send('quit'); } catch (_) {}
    this.worker.terminate();
  }
}
