/*
 * JARVIS Full Automatic Assistant — Complete tool-use implementation
 * Handles all phone actions: alarms, SMS, reminders, calendar, timers, apps, notifications
 * Auto-logs everything to vault with context and timestamps
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
    {
      name: "set_alarm",
      description: "Set an alarm for a specific time",
      input_schema: {
        type: "object",
        properties: {
          time: { type: "string", description: "Time in HH:MM format (24-hour)" },
          date: { type: "string", description: "Date (YYYY-MM-DD or relative: today, tomorrow)" },
          label: { type: "string", description: "Alarm reason/label" },
          snooze_minutes: { type: "number", description: "Snooze duration in minutes (default 10)" }
        },
        required: ["time", "date"]
      }
    },
    {
      name: "send_sms",
      description: "Send SMS to a contact",
      input_schema: {
        type: "object",
        properties: {
          contact: { type: "string", description: "Contact name or phone number" },
          message: { type: "string", description: "Message text" }
        },
        required: ["contact", "message"]
      }
    },
    {
      name: "create_reminder",
      description: "Create a time-based reminder",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Reminder text" },
          date: { type: "string", description: "Date (YYYY-MM-DD or relative)" },
          time: { type: "string", description: "Time in HH:MM format" }
        },
        required: ["title", "date", "time"]
      }
    },
    {
      name: "create_calendar_event",
      description: "Create a calendar event",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title" },
          date: { type: "string", description: "Event date (YYYY-MM-DD or relative)" },
          start_time: { type: "string", description: "Start time in HH:MM format" },
          end_time: { type: "string", description: "End time in HH:MM format (optional)" },
          location: { type: "string", description: "Event location (optional)" },
          description: { type: "string", description: "Event description (optional)" }
        },
        required: ["title", "date", "start_time"]
      }
    },
    {
      name: "open_app",
      description: "Open an app on the phone",
      input_schema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name (Chrome, Gmail, Obsidian, etc.)" }
        },
        required: ["app_name"]
      }
    },
    {
      name: "set_timer",
      description: "Set a countdown timer",
      input_schema: {
        type: "object",
        properties: {
          duration_minutes: { type: "number", description: "Timer duration in minutes" },
          label: { type: "string", description: "Timer label/reason (optional)" }
        },
        required: ["duration_minutes"]
      }
    },
    {
      name: "send_notification",
      description: "Send a system notification",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Notification title" },
          message: { type: "string", description: "Notification body" },
          priority: { type: "string", enum: ["low", "normal", "high"], description: "Priority level" }
        },
        required: ["title", "message"]
      }
    },
    {
      name: "log_event",
      description: "Log an event/note to vault for tracking",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title" },
          body: { type: "string", description: "Event details" },
          category: { type: "string", enum: ["personal", "work", "health", "finance", "project"], description: "Event category" },
          tags: { type: "string", description: "Comma-separated tags" }
        },
        required: ["title", "category"]
      }
    }
  ];

  const recent = app.vault
    .getMarkdownFiles()
    .filter((f) => f.path.startsWith("JARVIS/Inbox/") || f.path.startsWith("Journal/") || f.path.startsWith("Claude Memory/Projects/"))
    .sort((a, b) => b.stat.mtime - a.stat.mtime)
    .slice(0, 25);

  let context = "";
  for (const f of recent) {
    context += `\n\n--- ${f.basename} ---\n` + (await app.vault.cachedRead(f));
  }

  const systemPrompt = `You are JARVIS Unlimited — a full automatic personal assistant running on mobile.

Your role:
- Parse natural language requests and execute phone actions
- Use tools to set alarms, send messages, create events, manage reminders, control apps
- Log important events and decisions to the vault
- Be proactive and anticipate needs based on context
- Always explain what you're doing clearly

When executing actions:
1. Understand the user's intent
2. Call the appropriate tools
3. Provide clear confirmation of what was executed
4. Log significant actions to vault for future reference

Be concise but thorough. If something is unclear, ask for clarification.`;

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
      system: systemPrompt,
      tools: TOOLS,
      messages: [
        {
          role: "user",
          content: `Context from recent activities:\n${context}\n\n---\nRequest: ${question.trim()}`,
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
  let actionsTaken = [];
  for (const block of (res.json.content || [])) {
    if (block.type === "text") {
      answer += block.text;
    } else if (block.type === "tool_use") {
      const tool = block.name;
      const input = block.input;
      answer += `\n✓ ${formatAction(tool, input)}`;
      actionsTaken.push({ tool, input });

      await executeTool(tool, input, requestUrl);
    }
  }

  if (!answer) answer = "JARVIS: acknowledged.";
  new Notice(answer.slice(0, 300) + (answer.length > 300 ? "…" : ""), 10000);

  await logToVault(app, question, answer, actionsTaken);
};

async function executeTool(tool, input, requestUrl) {
  try {
    if (tool === "set_alarm") {
      const [hours, minutes] = input.time.split(":").map(x => parseInt(x));
      const snooze = input.snooze_minutes || 10;
      const label = encodeURIComponent(input.label || "Alarm");
      const url = `http://localhost:1337/?task=Jarvis%20Alarm&par1=${hours}&par2=${minutes}&par3=${label}&par4=${snooze}`;
      await requestUrl({ url, method: "GET", throw: false });
    } else if (tool === "send_sms") {
      const contact = encodeURIComponent(input.contact);
      const message = encodeURIComponent(input.message);
      const url = `http://localhost:1337/?task=Jarvis%20SMS&par1=${contact}&par2=${message}`;
      await requestUrl({ url, method: "GET", throw: false });
    } else if (tool === "create_reminder") {
      const [hours, minutes] = input.time.split(":").map(x => parseInt(x));
      const title = encodeURIComponent(input.title);
      const url = `http://localhost:1337/?task=Jarvis%20Reminder&par1=${title}&par2=${input.date}&par3=${hours}&par4=${minutes}`;
      await requestUrl({ url, method: "GET", throw: false });
    } else if (tool === "create_calendar_event") {
      const title = encodeURIComponent(input.title);
      const [startHours, startMins] = input.start_time.split(":").map(x => parseInt(x));
      const endTime = input.end_time ? input.end_time : input.start_time;
      const [endHours, endMins] = endTime.split(":").map(x => parseInt(x));
      const location = input.location ? encodeURIComponent(input.location) : "";
      const url = `http://localhost:1337/?task=Jarvis%20Calendar&par1=${title}&par2=${input.date}&par3=${startHours}&par4=${startMins}&par5=${endHours}&par6=${endMins}&par7=${location}`;
      await requestUrl({ url, method: "GET", throw: false });
    } else if (tool === "open_app") {
      const app_name = encodeURIComponent(input.app_name);
      const url = `http://localhost:1337/?task=Jarvis%20OpenApp&par1=${app_name}`;
      await requestUrl({ url, method: "GET", throw: false });
    } else if (tool === "set_timer") {
      const duration = input.duration_minutes;
      const label = input.label ? encodeURIComponent(input.label) : "";
      const url = `http://localhost:1337/?task=Jarvis%20Timer&par1=${duration}&par2=${label}`;
      await requestUrl({ url, method: "GET", throw: false });
    } else if (tool === "send_notification") {
      const title = encodeURIComponent(input.title);
      const message = encodeURIComponent(input.message);
      const priority = input.priority || "normal";
      const url = `http://localhost:1337/?task=Jarvis%20Notify&par1=${title}&par2=${message}&par3=${priority}`;
      await requestUrl({ url, method: "GET", throw: false });
    } else if (tool === "log_event") {
      // Logged in vault separately; this is just acknowledgment
    }
  } catch (e) {
    console.log(`[JARVIS] Tool execution error for ${tool}:`, e.message);
  }
}

async function logToVault(app, question, answer, actions) {
  try {
    if (!app.vault.getAbstractFileByPath("JARVIS")) {
      await app.vault.createFolder("JARVIS");
    }

    const timestamp = new Date().toLocaleString();
    const date = new Date().toISOString().split("T")[0];

    const actionLog = actions.map(a => `- **${a.tool}**: ${JSON.stringify(a.input).substring(0, 100)}`).join("\n");
    const entry = `\n\n### ${timestamp}\n**Q:** ${question.trim()}\n\n${answer}${actions.length > 0 ? `\n\n**Actions:**\n${actionLog}` : ""}\n`;

    const chatPath = "JARVIS/Chat.md";
    const existing = app.vault.getAbstractFileByPath(chatPath);
    if (existing) {
      await app.vault.append(existing, entry);
    } else {
      await app.vault.create(chatPath, `# JARVIS Chat Log\n${entry}`);
    }

    const actionLogPath = `JARVIS/Actions/${date}.md`;
    if (actions.length > 0) {
      if (!app.vault.getAbstractFileByPath("JARVIS/Actions")) {
        await app.vault.createFolder("JARVIS/Actions");
      }
      const actionEntry = `${timestamp} | ${actions.map(a => a.tool).join(", ")}\n`;
      const actionFile = app.vault.getAbstractFileByPath(actionLogPath);
      if (actionFile) {
        await app.vault.append(actionFile, actionEntry);
      } else {
        await app.vault.create(actionLogPath, `# Actions Log — ${date}\n\n${actionEntry}`);
      }
    }
  } catch (e) {
    console.log("[JARVIS] Vault logging error:", e.message);
  }
}

function formatAction(tool, input) {
  if (tool === "set_alarm") return `⏰ ALARM: ${input.time} on ${input.date}${input.label ? " (" + input.label + ")" : ""}`;
  if (tool === "send_sms") return `💬 SMS to ${input.contact}: ${input.message.substring(0, 50)}${input.message.length > 50 ? "..." : ""}`;
  if (tool === "create_reminder") return `🔔 REMINDER: ${input.title} at ${input.date} ${input.time}`;
  if (tool === "create_calendar_event") return `📅 EVENT: ${input.title} on ${input.date} at ${input.start_time}`;
  if (tool === "open_app") return `📱 OPEN: ${input.app_name}`;
  if (tool === "set_timer") return `⏱️ TIMER: ${input.duration_minutes} min${input.label ? " (" + input.label + ")" : ""}`;
  if (tool === "send_notification") return `🔔 NOTIFY: ${input.title}`;
  if (tool === "log_event") return `📝 LOG: ${input.title} [${input.category}]`;
  return tool;
}
