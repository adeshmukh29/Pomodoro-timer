// ---------- CONFIG ----------
const POMODORO_MINUTES = 25;   // change to 0.2 (12 sec) for testing
const BREAK_MINUTES = 5;       // change to 0.1 (6 sec) for testing
const IDLE_THRESHOLD_MS = 12000; // 12s idle -> show "Stuck?" hint (Iteration 2)
 // 20s idle -> show "Stuck?" hint

// ---------- STATE ----------
let timerInterval = null;
let timerEndTime = null;
let remainingMs = 0;
let currentMode = "idle"; // "sprint" | "break" | "idle"
let isPaused = false;
let lastInteraction = Date.now();
let idleHintShown = false;
let selectedRating = null;
let currentGoal = "";

// ---------- DOM ----------
const setupView = document.getElementById("setup-view");
const sprintView = document.getElementById("sprint-view");
const breakView = document.getElementById("break-view");
const reflectionView = document.getElementById("reflection-view");

const startSprintBtn = document.getElementById("start-sprint-btn");
const skipGoalBtn = document.getElementById("skip-goal-btn");
const backHomeBtn = document.getElementById("back-home-btn");

const goalInput = document.getElementById("goal-input");
const currentGoalLabel = document.getElementById("current-goal-label");

const sprintTimerDisplay = document.getElementById("sprint-timer-display");
const breakTimerDisplay = document.getElementById("break-timer-display");
const stuckHint = document.getElementById("stuck-hint");

const pauseBtn = document.getElementById("pause-btn");
const resumeBtn = document.getElementById("resume-btn");
const endSprintBtn = document.getElementById("end-sprint-btn");

const reflectionError = document.getElementById("reflection-error");
const ratingButtons = document.querySelectorAll(".rating-btn");
const notesInput = document.getElementById("reflection-notes");
const saveReflectionBtn = document.getElementById("save-reflection-btn");

const todaySprintsSpan = document.getElementById("today-sprints");
const streakSpan = document.getElementById("streak");
const totalSprintsSpan = document.getElementById("total-sprints");
const avgMotivationSpan = document.getElementById("avg-motivation");
const toast = document.getElementById("toast"); // Iteration 1


// ---------- INIT ----------
init();

function init() {
  attachEventListeners();
  updateStatsUI();
  setView("setup");
}

function attachEventListeners() {
  startSprintBtn.addEventListener("click", () => {
    const goal = goalInput.value.trim();
    startSprint(goal);
  });

  skipGoalBtn.addEventListener("click", () => {
    startSprint("");
  });

  pauseBtn.addEventListener("click", pauseTimer);
  resumeBtn.addEventListener("click", resumeTimer);
  endSprintBtn.addEventListener("click", () => {
    // treat manual end as completed sprint (often what you want in HCI demo)
    stopTimer();
    currentMode = "idle";
    goToReflection();
  });

  document.getElementById("skip-break-btn").addEventListener("click", () => {
    stopTimer();
    currentMode = "idle";
    goToReflection();
  });

  ratingButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      ratingButtons.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedRating = parseInt(btn.dataset.rating, 10);
      reflectionError.classList.add("hidden");
    });
  });

  saveReflectionBtn.addEventListener("click", () => {
    if (!selectedRating) {
      reflectionError.classList.remove("hidden");
      return;
    }
    recordSession(selectedRating, notesInput.value.trim());
    // reset reflection UI
    selectedRating = null;
    ratingButtons.forEach((b) => b.classList.remove("selected"));
    notesInput.value = "";
    reflectionError.classList.add("hidden");
    setView("setup");
    backHomeBtn.classList.add("hidden");
    showToast(); // Iteration 1: confirm that the sprint was saved
  });


  backHomeBtn.addEventListener("click", () => {
    stopTimer();
    setView("setup");
    backHomeBtn.classList.add("hidden");
  });

  // Track interaction to drive "Stuck?" hint
  ["click", "keydown", "mousemove"].forEach((evt) => {
    document.addEventListener(evt, () => {
      lastInteraction = Date.now();
      if (!stuckHint.classList.contains("hidden")) {
        stuckHint.classList.add("hidden");
      }
      idleHintShown = false;
    });
  });
}

