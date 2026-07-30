// Temario de la sección "Enseñar aperturas".
//
// Un CURSO es una apertura vista desde un bando (`side`). Cada curso tiene
// LECCIONES (`lines`): una secuencia de jugadas con la explicación del porqué de
// cada una. En cada jugada se puede declarar:
//
//   san    jugada en notación algebraica (obligatoria)
//   why    por qué se juega (se muestra tras jugarla)  [HTML]
//   ask    pregunta guía para TU jugada: la idea, sin delatar la jugada
//   plan   plan a medio plazo que abre esa jugada (opcional)
//   tag    'clave' para marcarla como jugada temática
//   also   otras jugadas jugables en ese punto, como nota (opcional)
//   alts   respuestas alternativas DEL RIVAL: [{ san, name, note, goto }]
//          `goto` = id de la lección que cubre esa respuesta (se puede saltar)
//   traps  { SAN_equivocado: { text, punish? } } por qué falla ese error típico
//
// Todo se valida en tools/test-courses.mjs (legalidad, prefijos de los `goto`,
// turnos correctos y que los errores de `traps` sean jugadas legales).
import { Chess } from '../vendor/chess.mjs';

// ---------------------------------------------------------------------------
// CURSO 1 — El Gambito de Dama, con blancas
// ---------------------------------------------------------------------------

const GDA = {
  id: 'gda',
  title: 'Gambito de Dama Aceptado (2…dxc4)',
  short: 'Te toman el peón y lo recuperas con centro y desarrollo. Empieza por aquí.',
  moves: [
    {
      san: 'd4',
      ask: 'Abre la partida ocupando el centro con el peón de dama.',
      why: 'Ocupa el centro y controla e5 y c5. La ventaja sobre 1.e4 es que este peón nace <b>defendido por la dama</b>: la posición es estable desde la primera jugada.',
    },
    {
      san: 'd5',
      why: 'La respuesta más directa y más sólida: las negras copian tu idea y ocupan el centro. Los dos peones se bloquean y ninguno puede avanzar.',
    },
    {
      san: 'c4',
      tag: 'clave',
      ask: 'El peón de d5 es el que sostiene todo el centro negro. ¿Cómo lo atacas con un peón?',
      why: '<b>El Gambito de Dama.</b> Atacas d5 con un peón de flanco, que vale menos que el peón central. El nombre engaña: <b>no regalas nada</b>. Si te lo toman, lo recuperas siempre.',
      plan: 'Detrás de c4 hay un plan completo: Nc3 y Nf3 al centro, e3 para sostener d4, y la columna c medio abierta para tus torres.',
      also: 'Otras formas de jugar 1.d4 son 2.Nf3 o 2.Bf4 (Sistema Londres), más fáciles pero menos ambiciosas: no discuten d5.',
    },
    {
      san: 'dxc4',
      why: '<b>Gambito de Dama Aceptado.</b> Las negras ganan un peón, pero pagan un precio alto: sueltan el centro. Ya no queda ningún peón negro que discuta d4 ni e4.',
      alts: [
        { san: 'e6', name: 'Gambito de Dama Rechazado', note: 'Sostienen d5 con el peón de e6. Sólido, pero encierra su alfil de c8.', goto: 'gdr' },
        { san: 'c6', name: 'Defensa Eslava', note: 'Sostienen d5 con el peón de c6 y dejan libre la diagonal de su alfil.', goto: 'eslava' },
        { san: 'c5', name: 'Defensa Simétrica', note: 'Contragolpe inmediato en el centro. Respondes 3.cxd5 y si 3…Nf6, 4.dxc5, quedándote un peón de ventaja momentáneo.' },
        { san: 'Nf6', name: 'Defensa Marshall', note: 'Dudosa: 3.cxd5 Nxd5 4.e4! y el caballo tiene que volver mientras tú montas un centro enorme.' },
      ],
    },
    {
      san: 'Nf3',
      tag: 'clave',
      ask: 'Antes de recuperar el peón hay una jugada de <b>orden</b>. ¿Qué casilla no puedes dejar que ocupen las negras con un peón?',
      why: 'El <b>orden importa</b>. Nf3 vigila <b>e5</b>: ahora …e5 sería perder un peón (Nxe5). Sin esto, las negras devolverían el peón para plantar dos peones en el centro y neutralizar todo tu plan.',
      also: 'También se juega 3.e4 (Variante Central, muy agresiva) y 3.Qa4+ (recupera el peón de inmediato, pero saca la dama muy pronto).',
      traps: {
        e3: {
          text: 'Prisa. <b>3.e3?! e5!</b> y las negras <b>devuelven</b> el peón para conseguir lo único que les faltaba: peones en el centro. Tras 4.Bxc4 exd4 5.exd4 la posición se ha simplificado y tu ventaja se ha evaporado. Primero <b>Nf3</b>, para que …e5 sea imposible.',
          punish: 'e5',
        },
        Nc3: {
          text: 'Natural, pero deja pasar lo mismo: <b>4…e5!</b> le da a las negras el centro que acabas de comprar. La casilla que hay que vigilar es <b>e5</b>, y el que la vigila es el caballo de <b>f3</b>.',
        },
      },
    },
    {
      san: 'Nf6',
      why: 'Desarrollo con propósito: el caballo controla <b>e4</b> y <b>d5</b>, así que te impide montar el centro ideal con e4.',
      alts: [
        { san: 'b5', name: 'Intentan aguantar el peón', note: '¡Es codicia y se castiga! Míralo en la lección "Castigo a la codicia".', goto: 'codicia' },
        { san: 'e6', name: 'Orden alternativo', note: 'Transpone a lo mismo tras 4.e3 Nf6 5.Bxc4.' },
        { san: 'Nc6', name: 'Ideas de …e5', note: 'Prepara …e5. Respondes 4.e3 y 5.Bxc4 con desarrollo cómodo.' },
      ],
    },
    {
      san: 'e3',
      ask: 'Toca preparar la recuperación del peón. ¿Qué peón abre la diagonal de tu alfil de f1 <b>y</b> sostiene d4 a la vez?',
      why: 'Jugada modesta con dos funciones: <b>sostiene d4</b> y <b>abre la diagonal f1–a6</b> para que el alfil vaya a comerse el peón de c4. En el Gambito de Dama las jugaditas de peón como e3 valen oro.',
      traps: {
        e4: {
          text: 'Ambicioso pero prematuro: <b>4.e4?</b> deja d4 <b>colgando</b> y las negras golpean con 4…Nxe4 o con …e5 / …c5 contra un centro sin apoyo. e3 es más lento pero <b>sostiene</b> d4, que es la base de toda tu posición.',
        },
        Nc3: {
          text: 'No es mala jugada, pero no avanza tu plan: el peón de c4 sigue vivo. <b>e3</b> tiene un objetivo concreto e inmediato: abrirle paso al alfil hacia c4.',
        },
      },
    },
    {
      san: 'e6',
      why: 'Las negras abren la salida a su alfil de f8 para poder enrocar. Es la jugada útil que casi siempre toca en estas posiciones.',
    },
    {
      san: 'Bxc4',
      tag: 'clave',
      ask: 'El momento de la verdad: recupera el peón con la pieza correcta.',
      why: '<b>Cobras el gambito.</b> Cuenta lo que ha pasado: material igualado, tú tienes un peón en d4 (las negras ninguno en el centro), y tu alfil apunta a f7 desde una diagonal magnífica. Eso es todo el Gambito de Dama en una frase.',
      plan: 'Sigue: O-O, Nc3, Qe2 y la ruptura <b>e4</b> o presión por la columna d. Las negras tienen que resolver el problema del espacio.',
      traps: {
        'Qa4+': {
          text: 'Recupera el peón con jaque, sí, pero con la <b>dama</b>: la pieza más valiosa en la casilla más expuesta. Tras …Nbd7 o …Bd7 las negras tapan el jaque y luego ganan tiempo atacándola. La regla: <b>recupera con la pieza más barata</b> que pueda, y aquí es el <b>alfil</b>.',
        },
        Bd3: {
          text: 'El alfil sale, pero se olvida del peón. Toda la maniobra e3 servía justo para que el alfil llegase a <b>c4</b>: cóbralo.',
        },
        Be2: {
          text: 'Casilla pasiva y encima deja vivo el peón de c4. El alfil tiene una diagonal mucho mejor y un peón que cobrar: <b>Bxc4</b>.',
        },
      },
    },
    {
      san: 'c5',
      why: 'La reacción correcta de las negras: golpean d4 para no morir de asfixia. Si no lo hacen nunca, tu peón de d4 les quita todo el espacio.',
    },
    {
      san: 'O-O',
      ask: 'Tienes el centro, el peón recuperado y el desarrollo hecho. ¿Qué es lo último que falta antes de atacar?',
      why: '<b>Rey a salvo primero.</b> Con el rey enrocado ya puedes pensar en dxc5, Nc3, Qe2 y e4 sin miedo a que te abran el centro con el rey en medio.',
    },
  ],
  keys: [
    'El peón de c4 <b>siempre se recupera</b>: la maniobra es e3 y luego <b>Bxc4</b>.',
    'El orden es sagrado: <b>Nf3 antes de e3</b>, para que las negras nunca puedan jugar …e5.',
    'Lo que compras con el gambito no es material, es el <b>centro</b>: tú con peón en d4, ellas sin ninguno.',
    'Recupera siempre con la pieza más barata (el alfil), nunca con la dama.',
  ],
};

