#!/usr/bin/env node
/*
 * JARVIS — £0 Skill Runner
 * ------------------------------------------------------------------
 * One self-contained engine that runs the four scheduled "Active Vault"
 * skills for FREE, FOREVER. It replaces the paid n8n.cloud workflows and
 * the paid Claude API with:
 *
 *   - Compute .... GitHub Actions (free for public repos, generous free
 *                  minutes for private repos)
 *   - LLM ........ Groq (free tier, no card) — default llama-3.3-70b-versatile
 *   - Vault I/O .. a local `actions/checkout` of the repo (no GitHub API
 *                  reads, no rate-limit lottery); the workflow commits the
 *                  output back to master with a rebase-retry loop.
 *
 * It is a faithful port of the n8n workflows in `Assistant Core/n8n/`
 * (same inputs, same prompts, same output paths) — just on a £0 engine.
 *
 * Zero npm dependencies. Node 18+ (global fetch + full-ICU Intl).
 *
 * Usage:
 *   node runner.mjs --skill=morning-brief
 *   node runner.mjs --skill=weekly-synthesis --force      # ignore time guard
 *   node runner.mjs --skill=pattern-detector --dry-run    # no Groq call, stub text
 *
 * Env:
 *   GROQ_API_KEY   required (unless --dry-run)
 *   GROQ_MODEL     optional, default "llama-3.3-70b-versatile"
 *   VAULT_ROOT     optional, default = repo root (two levels up from this file)
 *
 * Exit codes: 0 = wrote a file OR nothing-to-do (guard skip); 1 = real error.
 * ------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- paths ----------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_ROOT = process.env.VAULT_ROOT
  ? path.resolve(process.env.VAULT_ROOT)
  : path.resolve(__dirname, '..', '..'); // Assistant Core/jarvis-skills -> repo root

// ---------- config ----------
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const CORPUS_CAP = 30000; // chars — safely under Groq free-tier tokens/minute
const PER_FILE_CAP = 4000; // chars per source note (matches n8n)
const MEMORY_CAP = 6000;   // chars of MEMORY.md (matches n8n)

// ---------- tiny arg parser ----------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);
const SKILL = args.skill;
const FORCE = !!args.force;
const DRY_RUN = !!args['dry-run'];

// ---------- London-time helpers (DST-correct via Intl) ----------
// JARVIS_FAKE_NOW (ISO string) overrides "now" — used by the test harness and
// for backfilling a specific day, e.g. re-running yesterday's brief.
function londonNow(d = process.env.JARVIS_FAKE_NOW ? new Date(process.env.JARVIS_FAKE_NOW) : new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  const year = +p.year, month = +p.month, day = +p.day;
  let hour = +p.hour;
  if (hour === 24) hour = 0; // some ICU builds emit "24" at midnight
  // weekday of the London calendar date (0=Sun..6=Sat). None of our
  // scheduled times cross midnight, so the calendar-date weekday is correct.
  const dow = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const date = `${p.year}-${p.month}-${p.day}`;
  const longFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', weekday: 'long', day: 'numeric',
    month: 'long', year: 'numeric',
  });
  return { year, month, day, hour, minute: +p.minute, dow, date, long: longFmt.format(d) };
}

// ISO-8601 week number + week-year (matches luxon weekNumber/weekYear used by n8n)
function isoWeek(year, month, day) {
  const dt = new Date(Date.UTC(year, month - 1, day));
  const dayNr = (dt.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  dt.setUTCDate(dt.getUTCDate() - dayNr + 3); // nearest Thursday
  const firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((dt - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7
  );
  return { week, weekYear: dt.getUTCFullYear() };
}

// ---------- vault read helpers ----------
function readFileSafe(rel, cap = Infinity) {
  const full = path.join(VAULT_ROOT, rel);
  try {
    return fs.readFileSync(full, 'utf8').slice(0, cap);
  } catch {
    return null;
  }
}

// Newest N markdown captures from JARVIS/Inbox, name-sorted desc (filenames
// start with the date, so name-desc == newest-first — faithful to n8n).
function recentCaptures(n) {
  const dir = path.join(VAULT_ROOT, 'JARVIS', 'Inbox');
  let names = [];
  try {
    names = fs.readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.md'))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, n);
  } catch { names = []; }
  return names.map((name) => ({
    name,
    text: readFileSafe(path.join('JARVIS', 'Inbox', name)) || '',
  }));
}

function corpusFrom(items) {
  if (!items.length) return '(No captures found for this period.)';
  const parts = items.map((it) => `## ${it.name}\n${(it.text || '').slice(0, PER_FILE_CAP)}`);
  return parts.join('\n\n---\n\n').slice(0, CORPUS_CAP);
}

function filesCorpus(relPaths) {
  const items = [];
  for (const rel of relPaths) {
    const text = readFileSafe(rel);
    if (text != null) items.push({ name: rel, text });
  }
  return corpusFrom(items);
}

// ---------- Groq client ----------
async function groqChat({ system, user, maxTokens }) {
  if (DRY_RUN) {
    return `_(dry-run stub — no Groq call was made)_\n\n` +
      `## Section A\n- Example line grounded in vault context.\n\n` +
      `## Section B\n- Another example line.\n`;
  }
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not set (and --dry-run was not passed).');

  const body = {
    model: GROQ_MODEL,
    max_tokens: maxTokens,
    temperature: 0.4,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };

  // up to 3 attempts with backoff for transient 429/5xx
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = +res.headers.get('retry-after') || attempt * 5;
        lastErr = new Error(`Groq HTTP ${res.status}`);
        if (attempt < 3) { await sleep(retryAfter * 1000); continue; }
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Groq HTTP ${res.status}: ${t.slice(0, 500)}`);
      }
      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content;
      if (!text) throw new Error(`Groq returned no content: ${JSON.stringify(json).slice(0, 500)}`);
      return text.trim();
    } catch (e) {
      lastErr = e;
      if (attempt < 3) { await sleep(attempt * 5000); continue; }
    }
  }
  throw lastErr;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- skill definitions (faithful ports) ----------
const SKILLS = {
  'morning-brief': {
    label: 'Morning Brief', num: 1,
    guard: { hour: 7 }, // daily 07:00 London
    build(ctx) {
      const memory = readFileSafe('Claude Memory/MEMORY.md', MEMORY_CAP) || '';
      const captures = corpusFrom(recentCaptures(12));
      const system =
        "You are JARVIS, Elliot's morning briefing assistant. Write a concise " +
        "2-3 minute morning brief in markdown. Sections: ## Today at a Glance, " +
        "## Recent Highlights, ## Patterns, ## Today's Focus (top 3, numbered). " +
        "Be specific and pull only from the provided vault context - no invented " +
        "events, no filler. Do not write a top-level # title - start directly with " +
        "the first ## section. Focus on captures from the last 48 hours; ignore " +
        "older ones (filenames contain dates).";
      const user =
        `Today is ${ctx.london.long}.\n\n=== MEMORY.md ===\n${memory}\n\n` +
        `=== RECENT CAPTURES ===\n${captures}\n\nGenerate the morning brief.`;
      return {
        system, user, maxTokens: 1500,
        outPath: `Claude Memory/briefings/${ctx.london.date}.md`,
        title: `Morning Brief — ${ctx.london.date}`,
        commit: `JARVIS Skill 1: morning brief ${ctx.london.date} (automated · GitHub Actions + Groq)`,
        mode: 'create',
      };
    },
  },

  'connection-finder': {
    label: 'Connection Finder', num: 3,
    guard: { hour: 14, dow: 0 }, // Sunday 14:00 London
    build(ctx) {
      const corpus = filesCorpus([
        'Claude Memory/MEMORY.md',
        'Claude Memory/Projects/Smart Home/_index.md',
        'Claude Memory/Projects/Faceless Finance/_index.md',
        'Claude Memory/Projects/Doc to Learning/_index.md',
        'Claude Memory/Projects/Work Financial Forecasting/_index.md',
        'Claude Memory/Projects/Other Workspaces/_index.md',
      ]);
      const system =
        "You are JARVIS, a connection analyst for Elliot's Obsidian vault. Find " +
        "non-obvious links across his projects. Sections: ## Surprising Links, " +
        "## Project Bridges, ## Missing Connections, ## Suggested Actions " +
        "(numbered, concrete). Every claim must cite which note or project it came " +
        "from. If the evidence is thin, say so rather than inventing links. Do not " +
        "write a top-level # title - start directly with the first ## section.";
      const user = `=== VAULT CONTEXT ===\n${corpus}\n\nFind the connections.`;
      return {
        system, user, maxTokens: 2000,
        outPath: `Claude Memory/connections/${ctx.london.date}.md`,
        title: `Connections Found — ${ctx.london.date}`,
        commit: `JARVIS Skill 3: connection report ${ctx.london.date} (automated · GitHub Actions + Groq)`,
        mode: 'create',
      };
    },
  },

  'weekly-synthesis': {
    label: 'Weekly Synthesis', num: 4,
    guard: { hour: 18, dow: 5 }, // Friday 18:00 London
    build(ctx) {
      const captures = corpusFrom(recentCaptures(30));
      const context = filesCorpus([
        'Claude Memory/decisions.md',
        'Claude Memory/beliefs.md',
        'Claude Memory/patterns.md',
        'Claude Memory/Projects/Smart Home/_index.md',
        'Claude Memory/Projects/Faceless Finance/_index.md',
        'Claude Memory/Projects/Doc to Learning/_index.md',
        'Claude Memory/Projects/Work Financial Forecasting/_index.md',
        'Claude Memory/Projects/Other Workspaces/_index.md',
      ]);
      const { week, weekYear } = isoWeek(ctx.london.year, ctx.london.month, ctx.london.day);
      const wk = String(week).padStart(2, '0');
      const name = `${weekYear}-W${wk}`;
      const system =
        "You are JARVIS, writing Elliot's weekly synthesis. Sections: ## Momentum " +
        "(per project), ## Decisions, ## Beliefs Shifted, ## Patterns, ## Blockers " +
        "Resolved, ## Next Week Priorities (top 3), ## Across Projects. Ground " +
        "everything in the provided context; if a section has no evidence this " +
        'week, write "Nothing logged this week." Weight captures from the last 7 ' +
        "days (filenames contain dates). Do not write a top-level # title - start " +
        "directly with the first ## section.";
      const user =
        `Week ${week} of ${weekYear}.\n\n=== THIS WEEK'S CAPTURES ===\n${captures}\n\n` +
        `=== PROJECT STATUS + DECISIONS + BELIEFS + PATTERNS ===\n${context}\n\n` +
        `Write the weekly synthesis.`;
      return {
        system, user, maxTokens: 2500,
        outPath: `Claude Memory/synthesis/${name}.md`,
        title: `Weekly Synthesis — ${name}`,
        commit: `JARVIS Skill 4: weekly synthesis ${name} (automated · GitHub Actions + Groq)`,
        mode: 'create',
      };
    },
  },

  'pattern-detector': {
    label: 'Pattern Detector', num: 6,
    guard: { hour: 8, dow: 1 }, // Monday 08:00 London
    build(ctx) {
      const captures = corpusFrom(recentCaptures(30));
      const previousRaw = readFileSafe('Claude Memory/patterns.md') || '';
      const previousForPrompt = previousRaw.slice(0, 5000);
      const system =
        "You are JARVIS, a pattern analyst for Elliot. Analyse the past week of " +
        `captures (today is ${ctx.london.date}; filenames contain dates - weight ` +
        "the last 7 days). Sections: ## Capture Timing, ## Action Patterns, " +
        "## Decision Patterns, ## Behavioural Patterns, ## Insights, ## Next Week " +
        "Suggestion. Compare against the previous report where relevant. Only use " +
        "evidence from the provided captures. Do not write a top-level # title - " +
        "start directly with the first ## section.";
      const user =
        `=== CAPTURES ===\n${captures}\n\n=== PREVIOUS PATTERNS REPORT (comparison) ===\n` +
        `${previousForPrompt}\n\nGenerate this week's pattern report.`;
      // patterns.md is a rolling file: new section on top, history below (~20k)
      const historyTail = previousRaw
        .replace(/^# Patterns Detected[^\n]*\n/, '')
        .slice(0, 20000);
      return {
        system, user, maxTokens: 2000,
        outPath: 'Claude Memory/patterns.md',
        mode: 'prepend',
        render: (text) =>
          `# Patterns Detected\n\n` +
          `*Last updated: ${ctx.london.date} (automated · JARVIS Skill 6: Pattern Detector · GitHub Actions + Groq)*\n\n` +
          `## Week ending ${ctx.london.date}\n\n${text}\n\n---\n${historyTail}`,
        commit: `JARVIS Skill 6: pattern report ${ctx.london.date} (automated · GitHub Actions + Groq)`,
      };
    },
  },
};

// ---------- output helpers ----------
function setOutputs(obj) {
  const gh = process.env.GITHUB_OUTPUT;
  if (!gh) return;
  const lines = Object.entries(obj).map(([k, v]) => `${k}=${String(v).replace(/\r?\n/g, ' ')}`);
  fs.appendFileSync(gh, lines.join('\n') + '\n');
}

function guardPasses(guard, london) {
  if (FORCE) return true;
  if (guard.hour != null && london.hour !== guard.hour) return false;
  if (guard.dow != null && london.dow !== guard.dow) return false;
  return true;
}

// ---------- main ----------
async function main() {
  if (!SKILL || !SKILLS[SKILL]) {
    console.error(`Unknown or missing --skill. Valid: ${Object.keys(SKILLS).join(', ')}`);
    process.exit(1);
  }
  const skill = SKILLS[SKILL];
  const london = londonNow();
  const ctx = { london };

  console.log(`[jarvis] skill=${SKILL} (Skill ${skill.num}: ${skill.label})`);
  console.log(`[jarvis] London now: ${london.long} ${String(london.hour).padStart(2, '0')}:${String(london.minute).padStart(2, '0')} (dow=${london.dow})`);
  console.log(`[jarvis] model=${GROQ_MODEL}  dry-run=${DRY_RUN}  force=${FORCE}`);

  if (!guardPasses(skill.guard, london)) {
    console.log(`[jarvis] Not the scheduled London time for ${skill.label} — nothing to do. ` +
      `(want hour=${skill.guard.hour}${skill.guard.dow != null ? `, dow=${skill.guard.dow}` : ''})`);
    setOutputs({ wrote: 'false', reason: 'time-guard' });
    process.exit(0);
  }

  const spec = skill.build(ctx);
  console.log(`[jarvis] generating -> ${spec.outPath}`);

  const modelText = await groqChat({ system: spec.system, user: spec.user, maxTokens: spec.maxTokens });

  let markdown;
  if (spec.mode === 'prepend' && spec.render) {
    markdown = spec.render(modelText);
  } else {
    markdown =
      `# ${spec.title}\n\n${modelText}\n\n---\n` +
      `*Generated automatically by GitHub Actions + Groq (${GROQ_MODEL}) — JARVIS Skill ${skill.num}: ${skill.label}.*\n`;
  }

  const outFull = path.join(VAULT_ROOT, spec.outPath);
  fs.mkdirSync(path.dirname(outFull), { recursive: true });
  fs.writeFileSync(outFull, markdown, 'utf8');
  console.log(`[jarvis] wrote ${markdown.length} chars to ${spec.outPath}`);

  setOutputs({ wrote: 'true', path: spec.outPath, commit_msg: spec.commit });
}

main().catch((e) => {
  console.error(`[jarvis] ERROR: ${e.stack || e.message || e}`);
  setOutputs({ wrote: 'false', reason: 'error' });
  process.exit(1);
});
