import { Chess } from '../vendor/chess.mjs';
import { explainMyMove, explainBest, sacrificedMaterial } from '../js/coach.js';

let fails = 0;
const check = (cond, msg, got) => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}${cond ? '' : '  => ' + got}`);
};

// Helper: juega una jugada y devuelve {move, postFen}.
function play(fen, from, to, promo) {
  const c = new Chess(fen);
  const move = c.move({ from, to, promotion: promo || 'q' });
  return { move, postFen: c.fen() };
}

// 1. Desarrollo de caballo al centro (1.e4 e5 2.Nf3): desde g1 no llega al centro,
//    usemos Nc3 (b1->c3) que no es centro; probemos desarrollo simple.
{
  const { move, postFen } = play('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'g1', 'f3');
  const why = explainMyMove({ categoryKey: 'best', move, postFen, cpl: 0, sacMaterial: 0 });
  check(/[Dd]esarrollas/.test(why), 'desarrollo de caballo', why);
}

// 2. Avance central de peón e2-e4.
{
  const { move, postFen } = play(new Chess().fen(), 'e2', 'e4');
  const why = explainMyMove({ categoryKey: 'best', move, postFen, cpl: 0, sacMaterial: 0 });
  check(/centro/.test(why), 'peón al centro', why);
}

// 3. Enroque corto.
{
  const fen = 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  const { move, postFen } = play(fen, 'e1', 'g1');
  const why = explainMyMove({ categoryKey: 'best', move, postFen, cpl: 0, sacMaterial: 0 });
  check(/[Ee]nrocas/.test(why), 'enroque', why);
}

// 4. Captura que gana material limpio (dama negra colgada en d5, la toma un peón).
{
  const fen = 'rnb1kbnr/ppp1pppp/8/3q4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1';
  const { move, postFen } = play(fen, 'e2', 'e4'); // no captura; en su lugar:
  // Mejor: caballo/algo capture. Montamos captura directa: peón c4 x d5 dama.
  const fen2 = 'rnb1kbnr/ppp1pppp/8/3q4/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 0 1';
  const r = play(fen2, 'c4', 'd5');
  const why = explainMyMove({ categoryKey: 'best', move: r.move, postFen: r.postFen, cpl: 0, sacMaterial: sacrificedMaterial(r.postFen) });
  check(/[Gg]anas material/.test(why), 'captura que gana material', why);
}

// 5. Jugada floja que cuelga una pieza: mover el alfil a una casilla donde lo ganan.
{
  // Blancas mueven Bb5-a4? probemos colgar: alfil a f7? Montamos: alfil blanco va a h5 sin apoyo, peón g lo toma.
  const fen = 'rnbqkbnr/pppp1ppp/8/6B1/8/8/PPPPPPPP/RN1QKBNR b KQkq - 0 1';
  // Aquí el alfil blanco en g5 lo puede tomar el peón... pero mueve negro; hagamos que negro cuelgue.
  // Simplificamos: negro juega h7-h6? no cuelga. Usamos posición donde negro deja dama en toma.
  const fen2 = 'rnb1kbnr/pppp1ppp/8/4p3/6q1/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 1';
  const r = play(fen2, 'f3', 'g4'); // peón toma dama? no, mueve blanco; en g4 hay dama negra -> fxg4 gana dama
  const why = explainMyMove({ categoryKey: 'best', move: r.move, postFen: r.postFen, cpl: 0, sacMaterial: sacrificedMaterial(r.postFen) });
  check(/[Gg]anas material/.test(why), 'peón captura dama colgada', why);
}

// 6. Brillante.
{
  const why = explainMyMove({ categoryKey: 'brilliant', move: { piece: 'n', flags: 'c', from: 'e5', to: 'f7', color: 'w', captured: 'p' }, postFen: new Chess().fen(), cpl: 0, sacMaterial: 3 });
  check(/[Ss]acrificas/.test(why), 'brillante = sacrificio', why);
}

// 7. explainBest no revienta y devuelve algo.
{
  const why = explainBest(new Chess().fen(), 'e2e4');
  check(typeof why === 'string' && why.length > 0, 'explainBest devuelve texto', why);
}

// 8. Jugada mala que cuelga una pieza: debe decir claramente que queda sin protección.
{
  // Blancas juegan Bc4-f7?? no legal sin captura; montamos alfil que se mete solo en toma:
  // Alfil blanco a b5, peón negro a6 lo puede tomar limpio.
  const fen = 'rnbqkbnr/1ppppppp/p7/8/8/4P3/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  const { move, postFen } = play(fen, 'f1', 'b5'); // axb5 gana el alfil
  const why = explainMyMove({ categoryKey: 'blunder', move, postFen, cpl: 300, sacMaterial: sacrificedMaterial(postFen), oppReplyUci: 'a6b5' });
  check(/sin protecci|sin defensa/.test(why) && /material/.test(why), 'cuelga pieza = explicación clara', why);
}

// 9. Caballo al borde (Nh3): debe señalar el defecto posicional y el castigo (d5, centro).
{
  const { move, postFen } = play(new Chess().fen(), 'g1', 'h3');
  const why = explainMyMove({ categoryKey: 'inaccuracy', move, postFen, cpl: 90, sacMaterial: 0, oppReplyUci: 'd7d5' });
  check(/borde/.test(why) && /centro|d5/.test(why), 'caballo al borde: defecto + castigo', why);
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