const GDR = {
  id: 'gdr',
  title: 'Gambito de Dama Rechazado (2…e6)',
  short: 'No te toman el peón: lo defienden. Aprende a presionar d5 y el alfil malo negro.',
  moves: [
    { san: 'd4', ask: 'Abre con el peón de dama.', why: 'Centro y control de e5/c5, con el peón defendido por la dama.' },
    { san: 'd5', why: 'Las negras ocupan el centro y bloquean tu peón.' },
    {
      san: 'c4', tag: 'clave',
      ask: 'Ataca el peón que sostiene el centro negro.',
      why: 'El Gambito de Dama. Ahora las negras tienen que decidir: tomar o defender.',
    },
    {
      san: 'e6',
      why: '<b>Gambito de Dama Rechazado.</b> Defienden d5 con un peón, así que el centro sigue trabado y muy sólido… pero pagan un precio permanente: acaban de <b>encerrar su alfil de c8</b> detrás de sus propios peones. Ese es el famoso "alfil malo" del GDR, y su problema durante toda la partida.',
      alts: [
        { san: 'dxc4', name: 'Gambito de Dama Aceptado', note: 'Toman el peón y sueltan el centro.', goto: 'gda' },
        { san: 'c6', name: 'Defensa Eslava', note: 'Defienden d5 sin encerrar el alfil: la mejor versión de esta idea.', goto: 'eslava' },
        { san: 'c5', name: 'Defensa Tarrasch', note: 'Contragolpe inmediato. Aceptan un peón aislado en d5 a cambio de piezas activas: 3.cxd5 exd5 4.Nf3.' },
        { san: 'Nc6', name: 'Defensa Chigorin', note: 'Poco común. 3.Nf3 y las negras juegan a cambiar en el centro con …dxc4 y …e5.' },
      ],
    },
    {
      san: 'Nc3',
      ask: 'El peón de d5 ya está atacado una vez. ¿Cómo lo atacas por segunda vez y desarrollas a la vez?',
      why: '<b>Segunda presión sobre d5.</b> El caballo también prepara Bg5 y, más adelante, la ruptura e4. En el GDR la partida entera gira alrededor de <b>quién manda en d5</b>.',
    },
    {
      san: 'Nf6',
      why: 'El defensor natural de d5: ahora ese peón está atacado dos veces y defendido dos veces (peón de e6 y caballo de f6).',
      alts: [
        { san: 'c6', name: 'Defensa Semi-Eslava', note: 'Sostienen d5 con todo. Da lugar a la Meran y al Anti-Meran, teoría muy densa.' },
        { san: 'Be7', name: 'Orden flexible', note: 'Transpone casi siempre a lo mismo tras 4.Nf3 Nf6.' },
        { san: 'c5', name: 'Tarrasch retrasada', note: 'Buscan actividad al precio de un peón aislado en d5.' },
      ],
    },
    {
      san: 'Bg5',
      tag: 'clave',
      ask: 'El peón de d5 está defendido por el caballo de f6. ¿Cómo atacas al <b>defensor</b> en lugar de al peón?',
      why: '<b>La jugada temática del GDR.</b> No atacas d5 otra vez: atacas a <b>quien lo defiende</b>. El caballo de f6 queda incómodo y las negras tienen que gastar jugadas en resolverlo. Si algún día ese caballo desaparece, d5 se cae.',
      plan: 'Regla de oro: cuando un punto está bien defendido, <b>elimina o incomoda al defensor</b>. Aquí ese defensor es el caballo de f6.',
      traps: {
        cxd5: {
          text: 'Cambiar así <b>suelta la tensión</b> demasiado pronto y les hace un favor: tras 4…exd5 su alfil de c8 <b>ya está libre</b>, que era justo su único problema. La tensión en el centro te beneficia a ti: manténla.',
          punish: 'exd5',
        },
        e3: {
          text: 'Correcta más adelante, pero la juegas <b>después</b> de Bg5: si tocas e3 primero, encierras a tu alfil de c1 y la clavada en g5 deja de estar disponible. <b>Saca las piezas antes de cerrarles la puerta.</b>',
        },
      },
    },
    {
      san: 'Be7',
      why: 'Rompen la presión sobre f6 y preparan el enroque. Es la <b>Defensa Ortodoxa</b>, la manera clásica y más sólida de jugar el GDR.',
      alts: [
        { san: 'Bb4', name: 'Defensa Ragozin', note: 'Clavan tu caballo de c3, que es el que presiona d5. Muy de moda a nivel alto.' },
        { san: 'Nbd7', name: 'Cambridge Springs', note: 'Invitan a 5.cxd5 exd5 6.Nxd5?? Nxd5! 7.Bxd8 Bb4+! y ganan pieza. ¡Nunca tomes en d5 con el caballo mientras su alfil pueda dar Bb4+!' },
        { san: 'h6', name: 'Expulsan al alfil', note: 'Ganan espacio, debilitan g6. Respondes Bxf6 o Bh4.' },
      ],
    },
    {
      san: 'e3',
      ask: 'Ya tienes tres piezas fuera. Toca la jugadita de peón que sostiene d4 y libera a tu alfil de f1.',
      why: '<b>Ahora sí.</b> Sostiene d4 (que tras un futuro …c5 será atacado) y abre paso al alfil de f1 hacia d3 o e2. El alfil de c1 ya está fuera, así que e3 no encierra nada.',
    },
    {
      san: 'O-O',
      why: 'Las negras ponen el rey a salvo. La posición es la <b>Ortodoxa clásica</b>: sólida como una roca, pero con menos espacio y ese alfil de c8 aún sin resolver.',
    },
    {
      san: 'Bd3',
      ask: 'Coloca tu último alfil en la diagonal que apunta al enroque negro.',
      why: 'El alfil mira a <b>h7</b> y prepara Nf3 y O-O. Con esto has completado el desarrollo entero sin una sola concesión.',
      plan: 'Tus dos planes clásicos desde aquí: <b>1)</b> el <b>ataque de minorías</b> — cambia en d5 y avanza b4-b5 para reventarles la columna c y dejarles un peón débil en c6; <b>2)</b> la ruptura <b>e4</b>, abriendo el centro donde estás mejor desarrollado.',
    },
  ],
  keys: [
    'Con …e6 las negras son sólidas, pero <b>encierran su alfil de c8</b>: ese es su problema permanente.',
    '<b>No sueltes la tensión</b> con cxd5 sin motivo: liberas justo al alfil que ellas tienen atrapado.',
    'Ataca al <b>defensor</b> (Bg5 contra el caballo de f6), no al punto defendido.',
    'Saca las piezas <b>antes</b> de jugar e3: primero Bg5, luego e3.',
    'Planes finales: <b>ataque de minorías</b> (b4-b5) o ruptura <b>e4</b>.',
  ],
};

