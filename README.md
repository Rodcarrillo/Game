# MICHELSON'S ARCADE · Isla Gomita

Juego de tablero multijugador estilo fiesta. **La tele es el tablero y cada celular es un control.**
Los jugadores tiran el dado, avanzan casilla por casilla, eligen ruta en los cruces, juntan **Pemolares**
y los cambian por **Perritas** en las tiendas. Gana quien tenga más Perritas al final.

## Cómo jugar en casa

Requisito: [Node.js](https://nodejs.org) 18 o más reciente. **No hay que instalar dependencias.**

```bash
node server/index.js          # o: npm start
```

1. En la computadora conectada a la tele abre `http://localhost:3000/tv`.
2. La pantalla muestra un código de 4 letras, un QR y la dirección para los celulares
   (por ejemplo `http://192.168.1.50:3000/play?room=WMXX`).
3. Cada jugador abre esa dirección en su celular (misma red Wi-Fi), escribe su nombre y elige color y sombrero.
4. En la tele: **Configuración** para ajustar la partida, **+ Bot** si faltan jugadores, y **¡A jugar!**

Si un celular se desconecta, basta con volver a abrir la página: recupera su lugar automáticamente.
Si se reinicia el servidor, las salas se restauran desde `data/rooms/`.

### Versión de una sola pantalla

`dist/michelsons-arcade.html` es el mismo juego corriendo completo en el navegador, sin servidor:
los jugadores se turnan en el mismo dispositivo (con bots opcionales) y en los minijuegos cada quien
usa sus teclas (Q/W, O/P, Z/X, N/M) o los botones en pantalla. Se regenera con `npm run build:artifact`
(necesita `npm i -D esbuild`).

## Reglas y economía

| Concepto | Valor inicial (configurable) |
|---|---|
| Dado | 1–6 (opción 1–8 y 1–10) |
| Pemolares iniciales | 10 |
| Precio de la Perrita | 20 Pemolares (hasta 3 por visita) |
| Casilla azul | +3 a +8 Pemolares |
| Casilla roja | −3 a −5 Pemolares (sin saldos negativos, salvo que se active) |
| Pasar por la salida | +3 Pemolares |
| Minijuego | 1º +10 · 2º +6 · participar +3 (en duelo: ganador +10, perdedor +3) |
| Bonos finales | Rey del Minijuego y Bolsillo de Oro: +1 Perrita cada uno |
| Desempate | Pemolares (se puede desactivar) |

**Casillas:** Pemolares + / −, Perrita (30 % de dar una Perrita; si no, +8 Pemolares), Minijuego (duelo o todos),
Caos (lluvia de Pemolares, escudo, fiesta, Robin Gomita, impuesto, cañón de confeti o duelo), Cruce (elige ruta)
y Tienda de Perritas (al pasar o caer).

**Tablero:** 7 regiones (Plaza Confeti, Bosque Gomita, Pantano Burbuja, Cumbre Algodón, Volcán Malvavisco,
Isla Pemolar y Muelle Chicle), dos bifurcaciones con rutas de distinto riesgo y tres tiendas. Se puede hacer
corto, normal o largo, y con o sin atajos.

**Flujo:** `LOBBY → BOARD_INTRO → TURN_START → DICE_ROLL → MOVEMENT → (ROUTE_CHOICE | SHOP) → TILE_RESOLUTION → siguiente turno`.
Al terminar cada ronda (configurable) hay un minijuego común: `MINIGAME_INTRO → MINIGAME_PLAYING → MINIGAME_RESULTS`.
Al final: `BOARD_END → FINAL_BONUSES → FINAL_LEADERBOARD → WINNER_REVEAL`, con premios de broma y una tarjeta de resultados para compartir.

## Minijuegos

| Modo | Estado |
|---|---|
| CAP OR FACT | Jugable: 4 frases, todos responden a la vez; acertar rápido da puntos extra |
| SKILL ISSUE | Jugable: detén el reloj en el tiempo objetivo; el reloj se esconde al segundo y medio |
| GG DID IT? · SNAKE IN THE ROOM · OUT OF POCKET · CHAOS ENGINE | Registrados en el puente; aparecen como "próximamente" |

Para conectar un minijuego, crea un módulo en `src/engine/minigames/` con la interfaz descrita en
`src/engine/minigames/index.js` (`init`, `input`, `tick`, `isDone`, `scores`, `publicView`, `privateView`, `bot`)
y su vista en `public/js/minigame-views.js` (`tv` y `phone`). El motor nunca lanza dos minijuegos al mismo tiempo
y regresa al mismo tablero y turno al terminar.

## Arquitectura

```
src/engine/            reglas puras y autoritativas (se ejecutan en el servidor)
  config.js            configuración por defecto + normalización/validación
  board.js             tablero como datos: casillas con id, x, y, tipo, vecinos y región
  tileEffects.js       TileEventResolver: registro reutilizable de efectos por tipo de casilla
  turnManager.js       TurnManager: máquina de estados, dado, movimiento, tienda, minijuegos, final
  wallet.js            única vía para mover Perritas/Pemolares (genera eventos para animar)
  minigames/           MiniGameBridge + minijuegos
  runner.js            temporizadores y bots
server/                HTTP + WebSocket sin dependencias, salas, tokens de reconexión, persistencia
public/                TV (tv.html) y control (play.html)
  js/board-view.js     GameBoard · BoardTile · PlayerToken · BoardCameraController
  js/hud.js            BoardHUD · PlayerLeaderboard
  js/overlays.js       DiceRoller · PerritaShop · resultados · FinalResults + tarjeta compartible
  js/controls.js       controles privados del celular
artifact/              modo de una sola pantalla (se empaqueta a dist/)
```

**Seguridad:** el servidor genera el dado, calcula recompensas y compras, y fija la identidad de cada jugador
(el celular nunca dice "soy X"). Las acciones fuera de turno, los tiros dobles y las compras repetidas se rechazan
(la compra usa un token de un solo uso y es atómica). El estado público nunca incluye la semilla aleatoria ni las
respuestas de los minijuegos.

## Pruebas

```bash
npm test                         # motor: grafo del tablero, partidas completas con bots, tienda, seguridad
node server/index.js &           # y luego, contra el servidor:
node test/e2e-socket.mjs         # partida real por WebSocket con 2 celulares + 1 bot y una reconexión
```

El arte (personajes gomita, Perritas, Pemolares, casillas y decoraciones) es original y está dibujado en SVG.
