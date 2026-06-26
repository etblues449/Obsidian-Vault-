// JARVIS Unlimited — Inline Macro (no external script dependency)
// Paste entire code into QuickAdd macro

const CONFIG = {
  apiKey: localStorage.getItem("JARVIS_API_KEY"),
  model: "claude-opus-4-8",
  maxTokens: 1024
};

const TOOLS = [
  { name: "set_alarm", description: "Set an alarm", input_schema: { type: "object", properties: { time: { type: "string" }, date: { type: "string" }, label: { type: "string" } }, required: ["time", "date"] } },
  { name: "create_calendar_event", description: "Create calendar event", input_schema: { type: "object", properties: { title: { type: "string" }, date: { type: "string" }, start_time: { type: "string" }, end_time: { type: "string" }, location: { type: "string" } }, required: ["title", "date", "start_time"] } },
  { name: "send_sms", description: "Send SMS", input_schema: { type: "object", properties: { contact: { type: "string" }, message: { type: "string" } }, required: ["contact", "message"] } },
  { name: "create_reminder", description: "Create reminder", input_schema: { type: "object", properties: { title: { type: "string" }, date: { type: "string" }, time: { type: "string" } }, required: ["title", "date", "time"] } },
  { name: "open_app", description: "Open app", input_schema: { type: "object", properties: { app_name: { type: "string" } }, required: ["app_name"] } },
  { name: "set_timer", description: "Set timer", input_schema: { type: "object", properties: { duration_minutes: { type: "number" }, label: { type: "string" } }, required: ["duration_minutes"] } },
  { name: "send_notification", description: "Send notification", input_schema: { type: "object", properties: { title: { type: "string" }, message: { type: "string" } }, required: ["title", "message"] } },
  { name: "get_time_and_date", description: "Get time/date", input_schema: { type: "object", properties: { format: { type: "string", enum: ["iso", "readable", "timestamp"] } }, required: [] } }
];

function notify(msg) {
  if (typeof Notice !== "undefined") {
    new Notice(msg);
  } else {
    console.log("[JARVIS]", msg);
  }
}

function formatTool(name, input) {
  if (name === "set_alarm") return `⏰ ALARM: ${input.time} on ${input.date}${input.label ? " (" + input.label + ")" : ""}`;
  if (name === "create_calendar_event") return `📅 EVENT: ${input.title} on ${input.date} at ${input.start_time}`;
  if (name === "send_sms") return `💬 SMS to ${input.contact}: ${input.message}`;
  if (name === "create_reminder") return `🔔 REMINDER: ${input.title} at ${input.date} ${input.time}`;
  if (name === "open_app") return `📱 OPEN: ${input.app_name}`;
  if (name === "set_timer") return `⏱️ TIMER: ${input.duration_minutes} min`;
  if (name === "send_notification") return `🔔 NOTIFY: ${input.title}`;
  return name;
}

(async () => {
  if (!CONFIG.apiKey) {
    notify("JARVIS: No API key. Run Setup first.");
    return;
  }

  const userInput = input?.trim();
  if (!userInput) {
    notify("JARVIS: What do you want to do?");
    return;
  }

  notify("JARVIS: Processing...");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": CONFIG.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        system: "You are JARVIS - a phone assistant. Parse natural language requests and decide which tools to call. Be direct.",
        tools: TOOLS,
        messages: [{ role: "user", content: userInput }]
      })
    });

    if (!response.ok) {
      notify(`API Error: ${response.status}`);
      return;
    }

    const data = await response.json();
    if (!data.content) {
      notify("JARVIS: No response");
      return;
    }

    for (const block of data.content) {
      if (block.type === "text") {
        notify(`JARVIS: ${block.text}`);
      } else if (block.type === "tool_use") {
        const toolMsg = formatTool(block.name, block.input);
        notify(`✓ ${toolMsg}`);
      }
    }
  } catch (e) {
    notify(`Error: ${e.message}`);
  }
})();
