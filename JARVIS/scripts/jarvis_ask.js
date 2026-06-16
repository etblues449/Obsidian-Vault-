/*
 * jarvis_ask.js — ask JARVIS a question (QuickAdd user script)
 * -----------------------------------------------------------
 * A lightweight, always-available Q&A. Prompts for a question, optionally
 * grounds it on your recent captures, returns the answer in a Notice AND
 * appends the exchange to "JARVIS/Chat.md" so it's searchable later.
 *
 * For deep, vault-wide semantic chat use Smart Connections (it embeds the
 * whole vault). This script is the quick "hey JARVIS, what did I…" path that
 * works with zero extra setup.
 */
module.exports = async (params) => {
  const { app, quickAddApi } = params;
  // QuickAdd hands us the obsidian module on params (mobile-safe; no require).
  const { requestUrl, Notice } = params.obsidian;

  const MODEL = "claude-opus-4-8";
  const apiKey = window.localStorage.getItem("jarvis-anthropic-key");
  if (!apiKey) {
    new Notice("JARVIS: no API key. Run JARVIS Setup first.", 8000);
    return;
  }

  const question = await quickAddApi.inputPrompt("Ask JARVIS");
  if (!question || !question.trim()) return;

  // Ground on the 20 most recent Inbox + Journal notes (cheap, no embeddings).
  const recent = app.vault
    .getMarkdownFiles()
    .filter((f) => f.path.startsWith("Inbox/") || f.path.startsWith("Journal/"))
    .sort((a, b) => b.stat.mtime - a.stat.mtime)
    .slice(0, 20);

  let context = "";
  for (const f of recent) {
    context += `\n\n--- ${f.basename} ---\n` + (await app.vault.cachedRead(f));
  }

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
      system:
        "You are JARVIS, Elliot's personal assistant with access to his recent " +
        "vault notes (below). Answer concisely and practically. If the notes " +
        "don't cover it, say so and answer from general knowledge.",
      messages: [
        {
          role: "user",
          content: `Recent notes:\n${context}\n\n---\nQuestion: ${question.trim()}`,
        },
      ],
    }),
    throw: false,
  });

  if (res.status !== 200) {
    const msg = res.json && res.json.error ? res.json.error.message : "HTTP " + res.status;
    new Notice("JARVIS ask failed: " + msg, 8000);
    return;
  }
  const answer = (res.json.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  new Notice("JARVIS: " + answer.slice(0, 280) + (answer.length > 280 ? "…" : ""), 10000);

  if (!app.vault.getAbstractFileByPath("JARVIS")) {
    try {
      await app.vault.createFolder("JARVIS");
    } catch (e) {}
  }
  const path = "JARVIS/Chat.md";
  const entry = `\n\n### ${new Date().toLocaleString()}\n**Q:** ${question.trim()}\n\n${answer}\n`;
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing) await app.vault.append(existing, entry);
  else await app.vault.create(path, `# JARVIS Chat${entry}`);
};