const ESLAVA_BLANCAS = {
  id: 'eslava',
  title: 'Defensa Eslava (2…c6)',
  short: 'La defensa más sana contra tu gambito. Aprende a impedir …b5 con a4.',
  moves: [
    { san: 'd4', ask: 'Abre con el peón de dama.', why: 'Centro y estabilidad.' },
    { san: 'd5', why: 'Simetría en el centro.' },
    { san: 'c4', tag: 'clave', ask: 'Ataca d5.', why: 'El Gambito de Dama.' },
    {
      san: 'c6',
      why: '<b>Defensa Eslava.</b> Defienden d5 igual que con …e6, pero con el peón de c6: la diferencia es enorme, porque la diagonal c8–h3 <b>sigue abierta</b> y su alfil de c8 podrá salir a f5 o g4. Es la defensa más lógica contra el Gambito de Dama.',
      alts: [
        { san: 'e6', name: 'Gambito de Dama Rechazado', note: 'Misma idea, pero encierran su alfil.', goto: 'gdr' },
        { san: 'dxc4', name: 'Gambito de Dama Aceptado', note: 'Toman y sueltan el centro.', goto: 'gda' },
      ],
    },
    {
      san: 'Nf3',
      ask: 'Desarrolla el caballo a su mejor casilla, la que vigila e5.',
      why: 'Desarrollo natural que además vigila <b>e5</b>: la casilla que siempre hay que controlar en el Gambito de Dama.',
    },
    { san: 'Nf6', why: 'Desarrollo simétrico. Controlan e4 y refuerzan d5.' },
    {
      san: 'Nc3',
      ask: 'Presiona d5 por segunda vez desarrollando la otra pieza.',
      why: 'Aumentas la presión sobre d5. Las negras tienen que decidir ya: o toman en c4, o sostienen con …e6 (Semi-Eslava).',
    },
    {
      san: 'dxc4',
      why: '<b>Eslava Aceptada.</b> Ahora sí toman, y con una idea concreta: como ya jugaron …c6, pueden sostener el peón con <b>…b5</b> (el peón de c6 defendería a b5). Ahí está la trampa que tienes que desactivar.',
      alts: [
        { san: 'e6', name: 'Defensa Semi-Eslava', note: 'Lo defienden todo. Sólida y densa: lleva a la Meran (5.e3) o al Anti-Meran (5.Bg5).' },
        { san: 'a6', name: 'Variante Chebanenko', note: 'Preparan …b5 con calma. Respondes 5.e3 o 5.a4.' },
        { san: 'g6', name: 'Eslava Schlechter', note: 'Poco común: colocan el alfil en g7 en lugar de f5.' },
      ],
    },
    {
      san: 'a4',
      tag: 'clave',
      ask: 'Las negras quieren sostener el peón de c4 con <b>…b5</b>. ¿Cómo se lo impides <b>antes</b> de que lo jueguen?',
      why: '<b>La jugada clave de toda la variante.</b> Ahora …b5 es imposible: axb5 y el peón cae. Sin a4 las negras consolidan con …b5 y …Bb7 y se quedan con el peón de verdad.',
      plan: 'a4 tiene un coste: debilita <b>b4</b>, y el caballo negro puede ir a b4 o a d5 usando esa casilla. Es el precio justo por recuperar el peón.',
      traps: {
        e3: {
          text: 'Es tu jugada normal en el Gambito de Dama, pero aquí llega <b>tarde</b>: <b>5.e3? b5!</b> y ahora sí sostienen el peón (b5 defendido por c6). Tras …Bb7 y …a6 tendrías un peón menos de verdad. Con …c6 en el tablero, <b>a4 va antes que e3</b>.',
          punish: 'b5',
        },
        e4: {
          text: 'Existe y es agresivo (<b>Gambito Geller-Tolush</b>): montas un centro enorme a cambio del peón. Pero es una línea muy afilada y hay que saberla al detalle. Con <b>a4</b> recuperas el peón <b>sin riesgo</b>, y eso es lo que quieres cuando estás aprendiendo la apertura.',
        },
        Ne5: {
          text: 'El caballo salta a una casilla bonita, pero sin apoyo: tras …Nbd7 o …e6 y …Bd6 lo expulsan y habrás perdido tiempo. La prioridad es <b>a4</b>.',
        },
      },
    },
    {
      san: 'Bf5',
      why: '<b>La razón de ser de la Eslava.</b> El alfil sale <b>por fuera</b> de la cadena de peones, antes de jugar …e6. Compara con el GDR, donde este alfil se queda encerrado toda la partida: por eso muchos consideran la Eslava la mejor defensa contra el Gambito de Dama.',
      alts: [
        { san: 'Bg4', name: 'Otra casilla del alfil', note: 'También sale por fuera. Respondes Ne5 atacándolo.' },
        { san: 'e6', name: 'Vuelven al encierro', note: 'Incoherente: encierran el alfil habiendo jugado …c6, y ya no pueden sostener c4.' },
      ],
    },
    {
      san: 'e3',
      ask: 'Ahora sí toca la jugadita de siempre: sostén d4 y abre paso al alfil de f1.',
      why: '<b>Ahora sí es el momento.</b> Sostiene d4 y abre la diagonal para Bxc4. Con a4 ya jugada, las negras no tienen forma de sostener el peón: lo recuperas la jugada que viene.',
      plan: 'Sigue Bxc4, O-O y a veces Qe2 con la idea de e4, quedándote con más espacio en el centro.',
    },
  ],
  keys: [
    'Con …c6 las negras defienden d5 <b>sin</b> encerrar su alfil de c8: la Eslava es más sana que el GDR.',
    'Si toman en c4 habiendo jugado …c6, amenazan sostenerlo con <b>…b5</b>.',
    'La cura es <b>a4</b>, y va <b>antes</b> de e3. Ese es el único detalle que hay que recordar.',
    'a4 debilita b4: acepta ese pequeño coste, recuperar el peón vale más.',
  ],
};

