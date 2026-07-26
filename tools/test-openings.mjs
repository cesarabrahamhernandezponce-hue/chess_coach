// Verifica que todas las secuencias del libro de aperturas sean legales
// y que el diccionario se construya sin colisiones de nombres.
import { Chess } from '../vendor/chess.mjs';
import { book, lookupOpening, isBookPosition } from '../js/openings.js';

let ok = 0;
let fail = 0;

function check(cond, msg) {
  if (cond) { ok++; }
  else { fail++; console.error('  ✗ ' + msg); }
}

console.log('Verificando el libro de aperturas...\n');

// 1) El libro se construyó (buildBook ya lanzaría si hubiera jugada ilegal).
check(book.size > 0, 'el libro no está vacío');
console.log(`  Posiciones en el libro: ${book.size}`);

// 2) Secuencias conocidas quedan reconocidas con el nombre correcto.
const casos = [
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], esperado: 'Española' },
  { moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'], esperado: 'Najdorf' },
  { moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4'], esperado: 'Winawer' },
  { moves: ['e4', 'c6', 'd4', 'd5'], esperado: 'Caro-Kann' },
  { moves: ['d4', 'd5', 'c4', 'dxc4'], esperado: 'Aceptado' },
  { moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], esperado: 'Nimzo' },
  { moves: ['d4', 'd5', 'Bf4'], esperado: 'Londres' },
  { moves: ['c4', 'e5'], esperado: 'Inglesa' },
];

for (const { moves, esperado } of casos) {
  const game = new Chess();
  let legal = true;
  for (const m of moves) {
    if (!game.move(m)) { legal = false; break; }
  }
  check(legal, `secuencia legal: ${moves.join(' ')}`);
  if (legal) {
    const nombre = lookupOpening(game.fen());
    check(nombre !== null, `posición reconocida: ${moves.join(' ')}`);
    check(nombre && nombre.includes(esperado),
      `nombre contiene "${esperado}" (obtenido: "${nombre}") para ${moves.join(' ')}`);
  }
}

// 3) Una posición fuera del libro no se reconoce.
const raro = new Chess();
raro.move('a4'); raro.move('a5'); raro.move('h4'); raro.move('h5');
check(!isBookPosition(raro.fen()), 'posición rara NO está en el libro');

console.log(`\nResultado: ${ok} correctas, ${fail} fallidas`);
process.exit(fail === 0 ? 0 : 1);
