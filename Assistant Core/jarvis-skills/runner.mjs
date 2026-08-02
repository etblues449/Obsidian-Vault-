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
import crypto from 'node:crypto';
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

// ---------- capture router (Skill 2) ----------
// Event-driven, NOT scheduled — fires on push to the inbox. Deterministic: the
// routing rules are a written table below, never a prompt, so this skill makes
// no Groq call at all (£0, no quota, no nondeterminism).
//
// THE RULE TABLE — if you cannot state the rule that routed a note, the rule is
// unmaintainable. Rules are applied top-down, first match wins:
//
//   1. body is empty / whitespace-only ....... REJECT -> JARVIS/Inbox/_rejected/
//   2. body is a known placeholder ........... REJECT -> JARVIS/Inbox/_rejected/
//   3. body matches /#belief\b/i ............. APPEND -> Claude Memory/beliefs.md
//   4. body matches /#decision\b/i ........... APPEND -> Claude Memory/decisions.md
//   5. anything else ......................... KEEP   -> stays in JARVIS/Inbox/
//
// Rule 5 is load-bearing: an unclassifiable capture is NEVER dropped. Losing a
// capture is the one unrecoverable outcome in this pipeline.
//
// The junk filter (rules 1-2) is a SECOND LINE OF DEFENCE, not the fix for the
// empty-Tasker-capture bug. Rejected captures are MOVED, never deleted, and are
// reported loudly in the workflow job summary — a silent drop would be worse
// than the bug it hides.

const CAPTURE_DIR = path.join('JARVIS', 'Inbox');
const LEGACY_CAPTURE_DIR = 'Inbox'; // pre-2026-06-19 destination; still written by some paths
const REJECT_DIR = path.join('JARVIS', 'Inbox', '_rejected');
const ROUTER_LOG = path.join('Claude Memory', 'Account', 'capture-router-log.md');

// Files that live in an inbox but are NOT captures (templates, landing pages).
const NOT_A_CAPTURE = new Set(['quick-capture.md', 'quick-notes.md', 'readme.md']);

// Known placeholder bodies. `your note here` is the live Tasker bug.
const JUNK_BODIES = new Set(['', 'your note here', 'test', 'testing', 'test capture', 'n/a', '-']);

const captureId = (text) =>
  crypto.createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 8);

function splitFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? { fm: m[1], body: m[2] } : { fm: '', body: raw };
}

