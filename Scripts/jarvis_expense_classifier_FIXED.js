/**
 * JARVIS Expense Classifier
 * Auto-categorizes expenses using Claude
 */

const { requestUrl, Notice } = params.obsidian;

const CONFIG = {
  inboxFolder: "JARVIS/Inbox",
  categories: ["Food", "Transport", "Home", "Tools", "Health", "Entertainment", "Savings", "Work", "Social", "Misc"]
};

async function classifyExpense(input) {
  let apiKey;
  try {
    apiKey = localStorage.getItem("JARVIS_API_KEY");
  } catch (e) {
    apiKey = null;
  }

  if (!apiKey) {
    new Notice("JARVIS: API key not found. Run Setup first.");
    return null;
  }

  try {
    const prompt = `Extract expense details. Return ONLY valid JSON:
{
  "amount": 0.00,
  "category": "Food",
  "description": "item",
  "currency": "GBP"
}

Expense: "${input}"`;

    const response = await requestUrl({
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = JSON.parse(response.text);
    if (data.content && data.content[0]) {
      return JSON.parse(data.content[0].text);
    }
    return null;
  } catch (error) {
    new Notice(`Error: ${error.message}`);
    return null;
  }
}

async function saveExpense(classified) {
  if (!classified || !classified.amount) return;

  try {
    const folderPath = CONFIG.inboxFolder;
    if (!app.vault.getAbstractFileByPath(folderPath)) {
      await app.vault.createFolder(folderPath);
    }

    const date = new Date().toISOString().split("T")[0];
    const filename = `${date}-expense-${classified.category.toLowerCase()}.md`;
    const filepath = `${folderPath}/${filename}`;

    const content = `---
type: expense
date: ${date}
amount: ${classified.amount}
currency: ${classified.currency}
category: ${classified.category}
---

# ${classified.category}: ${classified.description}

**Amount:** ${classified.currency} ${classified.amount}
**Category:** ${classified.category}
`;

    await app.vault.create(filepath, content);
    new Notice(`JARVIS ✓ expense → ${classified.category} (${classified.currency} ${classified.amount})`);
  } catch (error) {
    new Notice(`Save error: ${error.message}`);
  }
}

async function main() {
  const expense = await classifyExpense(input);
  if (expense) {
    await saveExpense(expense);
  }
}

await main();
