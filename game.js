'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - azul
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris acero)
  '#1c1c1c', // B - bomba (negro)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (hueco central)
  [[9]],                                       // B - bomba (1 celda, explota en 3x3)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const NUT = 8;
const NUT_CHANCE = 0.1;

// la bomba no se sortea: cae cuando el tablero supera COVER_START de cobertura,
// y luego cada COVER_STEP adicional. Si la cobertura baja de COVER_START, se rearma.
const BOMB = 9;
const BOMB_SIZE = 3;
const BOMB_RADIUS = 1; // (BOMB_SIZE - 1) / 2, a cada lado
const COVER_START = 0.5;
const COVER_STEP = 0.1;
const BOMB_SCORE = 10;

const THEME_KEY = 'tetris-theme';
const RECORDS_KEY = 'tetris-records';
const GRID_COLORS = { dark: '#22222e', light: '#d8d8e4' };

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const recordsTable = document.getElementById('records-table');
const recordsTableOverlay = document.getElementById('records-table-overlay');
const nameInput = document.getElementById('name-input');
const saveNameBtn = document.getElementById('save-name-btn');
const nameInputContainer = document.getElementById('name-input-container');
const recordsSection = document.getElementById('records-section');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, bombThreshold, maxCombo, maxLines;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  // la tuerca es un reto: sale rara vez, el resto es sorteo uniforme entre las 7 estándar
  const type = Math.random() < NUT_CHANCE ? NUT : Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function bombPiece() {
  return { type: BOMB, shape: [[BOMB]], x: Math.floor(COLS / 2), y: 0 };
}

function coverage() {
  let filled = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) filled++;
  return filled / (ROWS * COLS);
}

// arma o dispara la bomba según lo lleno que esté el tablero
function checkBomb() {
  const cov = coverage();
  if (cov < COVER_START) { bombThreshold = COVER_START; return; }
  if (cov >= bombThreshold) {
    bombThreshold = Math.min(1, bombThreshold + COVER_STEP);
    next = bombPiece(); // se ve venir en el preview "Siguiente"
  }
}

// la bomba se posa SOBRE la pila, así que el 3x3 muerde hacia abajo (su fila + las 2
// siguientes): un 3x3 centrado en ella solo rasparía la superficie y no dejaría hueco
function explode() {
  let destroyed = 0;
  for (let r = current.y; r < current.y + BOMB_SIZE; r++)
    for (let c = current.x - BOMB_RADIUS; c <= current.x + BOMB_RADIUS; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c]) { board[r][c] = 0; destroyed++; }
  score += destroyed * BOMB_SCORE;
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  if (current.type === BOMB) return; // la bomba no rota
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    maxCombo = Math.max(maxCombo, cleared);
    maxLines = Math.max(maxLines, lines);
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  // la bomba detona en vez de fijarse: board nunca contiene el índice BOMB
  if (current.type === BOMB) explode();
  else merge();
  clearLines();
  checkBomb();
  spawn();
  updateHUD();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (colorIndex === BOMB) {
    // cuerpo esférico + mecha, para que el negro se distinga del fondo
    const cx = x * size + size / 2;
    const cy = y * size + size / 2;
    context.fillStyle = '#3a3a3a';
    context.beginPath();
    context.arc(cx, cy + size * 0.08, size * 0.3, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ff8a3d';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(cx, cy - size * 0.2);
    context.lineTo(cx + size * 0.18, cy - size * 0.38);
    context.stroke();
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  ctx.strokeStyle = GRID_COLORS[theme];
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // con el juego terminado no hay pieza en juego: solo el tablero fijado
  if (gameOver) return;

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

// ---- Funciones de Records ----
function loadRecords() {
  const stored = localStorage.getItem(RECORDS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function isTopScore(newScore) {
  const records = loadRecords();
  if (records.length < 5) return true;
  return newScore > records[records.length - 1].score;
}

function getRecordPosition(newScore) {
  const records = loadRecords();
  for (let i = 0; i < records.length; i++)
    if (newScore > records[i].score) return i;
  return records.length < 5 ? records.length : -1;
}

function addRecord(name, score) {
  const records = loadRecords();
  records.push({ name, score, date: new Date().toLocaleDateString('es-ES') });
  records.sort((a, b) => b.score - a.score);
  saveRecords(records.slice(0, 5));
  updateRecordsDisplay();
}

function updateRecordsDisplay() {
  const records = loadRecords();
  let html = '';
  records.forEach((r, i) => {
    html += `<tr><td>${i + 1}</td><td>${r.name}</td><td>${r.score.toLocaleString()}</td></tr>`;
  });
  const fallback = '<tr><td colspan="3">Sin registros</td></tr>';
  recordsTable.innerHTML = html || fallback;
  recordsTableOverlay.innerHTML = html || fallback;
}

function resetRecords() {
  if (confirm('¿Estás seguro de que deseas borrar todos los registros?')) {
    localStorage.removeItem(RECORDS_KEY);
    updateRecordsDisplay();
  }
}

function showNameInput(isTopScore) {
  if (!isTopScore) {
    restartBtn.textContent = 'Reiniciar';
    restartBtn.style.display = 'block';
    nameInputContainer.style.display = 'none';
    recordsTableOverlay.style.display = 'block';
    return;
  }
  nameInputContainer.style.display = 'block';
  recordsTableOverlay.style.display = 'none';
  restartBtn.style.display = 'none';
  nameInput.value = '';
  nameInput.focus();
}

function savePlayerName() {
  const name = nameInput.value.trim() || 'Jugador';
  addRecord(name, score);
  nameInputContainer.style.display = 'none';
  recordsTableOverlay.style.display = 'block';
  restartBtn.textContent = 'Reiniciar';
  restartBtn.style.display = 'block';
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw();
  overlayTitle.textContent = 'GAME OVER';
  const isTop = isTopScore(score);
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}\nMáx. Combo: ${maxCombo} | Líneas: ${maxLines}`;
  showNameInput(isTop);
  updateRecordsDisplay();
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // lockPiece() puede haber disparado endGame(): no reagendar el frame
  if (gameOver || paused) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  bombThreshold = COVER_START;
  maxCombo = 0;
  maxLines = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  nameInputContainer.style.display = 'none';
  recordsTableOverlay.style.display = 'none';
  restartBtn.style.display = 'block';
  restartBtn.textContent = 'Reiniciar';
  updateRecordsDisplay();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
if (resetRecordsBtn) resetRecordsBtn.addEventListener('click', resetRecords);
if (saveNameBtn) saveNameBtn.addEventListener('click', savePlayerName);
if (nameInput) nameInput.addEventListener('keypress', e => { if (e.key === 'Enter') savePlayerName(); });

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === 'light' ? '☀️' : '🌙';
  themeToggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  themeToggle.setAttribute('aria-label', theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  localStorage.setItem(THEME_KEY, theme);
  if (board) draw();
}

function toggleTheme() {
  const isLight = document.documentElement.dataset.theme === 'light';
  applyTheme(isLight ? 'dark' : 'light');
}

themeToggle.addEventListener('click', toggleTheme);
applyTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');

init();
