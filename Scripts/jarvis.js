/*
 * jarvis.js — JARVIS capture brain (QuickAdd user script)
 * ---------------------------------------------------------
 * Obsidian-native. Runs entirely inside Obsidian — no Termux, no PC server.
 *
 * Flow:  raw text (typed or dictated)
 *          -> Claude classifies it (structured output)
 *          -> routes to: a vault note  OR  a Home Assistant action
 *          -> Obsidian Sync carries it to every device.
 *
 * Install: drop this file in your QuickAdd user-scripts folder, then point a
 * QuickAdd Macro at it. See SETUP.md. Secrets live in device-local storage
 * (set once via jarvis_setup.js) and are NEVER written into the vault.
 *
 * QuickAdd passes `params = { app, quickAddApi, variables }`.
 */

// ============================================================================
// CONFIG — edit freely. This is the only block most people will touch.
// ============================================================================
const CONFIG = {
  // The model that powers classification. claude-opus-4-8 is the most capable.
  // For cents-per-capture you may switch to "claude-haiku-4-5" (fast/cheap) or
  // "claude-sonnet-4-6" (balanced). Your call.
  model: "claude-opus-4-8",

  // Where each kind of capture is filed (folders are created if missing).
  folders: {
    note: "JARVIS/Inbox",
    task: "JARVIS/Inbox",
    idea: "JARVIS/Inbox",
    journal: "Journal",
    question: "JARVIS/Inbox",
  },

  // Projects JARVIS may tag a capture with. Keep in sync with your vault.
  projects: [
    "Smart Home",
    "Faceless Finance",
    "Doc to Learning",
    "Work Forecasting",
    "General",
  ],

  // Real Home Assistant entities JARVIS is allowed to control. Claude maps
  // natural language ("turn on the lounge lights") to one of these exactly.
  // Add yours here — anything not listed is treated as a note, never guessed.
  haEntities: [
  "light.living_room_light",
  "light.left_smart_bulb",
  "light.right_smart_bulb",
  "light.stairs_smart_bulb",
  ],
};

// ============================================================================
// Secret + helper plumbing (no need to edit below here)
// ============================================================================
module.exports = async (params) => {
  const { app, quickAddApi } = params;
  const { requestUrl, Notice } = params.obsidian;
  
  const apiKey = window.localStorage.getItem("jarvis-anthropic-key");
  if (!apiKey) {
    new Notice("JARVIS: no API key. Run the JARVIS Setup command first.", 8000);
    return;
  }

  // 1) Get the capture text. A preset value (e.g. passed from Advanced URI via
  //    QuickAdd variables) wins; otherwise prompt — the phone keyboard mic
  //    dictates straight into this field (local voice, no cloud STT).
  let text = params.variables && params.variables.text;
  if (!text) {
    text = await quickAddApi.inputPrompt("JARVIS — what's on your mind?");
  }
  if (!text || !text.trim()) return; // cancelled

  // 2) Classify with Claude (structured output → always-parseable routing).
  let result;
  try {
    result = await classify(requestUrl, apiKey, text.trim());
  } catch (e) {
    new Notice("JARVIS classify failed: " + e.message, 8000);
    return;
  }

  // 3) Route.
  if (result.kind === "ha_action" && result.ha) {
    await fireHomeAssistant(requestUrl, Notice, result.ha);
    return;
  }
  await writeNote(app, Notice, result, text.trim());
};