const CODICIA = {
  id: 'codicia',
  title: 'Castigo a la codicia (3…b5)',
  short: 'Qué hacer cuando el rival se empeña en quedarse con el peón. Muy instructiva.',
  moves: [
    { san: 'd4', ask: 'Abre con el peón de dama.', why: 'Centro.' },
    { san: 'd5', why: 'Simetría.' },
    { san: 'c4', tag: 'clave', ask: 'Ofrece el gambito.', why: 'Atacas d5.' },
    { san: 'dxc4', why: 'Aceptan el peón.' },
    { san: 'Nf3', ask: 'La jugada de orden: vigila e5 antes de recuperar el peón.', why: 'Nf3 impide …e5.' },
    {
      san: 'b5',
      why: '<b>Aquí está la codicia.</b> Las negras no quieren devolver el peón y lo sostienen con …b5. Parece que funciona: c4 está defendido por b5. Pero han hecho <b>dos jugadas de peón en el flanco</b> con el rey sin enrocar y sin una sola pieza desarrollada. Eso se castiga.',
      alts: [
        { san: 'Nf6', name: 'Lo correcto', note: 'Desarrollarse y devolver el peón: eso es el GDA normal.', goto: 'gda' },
      ],
    },
    {
      san: 'a4',
      tag: 'clave',
      ask: 'La cadena negra es b5–c4. Un peón defendido solo cae si atacas <b>a quien lo defiende</b>. ¿Qué peón tuyo puede atacar a b5?',
      why: '<b>a4: golpea la base de la cadena.</b> El peón de c4 está defendido por b5, así que no atacas c4: atacas <b>b5</b>. Si b5 cae, c4 se queda solo y también cae. Esta es una idea que sirve en toda tu vida ajedrecística: <b>ataca la base de la cadena de peones</b>.',
      traps: {
        e3: {
          text: 'Demasiado lento. Tras <b>4.e3?! Bb7</b> (o …a6) las negras <b>consolidan</b> la cadena b5–c4 y se quedan con el peón de verdad. El golpe <b>a4</b> hay que darlo <b>ya</b>, antes de que lleguen a defenderlo con piezas.',
          punish: 'Bb7',
        },
        b3: {
          text: 'La idea correcta pero por el lado equivocado: <b>4.b3? cxb3</b> y las negras se quedan con el peón <b>y</b> abren tu flanco de dama. El peón de b5 se ataca con <b>a4</b>.',
          punish: 'cxb3',
        },
        Ne5: {
          text: 'Caballo activo pero irrelevante: no toca la cadena b5–c4. Mientras te entretienes, las negras juegan …Bb7 y …a6 y el peón se queda suyo. Golpea <b>a4</b>.',
        },
      },
    },
    {
      san: 'c6',
      why: 'La defensa más natural: sostienen b5 con otro peón. Ahora la cadena es c6–b5–c4 y parece un muro… pero fíjate en que las negras llevan <b>tres jugadas de peón</b> y cero piezas fuera.',
      alts: [
        { san: 'bxa4', name: 'Sueltan la cadena', note: 'Tras 5.Qxa4+ recuperas material con jaque y ellas quedan con peones sueltos y sin desarrollo. Malísimo para ellas.' },
        { san: 'a6', name: 'Aguantan igual', note: 'Tras 5.axb5 axb5 6.b3! el mismo golpe: la cadena se derrumba.' },
      ],
    },
    {
      san: 'axb5',
      ask: 'Sigue el plan: cambia en b5 para abrir la columna a y desmontar la cadena.',
      why: 'Cambias en b5 y <b>abres la columna a</b> para tu torre. Cada cambio aquí te acerca al peón de c4, que se está quedando sin defensores.',
    },
    { san: 'cxb5', why: 'Obligado: si no recuperan, están un peón abajo y con la posición destrozada. Pero ahora c6 está vacío y su cadena es solo b5–c4, colgando de nada.' },
    {
      san: 'b3',
      tag: 'clave',
      ask: 'Su peón de c4 ya no lo defiende ningún peón salvo b5. Da el <b>segundo</b> golpe de peón contra la cadena.',
      why: '<b>b3: el golpe final.</b> Atacas c4 por segunda vez y ya no hay forma de aguantarlo todo. Tras …cxb3 5.Qxb3 recuperas el peón atacando b5 (que ya no tiene quien lo defienda) con la columna a abierta para tu torre y las negras sin desarrollar nada.',
      plan: 'El resultado: material igualado, tú con centro y desarrollo, ellas con peones sueltos en el flanco de dama y el rey en el centro. Así se castiga la codicia en la apertura.',
      traps: {
        Nc3: {
          text: 'Buena jugada en general, pero aquí pierdes el momento: las negras juegan …a6 o …Bb7 y consolidan. El peón de c4 solo lo tiene defendido b5, así que <b>golpea b5 y c4 con peones</b>: <b>b3</b>.',
        },
        e3: {
          text: 'Ahora no toca aún: tras …Bb7 y …a6 se afianzan. Remata primero la cadena con <b>b3</b>, que ataca c4 y no tiene respuesta buena.',
        },
      },
    },
  ],
  keys: [
    'Intentar aguantar el peón del gambito con <b>…b5</b> es un error: son jugadas de peón sin desarrollo.',
    'Un peón defendido no se ataca de frente: <b>ataca la base de la cadena</b> (a4 contra b5, luego b3 contra c4).',
    'Cada cambio en el flanco te abre <b>columnas</b> (la columna a para tu torre).',
    'Moraleja general: en la apertura, <b>desarrollo &gt; un peón</b>.',
  ],
};

