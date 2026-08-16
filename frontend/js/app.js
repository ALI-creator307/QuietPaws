// ==================== CONFIG & API ====================

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://quiet-paws-mu.vercel.app';

function getToken() {
  return localStorage.getItem('quietpaws_token');
}

function setToken(token) {
  if (token) {
    localStorage.setItem('quietpaws_token', token);
  } else {
    localStorage.removeItem('quietpaws_token');
  }
}

// ==================== APP ELEMENTS ====================

const appView = document.querySelector("#app-view");
const authView = document.querySelector("#auth-view");
const revealView = document.querySelector("#reveal-view");

const pages = document.querySelectorAll(".page");
const navLinks = document.querySelectorAll(".nav-link");

// Default fallback catalog mapping
const defaultCatQuotes = {
  Mochi: "“The sun is the best blanket.”",
  Biscuit: "“Slow is a lovely speed.”",
  Luna: "“There is time for one more rest.”",
  Oliver: "“Soft purrs fix everything.”",
  Cleo: "“Royalty lies in quiet moments.”",
  Simba: "“Brave hearts rest softly.”"
};


// ==================== TIMER STATE ====================

let selectedMinutes = 5;
let totalSeconds = 300;
let remaining = 300;

let timerId;
let running = false;


// ==================== HOUSE STATE ====================

let currentStreak = 0;
let bestStreak = 0;
let catsFound = 0;
let piecesFound = 0;
let authMode = "login"; // "login" or "signup"


// ==================== VIEW MANAGEMENT ====================

function showView(name) {
  // Hide the reward screen
  revealView.classList.add("hidden");

  // Show the main application
  appView.classList.remove("hidden");

  // Hide all pages
  pages.forEach((page) => {
    page.classList.add("hidden");
  });

  // Show the selected page
  const selectedPage = document.querySelector(`#${name}-view`);
  if (selectedPage) {
    selectedPage.classList.remove("hidden");
  }

  // Update active navigation link
  navLinks.forEach((link) => {
    link.classList.toggle(
      "active",
      link.dataset.view === name
    );
  });

  // Fetch updated data when opening House or Profile
  if (name === "house") {
    loadHouseData();
  } else if (name === "profile") {
    loadProfileData();
  }
}


// ==================== TIMER ====================

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secondsLeft = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${secondsLeft}`;
}

function updateTimer() {
  const timeDisplay = document.querySelector("#time-display");
  const timerRing = document.querySelector("#timer-ring");

  if (timeDisplay) {
    timeDisplay.textContent = formatTime(remaining);
  }

  if (timerRing) {
    timerRing.style.setProperty(
      "--progress",
      `${(remaining / totalSeconds) * 100}%`
    );
  }
}

async function finishSession() {
  // Stop the timer
  clearInterval(timerId);
  running = false;

  // Restore start button icon
  const startBtn = document.querySelector("#start-timer");
  if (startBtn) startBtn.textContent = "▶";

  const token = getToken();
  let rewardData = null;
  let newStreakVal = currentStreak + 1;

  if (token) {
    try {
      const res = await fetch(`${API_BASE}/api/sessions/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          durationMin: selectedMinutes,
          intention: "Quiet pause"
        })
      });

      if (res.ok) {
        const data = await res.json();
        newStreakVal = data.newStreak;
        rewardData = data.reward;
      }
    } catch (err) {
      console.error("Error completing session:", err);
    }
  }

  // Update streak count
  currentStreak = newStreakVal;
  updateStreakDisplay();

  // Populate reveal view
  if (rewardData) {
    document.querySelector("#reward-image").src = rewardData.image_url || "assets/cats/cat3.jpeg";
    document.querySelector("#reward-name").textContent = rewardData.name || "A new friend!";
    document.querySelector("#reward-trait").textContent = rewardData.detail || "Joined your cozy room.";
  } else {
    document.querySelector("#reward-image").src = "assets/cats/cat3.jpeg";
    document.querySelector("#reward-name").textContent = "Quiet Moment";
    document.querySelector("#reward-trait").textContent = "Peaceful mind achieved.";
  }

  document.querySelector("#reward-minutes").textContent = selectedMinutes;

  // Switch from app to reveal screen
  appView.classList.add("hidden");
  revealView.classList.remove("hidden");

  // Reload house progress
  loadHouseData();
}


// ==================== AUTHENTICATION ====================

const authForm = document.querySelector("#auth-form");
const authError = document.querySelector("#auth-error");

if (authForm) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    authError.textContent = "";

    const emailInput = authForm.querySelector("input[type='email']");
    const passwordInput = authForm.querySelector("input[type='password']");

    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if (!email || !password) {
      authError.textContent = "Please enter email and password";
      return;
    }

    const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const bodyData = authMode === "signup"
      ? { name: email.split("@")[0], email, password }
      : { email, password };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();

      if (!res.ok) {
        authError.textContent = data.error || "Authentication failed";
        return;
      }

      setToken(data.token);
      authView.classList.add("hidden");
      showView("timer");
      loadProfileData();
      loadHouseData();
    } catch (err) {
      console.error("Auth error:", err);
      authError.textContent = "Unable to connect to backend server.";
    }
  });
}