// ---------- VIEW HANDLING ----------
function setView(viewName) {
  // Hide all views
  setupView.classList.add("hidden");
  sprintView.classList.add("hidden");
  breakView.classList.add("hidden");
  reflectionView.classList.add("hidden");

  // Reset mode classes on <body>
  document.body.classList.remove("sprint-mode", "break-mode");

  if (viewName === "setup") {
    setupView.classList.remove("hidden");
  } else if (viewName === "sprint") {
    sprintView.classList.remove("hidden");
    backHomeBtn.classList.remove("hidden");
    document.body.classList.add("sprint-mode"); // <-- very visible
  } else if (viewName === "break") {
    breakView.classList.remove("hidden");
    backHomeBtn.classList.remove("hidden");
    document.body.classList.add("break-mode"); // <-- very visible
  } else if (viewName === "reflection") {
    reflectionView.classList.remove("hidden");
    backHomeBtn.classList.remove("hidden");
  }
}


// ---------- TIMER LOGIC ----------
function startSprint(goalText) {
  currentGoal = goalText || "(no specific goal)";
  currentGoalLabel.textContent = currentGoal;
  currentMode = "sprint";
  // Iteration 2: set sprint mode border
  const sprintCircle = document.querySelector("#sprint-view .timer-circle");
  if (sprintCircle) {
    sprintCircle.classList.add("sprint-mode");
    sprintCircle.classList.remove("break-mode");
  }

  idleHintShown = false;
  stuckHint.classList.add("hidden");
  goalInput.value = "";
  startTimer(POMODORO_MINUTES * 60 * 1000, "sprint");
  setView("sprint");
}

function startBreak() {
  currentMode = "break";
    // Iteration 2: set break mode border
  const breakCircle = document.querySelector("#break-view .timer-circle");
  if (breakCircle) {
    breakCircle.classList.add("break-mode");
    breakCircle.classList.remove("sprint-mode");
  }

  startTimer(BREAK_MINUTES * 60 * 1000, "break");
  setView("break");
}

function startTimer(durationMs, mode) {
  stopTimer(); // clear any existing
  currentMode = mode;
  isPaused = false;
  remainingMs = durationMs;
  timerEndTime = Date.now() + durationMs;

  updateTimerDisplay(remainingMs);
    // Iteration 1: add 'running' class to the active timer circle
  if (currentMode === "sprint") {
    const sprintCircle = document.querySelector("#sprint-view .timer-circle");
    sprintCircle && sprintCircle.classList.add("running");
  } else if (currentMode === "break") {
    const breakCircle = document.querySelector("#break-view .timer-circle");
    breakCircle && breakCircle.classList.add("running");
  }


  timerInterval = setInterval(() => {
    if (isPaused) return;

    const now = Date.now();
    remainingMs = timerEndTime - now;

    if (remainingMs <= 0) {
      timerComplete();
      return;
    }

    updateTimerDisplay(remainingMs);
    handleIdleHint();
  }, 1000);
}

function pauseTimer() {
  if (currentMode === "idle" || isPaused) return;
  isPaused = true;
  remainingMs = Math.max(timerEndTime - Date.now(), 0);
  clearInterval(timerInterval);
  timerInterval = null;
  pauseBtn.classList.add("hidden");
  resumeBtn.classList.remove("hidden");
}

