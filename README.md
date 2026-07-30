# Entrenador de Ajedrez

Aplicación web de ajedrez que corre **100% en local** (sin backend, sin APIs de pago).
Juegas contra Stockfish y la app **clasifica cada una de tus jugadas en tiempo real**
—jugada de libro, mejor jugada, excelente, buena, imprecisión, error y error grave—
al estilo Chess.com / Lichess.

## Requisitos

- Un navegador moderno (Chrome, Edge, Firefox, Safari).
- Node.js **o** Python 3, solo para levantar un servidor estático local.
  > No se puede abrir con `file://` directamente: los Web Workers y el WASM
  > necesitan servirse por HTTP.

Las dependencias (`chess.js` y el motor `stockfish` en WASM) ya vienen copiadas
en `vendor/`, así que **no hace falta compilar ni instalar nada** para jugar.

## Cómo arrancarla

Desde la carpeta del proyecto, usa **una** de estas opciones:

```bash
# Opción A – Node
npx serve -l 5000 .
#   luego abre http://localhost:5000

# Opción B – Python
python3 -m http.server 5000
#   luego abre http://localhost:5000

# Atajo con npm (usa serve)
npm start
```

La primera carga tarda unos segundos porque descarga el motor WASM (~7 MB).
En la consola del navegador verás `[app] ambos motores UCI listos` cuando esté todo listo.

## Instalar como app (PWA, funciona sin conexión)

La app incluye un **manifest** y un **service worker** que cachea todo el núcleo
(incluido el motor WASM), así que **tras la primera carga funciona 100% offline**.
En Chrome/Edge aparece el icono de **instalar** en la barra de direcciones: al
instalarla se abre como una app de escritorio propia, sin barra del navegador.

## Cómo se usa

1. Al abrir, elige color (blancas / negras / al azar) y la **fuerza del rival**
   (1320–2800 Elo). Con el **Elo adaptativo** activado (por defecto), el slider se
   presetea a tu nivel estimado y se ajusta solo al terminar cada partida. Pulsa
   **Comenzar**.
2. Mueve las piezas **arrastrando** o con **clic-origen / clic-destino**.
   Se resaltan las casillas legales.
3. Tras cada jugada tuya aparece un **badge** sobre la casilla de destino y una
   etiqueta grande con la clasificación y los peones perdidos.
4. La **barra de evaluación** (izquierda) y el **nombre de la apertura** se
   actualizan en vivo. La lista de jugadas muestra la calidad y el cpl de cada una.
5. Al terminar la partida se muestra un **resumen** con la precisión estimada (%)
   y el conteo de cada tipo de jugada.

Botones: **Nueva partida**, **Rendirse**, **Deshacer** (vuelve a tu turno
anterior), **Rehacer** (avanza por la línea principal), **Copiar PGN**,
**Voltear**. La casilla *"Mostrar mejor jugada tras mover"* dibuja la flecha de
la jugada óptima **después** de que muevas (nunca antes, para no hacerte trampas).
La partida en curso se guarda en `localStorage`, así que puedes recargar la
página sin perderla.

- **Navegar la partida**: haz clic en cualquier jugada de la lista (o usa
  `←` / `→`, `Inicio` / `Fin`) para ver la posición en ese momento. La barra de
  navegación muestra en qué jugada estás y si es la línea principal o una variante.
- **Árbol de variantes**: si retrocedes a una jugada tuya y juegas **otra distinta**,
  la app **no borra** la continuación anterior: la guarda como una **variante**
  (rama) que se muestra entre paréntesis e indentada en la lista, igual que en
  Lichess. Así puedes explorar líneas alternativas sin perder lo jugado. El rival
  responde también dentro de cada rama.
  - **⤴ Promover** (`P`): convierte la variante en la que estás en la línea principal.
  - **🗑 Borrar** (`Supr`): elimina la jugada actual y todo lo que cuelga de ella.
  - **Deshacer** / **Rehacer** te llevan a tu turno anterior / siguiente por la
    línea principal (sin borrar nada; jugar otra cosa crea una rama).
- **Mejor línea**: tras una jugada no óptima, bajo la clasificación se muestra en
  notación la mejor jugada y la continuación del motor ("Mejor era …").
- **Intentar de nuevo**: tras una imprecisión, error o error grave aparece un
  botón que te devuelve a tu turno anterior para probar otra (la fallida queda
  guardada como variante).
- **Atajos de teclado** (escritorio): `N` nueva partida · `U` deshacer ·
  `Y` rehacer · `F` voltear · `A` alternar flecha · `H` pista · `←`/`→` navegar ·
  `Inicio`/`Fin` ir al principio/final de la línea · `P` promover variante ·
  `Supr` borrar desde la jugada actual · `Enter` comenzar (en el modal).
