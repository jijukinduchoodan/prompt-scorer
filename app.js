const DIMENSIONS = [
  {
    id: "specificity",
    label: "Specificity",
    icon: "🎯",
    tip: "Add concrete details: numbers, named deliverables, examples, and an unambiguous ask.",
  },
  {
    id: "context",
    label: "Context",
    icon: "📋",
    tip: "Set the scene: audience, goal, product/domain, and why the output matters.",
  },
  {
    id: "role",
    label: "Role Assignment",
    icon: "🎭",
    tip: 'Assign a clear persona, e.g. "Act as a senior copywriter specializing in B2B SaaS."',
  },
  {
    id: "format",
    label: "Output Format",
    icon: "📐",
    tip: "Specify structure: JSON, markdown table, numbered steps, or labeled sections.",
  },
  {
    id: "constraints",
    label: "Constraints",
    icon: "📏",
    tip: "Add limits: must/never rules, tone bounds, length caps, or things to avoid.",
  },
];

const ROLE_PATTERNS = [
  /\b(?:you are|you're)\b/i,
  /\bact as\b/i,
  /\bas an?\b/i,
  /\brole(?:\s+of|\s*:)\b/i,
  /\bpersona\b/i,
  /\b(?:expert|specialist|professional|veteran|senior)\b/i,
  /\bimagine you(?:'re| are)\b/i,
  /\btake (?:on|the role)\b/i,
];

const CONTEXT_PATTERNS = [
  /\b(?:context|background|given that|considering|based on)\b/i,
  /\b(?:audience|users?|customers?|readers?|stakeholders?)\b/i,
  /\b(?:goal|objective|purpose|aimed at|so that|in order to)\b/i,
  /\b(?:for (?:a|an|our|my|the)|about|regarding|concerning)\b/i,
  /\b(?:scenario|situation|use case|problem|challenge)\b/i,
  /\b(?:company|product|brand|team|project|industry|domain)\b/i,
];

const FORMAT_PATTERNS = [
  /\b(?:json|yaml|xml|csv|markdown|html)\b/i,
  /\b(?:bullet(?:\s*points?)?|numbered list|checklist|table|matrix)\b/i,
  /\b(?:format|structure|template|schema|outline)\b/i,
  /\b(?:sections?|headings?|columns?|rows?)\b/i,
  /\b(?:respond with|return|output|provide|write)\b.{0,40}\b(?:as|in|using)\b/i,
  /\b(?:step[- ]by[- ]step|ordered list|key[- ]value)\b/i,
];

const CONSTRAINT_PATTERNS = [
  /\b(?:must|must not|should|should not|don't|do not|never|always|only)\b/i,
  /\b(?:no more than|at most|at least|under|within|less than|more than)\b/i,
  /\b(?:words?|characters?|sentences?|paragraphs?|pages?|lines?)\b/i,
  /\b(?:avoid|exclude|without|limit|restrict|forbidden|ban)\b/i,
  /\b(?:tone|voice|style|formality|reading level)\b/i,
  /\b(?:keep it|make it|be)\b.{0,20}\b(?:concise|brief|short|formal|casual|neutral)\b/i,
];

const SPECIFICITY_PATTERNS = [
  /\b\d+(?:\.\d+)?%?\b/,
  /\b(?:exactly|specifically|in particular|for example|e\.g\.|including)\b/i,
  /\b(?:named|called|titled|version|v\d+)\b/i,
  /\b(?:deliverable|acceptance criteria|definition of done|KPI|metric)\b/i,
  /"[^"]{3,}"|'[^']{3,}'/,
  /\b(?:compare|rewrite|analyze|generate|draft|summarize|critique)\b/i,
];

const VAGUE_PATTERNS = [
  /\b(?:something|somehow|stuff|things?|nice|good|better|interesting|etc\.?)\b/i,
  /\b(?:help me with|make it better|improve this)\b/i,
];

function countMatches(text, patterns) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scoreSpecificity(text, words) {
  let score = 0;
  const matches = countMatches(text, SPECIFICITY_PATTERNS);
  const vagueHits = countMatches(text, VAGUE_PATTERNS);

  if (words >= 12) score += 4;
  if (words >= 28) score += 4;
  if (words >= 55) score += 3;
  if (words >= 90) score += 2;

  score += Math.min(8, matches * 2);

  const hasClearAsk =
    /\b(?:write|create|generate|draft|rewrite|explain|list|compare|analyze|summarize|design|produce|return)\b/i.test(
      text
    );
  if (hasClearAsk) score += 3;

  score -= Math.min(6, vagueHits * 2);
  return clamp(Math.round(score), 0, 20);
}

function scoreByPatterns(text, patterns, extras = 0) {
  const matches = countMatches(text, patterns);
  let score = Math.min(14, matches * 3.5) + extras;
  if (matches >= 3) score += 3;
  if (matches >= 5) score += 2;
  return clamp(Math.round(score), 0, 20);
}

function scoreContext(text, words) {
  const extras = words >= 40 ? 3 : words >= 20 ? 1 : 0;
  return scoreByPatterns(text, CONTEXT_PATTERNS, extras);
}

function scoreRole(text) {
  return scoreByPatterns(text, ROLE_PATTERNS);
}

function scoreFormat(text) {
  return scoreByPatterns(text, FORMAT_PATTERNS);
}

function scoreConstraints(text) {
  return scoreByPatterns(text, CONSTRAINT_PATTERNS);
}

function scorePrompt(prompt) {
  const text = prompt.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  if (!text) {
    return {
      total: 0,
      words: 0,
      scores: Object.fromEntries(DIMENSIONS.map((d) => [d.id, 0])),
    };
  }

  const scores = {
    specificity: scoreSpecificity(text, words),
    context: scoreContext(text, words),
    role: scoreRole(text),
    format: scoreFormat(text),
    constraints: scoreConstraints(text),
  };

  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  return { total, words, scores };
}

function verdictFor(total) {
  if (total >= 90) {
    return {
      title: "Production-ready",
      summary:
        "Strong across the board. This prompt should produce consistently high-quality output.",
    };
  }
  if (total >= 80) {
    return {
      title: "Excellent",
      summary:
        "A polished prompt. Small refinements could push it into the 90+ range.",
    };
  }
  if (total >= 70) {
    return {
      title: "Solid",
      summary:
        "Good foundation. Tighten the weakest dimensions to get more reliable results.",
    };
  }
  if (total >= 50) {
    return {
      title: "Needs work",
      summary:
        "Useful intent, but missing structure. Role, format, and constraints usually help most.",
    };
  }
  return {
    title: "Too vague",
    summary:
      "The model has too much room to guess. Add role, context, format, and hard constraints.",
  };
}

function toneFor(score) {
  if (score >= 14) return "tone-high";
  if (score >= 8) return "tone-mid";
  return "tone-low";
}

function ringColor(total) {
  if (total >= 80) return "var(--good)";
  if (total >= 50) return "var(--mid)";
  return "var(--low)";
}

function buildTips(result) {
  return DIMENSIONS.filter((dimension) => result.scores[dimension.id] < 14)
    .sort((a, b) => result.scores[a.id] - result.scores[b.id])
    .slice(0, 4)
    .map((dimension) => dimension.tip);
}

const form = document.getElementById("scorer-form");
const input = document.getElementById("prompt-input");
const wordCount = document.getElementById("word-count");
const results = document.getElementById("results");
const breakdown = document.getElementById("breakdown");
const tipsList = document.getElementById("tips-list");
const totalScoreEl = document.getElementById("total-score");
const scoreTitle = document.getElementById("score-title");
const scoreSummary = document.getElementById("score-summary");
const ringValue = document.getElementById("ring-value");

const RING_LENGTH = 2 * Math.PI * 52;

function updateWordCount() {
  const words = input.value.trim()
    ? input.value.trim().split(/\s+/).filter(Boolean).length
    : 0;
  wordCount.textContent = `${words} word${words === 1 ? "" : "s"}`;
}

function renderBreakdown(result) {
  breakdown.innerHTML = "";

  DIMENSIONS.forEach((dimension, index) => {
    const score = result.scores[dimension.id];
    const row = document.createElement("article");
    row.className = `dimension ${toneFor(score)}`;
    row.style.animationDelay = `${index * 0.05}s`;
    row.innerHTML = `
      <div class="dimension-head">
        <span aria-hidden="true">${dimension.icon}</span>
        <h3>${dimension.label}</h3>
      </div>
      <div class="bar" aria-hidden="true"><i style="width: 0%"></i></div>
      <div class="dimension-score">${score}/20</div>
    `;
    breakdown.appendChild(row);

    requestAnimationFrame(() => {
      const bar = row.querySelector("i");
      bar.style.width = `${(score / 20) * 100}%`;
    });
  });
}

function renderTips(result) {
  const tips = buildTips(result);
  tipsList.innerHTML = "";

  if (tips.length === 0) {
    const item = document.createElement("li");
    item.textContent =
      "All dimensions look strong. Optional polish: add an example of ideal output.";
    tipsList.appendChild(item);
    return;
  }

  tips.forEach((tip) => {
    const item = document.createElement("li");
    item.textContent = tip;
    tipsList.appendChild(item);
  });
}

function renderResults(result) {
  const verdict = verdictFor(result.total);
  results.hidden = false;
  totalScoreEl.textContent = String(result.total);
  scoreTitle.textContent = verdict.title;
  scoreSummary.textContent = verdict.summary;

  ringValue.style.stroke = ringColor(result.total);
  ringValue.style.strokeDasharray = String(RING_LENGTH);
  ringValue.style.strokeDashoffset = String(
    RING_LENGTH - (result.total / 100) * RING_LENGTH
  );

  renderBreakdown(result);
  renderTips(result);
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

input.addEventListener("input", updateWordCount);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = scorePrompt(input.value);
  renderResults(result);
});

updateWordCount();
