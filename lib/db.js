const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "store.json");

const ADMIN_USERNAMES = new Set(["jki", "richa", "minju"]);
const DEFAULT_ADMIN_PASSWORD = "admin123";

function emptyStore() {
  return { users: [], prompts: [], sessions: {} };
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const store = emptyStore();
    seedAdmins(store);
    writeStore(store);
    return store;
  }
  const store = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  seedAdmins(store);
  writeStore(store);
  return store;
}

function seedAdmins(store) {
  for (const username of ADMIN_USERNAMES) {
    const existing = store.users.find(
      (user) => user.username.toLowerCase() === username
    );
    if (existing) {
      existing.role = "admin";
      continue;
    }
    store.users.push({
      id: crypto.randomUUID(),
      username,
      passwordHash: bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10),
      role: "admin",
      createdAt: new Date().toISOString(),
    });
  }
}

function readStore() {
  return ensureStore();
}

function writeStore(store) {
  fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
}

function isAdminUsername(username) {
  return ADMIN_USERNAMES.has(String(username || "").trim().toLowerCase());
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}

function findUserByUsername(username) {
  const normalized = String(username || "").trim().toLowerCase();
  return readStore().users.find(
    (user) => user.username.toLowerCase() === normalized
  );
}

function findUserById(id) {
  return readStore().users.find((user) => user.id === id);
}

function createUser(username, password) {
  const trimmed = String(username || "").trim();
  if (!trimmed || trimmed.length < 2) {
    throw new Error("Username must be at least 2 characters.");
  }
  if (!password || String(password).length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }
  if (findUserByUsername(trimmed)) {
    throw new Error("Username is already taken.");
  }

  const store = readStore();
  const user = {
    id: crypto.randomUUID(),
    username: trimmed,
    passwordHash: bcrypt.hashSync(String(password), 10),
    role: isAdminUsername(trimmed) ? "admin" : "user",
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  writeStore(store);
  return user;
}

function verifyUser(username, password) {
  const user = findUserByUsername(username);
  if (!user) return null;
  if (!bcrypt.compareSync(String(password || ""), user.passwordHash)) {
    return null;
  }
  return user;
}

function createSession(userId) {
  const store = readStore();
  const token = crypto.randomBytes(24).toString("hex");
  store.sessions[token] = {
    userId,
    createdAt: new Date().toISOString(),
  };
  writeStore(store);
  return token;
}

function getSessionUser(token) {
  if (!token) return null;
  const store = readStore();
  const session = store.sessions[token];
  if (!session) return null;
  return findUserById(session.userId);
}

function destroySession(token) {
  if (!token) return;
  const store = readStore();
  delete store.sessions[token];
  writeStore(store);
}

function sanitizePrompt(prompt, viewer) {
  const base = {
    id: prompt.id,
    useCase: prompt.useCase,
    prompt: prompt.prompt,
    username: prompt.username,
    userId: prompt.userId,
    status: prompt.status,
    createdAt: prompt.createdAt,
    scoredAt: prompt.scoredAt || null,
  };

  if (viewer?.role === "admin") {
    return {
      ...base,
      result: prompt.result || null,
      scoredBy: prompt.scoredBy || null,
    };
  }

  return {
    ...base,
    // Normal users never receive overall/total scoring payloads.
    hasScore: Boolean(prompt.result),
  };
}

function createPrompt({ user, prompt }) {
  const text = String(prompt || "").trim();
  if (!text || text.length < 10) {
    throw new Error("Prompt must be at least 10 characters.");
  }

  const store = readStore();
  const existing = store.prompts.find((item) => item.userId === user.id);
  if (existing) {
    throw new Error("You can submit only one prompt.");
  }

  const entry = {
    id: crypto.randomUUID(),
    userId: user.id,
    username: user.username,
    useCase: "Content writing",
    prompt: text,
    status: "pending",
    result: null,
    scoredBy: null,
    scoredAt: null,
    createdAt: new Date().toISOString(),
  };
  store.prompts.unshift(entry);
  writeStore(store);
  return entry;
}

function listPromptsForUser(userId) {
  return readStore().prompts.filter((prompt) => prompt.userId === userId);
}

function listAllPrompts() {
  return readStore().prompts;
}

function findPromptById(id) {
  return readStore().prompts.find((prompt) => prompt.id === id);
}

function savePromptScore(id, result, adminUser) {
  const store = readStore();
  const prompt = store.prompts.find((item) => item.id === id);
  if (!prompt) throw new Error("Prompt not found.");
  prompt.result = result;
  prompt.status = "scored";
  prompt.scoredBy = adminUser.username;
  prompt.scoredAt = new Date().toISOString();
  writeStore(store);
  return prompt;
}

module.exports = {
  ADMIN_USERNAMES,
  DEFAULT_ADMIN_PASSWORD,
  publicUser,
  createUser,
  verifyUser,
  createSession,
  getSessionUser,
  destroySession,
  sanitizePrompt,
  createPrompt,
  listPromptsForUser,
  listAllPrompts,
  findPromptById,
  savePromptScore,
  ensureStore,
};
