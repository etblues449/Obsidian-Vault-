/**
 * JARVIS Expense Classifier
 * Auto-categorizes expenses from natural language using Claude
 *
 * Usage: Feed expense descriptions; Claude returns category + amount
 * Routes to JARVIS/Inbox with type: "expense"
 */

const { requestUrl, Notice } = params.obsidian;

const CONFIG = {
  apiKey: localStorage.getItem("jarvis-anthropic-key"),
  vaultRoot: app.vault.adapter.basePath,
  inboxFolder: "JARVIS/Inbox",
  categories: [
    "Food", "Transport", "Home", "Tools", "Health",
    "Entertainment", "Savings", "Work", "Social", "Misc"
  ]
};

// Main expense classifier
async function classifyExpense(input) {
  if (!CONFIG.apiKey) {
    new Notice("JARVIS: Please run Setup first (no API key)");
    return null;
  }

  try {
    const prompt = `You are a personal finance classifier. Analyze this expense capture and extract:
1. Amount (numeric only, e.g., 45.50)
2. Category (one of: ${CONFIG.categories.join(", ")})
3. Item description (2-5 words, e.g., "groceries from Tesco")

Expense: "${input}"

Respond ONLY with valid JSON:
{
  "amount": 0.00,
  "category": "Food",
  "description": "Item name",
  "currency": "GBP"
}`;

    const response = await requestUrl({
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": CONFIG.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = JSON.parse(response.text);
    if (data.content && data.content[0]) {
      const classified = JSON.parse(data.content[0].text);
      return classified;
    }
  } catch (error) {
    new Notice(`JARVIS Error: ${error.message}`);
    return null;
  }
}

// Save to JARVIS/Inbox
async function saveExpense(classified) {
  if (!classified) return;

  const timestamp = new Date().toISOString();
  const date = timestamp.split("T")[0];
  const filename = `${date}-expense-${classified.category.toLowerCase()}.md`;
  const filepath = `${CONFIG.inboxFolder}/${filename}`;

  const content = `---
type: expense
date: ${date}
amount: ${classified.amount}
currency: ${classified.currency}
category: ${classified.category}
created: ${timestamp}
---

# 💰 ${classified.category}: ${classified.description}

**Amount:** ${classified.currency} ${classified.amount}
**Category:** ${classified.category}
**Date:** ${date}

---

Original capture: "${params.input}"
`;

  try {
    await app.vault.create(filepath, content);
    new Notice(`JARVIS ✓ expense → ${classified.category} (${classified.currency} ${classified.amount})`);
    return filepath;
  } catch (error) {
    new Notice(`JARVIS: Save error — ${error.message}`);
  }
}

// Main execution
async function main() {
  const expense = await classifyExpense(params.input);
  if (expense) {
    await saveExpense(expense);
  }
}

await main();