const CURSO_GD = {
  id: 'gd-blancas',
  title: 'El Gambito de Dama',
  side: 'w',
  subtitle: 'Con blancas · 1.d4 d5 2.c4',
  intro:
    'La apertura más sólida y respetada de la historia con 1.d4, y la favorita de campeones del mundo ' +
    'desde Capablanca hasta Carlsen. Su nombre engaña: <b>no regalas nada</b>. Ofreces el peón de c4 para ' +
    '<b>desviar</b> al peón de d5 del centro. Si te lo toman, no pueden aguantarlo; y si lo defienden, ' +
    'quedan pasivos. En los dos casos tú sales con el centro y mejor desarrollo.',
  ideas: [
    'El peón de c4 <b>no es un sacrificio real</b>: siempre lo recuperas, con <b>e3 + Bxc4</b>, o con <b>a4</b> si intentan sostenerlo con …b5.',
    'Lo que compras con c4 es el <b>centro</b>. Si el peón de d5 desaparece, tú tienes peones en d4 y e3–e4 y las negras ninguno.',
    'Si defienden d5 con un peón (…e6 o …c6), mantienes la <b>tensión</b> y desarrollas presionando ese punto: <b>Nc3</b>, <b>Nf3</b>, <b>Bg5</b>.',
    'Cada pieza tiene su casilla: <b>Nc3</b> presiona d5, <b>Nf3</b> vigila e5, <b>Bg5</b> molesta al defensor de d5, <b>e3</b> sostiene d4 y libera al alfil de f1.',
    'Planes a medio plazo: la ruptura <b>e4</b>, la presión por la <b>columna c</b> y el <b>ataque de minorías</b> (b4–b5).',
  ],
  lines: [GDA, GDR, ESLAVA_BLANCAS, CODICIA],
};

// ---------------------------------------------------------------------------
// CURSO 2 — La Defensa Eslava, con negras (tu defensa contra el Gambito de Dama)
// ---------------------------------------------------------------------------

