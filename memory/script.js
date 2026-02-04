const TOTAL_TIME = 600; // 10 minutes

let level = Number(localStorage.getItem("memoryRectangles_currentLevel")) || 0;
let bestLevel = Number(localStorage.getItem("memoryRectangles_bestLevel")) || 0;

// Do NOT rely on these being the single source of truth during runtime.
// We'll use helper functions to read/write localStorage atomically when needed.
let savedSequence = null;
let userIndex = 0;

let timeLeft = TOTAL_TIME;
let timerInterval = null;

let grid = document.getElementById("grid");
let levelText = document.getElementById("levelText");
let timerFill = document.getElementById("timerFill");
let statusText = document.getElementById("statusText");
let startBtn = document.getElementById("startBtn");

let gameOverOverlay = document.getElementById("gameOverOverlay");
let finalLevelText = document.getElementById("finalLevelText");
let bestLevelText = document.getElementById("bestLevelText");
let restartBtn = document.getElementById("restartBtn");

let tiles = [];
let sequence = [];
let isPlayingSequence = false;

/* ---------- PERSISTENCE HELPERS (save / load / clear) ---------- */

// Keys used in localStorage
const STORAGE_KEYS = {
  sequence: 'memoryRectangles_sequence',
  userIndex: 'memoryRectangles_userIndex',
  currentLevel: 'memoryRectangles_currentLevel',
  bestLevel: 'memoryRectangles_bestLevel',
  timeLeft: 'memoryRectangles_timeLeft',
  lastSavedTime: 'memoryRectangles_lastSavedTime'
};

/**
 * Save current in-memory sequence and userIndex to localStorage.
 * Called immediately after generating a sequence and after every correct click.
 */
function saveGameProgress() {
  try {
    if (Array.isArray(sequence) && sequence.length > 0) {
      localStorage.setItem(STORAGE_KEYS.sequence, JSON.stringify(sequence));
    } else {
      localStorage.removeItem(STORAGE_KEYS.sequence);
    }

    localStorage.setItem(STORAGE_KEYS.userIndex, String(userIndex || 0));
  } catch (err) {
    console.warn('Failed to save game progress', err);
  }
}

/**
 * Save timer state: remaining time and when it was saved.
 * Called during the timer countdown to persist time across reloads.
 */
function saveTimerState() {
  try {
    localStorage.setItem(STORAGE_KEYS.timeLeft, String(timeLeft));
    localStorage.setItem(STORAGE_KEYS.lastSavedTime, String(Date.now()));
  } catch (err) {
    console.warn('Failed to save timer state', err);
  }
}

/**
 * Load saved progress from localStorage and return an object.
 * This reads storage fresh each time to avoid stale in-memory copies.
 */
function loadGameProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.sequence);
    const seq = raw ? JSON.parse(raw) : null;
    const idxRaw = localStorage.getItem(STORAGE_KEYS.userIndex);
    const idx = idxRaw !== null ? Number(idxRaw) : 0;
    return {
      sequence: Array.isArray(seq) ? seq : null,
      userIndex: Number.isFinite(idx) && !Number.isNaN(idx) ? idx : 0
    };
  } catch (err) {
    console.warn('Failed to load game progress', err);
    return { sequence: null, userIndex: 0 };
  }
}

/**
 * Remove saved in-progress sequence and user index from storage.
 */
function clearSavedProgress() {
  try {
    localStorage.removeItem(STORAGE_KEYS.sequence);
    localStorage.removeItem(STORAGE_KEYS.userIndex);
  } catch (err) {
    console.warn('Failed to clear saved progress', err);
  }
}

/**
 * Load and restore timer state from localStorage, accounting for offline time.
 * Returns the adjusted timeLeft.
 */
function restoreTimerState() {
  try {
    const savedTimeLeft = Number(localStorage.getItem(STORAGE_KEYS.timeLeft));
    const lastSavedTime = Number(localStorage.getItem(STORAGE_KEYS.lastSavedTime));

    // If no saved time, return default
    if (!Number.isFinite(savedTimeLeft) || !Number.isFinite(lastSavedTime)) {
      return TOTAL_TIME;
    }

    // Calculate how much time passed while offline
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - lastSavedTime) / 1000);

    // Adjust timeLeft by subtracting elapsed time
    const newTimeLeft = Math.max(0, savedTimeLeft - elapsedSeconds);
    return newTimeLeft;
  } catch (err) {
    console.warn('Failed to restore timer state', err);
    return TOTAL_TIME;
  }
}

/* ---------- GRID LOGIC ---------- */

function getGridConfig(level) {
  if (level === 0) return { rows: 2, cols: 2 };
  if (level === 1) return { rows: 3, cols: 3 };
  if (level === 2) return { rows: 3, cols: 4 };
  if (level === 3) return { rows: 4, cols: 4 };
  return { rows: 4, cols: 5 };
}

function buildGrid() {
  grid.innerHTML = "";
  tiles = [];

  const { rows, cols } = getGridConfig(level);
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  const total = rows * cols;

  for (let i = 0; i < total; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.index = i;
    tile.addEventListener("click", () => onTileClick(i));
    grid.appendChild(tile);
    tiles.push(tile);
  }
}

/* ---------- TIMER ---------- */

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    
    // Save timer state every second so it persists across reloads
    saveTimerState();

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function updateTimerUI() {
  const percent = (timeLeft / TOTAL_TIME) * 100;
  timerFill.style.width = percent + "%";
}

/* ---------- SEQUENCE ---------- */

