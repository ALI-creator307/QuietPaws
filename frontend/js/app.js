// ==================== CONFIG & API ====================

const API_BASE = 'https://quiet-paws-mu.vercel.app';

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

function resolveImageUrl(rawUrl, category) {
  if (!rawUrl) {
    return category === 'cat' ? 'assets/cats/mochi.png' : 'assets/pieces/rug.png';
  }
  // Remove leading slash if present ('assets/cats/mochi.png')
  return rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl;
}


// ==================== APP ELEMENTS ====================

const appView = document.querySelector("#app-view");
const authView = document.querySelector("#auth-view");
const revealView = document.querySelector("#reveal-view");

const pages = document.querySelectorAll(".page");
const navLinks = document.querySelectorAll(".nav-link");

// Default quotes for items
const itemQuotes = {
  Mochi: "“Naps in sunbeams, ignores everyone.”",
  Biscuit: "“Slow is a lovely speed.”",
  Luna: "“The sun is the best blanket.”",
  Oliver: "“Soft purrs soothe your soul.”",
  Cleo: "“Royalty lies in quiet moments.”",
  Simba: "“Brave hearts rest softly.”",
  Peanut: "“Small moments bring big warmth.”",
  Whiskers: "“Master of peaceful cat naps.”",
  Jasper: "“Quietly observes the world with love.”",
  Hazel: "“Loves warm tea and cozy corners.”",
  Willow: "“Soft purrs that ease all stress.”",
  Ziggy: "“Chases dust motes in gentle light.”"
};


// ==================== TIMER STATE ====================

let selectedMinutes = 5;
let totalSeconds = 300;
let remaining = 300;

let timerId;
let running = false;


// ==================== HOUSE & CATALOG STATE ====================

let currentStreak = 0;
let bestStreak = 0;
let catsFound = 0;
let piecesFound = 0;
let authMode = "login"; // "login" or "signup"
let catalogFilter = "all"; // "all", "cat", "piece"
let cachedCatalog = { cats: [], pieces: [], houseComplete: false };
let currentUser = null;


// ==================== VIEW MANAGEMENT ====================

function showView(name) {
  // Hide reward reveal
  revealView.classList.add("hidden");

  // Show main app container
  appView.classList.remove("hidden");

  // Hide all pages
  pages.forEach((page) => {
    page.classList.add("hidden");
  });

  // Show selected page
  const selectedPage = document.querySelector(`#${name}-view`);
  if (selectedPage) {
    selectedPage.classList.remove("hidden");
  }

  // Update active nav link
  navLinks.forEach((link) => {
    link.classList.toggle(
      "active",
      link.dataset.view === name
    );
  });

  // Trigger data refreshes on view switch
  if (name === "house") {
    loadHouseData();
  } else if (name === "profile") {
    loadProfileData();
  }
}


// ==================== TIMER LOGIC ====================

