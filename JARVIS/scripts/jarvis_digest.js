/*
 * jarvis_digest.js — daily digest (QuickAdd user script)
 * ------------------------------------------------------
 * Reads everything captured in the last 24h from the Inbox, asks Claude to
 * summarise it into a tidy briefing, and writes it to today's note in Journal/.
 *
 * Run it from the DIGEST button, or wire it to fire when your daily note is
 * created (Templater folder template) — that's the Obsidian-native "cron".
 */
module.exports = async (params) => {
  const { app } = params;
  const { requestUrl, Notice } = require("obsidian");

  const MODEL = "claude-opus-4-8";
  const INBOX = "Inbox";
  const JOURNAL = "Journal";

  const apiKey = window.localStorage.getItem("jarvis-anthropic-key");
  if (!apiKey) {
    new Notice("JARVIS: no API key. Run JARVIS Setup first.", 8000);
    return;
  }

  // Gather last-24h Inbox notes.
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const files = app.vault
    .getMarkdownFiles()
    .filter((f) => f.path.startsWith(INBOX + "/") && f.stat.ctime >= cutoff);

  if (files.length === 0) {
    new Notice("JARVIS: nothing captured in the last 24h.", 5000);
    return;
  }

  let corpus = "";
  for (const f of files) {
    const body = await app.vault.cachedRead(f);
    corpus += `\n\n--- ${f.basename} ---\n${body}`;
  }

  const system =
    "You are JARVIS, writing Elliot's daily briefing from his raw captures. " +
    "Group by theme/project. Lead with anything time-sensitive. Use short " +
    "markdown sections and tight bullet points. Surface tasks as a checklist " +
    "(- [ ] ...). Do not invent anything that isn't in the captures.";

  const res = await requestUrl({
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      system,
      messages: [
        {
          role: "user",
          content:
            `Here are ${files.length} captures from the last 24 hours. ` +
            `Write the briefing.\n${corpus}`,
        },
      ],
    }),
    throw: false,
  });

  if (res.status !== 200) {
    const msg = res.json && res.json.error ? res.json.error.message : "HTTP " + res.status;
    new Notice("JARVIS digest failed: " + msg, 8000);
    return;
  }
  const summary = (res.json.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  if (!app.vault.getAbstractFileByPath(JOURNAL)) {
    try {
      await app.vault.createFolder(JOURNAL);
    } catch (e) {}
  }

  const d = new Date();
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const path = `${JOURNAL}/${day}.md`;
  const heading = `\n\n## JARVIS Digest — ${d.toLocaleTimeString()}\n\n${summary}\n`;

  const existing = app.vault.getAbstractFileByPath(path);
  if (existing) {
    await app.vault.append(existing, heading);
  } else {
    await app.vault.create(
      path,
      `---\ntype: journal\ncreated: ${d.toISOString()}\nsource: jarvis-digest\n---\n# ${day}${heading}`
    );
  }
  new Notice(`JARVIS ✓ digest written (${files.length} captures)`, 5000);

  function pad(n) {
    return String(n).padStart(2, "0");
  }
};