function generateSequence() {
  const flashCount = Math.min(tiles.length, 4 + level * 2);

  const availableIndexes = [];
  for (let i = 0; i < tiles.length; i++) {
    availableIndexes.push(i);
  }

  // Shuffle (Fisher-Yates)
  for (let i = availableIndexes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableIndexes[i], availableIndexes[j]] = [
      availableIndexes[j],
      availableIndexes[i]
    ];
  }

  sequence = availableIndexes.slice(0, flashCount);

  // ✅ Set in-memory sequence and reset user progress, then persist
  sequence = availableIndexes.slice(0, flashCount);
  userIndex = 0;
  savedSequence = sequence.slice();
  saveGameProgress();
}

async function playSequence(startFrom = 0) {
  isPlayingSequence = true;
  statusText.textContent = "Watch the sequence";

  // On resume, only play the tiles the player hasn't seen yet (from startFrom index onward)
  for (let i = startFrom; i < sequence.length; i++) {
    const idx = sequence[i];
    const tile = tiles[idx];

    tile.classList.add("active");
    await wait(600);
    tile.classList.remove("active");
    await wait(450);
  }

  isPlayingSequence = false;
  statusText.textContent = "Your turn";
}

/* ---------- USER INPUT ---------- */

function onTileClick(index) {
  if (isPlayingSequence) return;

  const tile = tiles[index];

  if (index === sequence[userIndex]) {
    // ✅ Correct = GREEN
    tile.classList.add("correct");

    setTimeout(() => {
      tile.classList.remove("correct");
    }, 300);

    userIndex++;
    // Persist updated progress immediately so resume is precise
    saveGameProgress();

    if (userIndex === sequence.length) {
      levelUp();
    }
  } else {
    // ❌ Wrong = RED
    tile.classList.add("wrong");
    grid.classList.add("shake");
    statusText.textContent = "Wrong! Try again.";

    setTimeout(() => {
      tile.classList.remove("wrong");
      grid.classList.remove("shake");
      // Reset user progress for this level and replay from the start
      userIndex = 0;
      saveGameProgress();
      playSequence(0); // Replay entire sequence from beginning
    }, 600);
  }
}

/* ---------- GAME FLOW ---------- */

function startLevel() {
  levelText.textContent = level;
  localStorage.setItem("memoryRectangles_currentLevel", level);

  buildGrid();

  // Try to load freshest saved progress from localStorage.
  const stored = loadGameProgress();

  // Validate stored sequence: must be an array and every index must be within current tile count
  const tileCount = tiles.length;
  let willRestore = false;
  if (stored.sequence && Array.isArray(stored.sequence)) {
    const valid = stored.sequence.every(i => Number.isInteger(i) && i >= 0 && i < tileCount);
    // userIndex must be within sequence bounds (not equal to length; equal means completed)
    const validIndex = Number.isInteger(stored.userIndex) && stored.userIndex >= 0 && stored.userIndex < stored.sequence.length;
    if (valid && validIndex) {
      willRestore = true;
    }
  }

  if (willRestore) {
    // Restore exact saved sequence and user progress
    sequence = stored.sequence.slice();
    userIndex = stored.userIndex;
    savedSequence = sequence.slice();
    // On resume, only play the NEW (unseen) tiles from userIndex onward
    playSequence(userIndex);
  } else {
    // No valid saved progress -> generate new sequence and persist
    clearSavedProgress();
    generateSequence();
    // New sequence: play all tiles from the beginning
    playSequence(0);
  }
}

function levelUp() {
  level++;
  levelText.textContent = level;
  statusText.textContent = "Good job!";

  localStorage.setItem("memoryRectangles_currentLevel", level);

  if (level > bestLevel) {
    bestLevel = level;
    localStorage.setItem("memoryRectangles_bestLevel", bestLevel);
  }

  // ✅ Clear saved sequence for next level
  clearSavedProgress();
  savedSequence = null;
  userIndex = 0;

  setTimeout(startLevel, 800);
}

function startGame(forceNew = false) {
  // If forcing a new game (restart), reset level and clear saved progress.
  if (forceNew) {
    level = 0;
    localStorage.setItem(STORAGE_KEYS.currentLevel, level);
    clearSavedProgress();
    // Clear timer state on new game
    localStorage.removeItem(STORAGE_KEYS.timeLeft);
    localStorage.removeItem(STORAGE_KEYS.lastSavedTime);
    savedSequence = null;
    userIndex = 0;
    timeLeft = TOTAL_TIME;
  } else {
    // Resume mode: restore timer state from localStorage
    timeLeft = restoreTimerState();
    
    // If timer already expired, end game immediately
    if (timeLeft <= 0) {
      endGame();
      return;
    }
  }

  // Always (re)start timer and UI for play session.
  updateTimerUI();
  gameOverOverlay.classList.add("hidden");
  startTimer();
  startLevel();
}

/* ---------- GAME OVER ---------- */

function endGame() {
  clearInterval(timerInterval);
  isPlayingSequence = true;
  
  // Clear timer state when game ends
  localStorage.removeItem(STORAGE_KEYS.timeLeft);
  localStorage.removeItem(STORAGE_KEYS.lastSavedTime);

  finalLevelText.textContent = level;
  bestLevelText.textContent = bestLevel;
  gameOverOverlay.classList.remove("hidden");
}

/* ---------- UTILS ---------- */

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ---------- EVENTS ---------- */

startBtn.addEventListener("click", () => startGame(false));
restartBtn.addEventListener("click", () => startGame(true));

window.addEventListener("load", () => {
  levelText.textContent = level;

  // If there is saved progress in localStorage, show resume hint.
  const stored = loadGameProgress();
  if (stored.sequence && Array.isArray(stored.sequence) && stored.sequence.length > 0 && stored.userIndex >= 0 && stored.userIndex < stored.sequence.length) {
    statusText.textContent = "Press Start to continue Level " + level;
  } else {
    statusText.textContent = "Press Start";
  }
});