- **Piezas SVG** del set **Cburnett** (el de Lichess), vendorizado en
  `vendor/pieces/cburnett/`, nítidas a cualquier tamaño.
- **Animación de deslizado**: las jugadas del rival se deslizan de casilla a
  casilla en lugar de aparecer de golpe.
- **Piezas capturadas y material**: encima y debajo del tablero se muestran las
  piezas que cada bando ha capturado, con la ventaja material (p. ej. `+9`).
- **Sonidos** sintetizados en el navegador (mover, capturar, jaque, enroque,
  coronar, fin de partida). Se pueden apagar en Ajustes.
- **Gráfico de evaluación**: curva del win% jugada a jugada bajo la lista;
  haz clic en cualquier punto para saltar a esa jugada.
- **💡 Pista** (`H`): dibuja la flecha de una buena jugada del motor con su idea,
  bajo demanda y solo en tu turno (no delata la mejor jugada antes de que lo pidas).
- **Flecha de amenaza**: al empezar tu turno, una flecha **roja punteada** señala
  la principal amenaza del rival (su mejor jugada si le tocara mover ahora). Se
  calcula tras analizar tu posición para no restar profundidad a la pista/eval, y
  no aparece si estás en jaque. Se puede apagar en Ajustes.
- **Repetir hasta acertar** (opcional, en Ajustes): cuando lo activas, si juegas
  una imprecisión, error o error grave la app **deshace tu jugada** y te devuelve
  a tu turno para que pruebes otra —el rival no responde hasta que juegas algo
  bueno (buena, excelente, mejor o de libro)—. La jugada fallida no se guarda:
  cada intento parte limpio. Puedes pedir 💡 Pista si te atascas.
- **⚙ Ajustes**: tema del tablero (Clásico, Verde, Madera, Azul, Gris),
  coordenadas on/off, sonidos on/off, flecha de amenaza on/off y repetir hasta
  acertar on/off, todo persistido en `localStorage`.
- **📚 Biblioteca de partidas**: al terminar una partida se archiva sola
  (resultado, precisión, color, Elo del rival, fecha y árbol completo). Desde el
  botón 📚 puedes reabrir cualquier partida en modo revisión o borrarla.
- **🎓 Enseñar aperturas**: sección de **lecciones guiadas** que te enseñan una
  apertura jugada a jugada, en español y **sin usar el motor** (la respuesta es
  inmediata y funciona offline). Se abre con el botón 🎓 o desde el propio modal
  de inicio. Hay dos cursos:
  - **El Gambito de Dama** (con blancas): ideas base y **GD Aceptado**, **GD
    Rechazado**, **Defensa Eslava** y **"Castigo a la codicia"** (cómo refutar
    a quien se empeña en aguantar el peón con …b5).
  - **Defensa Eslava** (con negras): cómo **defenderte** del Gambito de Dama —
    línea principal, **Variante del Cambio** y qué hacer si el rival evita la
    teoría.

  En cada lección: el rival juega solo y te explica **el porqué** de su jugada;
  cuando te toca, te hace una **pregunta guía** en vez de darte la respuesta.
  Si aciertas, te explica la idea; si te equivocas, te dice **qué falla en tu
  jugada** y, en los errores típicos, te **enseña el castigo en el tablero**
  antes de devolverte el turno. Además:
  - **Variantes de respuesta**: tras cada jugada del rival se listan sus
    alternativas reales (nombre + idea) y puedes **saltar a la lección que las
    cubre** desde la misma posición.
  - **Guiarme** (interruptor): la primera vez te muestra la jugada y una flecha;
    apágalo para repasar **de memoria**.
  - **💡 Pista** escalonada (idea → qué pieza → flecha) y **👁 Ver jugada**.
  - Al terminar, un **resumen de las ideas** para recordar y el **progreso**
    guardado por lección (✓ completada, 🏆 sin ayudas).
  - Atajos: `H` pista · `V` ver jugada · `R` reiniciar · `→`/`Enter` siguiente
    lección · `Esc` salir.
- **🧩 Puzzles de tus errores**: el botón 🧩 recopila de la biblioteca las
  posiciones donde jugaste una imprecisión, error o error grave y te las plantea
  como puzzles —justo **antes** de tu jugada floja, con tu turno—. Los peores
  primero. Tu intento se valida **en vivo con el motor**: cuenta como acierto si
  iguala o casi iguala la mejor jugada (no hace falta clavar la única "oficial").
  Tienes **Pista** (flecha), **Solución** y navegación entre puzzles.
- **📊 Perfil de debilidades por fase**: el botón 📊 analiza tus partidas
  archivadas y agrega **tus** jugadas por fase (**apertura**, **medio juego** y
  **final**), mostrando en cada una la precisión, las jugadas flojas, la pérdida
  media y una barra con el reparto por calidad. Resalta tu **fase más floja** para
  que sepas qué entrenar. Necesita algunas partidas jugadas para tener datos.