const ESL_BASE = {
  id: 'esl-base',
  title: 'Eslava: ideas base y línea principal',
  short: 'Cómo defender d5 sin encerrar tu alfil. Empieza por aquí.',
  moves: [
    { san: 'd4', why: 'Las blancas ocupan el centro con el peón defendido por la dama.' },
    {
      san: 'd5',
      ask: 'Te toca responder a 1.d4. Ocupa el centro tú también, en simetría.',
      why: 'La respuesta más sólida: ocupas el centro y bloqueas el peón de d4. Nada de concesiones.',
    },
    { san: 'c4', why: '<b>El Gambito de Dama.</b> Atacan tu peón de d5, que es el que sostiene tu centro. Tienes tres opciones: tomar, defender con …e6, o defender con …c6.' },
    {
      san: 'c6',
      tag: 'clave',
      ask: 'Quieres <b>defender</b> d5 con un peón, pero sin bloquear la diagonal de tu alfil de c8. ¿Con qué peón lo haces?',
      why: '<b>Defensa Eslava.</b> Defiendes d5 con el peón de c6 en lugar del de e6. La diferencia es toda la apertura: la diagonal <b>c8–h3 sigue abierta</b> y tu alfil podrá salir a <b>f5</b> o g4. En el Gambito de Dama Rechazado (…e6) ese alfil se queda encerrado durante toda la partida.',
      plan: 'Tu plan completo en la Eslava: …Nf6, …dxc4 en el momento justo, sacar el alfil a <b>f5</b> <u>antes</u> de jugar …e6, y solo entonces …e6 y …Be7 con el enroque. <b>Alfil fuera, después e6.</b> Nunca al revés.',
      traps: {
        dxc4: {
          text: 'Puedes tomar, y es una apertura respetable (Gambito de Dama Aceptado), pero cambias de plan: <b>sueltas el centro</b> y no puedes conservar el peón. Si quieres jugar la Eslava, el punto es <b>defender</b> d5 con …c6.',
        },
        e6: {
          text: 'Es el Gambito de Dama Rechazado: sólido, jugado por campeones… pero acabas de <b>encerrar tu alfil de c8</b> detrás de tus peones, y ese será tu problema durante toda la partida. Con <b>…c6</b> defiendes exactamente igual <b>sin</b> encerrarlo.',
        },
        Nf6: {
          text: 'Desarrollo natural, pero deja d5 defendido solo por el caballo: tras 3.cxd5 Nxd5 4.e4! el caballo tiene que retroceder y las blancas montan un centro enorme. Primero <b>sostén d5 con un peón</b>.',
          punish: 'cxd5',
        },
      },
    },
    { san: 'Nf3', why: 'Desarrollo natural que vigila e5. Es la jugada principal.', alts: [
      { san: 'cxd5', name: 'Variante del Cambio', note: 'Sueltan la tensión enseguida. Muy sólida y muy fácil de jugar para ti.', goto: 'esl-cambio' },
      { san: 'e3', name: 'Juego lento (tipo Londres)', note: 'Sin teoría. Ojo: aquí sacas el alfil a f5 antes de nada.', goto: 'esl-lenta' },
      { san: 'Nc3', name: 'Invitación al contragambito', note: 'Permite el atrevido 3…e5!? (Contragambito Winawer). También puedes seguir con …Nf6 normal.' },
    ] },
    {
      san: 'Nf6',
      ask: 'Desarrolla tu caballo a su casilla natural, la que controla e4 y refuerza d5.',
      why: 'Controlas <b>e4</b> (les impides montar el centro ideal) y refuerzas d5 con una pieza más.',
    },
    { san: 'Nc3', why: 'Presionan d5 por segunda vez. Ahora te toca decidir: sostener con …e6 (Semi-Eslava) o tomar en c4.' },
    {
      san: 'dxc4',
      tag: 'clave',
      ask: 'Ahora sí puedes tomar el peón. Piensa por qué <b>ahora</b> y no antes: ¿con qué peón podrías sostenerlo en c4?',
      why: '<b>Ahora tomar sí tiene sentido.</b> Con …c6 jugado, el peón de c4 se puede sostener con <b>…b5</b>, porque b5 quedaría defendido por c6. No vas a conservarlo para siempre, pero les cuesta una jugada de flanco (a4) recuperarlo, y ese tiempo lo aprovechas para desarrollarte cómodo.',
      also: 'También es totalmente correcto 4…e6, la <b>Semi-Eslava</b>: lo defiendes todo, es sólida, pero encierras el alfil y hay mucha más teoría.',
      traps: {
        Bf5: {
          text: '¡Casi! La idea es buenísima, pero el <b>momento</b> es malo: <b>4…Bf5?! 5.cxd5 cxd5 6.Qb3!</b> ataca d5 <b>y</b> b7 a la vez, y tienes problemas porque el alfil ya no defiende b7. Toma <b>primero</b> en c4 y saca el alfil después.',
          punish: 'cxd5',
        },
        e6: {
          text: 'No es un error: es la <b>Semi-Eslava</b>, una gran apertura. Pero es otra apertura: encierras el alfil de c8, que es justo lo que la Eslava evita. Aquí estamos aprendiendo la Eslava pura: toma en c4.',
        },
        g6: {
          text: 'Existe (Eslava Schlechter), pero renuncias a la mejor casilla de tu alfil, que es <b>f5</b>. La Eslava principal empieza por tomar en c4.',
        },
      },
    },
    {
      san: 'a4',
      why: '<b>La jugada que tenías que prever.</b> Impiden …b5 antes de que la juegues: si ahora …b5, axb5 y el peón cae. Buenas noticias: a4 les <b>debilita la casilla b4</b>, que tú puedes usar más adelante con un caballo o el alfil.',
      alts: [
        { san: 'e3', name: 'Recuperan con el alfil', note: 'Tras 5.e3 puedes intentar sostenerlo con …b5, pero lo normal es …e6 o …Bf5 con juego cómodo.' },
        { san: 'e4', name: 'Gambito Geller-Tolush', note: 'Muy agresivo: montan un centro enorme por el peón. Se responde …Bb4 o …b5, teoría afilada.' },
      ],
    },
    {
      san: 'Bf5',
      tag: 'clave',
      ask: 'Este es <b>el</b> momento de la Eslava. Saca la pieza que estarías obligado a encerrar si jugaras …e6 primero.',
      why: '<b>La razón de ser de toda la apertura.</b> El alfil sale <b>por fuera</b> de tu cadena de peones, <u>antes</u> de jugar …e6. Compáralo con el Gambito de Dama Rechazado, donde este alfil no sale en 40 jugadas. Este orden — <b>alfil primero, e6 después</b> — es lo único que no puedes olvidar de la Eslava.',
      traps: {
        b5: {
          text: 'La codicia se castiga: <b>5…b5? 6.axb5 cxb5 7.Nxb5!</b> y estás un peón abajo, con la columna a abierta contra tu torre y sin desarrollo. Cuando juegan a4, el peón de c4 <b>ya no se puede sostener</b>: olvídate de él y desarróllate.',
          punish: 'axb5',
        },
        e6: {
          text: 'Y aquí se pierde la Eslava. Con …e6 <b>encierras tu propio alfil de c8</b> justo cuando podía salir gratis, y acabas en una versión mala del Gambito de Dama Rechazado. Regla de la Eslava: <b>Bf5 antes de e6</b>.',
        },
        Na6: {
          text: 'El caballo va hacia b4, que es la casilla que a4 debilitó, pero es prematuro: primero saca el alfil por fuera, que es tu jugada más valiosa y solo está disponible ahora.',
        },
      },
    },
    { san: 'e3', why: 'Sostienen d4 y abren la diagonal para Bxc4, recuperando el peón. Normal y bueno.' },
    {
      san: 'e6',
      ask: 'Tu alfil ya está fuera. Ahora sí: abre la salida a tu alfil de f8 para poder enrocar.',
      why: '<b>Ahora sí toca …e6</b>, con el alfil bueno ya colocado en f5. Sigues con …Be7 (o …Bb4, usando la casilla que a4 debilitó) y …O-O. Has salido de la apertura con las piezas fuera, el centro sólido y sin un solo problema: eso es exactamente lo que busca una defensa.',
      plan: 'Tu posición modelo en la Eslava: peones en c6-e6, alfil en f5, caballos en f6 y d7, rey enrocado. A partir de ahí buscas …Ne4 o la ruptura …c5 / …e5.',
    },
  ],
  keys: [
    'La Eslava = defender d5 con <b>…c6</b> para que tu alfil de c8 no quede encerrado.',
    'Regla de oro: <b>…Bf5 antes de …e6</b>. Ese orden es toda la apertura.',
    'Toma en c4 solo <b>después</b> de …c6 y …Nf6, cuando les cueste una jugada (a4) recuperarlo.',
    'Cuando juegan a4, <b>renuncia al peón</b>: intentar …b5 pierde material (axb5 cxb5 Nxb5).',
    'El regalo de a4 es la casilla <b>b4</b>: úsala con el alfil o un caballo.',
  ],
};