function resumeTimer() {
  if (currentMode === "idle" || !isPaused || remainingMs <= 0) return;
  isPaused = false;
  timerEndTime = Date.now() + remainingMs;

  pauseBtn.classList.remove("hidden");
  resumeBtn.classList.add("hidden");

  timerInterval = setInterval(() => {
    if (isPaused) return;
    const now = Date.now();
    remainingMs = timerEndTime - now;

    if (remainingMs <= 0) {
      timerComplete();
      return;
    }

    updateTimerDisplay(remainingMs);
    handleIdleHint();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  remainingMs = 0;
  isPaused = false;
  pauseBtn.classList.remove("hidden");
  resumeBtn.classList.add("hidden");
  stuckHint.classList.add("hidden");
  idleHintShown = false;

    // Iteration 1 + 2: remove extra classes from timer circles
  document.querySelectorAll(".timer-circle").forEach((circle) => {
    circle.classList.remove("running", "sprint-mode", "break-mode");
  });

}


function timerComplete() {
  stopTimer();
  if (currentMode === "sprint") {
    startBreak();
  } else if (currentMode === "break") {
    currentMode = "idle";
    goToReflection();
  }
}

function updateTimerDisplay(ms) {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  if (currentMode === "sprint") {
    sprintTimerDisplay.textContent = `${minutes}:${seconds}`;
  } else if (currentMode === "break") {
    breakTimerDisplay.textContent = `${minutes}:${seconds}`;
  }
}

function handleIdleHint() {
  if (currentMode !== "sprint") return;
  if (idleHintShown) return;
  const idleFor = Date.now() - lastInteraction;
  if (idleFor >= IDLE_THRESHOLD_MS) {
    stuckHint.classList.remove("hidden");
    idleHintShown = true;
  }
}

// ---------- REFLECTION & STATS ----------
function goToReflection() {
  setView("reflection");
}

function loadState() {
  try {
    const raw = localStorage.getItem("studySprintData");
    if (!raw) {
      return {
        sessions: [],
        lastUseDate: null,
        streak: 0,
      };
    }
    return JSON.parse(raw);
  } catch (e) {
    return {
      sessions: [],
      lastUseDate: null,
      streak: 0,
    };
  }
}

function saveState(state) {
  localStorage.setItem("studySprintData", JSON.stringify(state));
}

function recordSession(rating, note) {
  const state = loadState();
  const today = getTodayISO();

  state.sessions.push({
    date: today,
    goal: currentGoal,
    rating,
    note,
  });

  if (!state.lastUseDate) {
    state.streak = 1;
    state.lastUseDate = today;
  } else if (state.lastUseDate === today) {
    // same day – streak unchanged
  } else if (isYesterday(state.lastUseDate, today)) {
    state.streak += 1;
    state.lastUseDate = today;
  } else {
    // gap -> reset
    state.streak = 1;
    state.lastUseDate = today;
  }

  saveState(state);
  updateStatsUI();
}

function updateStatsUI() {
  const state = loadState();
  const today = getTodayISO();
  const todaySessions = state.sessions.filter((s) => s.date === today);
  const allRatings = state.sessions.map((s) => s.rating);

  todaySprintsSpan.textContent = todaySessions.length;
  streakSpan.textContent = state.streak;
  // Iteration 2: show fire icon for streak >= 3
  if (state.streak >= 3) {
    streakSpan.textContent = `${state.streak} 🔥`;
  }

  totalSprintsSpan.textContent = state.sessions.length;

  if (allRatings.length === 0) {
    avgMotivationSpan.textContent = "–";
  } else {
    const avg =
      allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length;
    avgMotivationSpan.textContent = avg.toFixed(1);
  }
}
// ---------- TOAST ----------
// Iteration 1: show a small confirmation after saving reflection
function showToast() {
  if (!toast) return;
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2200);
}


function getTodayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function isYesterday(prevISO, currentISO) {
  if (!prevISO) return false;
  const prev = new Date(prevISO);
  const curr = new Date(currentISO);
  const diffMs = curr - prev;
  const oneDayMs = 24 * 60 * 60 * 1000;
  return diffMs > 0 && diffMs <= oneDayMs * 1.5; // small buffer
}