// The meaningful text of a capture: front-matter and the "# Title" line removed.
// The title is derived from the body by the capture scripts, so counting it
// would make an empty capture look non-empty.
function captureBody(raw) {
  return splitFrontMatter(raw).body.replace(/^\s*#[^\n]*\r?\n/, '').trim();
}

function classifyCapture(raw) {
  const body = captureBody(raw);
  const norm = body.toLowerCase().replace(/\s+/g, ' ').trim();
  if (JUNK_BODIES.has(norm)) return { rule: norm === '' ? 1 : 2, action: 'reject', body };
  if (/#belief\b/i.test(body)) return { rule: 3, action: 'belief', body };
  if (/#decision\b/i.test(body)) return { rule: 4, action: 'decision', body };
  return { rule: 5, action: 'keep', body };
}

function listCaptures(relDir) {
  const dir = path.join(VAULT_ROOT, relDir);
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
      .map((e) => e.name)
      .filter((n) => !NOT_A_CAPTURE.has(n.toLowerCase()))
      .sort();
  } catch { return []; }
}

// Sweep the legacy root Inbox/ into JARVIS/Inbox/ so the engine can see captures
// regardless of which writer produced them. COPY-IF-MISSING ONLY — this never
// deletes and never overwrites, so it is safely idempotent and cannot lose a
// capture if the two copies ever diverge.
function sweepLegacyInbox() {
  const swept = [];
  for (const name of listCaptures(LEGACY_CAPTURE_DIR)) {
    const from = path.join(VAULT_ROOT, LEGACY_CAPTURE_DIR, name);
    const to = path.join(VAULT_ROOT, CAPTURE_DIR, name);
    if (fs.existsSync(to)) continue; // already visible to the engine — leave both alone
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    swept.push(name);
  }
  return swept;
}

// Append an entry to beliefs.md / decisions.md, keyed by capture id so a repeat
// run can never duplicate it even if the router log is lost.
function appendKeyed(relPath, id, entry) {
  const full = path.join(VAULT_ROOT, relPath);
  const prev = readFileSafe(relPath) ?? '';
  if (prev.includes(`<!-- capture:${id} -->`)) return false; // already routed
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${prev.replace(/\s*$/, '')}\n${entry}`, 'utf8');
  return true;
}

function routedEntry(kind, id, note, london) {
  const text = note.body.replace(new RegExp(`#${kind}\\b`, 'ig'), '').trim();
  const label = kind === 'belief' ? 'Belief' : 'Decision';
  return (
    `\n---\n\n## ${label} — ${london.date} <!-- capture:${id} -->\n` +
    `**Source:** ${note.name} (auto-routed by Capture Router)\n` +
    `**Status:** NEW (unconfirmed)\n\n${text}\n`
  );
}

function readRouterLog() {
  const raw = readFileSafe(ROUTER_LOG) ?? '';
  const seen = new Set();
  for (const m of raw.matchAll(/`([0-9a-f]{8})`/g)) seen.add(m[1]);
  return { raw, seen };
}

async function runCaptureRouter(ctx) {
  const swept = sweepLegacyInbox();
  if (swept.length) console.log(`[jarvis] swept ${swept.length} capture(s) from ${LEGACY_CAPTURE_DIR}/ -> ${CAPTURE_DIR}/`);

  const { raw: logRaw, seen } = readRouterLog();
  const names = listCaptures(CAPTURE_DIR);

  const done = { rejected: [], belief: [], decision: [], kept: [] };
  const logLines = [];

  for (const name of names) {
    const rel = path.join(CAPTURE_DIR, name);
    const text = readFileSafe(rel);
    if (text == null) continue;
    const id = captureId(text);
    if (seen.has(id)) continue; // idempotent: already routed
    seen.add(id);

    const c = classifyCapture(text);
    const note = { name, body: c.body };

    if (c.action === 'reject') {
      const to = path.join(VAULT_ROOT, REJECT_DIR, name);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(path.join(VAULT_ROOT, rel), to);
      done.rejected.push(name);
      logLines.push(`| \`${id}\` | ${ctx.london.date} | ${name} | ${c.rule} | REJECTED → \`_rejected/\` |`);
    } else if (c.action === 'belief' || c.action === 'decision') {
      const target = c.action === 'belief'
        ? path.join('Claude Memory', 'beliefs.md')
        : path.join('Claude Memory', 'decisions.md');
      appendKeyed(target, id, routedEntry(c.action, id, note, ctx.london));
      done[c.action].push(name);
      logLines.push(`| \`${id}\` | ${ctx.london.date} | ${name} | ${c.rule} | → \`${target}\` |`);
    } else {
      done.kept.push(name);
      logLines.push(`| \`${id}\` | ${ctx.london.date} | ${name} | ${c.rule} | kept in inbox |`);
    }
  }

  const touched = done.rejected.length + done.belief.length + done.decision.length;
  if (!logLines.length && !swept.length) {
    console.log('[jarvis] capture router: nothing new to route.');
    return { wrote: false, reason: 'no-new-captures' };
  }

  // Write the audit log — append-only, newest block at the bottom.
  const header =
    '# Capture Router — processing log\n\n' +
    '> Append-only audit trail written by JARVIS Skill 2 (Capture Router).\n' +
    '> Each capture is keyed by a SHA-1 prefix of its content; a capture whose id\n' +
    "> already appears here is never re-routed. Don't hand-edit the ids.\n\n" +
    '| id | date | capture | rule | outcome |\n|---|---|---|---|---|\n';
  const body = logRaw.includes('| id | date |')
    ? logRaw.replace(/\s*$/, '') + '\n' + logLines.join('\n') + '\n'
    : header + logLines.join('\n') + '\n';
  const logFull = path.join(VAULT_ROOT, ROUTER_LOG);
  fs.mkdirSync(path.dirname(logFull), { recursive: true });
  fs.writeFileSync(logFull, body, 'utf8');

  const summary =
    `swept ${swept.length} · rejected ${done.rejected.length} · ` +
    `beliefs ${done.belief.length} · decisions ${done.decision.length} · kept ${done.kept.length}`;
  console.log(`[jarvis] capture router: ${summary}`);
  if (done.rejected.length) {
    // Loud on purpose: a rejected capture means the SOURCE is still broken.
    console.log(`[jarvis] ⚠ REJECTED ${done.rejected.length} placeholder/empty capture(s): ${done.rejected.join(', ')}`);
    console.log('[jarvis] ⚠ The junk filter is a second line of defence — fix the Tasker variable at source.');
  }

  return {
    wrote: true,
    commit: `JARVIS Skill 2: capture router — ${summary} (automated)`,
    summary,
    rejected: done.rejected,
  };
}

// ---------- skill definitions (faithful ports) ----------
const SKILLS = {
  'capture-router': {
    label: 'Capture Router', num: 2,
    guard: {},        // event-driven: no time guard, ever
    kind: 'router',
    run: runCaptureRouter,
  },
  'morning-brief': {
    label: 'Morning Brief', num: 1,
    // Scheduled daily ~07:00 London (two crons: 06:00 + 07:00 UTC). Runs when
    // today's brief does not exist yet, whenever GitHub actually gets to it.
    done: (ctx) => outputExists(`Claude Memory/briefings/${ctx.london.date}.md`),
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
    // Scheduled Sunday ~14:00 London. The cron only fires on Sunday, so the day
    // is enforced by the schedule; this only stops a second run the same day.
    done: (ctx) => outputExists(`Claude Memory/connections/${ctx.london.date}.md`),
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
    // Scheduled Friday ~18:00 London. Keyed on the ISO WEEK, not the date — so a
    // run that slips past midnight into Saturday still fills the same week's
    // slot instead of losing the week entirely.
    done: (ctx) => {
      const { week, weekYear } = isoWeek(ctx.london.year, ctx.london.month, ctx.london.day);
      return outputExists(`Claude Memory/synthesis/${weekYear}-W${String(week).padStart(2, '0')}.md`);
    },
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
    // Scheduled Monday ~08:00 London. patterns.md is a rolling prepend file, so
    // there is no per-period path to test — the rendered section carries an
    // explicit `<!-- week:YYYY-Www -->` marker and we look for that instead.
    done: (ctx) => {
      const { week, weekYear } = isoWeek(ctx.london.year, ctx.london.month, ctx.london.day);
      const raw = readFileSafe('Claude Memory/patterns.md') ?? '';
      return raw.includes(`<!-- week:${weekYear}-W${String(week).padStart(2, '0')} -->`);
    },
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
          `## Week ending ${ctx.london.date} <!-- week:${(() => {
            const { week, weekYear } = isoWeek(ctx.london.year, ctx.london.month, ctx.london.day);
            return `${weekYear}-W${String(week).padStart(2, '0')}`;
          })()} -->\n\n${text}\n\n---\n${historyTail}`,
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

// ---------- the run guard ----------
//
// HISTORY — read before changing this.
//
// Until 2026-08-02 this was an EXACT London-hour equality check:
//     if (guard.hour != null && london.hour !== guard.hour) return false;
// It silently broke the entire engine. GitHub Actions cron is best-effort and on
// free runners routinely starts jobs 30 minutes to 3 hours late. `londonNow()`
// reads the wall clock AT EXECUTION, so a delayed run saw the wrong hour, failed
// the guard, and exited 0 — the workflow reported SUCCESS and wrote nothing.
// Every one of the 11 scheduled runs in the repo's history failed this way; every
// briefing that exists was produced by n8n or a manual `workflow_dispatch`.
// Evidence: job 30693257169 ("London now: ... 10:11", "want hour=7").
//
// The replacement asks the only question that actually matters:
//
//     "Has this skill's output for the current period already been written?"
//
// That is DST-safe (no hour arithmetic at all), delay-safe (a brief written at
// 10:00 is still today's brief), and self-healing (a missed period is picked up
// by the next attempt). The paired BST/GMT crons are now simply two attempts at
// the same period — whichever runs first does the work, the other no-ops.
//
// `done(ctx)` is per-skill and MUST be keyed on the same period as the skill's
// output path, or the skill will either duplicate or never run.
function shouldRun(skill, ctx) {
  if (FORCE) return { run: true };
  if (typeof skill.done === 'function' && skill.done(ctx)) {
    return { run: false, reason: 'already-done' };
  }
  return { run: true };
}

const outputExists = (rel) => fs.existsSync(path.join(VAULT_ROOT, rel));

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

  const gate = shouldRun(skill, ctx);
  if (!gate.run) {
    console.log(`[jarvis] ${skill.label}: this period's output already exists — nothing to do.`);
    setOutputs({ wrote: 'false', reason: gate.reason });
    process.exit(0);
  }

  // Event-driven skills (the capture router) do their own multi-file writes and
  // never call Groq — they return the commit message directly.
  if (skill.kind === 'router') {
    const res = await skill.run(ctx);
    if (!res.wrote) {
      setOutputs({ wrote: 'false', reason: res.reason || 'nothing-to-do' });
      process.exit(0);
    }
    setOutputs({ wrote: 'true', path: '(multiple)', commit_msg: res.commit, summary: res.summary });
    return;
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