const ESL_CAMBIO = {
  id: 'esl-cambio',
  title: 'Eslava: Variante del Cambio (3.cxd5)',
  short: 'Cuando sueltan la tensión enseguida. La forma más fácil de igualar.',
  moves: [
    { san: 'd4', why: 'Peón de dama al centro.' },
    { san: 'd5', ask: 'Ocupa el centro en simetría.', why: 'Sólido y directo.' },
    { san: 'c4', why: 'El Gambito de Dama.' },
    {
      san: 'c6',
      tag: 'clave',
      ask: 'Defiende d5 con el peón que <b>no</b> encierra a tu alfil de c8.',
      why: 'Defensa Eslava: sostienes d5 dejando libre la diagonal de tu alfil.',
    },
    {
      san: 'cxd5',
      why: '<b>Variante del Cambio.</b> Sueltan la tensión de inmediato. Es la forma más tranquila de jugar contra la Eslava… y también la más fácil de igualar para ti: la estructura queda <b>totalmente simétrica</b>.',
      alts: [
        { san: 'Nf3', name: 'Línea principal', note: 'Mantienen la tensión: la Eslava de verdad.', goto: 'esl-base' },
        { san: 'e3', name: 'Juego lento', note: 'Sin teoría, plan tipo Londres.', goto: 'esl-lenta' },
      ],
    },
    {
      san: 'cxd5',
      ask: 'Recupera el peón. Piensa con cuál de los dos peones: el que <b>mantiene</b> tu peón en d5 y te abre la columna c.',
      why: 'Recuperas con el peón de c6, no con la dama. Tu peón se queda en d5 sosteniendo el centro y <b>se abre la columna c</b> para tus torres. La estructura es simétrica: si nadie se equivoca, esto está igualado.',
      also: 'Detalle importante: 4…Qxd5? sería peor, saca la dama pronto y tras 5.Nc3 pierdes tiempo moviéndola otra vez.',
      traps: {
        Qxd5: {
          text: 'Recuperas, pero con la <b>dama</b>: tras <b>5.Nc3</b> te la atacan con desarrollo y tienes que volver a moverla, regalando tiempo. Regla general: <b>recupera con el peón</b> siempre que puedas.',
          punish: 'Nc3',
        },
        Nf6: {
          text: 'Te olvidas del peón: tras 4.dxc6 Nxc6 estás un peón abajo sin nada a cambio. Recupera en d5 con el <b>peón de c6</b>.',
          punish: 'dxc6',
        },
      },
    },
    { san: 'Nc3', why: 'Desarrollo y presión sobre d5. Su plan típico es Bf4, e3, Bd3 y la maniobra Rc1 con presión en la columna c.' },
    {
      san: 'Nf6',
      ask: 'Desarrolla el caballo defendiendo d5 y controlando e4.',
      why: 'Defiendes d5 por segunda vez y controlas e4. En estructuras simétricas gana quien desarrolla mejor, así que no pierdas ni una jugada.',
    },
    { san: 'Nf3', why: 'Desarrollo natural y control de e5.' },
    {
      san: 'Nc6',
      ask: 'Saca el otro caballo a su casilla activa, la que presiona d4.',
      why: 'Presionas <b>d4</b>, que es la debilidad simétrica de la posición: exactamente lo que ellos te hacen a ti en d5. Simetría perfecta.',
    },
    { san: 'Bf4', why: 'El alfil sale por fuera antes de jugar e3, igual que harás tú con el tuyo. Es la buena manera de desarrollarse en estas estructuras.' },
    {
      san: 'Bf5',
      tag: 'clave',
      ask: 'Copia su buena idea: saca tu alfil <b>por fuera</b> antes de jugar …e6.',
      why: '<b>Otra vez la misma regla de la Eslava:</b> el alfil sale <u>antes</u> de …e6. Ahora tienes las dos piezas menores fuera y solo te queda …e6, …Be7 y …O-O para completar el desarrollo con una posición cómoda e igualada.',
      plan: 'Ojo al plan típico de las blancas aquí: <b>ataque de minorías</b> (Rc1, b4, b5) contra tu peón de c6. Se responde con …Rc8, …Ne4 o con la ruptura …e5 en el momento justo.',
      traps: {
        e6: {
          text: 'Otra vez el mismo error de orden: encierras tu alfil de c8 cuando podía salir gratis a f5. En la Eslava, <b>siempre el alfil antes que e6</b>.',
        },
      },
    },
  ],
  keys: [
    'Con 3.cxd5 recupera <b>con el peón de c6</b> (nunca con la dama): mantienes d5 y abres la columna c.',
    'La estructura queda simétrica: gana quien desarrolla mejor, no pierdas tiempo.',
    'La misma regla de siempre: <b>…Bf5 antes de …e6</b>.',
    'Vigila su <b>ataque de minorías</b> (b4–b5) contra tu peón de c6.',
  ],
};