// Login / Sign up tabs toggle
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => {
      item.classList.remove("active");
    });

    tab.classList.add("active");
    authMode = tab.dataset.mode || "login";

    const submitBtn = document.querySelector("#auth-form .primary");
    if (submitBtn) {
      submitBtn.textContent = authMode === "login" ? "Log In" : "Create account";
    }
  });
});


// ==================== DATA FETCHING ====================

function updateStreakDisplay() {
  const streakCountEl = document.querySelector("#streak-count");
  if (streakCountEl) {
    streakCountEl.textContent = `${currentStreak} Day Streak`;
  }
}

async function loadProfileData() {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/api/user/profile`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      currentStreak = data.streak ? data.streak.current : 0;
      bestStreak = data.streak ? data.streak.best : 0;
      updateStreakDisplay();

      const profileCardText = document.querySelector("#profile-view .profile-card p");
      if (profileCardText) {
        profileCardText.textContent = `Hello ${data.name || 'friend'}! You have sat with yourself for ${data.totalSessions || 0} calm sessions. Best streak: ${bestStreak} days.`;
      }
    } else if (res.status === 401) {
      setToken(null);
      appView.classList.add("hidden");
      authView.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Error loading profile:", err);
  }
}

async function loadHouseData() {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/api/user/rewards`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      const unlockedCats = (data.cats || []).filter(c => c.unlocked);
      const unlockedPieces = (data.pieces || []).filter(p => p.unlocked);

      catsFound = unlockedCats.length;
      piecesFound = unlockedPieces.length;

      const catsFoundEl = document.querySelector("#cats-found");
      const piecesFoundEl = document.querySelector("#pieces-found");
      const progressFillEl = document.querySelector("#progress-fill");

      if (catsFoundEl) catsFoundEl.textContent = catsFound;
      if (piecesFoundEl) piecesFoundEl.textContent = piecesFound;
      if (progressFillEl) {
        progressFillEl.style.width = `${((catsFound + piecesFound) / 24) * 100}%`;
      }
    }
  } catch (err) {
    console.error("Error loading house data:", err);
  }
}


// ==================== NAVIGATION & DURATION ====================

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
  });
});

document.querySelectorAll(".durations button").forEach((button) => {
  button.addEventListener("click", () => {
    if (running) return;

    selectedMinutes = Number(button.dataset.minutes);
    totalSeconds = selectedMinutes * 60;
    remaining = totalSeconds;

    document.querySelectorAll(".durations button").forEach((item) => {
      item.classList.toggle("selected", item === button);
    });

    updateTimer();
  });
});


// ==================== TIMER CONTROLS ====================

const startBtn = document.querySelector("#start-timer");
if (startBtn) {
  startBtn.addEventListener("click", () => {
    if (running) {
      clearInterval(timerId);
      running = false;
      startBtn.textContent = "▶";
      return;
    }

    running = true;
    startBtn.textContent = "Ⅱ";

    timerId = setInterval(() => {
      remaining--;
      updateTimer();

      if (remaining <= 0) {
        finishSession();
      }
    }, 1000);
  });
}

const resetBtn = document.querySelector("#reset-timer");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    clearInterval(timerId);
    running = false;
    remaining = totalSeconds;
    updateTimer();
    if (startBtn) startBtn.textContent = "▶";
  });
}

const stopBtn = document.querySelector("#stop-timer");
if (stopBtn) {
  stopBtn.addEventListener("click", () => {
    clearInterval(timerId);
    running = false;
    remaining = totalSeconds;
    updateTimer();
    if (startBtn) startBtn.textContent = "▶";
  });
}


// ==================== MODALS & SETTINGS ====================

const settingsBtn = document.querySelector("#settings-button");
if (settingsBtn) {
  settingsBtn.addEventListener("click", () => {
    const modal = document.querySelector("#settings-modal");
    if (modal) modal.classList.remove("hidden");
  });
}

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    const modal = button.closest(".modal");
    if (modal) modal.classList.add("hidden");
  });
});

const logoutBtn = document.querySelector("#logout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    setToken(null);
    const modal = document.querySelector("#settings-modal");
    if (modal) modal.classList.add("hidden");

    appView.classList.add("hidden");
    authView.classList.remove("hidden");
  });
}


// ==================== INITIAL AUTO-LOGIN CHECK ====================

async function init() {
  updateTimer();
  const token = getToken();

  if (token) {
    try {
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        authView.classList.add("hidden");
        showView("timer");
        loadProfileData();
        loadHouseData();
        return;
      }
    } catch (e) {
      console.warn("Backend server connection check failed:", e);
    }
  }

  // Show Auth view if no valid token
  authView.classList.remove("hidden");
  appView.classList.add("hidden");
}

init();