const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const db = require("./lib/db");
const { scorePrompt } = require("./lib/scoring");

const app = express();
const PORT = process.env.PORT || 5173;
const COOKIE_NAME = "promptscore_session";

db.ensureStore();

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

function getToken(req) {
  return req.cookies[COOKIE_NAME] || "";
}

function sessionCookieOptions(req) {
  const secure =
    process.env.NODE_ENV === "production" ||
    req.secure ||
    req.headers["x-forwarded-proto"] === "https";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 1000 * 60 * 60 * 24 * 14,
  };
}

function requireAuth(req, res, next) {
  const user = db.getSessionUser(getToken(req));
  if (!user) {
    return res.status(401).json({ error: "Please log in." });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    next();
  });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const user = db.getSessionUser(getToken(req));
  res.json({ user: db.publicUser(user) });
});

app.post("/api/auth/register", (req, res) => {
  try {
    const user = db.createUser(req.body?.username, req.body?.password);
    const token = db.createSession(user.id);
    res.cookie(COOKIE_NAME, token, sessionCookieOptions(req));
    res.status(201).json({ user: db.publicUser(user) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/login", (req, res) => {
  const user = db.verifyUser(req.body?.username, req.body?.password);
  if (!user) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  const token = db.createSession(user.id);
  res.cookie(COOKIE_NAME, token, sessionCookieOptions(req));
  res.json({ user: db.publicUser(user) });
});

app.post("/api/auth/logout", (req, res) => {
  db.destroySession(getToken(req));
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/prompts", requireAuth, (req, res) => {
  const prompts =
    req.user.role === "admin"
      ? db.listAllPrompts()
      : db.listPromptsForUser(req.user.id);
  res.json({
    prompts: prompts.map((prompt) => db.sanitizePrompt(prompt, req.user)),
  });
});

app.post("/api/prompts", requireAuth, (req, res) => {
  if (req.user.role === "admin") {
    return res.status(403).json({
      error: "Admins review and score prompts. Use a normal user account to submit.",
    });
  }
  try {
    const prompt = db.createPrompt({
      user: req.user,
      prompt: req.body?.prompt,
    });
    res.status(201).json({ prompt: db.sanitizePrompt(prompt, req.user) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/prompts/:id/score", requireAdmin, (req, res) => {
  const prompt = db.findPromptById(req.params.id);
  if (!prompt) {
    return res.status(404).json({ error: "Prompt not found." });
  }
  const result = scorePrompt(prompt.prompt);
  const updated = db.savePromptScore(prompt.id, result, req.user);
  res.json({ prompt: db.sanitizePrompt(updated, req.user) });
});

app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Not found." });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`PromptScore running at http://127.0.0.1:${PORT}`);
});