- **Elo adaptativo**: la app mantiene una **estimación de tu nivel** y, al terminar
  cada partida, la actualiza con la fórmula de Elo según el resultado (sube si
  ganas, baja si pierdes). Así el rival se mantiene **a tu altura**. El resumen de
  la partida muestra el cambio de nivel. Se puede desactivar en Ajustes.

## Cómo funciona la clasificación

- Se usan **dos** instancias de Stockfish en Web Workers separados:
  - **Rival**: con `UCI_LimitStrength` + `UCI_Elo` al valor elegido.
  - **Analista**: a fuerza completa, solo evalúa; nunca influye en las jugadas del rival.
- Mientras piensas, el analista ya calcula la mejor jugada y la evaluación de la
  posición. Cuando mueves, evalúa la posición resultante y calcula la pérdida en
  centipawns (**cpl**) desde tu perspectiva:

  | Categoría        | Criterio                        |
  |------------------|---------------------------------|
  | 📖 Jugada de libro | la posición está en el libro (prioridad máxima) |
  | ⭐ Mejor jugada   | coincide con la 1ª línea del motor |
  | Excelente        | cpl ≤ 25                         |
  | Buena            | cpl ≤ 60                         |
  | Imprecisión (?!) | cpl ≤ 120                        |
  | Error (?)        | cpl ≤ 270                        |
  | Error grave (??) | cpl > 270                        |

  Los "mate en N" se convierten a un valor grande (`10000 − N`) para tratarlos
  como ventaja decisiva.

## Estructura del proyecto

```
index.html
css/style.css
js/main.js          orquestación y estado (árbol de variantes)
js/board.js         render e interacción del tablero (CSS Grid + piezas SVG)
js/engine.js        wrapper UCI de los Web Workers de Stockfish
js/classifier.js    clasificación de jugadas y precisión
js/openings.js      libro de aperturas embebido
js/courses.js       temario de las lecciones de apertura (jugadas + explicaciones)
js/openingTrainer.js sección "Enseñar aperturas": lecciones guiadas
js/sounds.js        efectos de sonido sintetizados con WebAudio
js/settings.js      ajustes (tema de tablero, coordenadas, sonido) en localStorage
js/library.js       biblioteca de partidas terminadas en localStorage
js/puzzles.js       recolección de puzzles a partir de tus errores archivados
js/profile.js       perfil de debilidades por fase (apertura/medio/final)
js/adaptive.js      Elo adaptativo (estima tu nivel y ajusta al rival)
manifest.webmanifest, sw.js, icons/  soporte PWA (instalable y offline)
vendor/             chess.js (ESM), Stockfish 18 lite (WASM) y piezas SVG Cburnett
tools/test-openings.mjs   test de legalidad del libro de aperturas
tools/test-courses.mjs    test del temario de lecciones (legalidad e integridad)
tools/e2e.mjs             prueba end-to-end en navegador (Playwright)
tools/test-tree.mjs       prueba del árbol de variantes (Playwright)
```

## Pruebas

```bash
# Verifica el libro de aperturas y el temario de las lecciones (legalidad,
# turnos, errores típicos y saltos entre variantes)
npm test

# Pruebas end-to-end (requieren Playwright + Chromium y el servidor en :5050)
python3 -m http.server 5050 &
node tools/e2e.mjs        # motores, clasificación y libro
node tools/test-tree.mjs # árbol de variantes: ramas, promover, borrar, persistencia
node tools/test-threat.mjs # flecha de amenaza: aparición, punta roja y toggle
node tools/test-puzzles.mjs      # recolección de puzzles a partir de tus errores (sin navegador)
node tools/test-puzzles-ui.mjs   # flujo de UI de los puzzles (Playwright)
node tools/test-repeat.mjs       # modo "repetir hasta acertar" (Playwright)
node tools/test-profile.mjs      # perfil de debilidades por fase (lógica, sin navegador)
node tools/test-profile-ui.mjs   # flujo de UI del perfil (Playwright)
node tools/test-adaptive.mjs     # Elo adaptativo: fórmula, clamp y sugerencia (lógica)
node tools/test-adaptive-ui.mjs  # Elo adaptativo: preseteo del modal y cambio tras jugar (Playwright)
node tools/test-courses.mjs      # temario de aperturas: legalidad e integridad (sin navegador)
node tools/test-trainer-ui.mjs   # lecciones de apertura: flujo completo de UI (Playwright)
```

## Créditos y licencia

- Motor: [Stockfish.js](https://github.com/nmrugg/stockfish.js) (GPLv3).
- Reglas: [chess.js](https://github.com/jhlywa/chess.js) (BSD).
