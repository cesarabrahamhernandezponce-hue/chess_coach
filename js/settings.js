// Ajustes del usuario (tema de tablero, coordenadas, sonido), persistidos en
// localStorage y aplicados al vuelo mediante variables CSS y clases del body.
import Sound from './sounds.js';

const KEY = 'entrenador-ajedrez-config';

export const BOARD_THEMES = {
  clasico: { label: 'Clásico', light: '#dce2ee', dark: '#454f6b' },
  verde:   { label: 'Verde',   light: '#ebecd0', dark: '#779556' },
  madera:  { label: 'Madera',  light: '#f0d9b5', dark: '#b58863' },
  azul:    { label: 'Azul',    light: '#dee3e6', dark: '#4b7399' },
  gris:    { label: 'Gris',    light: '#d2d2d2', dark: '#7d7d7d' },
};

// `threatAuto` sustituye al antiguo `showThreat`: la flecha de amenaza ya no se
// dibuja sola al empezar tu turno (te daba masticado el plan del rival), sino
// cuando la pides con el botón ⚠ o la tecla T. Quien la prefiera automática
// puede volver a activarla aquí.
const DEFAULTS = { boardTheme: 'clasico', coords: true, sound: true, threatAuto: false, repeatUntilGood: false, adaptiveElo: true };

let cfg = { ...DEFAULTS };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) cfg = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (_) { /* usa defaults */ }
  applyAll();
  return cfg;
}

export function getSettings() { return cfg; }

export function setSetting(k, v) {
  cfg[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) {}
  applyOne(k);
}

function applyOne(k) {
  if (k === 'boardTheme') {
    const t = BOARD_THEMES[cfg.boardTheme] || BOARD_THEMES.clasico;
    document.documentElement.style.setProperty('--light-sq', t.light);
    document.documentElement.style.setProperty('--dark-sq', t.dark);
  } else if (k === 'coords') {
    document.body.classList.toggle('no-coords', !cfg.coords);
  } else if (k === 'sound') {
    Sound.enabled = !!cfg.sound;
  }
}

export function applyAll() {
  applyOne('boardTheme');
  applyOne('coords');
  applyOne('sound');
}