function formatTime(seconds) {
  if (seconds <= 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const secondsLeft = String(seconds % 60).padStart(2, "0");
  return `${String(minutes).padStart(2, "0")}:${secondsLeft}`;
}

function updateTimerDisplay() {
  const timeDisplay = document.querySelector("#time-display");
  const timerRing = document.querySelector("#timer-ring");

  if (timeDisplay) {
    timeDisplay.textContent = formatTime(remaining);
  }

  if (timerRing) {
    const progressPercent = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 100;
    timerRing.style.setProperty("--progress", `${progressPercent}%`);
  }
}

function setTimerMinutes(mins, highlightPresets = false) {
  if (running) return;
  mins = Math.max(1, Math.min(180, Number(mins) || 5));
  selectedMinutes = mins;
  totalSeconds = selectedMinutes * 60;
  remaining = totalSeconds;

  const customInput = document.querySelector("#custom-minutes-input");
  if (customInput && document.activeElement !== customInput) {
    customInput.value = selectedMinutes;
  }

  // Highlight preset pill only if explicitly requested
  document.querySelectorAll(".quick-dial-pills .dial-pill").forEach((btn) => {
    btn.classList.toggle("selected", highlightPresets && Number(btn.dataset.minutes) === selectedMinutes);
  });

  updateTimerDisplay();
}

async function finishSession() {
  // Stop timer
  clearInterval(timerId);
  running = false;

  const playIcon = document.querySelector("#play-icon");
  if (playIcon) playIcon.textContent = "▶";

  const intentionInput = document.querySelector("#timer-intention");
  const userIntention = intentionInput ? intentionInput.value.trim() : "";

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
          intention: userIntention || "Mindful quiet pause"
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

  // Clear intention input
  if (intentionInput) intentionInput.value = "";

  // Update streak count
  currentStreak = newStreakVal;
  if (currentStreak > bestStreak) bestStreak = currentStreak;
  updateStreakDisplay();

  // Populate reveal screen
  if (rewardData) {
    const rewardImgSrc = resolveImageUrl(rewardData.image_url, rewardData.type);
    document.querySelector("#reward-image").src = rewardImgSrc;
    document.querySelector("#reward-name").textContent = rewardData.name || "A New Companion!";
    document.querySelector("#reward-trait").textContent = rewardData.detail || "Joined your cozy sanctuary.";
  } else {
    document.querySelector("#reward-image").src = "assets/cats/mochi.png";
    document.querySelector("#reward-name").textContent = "Quiet Moment";
    document.querySelector("#reward-trait").textContent = "All sanctuary companions collected! Peace achieved.";
  }

  document.querySelector("#reward-minutes").textContent = selectedMinutes;

  // Show reveal view
  appView.classList.add("hidden");
  revealView.classList.remove("hidden");

  // Reload house catalog
  loadHouseData();
}


// ==================== AUTHENTICATION ====================

const authForm = document.querySelector("#auth-form");
const authError = document.querySelector("#auth-error");
const nameGroup = document.querySelector("#name-group");

if (authForm) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (authError) authError.textContent = "";

    const nameInput = document.querySelector("#auth-name");
    const emailInput = document.querySelector("#auth-email");
    const passwordInput = document.querySelector("#auth-password");

    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";
    const name = (authMode === "signup" && nameInput)
      ? nameInput.value.trim() || email.split("@")[0]
      : email.split("@")[0];

    if (!email || !password) {
      if (authError) authError.textContent = "Please enter email and password";
      return;
    }

    const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const bodyData = authMode === "signup"
      ? { name, email, password }
      : { email, password };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();

      if (!res.ok) {
        if (authError) authError.textContent = data.error || "Authentication failed";
        return;
      }

      setToken(data.token);
      currentUser = data.user;
      authView.classList.add("hidden");
      showView("timer");
      loadProfileData();
      loadHouseData();
    } catch (err) {
      console.error("Auth error:", err);
      if (authError) authError.textContent = "Unable to connect to backend server.";
    }
  });
}

// Login / Sign up tab toggling
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => {
      item.classList.remove("active");
    });

    tab.classList.add("active");
    authMode = tab.dataset.mode || "login";

    if (nameGroup) {
      if (authMode === "signup") {
        nameGroup.classList.remove("hidden");
      } else {
        nameGroup.classList.add("hidden");
      }
    }

    const submitBtn = document.querySelector("#auth-form .primary");
    if (submitBtn) {
      submitBtn.textContent = authMode === "login" ? "Log In" : "Create account";
    }
  });
});


// ==================== PROFILE & HOUSE DATA ====================

