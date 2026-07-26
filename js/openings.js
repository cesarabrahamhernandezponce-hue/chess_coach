// Libro de aperturas embebido.
// Cada línea es una secuencia de [jugadaSAN, nombreDeLaAperturaTrasEsaJugada].
// Si el nombre es null, se hereda el último nombre asignado.
// A partir de estas líneas se construye un diccionario clave_FEN -> nombre.
import { Chess } from '../vendor/chess.mjs';

const PEON_REY = 'Apertura de peón de rey';
const PEON_DAMA = 'Apertura de peón de dama';

const OPENINGS = [
  // --- 1.e4 e5 ---
  { line: [
    ['e4', PEON_REY], ['e5', null], ['Nf3', null], ['Nc6', null],
    ['Bb5', 'Apertura Española (Ruy López)'], ['a6', 'Española: Variante Morphy'],
    ['Ba4', null], ['Nf6', null], ['O-O', 'Española: Cerrada'], ['Be7', null],
    ['Re1', null], ['b5', null], ['Bb3', null], ['d6', null],
  ]},
  { line: [
    ['e4', PEON_REY], ['e5', null], ['Nf3', null], ['Nc6', null],
    ['Bb5', 'Apertura Española (Ruy López)'], ['Nf6', 'Española: Defensa Berlinesa'],
    ['O-O', null], ['Nxe4', null], ['d4', null], ['Nd6', null],
  ]},
  { line: [
    ['e4', PEON_REY], ['e5', null], ['Nf3', null], ['Nc6', null],
    ['Bc4', 'Apertura Italiana'], ['Bc5', 'Italiana: Giuoco Piano'],
    ['c3', null], ['Nf6', null], ['d3', 'Italiana: Giuoco Pianissimo'], ['d6', null],
  ]},
  { line: [
    ['e4', PEON_REY], ['e5', null], ['Nf3', null], ['Nc6', null],
    ['Bc4', 'Apertura Italiana'], ['Nf6', 'Defensa de los Dos Caballos'],
    ['Ng5', null], ['d5', null], ['exd5', null], ['Na5', null],
  ]},
  { line: [
    ['e4', PEON_REY], ['e5', null], ['Nf3', null], ['Nc6', null],
    ['d4', 'Apertura Escocesa'], ['exd4', null], ['Nxd4', null], ['Nf6', null],
    ['Nxc6', null], ['bxc6', null], ['e5', null],
  ]},
  { line: [
    ['e4', PEON_REY], ['e5', null], ['Nf3', null], ['Nf6', 'Defensa Petrov (Rusa)'],
    ['Nxe5', null], ['d6', null], ['Nf3', null], ['Nxe4', null], ['d4', null], ['d5', null],
  ]},
  { line: [
    ['e4', PEON_REY], ['e5', null], ['Nf3', null], ['Nc6', null],
    ['Bb5', 'Apertura Española (Ruy López)'], ['a6', 'Española: Variante Morphy'],
    ['Bxc6', 'Española: Variante del Cambio'], ['dxc6', null], ['O-O', null],
  ]},
  // --- Siciliana ---
  { line: [
    ['e4', PEON_REY], ['c5', 'Defensa Siciliana'], ['Nf3', null], ['d6', null],
    ['d4', null], ['cxd4', null], ['Nxd4', null], ['Nf6', null],
    ['Nc3', null], ['a6', 'Siciliana: Variante Najdorf'],
  ]},
  { line: [
    ['e4', PEON_REY], ['c5', 'Defensa Siciliana'], ['Nf3', null], ['d6', null],
    ['d4', null], ['cxd4', null], ['Nxd4', null], ['Nf6', null],
    ['Nc3', null], ['g6', 'Siciliana: Variante del Dragón'],
  ]},
  { line: [
    ['e4', PEON_REY], ['c5', 'Defensa Siciliana'], ['Nf3', null], ['Nc6', null],
    ['d4', null], ['cxd4', null], ['Nxd4', null], ['Nf6', null],
    ['Nc3', null], ['e5', 'Siciliana: Variante Sveshnikov'],
  ]},
  { line: [
    ['e4', PEON_REY], ['c5', 'Defensa Siciliana'], ['Nf3', null], ['e6', null],
    ['d4', null], ['cxd4', null], ['Nxd4', null], ['a6', 'Siciliana: Variante Kan'],
  ]},
  { line: [
    ['e4', PEON_REY], ['c5', 'Defensa Siciliana'], ['Nc3', 'Siciliana: Variante Cerrada'],
    ['Nc6', null], ['g3', null], ['g6', null], ['Bg2', null], ['Bg7', null],
  ]},
  // --- Francesa ---
  { line: [
    ['e4', PEON_REY], ['e6', 'Defensa Francesa'], ['d4', null], ['d5', null],
    ['Nc3', null], ['Nf6', 'Francesa: Variante Clásica'], ['Bg5', null], ['Be7', null],
  ]},
  { line: [
    ['e4', PEON_REY], ['e6', 'Defensa Francesa'], ['d4', null], ['d5', null],
    ['Nc3', null], ['Bb4', 'Francesa: Variante Winawer'], ['e5', null], ['c5', null],
  ]},
  { line: [
    ['e4', PEON_REY], ['e6', 'Defensa Francesa'], ['d4', null], ['d5', null],
    ['e5', 'Francesa: Variante del Avance'], ['c5', null], ['c3', null], ['Nc6', null],
  ]},
  // --- Caro-Kann ---
  { line: [
    ['e4', PEON_REY], ['c6', 'Defensa Caro-Kann'], ['d4', null], ['d5', null],
    ['Nc3', null], ['dxe4', null], ['Nxe4', null], ['Bf5', 'Caro-Kann: Variante Clásica'],
    ['Ng3', null], ['Bg6', null],
  ]},
  { line: [
    ['e4', PEON_REY], ['c6', 'Defensa Caro-Kann'], ['d4', null], ['d5', null],
    ['e5', 'Caro-Kann: Variante del Avance'], ['Bf5', null], ['Nf3', null], ['e6', null],
  ]},
  // --- Otras respuestas a 1.e4 ---
  { line: [
    ['e4', PEON_REY], ['d5', 'Defensa Escandinava'], ['exd5', null], ['Qxd5', null],
    ['Nc3', null], ['Qa5', null],
  ]},
  { line: [
    ['e4', PEON_REY], ['d6', 'Defensa Pirc'], ['d4', null], ['Nf6', null],
    ['Nc3', null], ['g6', null], ['Nf3', null], ['Bg7', null],
  ]},
  // --- 1.d4 d5 ---
  { line: [
    ['d4', PEON_DAMA], ['d5', null], ['c4', 'Gambito de Dama'], ['e6', 'Gambito de Dama Rechazado'],
    ['Nc3', null], ['Nf6', null], ['Bg5', null], ['Be7', null], ['e3', null], ['O-O', null],
  ]},
  { line: [
    ['d4', PEON_DAMA], ['d5', null], ['c4', 'Gambito de Dama'], ['dxc4', 'Gambito de Dama Aceptado'],
    ['Nf3', null], ['Nf6', null], ['e3', null], ['e6', null], ['Bxc4', null], ['c5', null],
  ]},
  { line: [
    ['d4', PEON_DAMA], ['d5', null], ['c4', 'Gambito de Dama'], ['c6', 'Defensa Eslava'],
    ['Nf3', null], ['Nf6', null], ['Nc3', null], ['dxc4', 'Eslava Aceptada'], ['a4', null], ['Bf5', null],
  ]},
  { line: [
    ['d4', PEON_DAMA], ['d5', null], ['Bf4', 'Sistema Londres'], ['Nf6', null],
    ['e3', null], ['e6', null], ['Nf3', null], ['Bd6', null], ['Bg3', null], ['O-O', null],
  ]},
  // --- 1.d4 Nf6 (Indias) ---
  { line: [
    ['d4', PEON_DAMA], ['Nf6', 'Defensa India'], ['c4', null], ['g6', null],
    ['Nc3', null], ['Bg7', null], ['e4', 'Defensa India de Rey'], ['d6', null],
    ['Nf3', null], ['O-O', null], ['Be2', null], ['e5', null],
  ]},
  { line: [
    ['d4', PEON_DAMA], ['Nf6', 'Defensa India'], ['c4', null], ['e6', null],
    ['Nc3', null], ['Bb4', 'Defensa India de Nimzo'], ['e3', null], ['O-O', null],
    ['Bd3', null], ['d5', null],
  ]},
  { line: [
    ['d4', PEON_DAMA], ['Nf6', 'Defensa India'], ['c4', null], ['e6', null],
    ['Nf3', null], ['b6', 'Defensa India de Dama'], ['g3', null], ['Ba6', null],
  ]},
  { line: [
    ['d4', PEON_DAMA], ['Nf6', 'Defensa India'], ['c4', null], ['g6', null],
    ['Nc3', null], ['d5', 'Defensa Grünfeld'], ['cxd5', null], ['Nxd5', null],
    ['e4', null], ['Nxc3', null], ['bxc3', null], ['Bg7', null],
  ]},
  { line: [
    ['d4', PEON_DAMA], ['f5', 'Defensa Holandesa'], ['g3', null], ['Nf6', null],
    ['Bg2', null], ['e6', null], ['Nf3', null], ['Be7', null],
  ]},
  // --- 1.c4 Inglesa ---
  { line: [
    ['c4', 'Apertura Inglesa'], ['e5', 'Inglesa: Siciliana Invertida'], ['Nc3', null], ['Nf6', null],
    ['Nf3', null], ['Nc6', null], ['g3', null], ['d5', null], ['cxd5', null], ['Nxd5', null],
  ]},
  { line: [
    ['c4', 'Apertura Inglesa'], ['c5', 'Inglesa: Simétrica'], ['Nf3', null], ['Nf6', null],
    ['Nc3', null], ['Nc6', null], ['g3', null], ['g6', null],
  ]},
  { line: [
    ['c4', 'Apertura Inglesa'], ['Nf6', null], ['Nc3', null], ['e6', null],
    ['Nf3', null], ['d5', null], ['d4', 'Transposición a Gambito de Dama'],
  ]},
  // --- 1.Nf3 Réti ---
  { line: [
    ['Nf3', 'Apertura Réti'], ['d5', null], ['c4', null], ['d4', null],
    ['b4', null], ['g6', null],
  ]},
  { line: [
    ['Nf3', 'Apertura Réti'], ['Nf6', null], ['g3', 'Ataque Rey Indio'], ['g6', null],
    ['Bg2', null], ['Bg7', null], ['O-O', null], ['O-O', null],
  ]},
];

function fenKey(fen) {
  // Placement + turno + enroques + al paso (ignora relojes/número de jugada).
  return fen.split(' ').slice(0, 4).join(' ');
}

function buildBook() {
  const byPosition = new Map(); // fenKey -> nombre
  for (const { line } of OPENINGS) {
    const game = new Chess();
    let currentName = null;
    for (const [san, name] of line) {
      if (name) currentName = name;
      const move = game.move(san);
      if (!move) {
        throw new Error(`Jugada ilegal en el libro: "${san}" desde ${game.fen()}`);
      }
      const key = fenKey(game.fen());
      if (!byPosition.has(key)) byPosition.set(key, currentName);
    }
  }
  return byPosition;
}

export const book = buildBook();

// Devuelve el nombre de la apertura para una posición, o null si no está en el libro.
export function lookupOpening(fen) {
  return book.get(fenKey(fen)) || null;
}

// True si la posición pertenece al libro de aperturas.
export function isBookPosition(fen) {
  return book.has(fenKey(fen));
}