const ESL_LENTA = {
  id: 'esl-lenta',
  title: 'Eslava: si evitan la teoría (3.e3)',
  short: 'Contra planteos lentos tipo Sistema Londres. Aquí sacas el alfil gratis.',
  moves: [
    { san: 'd4', why: 'Peón de dama al centro.' },
    { san: 'd5', ask: 'Ocupa el centro.', why: 'Sólido y directo.' },
    { san: 'c4', why: 'El Gambito de Dama.' },
    {
      san: 'c6',
      tag: 'clave',
      ask: 'Defiende d5 sin encerrar tu alfil de c8.',
      why: 'Defensa Eslava. Diagonal c8–h3 libre.',
    },
    {
      san: 'e3',
      why: '<b>Planteo lento.</b> Muy común en partidas de club: desarrollan con e3, Nf3, Bd3, Nbd7 y O-O sin buscar nada concreto. No hay teoría que memorizar… y eso es una <b>gran noticia para ti</b>, porque te dan tiempo para colocar tus piezas en sus mejores casillas.',
      alts: [
        { san: 'Nf3', name: 'Línea principal', note: 'La Eslava de verdad, con tensión.', goto: 'esl-base' },
        { san: 'cxd5', name: 'Variante del Cambio', note: 'Sueltan la tensión ya.', goto: 'esl-cambio' },
      ],
    },
    {
      san: 'Nf6',
      ask: 'Jugada útil que no compromete nada: desarrolla el caballo al centro.',
      why: 'Desarrollo natural: controlas e4, refuerzas d5 y esperas a ver su plan antes de decidir el tuyo.',
    },
    { san: 'Nf3', why: 'Siguen con su desarrollo tranquilo.' },
    {
      san: 'Bf5',
      tag: 'clave',
      ask: 'Te han dado tiempo. Coloca la pieza que en el Gambito de Dama Rechazado se queda encerrada para siempre.',
      why: '<b>Aquí sale gratis.</b> Como no te han presionado el centro, tu alfil llega a f5 sin coste ninguno: es tu mejor pieza en la mejor diagonal, y ya no tendrá ningún problema el resto de la partida. Contra planteos lentos, tu ventaja es que <b>puedes colocar todo en la casilla ideal</b>.',
      traps: {
        e6: {
          text: 'Es sólido pero te deja peor de lo necesario: acabas de encerrar tu alfil <b>sin que te obligaran</b>. Justo cuando el rival juega lento es cuando <b>más</b> hay que sacar el alfil primero: <b>Bf5</b>.',
        },
        dxc4: {
          text: 'Tomar aquí es un pequeño regalo: <b>4…dxc4 5.Bxc4</b> y su alfil llega gratis a una gran diagonal mientras tú has soltado el centro. Sin a4 de por medio, no tienes ninguna prisa: <b>desarróllate</b> con Bf5.',
          punish: 'Bxc4',
        },
      },
    },
    { san: 'Nc3', why: 'Desarrollo. También verás Bd3 (para cambiar tu alfil bueno) o Be2.' },
    {
      san: 'e6',
      ask: 'El alfil ya está colocado. Ahora sí, abre paso a tu alfil de f8.',
      why: '<b>El orden correcto, cumplido.</b> Alfil fuera primero, …e6 después. Tienes exactamente la posición que quiere la Eslava: centro sólido, alfil bueno activo y desarrollo sin problemas. Sigue con …Nbd7, …Be7 y …O-O.',
      plan: 'A partir de aquí busca la ruptura <b>…e5</b> (con …Nbd7 y …Bd6 preparándola) o …c5 si su centro se descuida. Contra juego lento, el que rompe primero en el centro suele tomar la iniciativa.',
    },
  ],
  keys: [
    'Contra planteos lentos, tu alfil llega a <b>f5</b> gratis: aprovéchalo siempre.',
    'Sin presión sobre d5, <b>no hay prisa</b> en tomar en c4: desarrolla.',
    'El orden es el de siempre: <b>Bf5, luego e6</b>.',
    'Con el desarrollo completo, busca la ruptura <b>…e5</b> para tomar la iniciativa.',
  ],
};

const CURSO_ESLAVA = {
  id: 'eslava-negras',
  title: 'Defensa Eslava',
  side: 'b',
  subtitle: 'Con negras · tu respuesta al Gambito de Dama',
  intro:
    'Ya sabes atacar con el Gambito de Dama; ahora aprende a <b>defenderte de él</b>. La Eslava es la ' +
    'respuesta más sana: defiendes tu peón de d5 con <b>…c6</b> en lugar de …e6, y así tu alfil de c8 ' +
    '<b>no queda encerrado</b>. Es sólida, fácil de entender y la juegan todos los grandes maestros. ' +
    'Toda la apertura se resume en una regla de orden: <b>saca el alfil a f5 antes de jugar …e6</b>.',
  ideas: [
    'Defiendes d5 con <b>…c6</b>: la diagonal c8–h3 queda libre y tu alfil sale a <b>f5</b>. Ese es el problema que resuelve la Eslava.',
    '<b>Regla de oro: …Bf5 antes de …e6.</b> Si juegas …e6 primero, encierras tu mejor alfil y estás en una versión mala del Gambito de Dama Rechazado.',
    'Puedes tomar en c4, pero solo cuando les cueste una jugada recuperarlo. Y cuando jueguen <b>a4</b>, <b>renuncia al peón</b>: intentar …b5 pierde material.',
    'a4 te regala la casilla <b>b4</b>: colócale ahí un caballo o el alfil.',
    'Tu posición modelo: peones c6 y e6, alfil en f5, caballos en f6 y d7, rey enrocado, y las rupturas …c5 o …e5 en el bolsillo.',
  ],
  lines: [ESL_BASE, ESL_CAMBIO, ESL_LENTA],
};

// ---------------------------------------------------------------------------

export const COURSES = [CURSO_GD, CURSO_ESLAVA];

export function getCourse(courseId) {
  return COURSES.find((c) => c.id === courseId) || null;
}

export function getLine(courseId, lineId) {
  const c = getCourse(courseId);
  return c ? c.lines.find((l) => l.id === lineId) || null : null;
}

// Enriquece las jugadas de una lección con los datos que necesita el tablero:
// color, casillas de salida/llegada, SAN real y el FEN antes y después.
// El resultado se memoiza en la propia lección.
export function lineSteps(line) {
  if (line._steps) return line._steps;
  const game = new Chess();
  const steps = line.moves.map((step, i) => {
    const fenBefore = game.fen();
    const move = game.move(step.san);
    if (!move) {
      throw new Error(`Jugada ilegal en la lección "${line.id}": "${step.san}" (jugada ${i + 1}) desde ${fenBefore}`);
    }
    return {
      ...step,
      idx: i,
      san: move.san,
      from: move.from,
      to: move.to,
      color: move.color,
      promotion: move.promotion || null,
      fenBefore,
      fen: game.fen(),
    };
  });
  line._steps = steps;
  return steps;
}

// Número de jugada y notación con puntos: 0 -> "1.", 1 -> "1…", 2 -> "2." …
export function moveLabel(idx) {
  return `${Math.floor(idx / 2) + 1}${idx % 2 === 0 ? '.' : '…'}`;
}

// Total de lecciones del temario.
export function totalLines() {
  return COURSES.reduce((n, c) => n + c.lines.length, 0);
}
