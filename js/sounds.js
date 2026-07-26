// Sonidos de la partida sintetizados con WebAudio (sin archivos, 100% offline).
// Cada efecto es una pequeña envolvente sobre uno o varios osciladores.

let ctx = null;
function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Un "click" tonal: oscilador con caída exponencial de volumen.
function tone(freq, { dur = 0.12, type = 'sine', gain = 0.18, delay = 0, glideTo = null } = {}) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Ruido corto filtrado, para capturas (más "percusivo").
function thud(gain = 0.22) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime;
  const len = Math.floor(a.sampleRate * 0.09);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filt = a.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 900;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
  src.connect(filt).connect(g).connect(a.destination);
  src.start(t0);
}

const Sound = {
  enabled: true,

  play(kind) {
    if (!this.enabled) return;
    switch (kind) {
      case 'move':    tone(320, { dur: 0.09, type: 'sine', gain: 0.16 }); break;
      case 'capture': thud(0.24); tone(200, { dur: 0.08, type: 'triangle', gain: 0.12 }); break;
      case 'castle':  tone(300, { dur: 0.08, gain: 0.14 }); tone(400, { dur: 0.1, gain: 0.14, delay: 0.07 }); break;
      case 'check':   tone(660, { dur: 0.14, type: 'square', gain: 0.11, glideTo: 880 }); break;
      case 'promote': tone(520, { dur: 0.1, gain: 0.15 }); tone(780, { dur: 0.14, gain: 0.15, delay: 0.09 }); break;
      case 'win':     [523, 659, 784, 1046].forEach((f, i) => tone(f, { dur: 0.18, gain: 0.16, delay: i * 0.11, type: 'triangle' })); break;
      case 'lose':    [440, 349, 262].forEach((f, i) => tone(f, { dur: 0.22, gain: 0.15, delay: i * 0.13, type: 'sine' })); break;
      case 'draw':    tone(440, { dur: 0.18, gain: 0.13 }); tone(440, { dur: 0.2, gain: 0.13, delay: 0.16 }); break;
      case 'start':   tone(392, { dur: 0.1, gain: 0.14 }); tone(587, { dur: 0.14, gain: 0.14, delay: 0.09 }); break;
      default: break;
    }
  },
};

// Deriva el tipo de sonido de un objeto move de chess.js (usa el SAN).
export function moveSound(move) {
  if (!move) return 'move';
  const san = move.san || '';
  if (san.includes('#')) return null;      // el fin de partida lo maneja checkGameOver
  if (san.startsWith('O-O')) return 'castle';
  if (san.includes('+')) return 'check';
  if (san.includes('=')) return 'promote';
  if (move.captured || san.includes('x')) return 'capture';
  return 'move';
}

export function playMove(move) {
  const k = moveSound(move);
  if (k) Sound.play(k);
}

export default Sound;
