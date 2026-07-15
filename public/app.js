const RING_LENGTH = 2 * Math.PI * 52;

const state = {
  mode: "login",
  user: null,
  prompts: [],
};

const els = {
  authPanel: document.getElementById("auth-panel"),
  appPanel: document.getElementById("app-panel"),
  headerActions: document.getElementById("header-actions"),
  rolePill: document.getElementById("role-pill"),
  logoutBtn: document.getElementById("logout-btn"),
  authForm: document.getElementById("auth-form"),
  authError: document.getElementById("auth-error"),
  authSubmit: document.getElementById("auth-submit"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  appTitle: document.getElementById("app-title"),
  appLede: document.getElementById("app-lede"),
  userPanel: document.getElementById("user-panel"),
  adminPanel: document.getElementById("admin-panel"),
  submitForm: document.getElementById("submit-form"),
  promptInput: document.getElementById("prompt-input"),
  wordCount: document.getElementById("word-count"),
  submitError: document.getElementById("submit-error"),
  submitSuccess: document.getElementById("submit-success"),
  submitLimitNote: document.getElementById("submit-limit-note"),
  myPrompts: document.getElementById("my-prompts"),
  adminPrompts: document.getElementById("admin-prompts"),
  refreshBtn: document.getElementById("refresh-btn"),
  scoreResults: document.getElementById("score-results"),
  totalScore: document.getElementById("total-score"),
  scoreTitle: document.getElementById("score-title"),
  scoreSummary: document.getElementById("score-summary"),
  ringValue: document.getElementById("ring-value"),
  breakdown: document.getElementById("breakdown"),
  tipsList: document.getElementById("tips-list"),
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "same-origin",
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function setAuthMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.mode === mode);
  });
  els.authSubmit.textContent = mode === "login" ? "Log in" : "Create account";
  els.password.autocomplete =
    mode === "login" ? "current-password" : "new-password";
  els.authError.hidden = true;
}

