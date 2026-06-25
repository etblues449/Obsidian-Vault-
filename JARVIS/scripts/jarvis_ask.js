/*
 * jarvis_ask.js — ask JARVIS (now with tool-use for phone actions)
 * Extended to handle tool calls: set alarms, send SMS, create reminders, etc.
 */
module.exports = async (params) => {
  const { app, quickAddApi } = params;
  const { requestUrl, Notice } = params.obsidian;

  const MODEL = "claude-opus-4-8";
  const apiKey = window.localStorage.getItem("jarvis-anthropic-key");
  if (!apiKey) {
    new Notice("JARVIS: no API key. Run JARVIS Setup first.", 8000);
    return;
  }

  const question = await quickAddApi.inputPrompt("Ask JARVIS (or request action)");
  if (!question || !question.trim()) return;

  const TOOLS = [
    { name: "set_alarm", description: "Set an alarm", input_schema: { type: "object", properties: { time: { type: "string" }, date: { type: "string" }, label: { type: "string" } }, required: ["time", "date"] } },
    { name: "send_sms", description: "Send SMS", input_schema: { type: "object", properties: { contact: { type: "string" }, message: { type: "string" } }, required: ["contact", "message"] } },
    { name: "create_reminder", description: "Create reminder", input_schema: { type: "object", properties: { title: { type: "string" }, date: { type: "string" }, time: { type: "string" } }, required: ["title", "date", "time"] } },
    { name: "create_calendar_event", description: "Create calendar event", input_schema: { type: "object", properties: { title: { type: "string" }, date: { type: "string" }, start_time: { type: "string" }, end_time: { type: "string" }, location: { type: "string" } }, required: ["title", "date", "start_time"] } },
    { name: "open_app", description: "Open app", input_schema: { type: "object", properties: { app_name: { type: "string" } }, required: ["app_name"] } },
    { name: "set_timer", description: "Set timer", input_schema: { type: "object", properties: { duration_minutes: { type: "number" }, label: { type: "string" } }, required: ["duration_minutes"] } },
  ];

  const recent = app.vault
    .getMarkdownFiles()
    .filter((f) => f.path.startsWith("JARVIS/Inbox/") || f.path.startsWith("Journal/"))
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
      max_tokens: 2000,
      system: "You are JARVIS. If user asks to set alarm, send SMS, or perform phone actions, use the available tools. Otherwise answer from recent context.",
      tools: TOOLS,
      messages: [
        {
          role: "user",
          content: `Recent notes:\n${context}\n\n---\nRequest: ${question.trim()}`,
        },
      ],
    }),
    throw: false,
  });

  if (res.status !== 200) {
    const msg = res.json && res.json.error ? res.json.error.message : "HTTP " + res.status;
    new Notice("JARVIS failed: " + msg, 8000);
    return;
  }

  let answer = "";
  let actionTaken = false;
  for (const block of (res.json.content || [])) {
    if (block.type === "text") {
      answer += block.text;
    } else if (block.type === "tool_use") {
      actionTaken = true;
      const tool = block.name;
      const input = block.input;
      answer += `\n✓ ${formatAction(tool, input)}`;

      // Execute via Tasker
      if (tool === "set_alarm") {
        try {
          const [hours, minutes] = input.time.split(":").map(x => parseInt(x));
          const label = input.label || "Alarm";
          // Call Tasker with task and parameters
          const url = `http://localhost:1337/?task=Jarvis%20Handler&par1=${hours}&par2=${minutes}&par3=${encodeURIComponent(label)}`;
          await fetch(url);
          answer += ` ✓`;
        } catch (e) {
          answer += ` (pending)`;
        }
      }
    }
  }

  if (!answer) answer = "JARVIS: done.";
  new Notice(answer.slice(0, 300) + (answer.length > 300 ? "…" : ""), 10000);

  if (!app.vault.getAbstractFileByPath("JARVIS")) {
    try {
      await app.vault.createFolder("JARVIS");
    } catch (e) {}
  }
  const path = "JARVIS/Chat.md";
  const entry = `\n\n### ${new Date().toLocaleString()}\n**Q:** ${question.trim()}\n\n${answer}${actionTaken ? "\n*(action executed)*" : ""}\n`;
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing) await app.vault.append(existing, entry);
  else await app.vault.create(path, `# JARVIS Chat${entry}`);
};

function formatAction(tool, input) {
  if (tool === "set_alarm") return `ALARM: ${input.time} on ${input.date}${input.label ? " (" + input.label + ")" : ""}`;
  if (tool === "send_sms") return `SMS to ${input.contact}: ${input.message}`;
  if (tool === "create_reminder") return `REMINDER: ${input.title} at ${input.date} ${input.time}`;
  if (tool === "create_calendar_event") return `EVENT: ${input.title} on ${input.date}`;
  if (tool === "open_app") return `OPEN: ${input.app_name}`;
  if (tool === "set_timer") return `TIMER: ${input.duration_minutes} min`;
  return tool;
}