function updateStreakDisplay() {
  const streakCountEl = document.querySelector("#streak-count");
  const bestStreakEl = document.querySelector("#best-streak-display");

  if (streakCountEl) {
    streakCountEl.textContent = `${currentStreak} Day Streak`;
  }

  if (bestStreakEl) {
    bestStreakEl.textContent = `👑 Best: ${bestStreak} Days`;
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

      const profileNameEl = document.querySelector("#profile-name");
      const profileEmailEl = document.querySelector("#profile-email");
      const profileInitialEl = document.querySelector("#profile-initial");

      if (profileNameEl) profileNameEl.textContent = data.name || "Mindful Meditator";
      if (profileEmailEl) profileEmailEl.textContent = data.email || "";
      if (profileInitialEl && data.name) {
        profileInitialEl.textContent = data.name.charAt(0).toUpperCase();
      }

      const statCurrent = document.querySelector("#stat-current-streak");
      const statBest = document.querySelector("#stat-best-streak");
      const statSessions = document.querySelector("#stat-sessions");
      const statCollectibles = document.querySelector("#stat-collectibles");

      if (statCurrent) statCurrent.textContent = currentStreak;
      if (statBest) statBest.textContent = bestStreak;
      if (statSessions) statSessions.textContent = data.totalSessions || 0;
      if (statCollectibles) statCollectibles.textContent = `${catsFound + piecesFound} / 24`;
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
      cachedCatalog = data;

      const unlockedCats = (data.cats || []).filter(c => c.unlocked);
      const unlockedPieces = (data.pieces || []).filter(p => p.unlocked);

      catsFound = unlockedCats.length;
      piecesFound = unlockedPieces.length;
      const totalUnlocked = catsFound + piecesFound;
      const pct = Math.round((totalUnlocked / 24) * 100);

      const catsFoundEl = document.querySelector("#cats-found");
      const piecesFoundEl = document.querySelector("#pieces-found");
      const progressFillEl = document.querySelector("#progress-fill");
      const progressPercentEl = document.querySelector("#progress-percent");

      if (catsFoundEl) catsFoundEl.textContent = `${catsFound} / 12`;
      if (piecesFoundEl) piecesFoundEl.textContent = `${piecesFound} / 12`;
      if (progressFillEl) progressFillEl.style.width = `${pct}%`;
      if (progressPercentEl) progressPercentEl.textContent = `${pct}%`;

      renderCatalogGrid();
    }
  } catch (err) {
    console.error("Error loading house data:", err);
  }
}


// ==================== CATALOG GRID RENDERER ====================

function renderCatalogGrid() {
  const gridEl = document.querySelector("#collectibles-grid");
  if (!gridEl) return;

  gridEl.innerHTML = "";

  const allItems = [];

  if (catalogFilter === "all" || catalogFilter === "cat") {
    (cachedCatalog.cats || []).forEach(cat => allItems.push({ ...cat, category: 'cat' }));
  }

  if (catalogFilter === "all" || catalogFilter === "piece") {
    (cachedCatalog.pieces || []).forEach(piece => allItems.push({ ...piece, category: 'piece' }));
  }

  allItems.forEach(item => {
    const card = document.createElement("div");
    card.className = `catalog-card ${item.unlocked ? 'unlocked' : 'locked'}`;

    const isCat = item.category === 'cat';
    const imgSrc = resolveImageUrl(item.image_url, item.category);
    const fallbackSrc = isCat ? 'assets/cats/mochi.png' : 'assets/pieces/rug.png';

    card.innerHTML = `
      <img
        class="catalog-card-img"
        src="${imgSrc}"
        alt="${item.name}"
        onerror="this.onerror=null; this.src='${fallbackSrc}';"
      />
      <h4>${item.unlocked ? item.name : '???'}</h4>
      <p>${item.unlocked ? (item.detail || 'Unlocked companion') : 'Complete sessions to unlock'}</p>
      <span class="badge ${item.unlocked ? 'badge-unlocked' : 'badge-locked'}">
        ${item.unlocked ? '✓ Unlocked' : '🔒 Locked'}
      </span>
    `;

    if (item.unlocked) {
      card.addEventListener("click", () => openItemModal(item));
    }

    gridEl.appendChild(card);
  });
}

function openItemModal(item) {
  const modal = document.querySelector("#cat-modal");
  if (!modal) return;

  const modalImg = document.querySelector("#modal-image");
  const modalName = document.querySelector("#modal-name");
  const modalTrait = document.querySelector("#modal-trait");
  const modalQuote = document.querySelector("#modal-quote");
  const modalBadge = document.querySelector("#modal-badge");

  const category = item.type || item.category || 'cat';
  const imgSrc = resolveImageUrl(item.image_url, category);
  const fallbackSrc = category === 'cat' ? 'assets/cats/mochi.png' : 'assets/pieces/rug.png';

  if (modalImg) {
    modalImg.src = imgSrc;
    modalImg.onerror = () => { modalImg.src = fallbackSrc; };
  }

  if (modalName) modalName.textContent = item.name;
  if (modalTrait) modalTrait.textContent = `☀  ${item.detail || 'A calm companion for your space.'}`;
  if (modalQuote) modalQuote.textContent = itemQuotes[item.name] || "“In quietness and confidence shall be your strength.”";
  if (modalBadge) {
    const dateStr = item.unlockedAt ? new Date(item.unlockedAt).toLocaleDateString() : 'Unlocked';
    modalBadge.textContent = `Unlocked ${dateStr}`;
  }

  modal.classList.remove("hidden");
}