function updateWordCount() {
  const words = els.promptInput.value.trim()
    ? els.promptInput.value.trim().split(/\s+/).filter(Boolean).length
    : 0;
  els.wordCount.textContent = `${words} word${words === 1 ? "" : "s"}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ringColor(total) {
  if (total >= 80) return "var(--good)";
  if (total >= 50) return "var(--mid)";
  return "var(--low)";
}

function toneFor(score) {
  if (score >= 14) return "tone-high";
  if (score >= 8) return "tone-mid";
  return "tone-low";
}

function showLoggedOut() {
  state.user = null;
  els.authPanel.hidden = false;
  els.appPanel.hidden = true;
  els.headerActions.hidden = true;
  els.userPanel.hidden = true;
  els.adminPanel.hidden = true;
  els.scoreResults.hidden = true;
}

function showLoggedIn() {
  const isAdmin = state.user.role === "admin";
  els.authPanel.hidden = true;
  els.appPanel.hidden = false;
  els.headerActions.hidden = false;
  els.rolePill.textContent = `${state.user.username} · ${
    isAdmin ? "Admin" : "User"
  }`;
  els.appTitle.textContent = isAdmin ? "Admin scoring" : "Submit a prompt";
  els.appLede.textContent = isAdmin
    ? "Review prompts submitted by users, then run scoring to produce overall results."
    : "Paste your one prompt and submit it for admin scoring.";

  // Users get the submit form; admins only get the review/scoring workspace.
  els.userPanel.hidden = isAdmin;
  els.adminPanel.hidden = !isAdmin;
  els.scoreResults.hidden = true;
  syncSubmitAvailability();
}

function syncSubmitAvailability() {
  if (!state.user || state.user.role === "admin") return;
  const hasSubmission = state.prompts.length > 0;
  els.submitForm.hidden = hasSubmission;
  els.submitLimitNote.hidden = !hasSubmission;
}

async function loadPrompts() {
  const data = await api("/api/prompts");
  state.prompts = data.prompts;
  if (state.user.role === "admin") {
    renderAdminPrompts();
  } else {
    renderMyPrompts();
    syncSubmitAvailability();
  }
}

function renderMyPrompts() {
  if (!state.prompts.length) {
    els.myPrompts.innerHTML =
      '<p class="empty">No submission yet. You can submit one prompt above.</p>';
    return;
  }

  els.myPrompts.innerHTML = state.prompts
    .map(
      (item) => `
      <article class="prompt-card">
        <div class="prompt-card-top">
          <h3>Prompt</h3>
          <span class="status status-${item.status}">${item.status}</span>
        </div>
        <p class="prompt-meta">${formatDate(item.createdAt)}${
          item.hasScore ? " · Scored by admin" : " · Awaiting score"
        }</p>
        <p class="prompt-body">${escapeHtml(item.prompt)}</p>
      </article>
    `
    )
    .join("");
}

function renderAdminPrompts() {
  if (!state.prompts.length) {
    els.adminPrompts.innerHTML =
      '<p class="empty">No user prompts yet. Ask teammates to register and submit.</p>';
    return;
  }

  els.adminPrompts.innerHTML = state.prompts
    .map(
      (item) => `
      <article class="prompt-card" data-id="${item.id}">
        <div class="prompt-card-top">
          <h3>Prompt from ${escapeHtml(item.username)}</h3>
          <span class="status status-${item.status}">${item.status}</span>
        </div>
        <p class="prompt-meta">
          ${formatDate(item.createdAt)}
          ${
            item.scoredBy
              ? ` · scored by ${escapeHtml(item.scoredBy)}`
              : ""
          }
        </p>
        <p class="prompt-body">${escapeHtml(item.prompt)}</p>
        <div class="prompt-actions">
          <button type="button" class="cta score-btn" data-id="${item.id}">
            ${item.result ? "Re-score" : "Run scoring"}
          </button>
          ${
            item.result
              ? `<button type="button" class="ghost-btn view-btn" data-id="${item.id}">View result</button>`
              : ""
          }
        </div>
      </article>
    `
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderScoreResult(result, meta = {}) {
  els.scoreResults.hidden = false;
  els.totalScore.textContent = String(result.total);
  els.scoreTitle.textContent = result.verdict.title;
  els.scoreSummary.textContent = meta.summary
    ? meta.summary
    : result.verdict.summary;

  els.ringValue.style.stroke = ringColor(result.total);
  els.ringValue.style.strokeDasharray = String(RING_LENGTH);
  els.ringValue.style.strokeDashoffset = String(
    RING_LENGTH - (result.total / 100) * RING_LENGTH
  );

  const dimensions = result.dimensions || [];
  els.breakdown.innerHTML = dimensions
    .map((dimension) => {
      const score = result.scores[dimension.id] || 0;
      return `
        <article class="dimension ${toneFor(score)}">
          <div class="dimension-head">
            <span aria-hidden="true">${dimension.icon}</span>
            <h3>${dimension.label}</h3>
          </div>
          <div class="bar" aria-hidden="true"><i style="width:${
            (score / 20) * 100
          }%"></i></div>
          <div class="dimension-score">${score}/20</div>
        </article>
      `;
    })
    .join("");

  const tips = result.tips?.length
    ? result.tips
    : ["All dimensions look strong."];
  els.tipsList.innerHTML = tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("");
  els.scoreResults.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function bootstrap() {
  const me = await api("/api/auth/me");
  if (!me.user) {
    showLoggedOut();
    return;
  }
  state.user = me.user;
  showLoggedIn();
  await loadPrompts();
}

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => setAuthMode(tab.dataset.mode));
});

els.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.authError.hidden = true;
  els.authSubmit.disabled = true;
  try {
    const payload = {
      username: els.username.value.trim(),
      password: els.password.value,
    };
    const path =
      state.mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const data = await api(path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.user = data.user;
    els.password.value = "";
    showLoggedIn();
    await loadPrompts();
  } catch (error) {
    els.authError.textContent = error.message;
    els.authError.hidden = false;
  } finally {
    els.authSubmit.disabled = false;
  }
});

els.logoutBtn.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST", body: "{}" });
  showLoggedOut();
});

els.promptInput.addEventListener("input", updateWordCount);

els.submitForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.submitError.hidden = true;
  els.submitSuccess.hidden = true;
  try {
    await api("/api/prompts", {
      method: "POST",
      body: JSON.stringify({
        prompt: els.promptInput.value,
      }),
    });
    els.promptInput.value = "";
    updateWordCount();
    els.submitSuccess.textContent = "Prompt submitted. You cannot submit another.";
    els.submitSuccess.hidden = false;
    await loadPrompts();
  } catch (error) {
    els.submitError.textContent = error.message;
    els.submitError.hidden = false;
  }
});

els.refreshBtn.addEventListener("click", () => {
  loadPrompts().catch((error) => alert(error.message));
});

els.adminPrompts.addEventListener("click", async (event) => {
  const scoreBtn = event.target.closest(".score-btn");
  const viewBtn = event.target.closest(".view-btn");
  const id = scoreBtn?.dataset.id || viewBtn?.dataset.id;
  if (!id) return;

  try {
    if (scoreBtn) {
      scoreBtn.disabled = true;
      scoreBtn.textContent = "Scoring…";
      const data = await api(`/api/prompts/${id}/score`, {
        method: "POST",
        body: "{}",
      });
      await loadPrompts();
      renderScoreResult(data.prompt.result, {
        summary: `${data.prompt.result.verdict.summary} Submitted by ${data.prompt.username}.`,
      });
      return;
    }

    const prompt = state.prompts.find((item) => item.id === id);
    if (prompt?.result) {
      renderScoreResult(prompt.result, {
        summary: `Saved result for ${prompt.username}`,
      });
    }
  } catch (error) {
    alert(error.message);
    if (scoreBtn) {
      scoreBtn.disabled = false;
      scoreBtn.textContent = "Run scoring";
    }
  }
});

updateWordCount();
bootstrap().catch((error) => {
  console.error(error);
  showLoggedOut();
});