// --- Claude classification ---------------------------------------------------
async function classify(requestUrl, apiKey, text) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      kind: {
        type: "string",
        enum: ["note", "task", "idea", "journal", "question", "ha_action"],
      },
      title: { type: "string" },
      body: { type: "string" },
      project: { type: "string", enum: CONFIG.projects },
      tags: { type: "array", items: { type: "string" } },
      ha: {
        type: "object",
        additionalProperties: false,
        properties: {
          service: { type: "string" }, // e.g. "light.turn_on"
          entity_id: { type: "string" }, // must be one of CONFIG.haEntities
        },
        required: ["service", "entity_id"],
      },
    },
    required: ["kind", "title", "body", "project", "tags"],
  };

  const system =
    "You are JARVIS, a capture router for Elliot's Obsidian vault.\n" +
    "Classify the user's text and return structured JSON only.\n\n" +
    "kind:\n" +
    "- task: an action to do ('remind me…', 'call…', 'buy…', 'fix…').\n" +
    "- idea: a thought, plan, or thing to explore later.\n" +
    "- journal: a reflection, log of something that happened, or feeling.\n" +
    "- question: something Elliot wants answered later.\n" +
    "- note: anything else worth keeping.\n" +
    "- ha_action: a smart-home command (lights, climate, TV).\n\n" +
    "title: a short imperative/headline (no trailing period).\n" +
    "body: a cleaned-up version of the text, lightly tidied, no invented detail.\n" +
    "project: best-fit from the allowed list; use General if unclear.\n" +
    "tags: 1-4 short lowercase tags, no '#'.\n\n" +
    "ha_action rules: only when the text is clearly a device command AND it maps " +
    "to one of these exact entities:\n" +
    CONFIG.haEntities.map((e) => "  - " + e).join("\n") +
    "\nSet ha.service like 'light.turn_on' / 'light.turn_off' / 'climate.set_temperature' " +
    "/ 'media_player.turn_off', and ha.entity_id to the exact entity above. " +
    "If the device isn't in the list, do NOT use ha_action — classify as a note instead.";

  const res = await requestUrl({
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CONFIG.model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: text }],
      output_config: { format: { type: "json_schema", schema } },
    }),
    throw: false,
  });

  if (res.status !== 200) {
    const msg = res.json && res.json.error ? res.json.error.message : "HTTP " + res.status;
    throw new Error(msg);
  }
  const block = (res.json.content || []).find((b) => b.type === "text");
  if (!block) throw new Error("no content returned");
  return JSON.parse(block.text);
}

// --- Home Assistant action ---------------------------------------------------
async function fireHomeAssistant(requestUrl, Notice, ha) {
  const haUrl = window.localStorage.getItem("jarvis-ha-url");
  const haToken = window.localStorage.getItem("jarvis-ha-token");
  if (!haUrl || !haToken) {
    new Notice("JARVIS: Home Assistant not configured. Run JARVIS Setup.", 8000);
    return;
  }
  const dot = ha.service.indexOf(".");
  const domain = ha.service.slice(0, dot);
  const service = ha.service.slice(dot + 1);

  const res = await requestUrl({
    url: `${haUrl.replace(/\/$/, "")}/api/services/${domain}/${service}`,
    method: "POST",
    headers: {
      Authorization: "Bearer " + haToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({ entity_id: ha.entity_id }),
    throw: false,
  });

  if (res.status >= 200 && res.status < 300) {
    new Notice(`JARVIS ✓ ${ha.service} → ${ha.entity_id}`, 5000);
  } else {
    new Notice(`JARVIS HA error (${res.status}) on ${ha.entity_id}`, 8000);
  }
}

// --- Write a vault note -------------------------------------------------------
async function writeNote(app, Notice, r, original) {
  const folder = CONFIG.folders[r.kind] || "Inbox";
  if (!app.vault.getAbstractFileByPath(folder)) {
    try {
      await app.vault.createFolder(folder);
    } catch (e) {
      /* already exists / race — ignore */
    }
  }

  const now = new Date();
  const stamp =
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    "-" +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());
  const slug = slugify(r.title) || r.kind;
  const path = `${folder}/${r.kind}_${stamp}-${slug}.md`;

  const tags = (r.tags || []).map((t) => t.replace(/^#/, "")).join(", ");
  const fm =
    "---\n" +
    `type: ${r.kind}\n` +
    `project: ${r.project}\n` +
    `tags: [${tags}]\n` +
    `created: ${now.toISOString()}\n` +
    "source: jarvis\n" +
    "---\n\n";
  const content = `${fm}# ${r.title}\n\n${r.body || original}\n`;

  await app.vault.create(path, content);
  new Notice(`JARVIS ✓ ${cap(r.kind)}: ${r.title}`, 5000);
}

// --- tiny utils --------------------------------------------------------------
function pad(n) {
  return String(n).padStart(2, "0");
}
function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function slugify(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