// Catalog Tabs (All / Cats / Decor)
document.querySelectorAll(".catalog-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".catalog-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    catalogFilter = tab.dataset.filter || "all";
    renderCatalogGrid();
  });
});


// ==================== NAVIGATION & TIMER CONTROLS ====================

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
  });
});

// Quick Dial Pills Click (explicitly highlights clicked preset)
document.querySelectorAll(".quick-dial-pills .dial-pill").forEach((button) => {
  button.addEventListener("click", () => {
    setTimerMinutes(Number(button.dataset.minutes), true);
  });
});

// Smooth Custom Minutes Input & Stepper
const customMinutesInput = document.querySelector("#custom-minutes-input");
if (customMinutesInput) {
  customMinutesInput.addEventListener("input", (e) => {
    if (running) return;
    const raw = e.target.value;

    // Unselect preset pills while custom typing
    document.querySelectorAll(".quick-dial-pills .dial-pill").forEach((btn) => {
      btn.classList.remove("selected");
    });

    if (raw === "" || raw === null) {
      remaining = 0;
      updateTimerDisplay();
      return;
    }

    let mins = parseInt(raw, 10);
    if (!isNaN(mins) && mins > 0) {
      mins = Math.min(180, mins);
      selectedMinutes = mins;
      totalSeconds = selectedMinutes * 60;
      remaining = totalSeconds;
      updateTimerDisplay();
    }
  });

  customMinutesInput.addEventListener("blur", (e) => {
    if (running) return;
    let mins = parseInt(e.target.value, 10);
    if (isNaN(mins) || mins < 1) {
      mins = 1;
    } else if (mins > 180) {
      mins = 180;
    }
    setTimerMinutes(mins, false);
  });
}

const minusMinBtn = document.querySelector("#minus-min");
if (minusMinBtn) {
  minusMinBtn.addEventListener("click", () => {
    setTimerMinutes(selectedMinutes - 1, false);
  });
}

const plusMinBtn = document.querySelector("#plus-min");
if (plusMinBtn) {
  plusMinBtn.addEventListener("click", () => {
    setTimerMinutes(selectedMinutes + 1, false);
  });
}


// ==================== TIMER CONTROLS ====================

const startBtn = document.querySelector("#start-timer");
const playIcon = document.querySelector("#play-icon");

if (startBtn) {
  startBtn.addEventListener("click", () => {
    if (running) {
      clearInterval(timerId);
      running = false;
      if (playIcon) playIcon.textContent = "▶";
      return;
    }

    running = true;
    if (playIcon) playIcon.textContent = "Ⅱ";

    timerId = setInterval(() => {
      remaining--;
      updateTimerDisplay();

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
    updateTimerDisplay();
    if (playIcon) playIcon.textContent = "▶";
  });
}

const stopBtn = document.querySelector("#stop-timer");
if (stopBtn) {
  stopBtn.addEventListener("click", () => {
    clearInterval(timerId);
    running = false;
    remaining = totalSeconds;
    updateTimerDisplay();
    if (playIcon) playIcon.textContent = "▶";
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
    currentUser = null;
    const modal = document.querySelector("#settings-modal");
    if (modal) modal.classList.add("hidden");

    appView.classList.add("hidden");
    authView.classList.remove("hidden");
  });
}


// ==================== INITIAL STARTUP ====================

async function init() {
  updateTimerDisplay();
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
      console.warn("Backend connection check warning:", e);
    }
  }

  authView.classList.remove("hidden");
  appView.classList.add("hidden");
}

init();