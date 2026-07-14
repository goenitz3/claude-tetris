# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Tetris en JavaScript vanilla: HTML5 Canvas + CSS, **sin dependencias, sin build, sin tests**. Tres archivos (`index.html`, `style.css`, `game.js`) más `README.md`.

## Ejecutar

No hay que instalar ni compilar. Abrir `index.html` directamente en el navegador, o servir estáticamente (recomendado para evitar restricciones de `file://`):

```bash
python3 -m http.server 8000   # o: npx serve .
```

No existen comandos de build, lint ni test — no hay toolchain. La verificación es manual: abrir el juego y jugar.

## Arquitectura

Toda la lógica vive en `game.js` (~300 líneas, un solo módulo, `'use strict'`). Puntos clave para ser productivo:

- **Estado como globals de módulo** (`board, current, next, score, level, dropInterval, animId`, etc., declarados en una sola línea al inicio). `init()` es el único punto que los (re)inicializa; el botón *Reiniciar* y la carga inicial ambos llaman a `init()`. No hay clases ni encapsulación.
- **El `board` es una matriz `ROWS × COLS`** donde cada celda es `0` (vacía) o un índice `1–8` (las 7 piezas estándar más la *tuerca*, un 3×3 con el centro hueco que `randomPiece` sortea aparte con probabilidad `NUT_CHANCE`). Ese índice es a la vez el tipo de pieza **y** el índice en `COLORS` y `PIECES` (ambos arrays empiezan con `null` en la posición 0 para alinear con el índice 1-based). Al añadir/cambiar piezas, mantener `PIECES` y `COLORS` en el mismo orden.
- **Game loop** (`loop`, vía `requestAnimationFrame`): acumula `dt` en `dropAccum` y baja la pieza cuando supera `dropInterval`. La pausa **cancela** el rAF (no hay flag comprobado dentro del loop); reanudar reinicia `lastTime` y vuelve a llamar a `loop`. `endGame()` también cancela el rAF.
- **Rotación**: `rotateCW` (transpuesta + reverso) genera la forma; `tryRotate` aplica *wall kicks* probando desplazamientos `[0,-1,1,-2,2]` y descarta el giro si todos colisionan.
- **Flujo de bloqueo**: `lockPiece()` → `merge()` (fija la pieza en `board`) → `clearLines()` → `spawn()`. `spawn()` promueve `next` a `current`, genera nueva `next`, y si la nueva pieza ya colisiona dispara `endGame()`.

## Acoplamiento HTML ↔ JS (importante al modificar)

- `game.js` busca elementos del DOM **por id** (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`). Renombrar un id en `index.html` rompe el juego silenciosamente.
- Las dimensiones del `<canvas id="board">` en `index.html` (`width="300" height="600"`) deben ser exactamente `COLS*BLOCK × ROWS*BLOCK`. Si cambias `COLS`, `ROWS` o `BLOCK` en `game.js`, ajusta el HTML a mano — no se calculan automáticamente.

## Convenciones

- Idioma: comentarios y UI en español; identificadores en inglés.
- Estilo compacto de una sola sentencia para bucles de dibujo/colisión (sin llaves). Al editar, respeta ese estilo para mantener la coherencia.
