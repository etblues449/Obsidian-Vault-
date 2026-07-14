/**
 * JARVIS Unlimited — Mobile QuickAdd Compatible
 * Uses global Obsidian app object instead of params
 */

const CONFIG = {
  apiKey: localStorage.getItem("JARVIS_API_KEY"),
  model: "claude-opus-4-8",
  maxTokens: 1024
};

const TOOLS = [
  {
    name: "set_alarm",
    description: "Set an alarm on the phone for a specific time with optional label",
    input_schema: {
      type: "object",
      properties: {
        time: { type: "string", description: "Time in HH:MM format (24-hour)" },
        date: { type: "string", description: "Date in YYYY-MM-DD or relative" },
        label: { type: "string", description: "Alarm label/reason" }
      },
      required: ["time", "date"]
    }
  },
  {
    name: "create_calendar_event",
    description: "Create a calendar event",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string" },
        start_time: { type: "string" },
        end_time: { type: "string" },
        location: { type: "string" }
      },
      required: ["title", "date", "start_time"]
    }
  },
  {
    name: "send_sms",
    description: "Send SMS to contact",
    input_schema: {
      type: "object",
      properties: {
        contact: { type: "string" },
        message: { type: "string" }
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
        title: { type: "string" },
        date: { type: "string" },
        time: { type: "string" }
      },
      required: ["title", "date", "time"]
    }
  },
  {
    name: "open_app",
    description: "Open an app on the phone",
    input_schema: {
      type: "object",
      properties: {
        app_name: { type: "string" }
      },
      required: ["app_name"]
    }
  },
  {
    name: "set_timer",
    description: "Set a timer for specified duration",
    input_schema: {
      type: "object",
      properties: {
        duration_minutes: { type: "number" },
        label: { type: "string" }
      },
      required: ["duration_minutes"]
    }
  },
  {
    name: "send_notification",
    description: "Send system notification",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        message: { type: "string" }
      },
      required: ["title", "message"]
    }
  },
  {
    name: "get_time_and_date",
    description: "Get current time and date",
    input_schema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["iso", "readable", "timestamp"] }
      },
      required: []
    }
  }
];

function showNotice(message) {
  if (typeof app !== "undefined" && app.vault) {
    new Notice(message);
  } else {
    console.log("[JARVIS]", message);
  }
}

function buildConfirmationText(toolName, input) {
  let msg = `About to:\n\n`;

  if (toolName === "set_alarm") {
    msg += `⏰ SET ALARM\nTime: ${input.time}\nDate: ${input.date}`;
    if (input.label) msg += `\nReason: ${input.label}`;
  } else if (toolName === "create_calendar_event") {
    msg += `📅 CREATE EVENT\nTitle: ${input.title}\nDate: ${input.date} ${input.start_time}`;
    if (input.location) msg += `\nAt: ${input.location}`;
  } else if (toolName === "send_sms") {
    msg += `💬 SMS\nTo: ${input.contact}\nMsg: ${input.message}`;
  } else if (toolName === "create_reminder") {
    msg += `🔔 REMINDER\nText: ${input.title}\nTime: ${input.date} at ${input.time}`;
  } else if (toolName === "open_app") {
    msg += `📱 OPEN APP\nApp: ${input.app_name}`;
  } else if (toolName === "set_timer") {
    msg += `⏱️ TIMER\nDuration: ${input.duration_minutes} min`;
    if (input.label) msg += `\nLabel: ${input.label}`;
  } else {
    msg += `${toolName}\n${JSON.stringify(input).substring(0, 100)}`;
  }

  msg += `\n✓ Executing...`;
  return msg;
}

async function executeToolAction(toolName, toolInput) {
  const confirmMsg = buildConfirmationText(toolName, toolInput);
  showNotice(confirmMsg);

  try {
    console.log(`[JARVIS] Executing: ${toolName}`, toolInput);
    // TODO: Call Termux:API here
  } catch (e) {
    showNotice(`Error: ${e.message}`);
  }
}

(async () => {
  if (!CONFIG.apiKey) {
    showNotice("JARVIS: Set API key via Setup first");
    return;
  }

  const userInput = input?.trim();
  if (!userInput) {
    showNotice("JARVIS: What do you want to do?");
    return;
  }

  showNotice("JARVIS: Processing...");

  try {
    // Use fetch instead of requestUrl (more compatible with mobile)
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": CONFIG.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        system: "You are JARVIS - a phone assistant. Parse requests and call tools. Be direct and clear.",
        tools: TOOLS,
        messages: [{ role: "user", content: userInput }]
      })
    });

    if (!response.ok) {
      showNotice(`API Error: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();

    if (!data.content || data.content.length === 0) {
      showNotice("JARVIS: No response");
      return;
    }

    let hasAction = false;
    for (let i = 0; i < data.content.length; i++) {
      const block = data.content[i];

      if (block.type === "text") {
        showNotice(`JARVIS: ${block.text}`);
      } else if (block.type === "tool_use") {
        hasAction = true;
        await executeToolAction(block.name, block.input);
      }
    }

    if (!hasAction) {
      showNotice("JARVIS: Try: 'Set alarm for 8am tomorrow'");
    }

  } catch (error) {
    showNotice(`Error: ${error.message}`);
  }
})();
