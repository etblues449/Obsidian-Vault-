/**
 * JARVIS Weekly Review Trigger
 * Auto-prompts for weekly review on Sunday evening (or manual trigger)
 *
 * Usage: Call manually or from Templater on Sunday daily note
 * Creates new Weekly Review note from template
 */

const { Notice } = params.obsidian;

const CONFIG = {
  templateFile: "JARVIS/Weekly Review Template",
  reviewFolder: "JARVIS/Weekly Reviews",
  dayToReview: 0 // 0 = Sunday
};

// Calculate week number (ISO 8601)
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Check if today is Sunday
function isSunday() {
  const today = new Date();
  return today.getDay() === CONFIG.dayToReview;
}

// Create weekly review note
async function createWeeklyReview() {
  try {
    // Read template
    const templateFile = app.vault.getFileByPath(`${CONFIG.templateFile}.md`);
    if (!templateFile) {
      new Notice("JARVIS: Weekly Review Template not found");
      return;
    }

    const templateContent = await app.vault.read(templateFile);

    // Generate new review content
    const now = new Date();
    const weekNum = getWeekNumber(now);
    const year = now.getFullYear();
    const weekStart = now.toISOString().split("T")[0];

    // Calculate week end (Saturday)
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    const reviewContent = templateContent
      .replace(/<% tp\.date\.now\("YYYY-\[W\]WW"\) %>/g, `${year}-W${String(weekNum).padStart(2, "0")}`)
      .replace(/<% tp\.date\.now\("WW, YYYY"\) %>/g, `${weekNum}, ${year}`)
      .replace(/<% tp\.date\.now\("YYYY-MM-DD"\) %>/g, weekStart)
      .replace(/<% tp\.date\.now\("dddd", 6\) %>/g, weekEndStr);

    // Create folder if needed
    const folderPath = CONFIG.reviewFolder;
    if (!app.vault.getAbstractFileByPath(folderPath)) {
      await app.vault.createFolder(folderPath);
    }

    // Create review file
    const filename = `${year}-W${String(weekNum).padStart(2, "0")}.md`;
    const filepath = `${folderPath}/${filename}`;

    // Check if already exists
    if (app.vault.getFileByPath(filepath)) {
      new Notice(`JARVIS: Weekly review already exists for W${weekNum}`);
      return;
    }

    await app.vault.create(filepath, reviewContent);
    new Notice(`JARVIS ✓ Weekly Review W${weekNum} created`);

    // Open it in current pane
    const file = app.vault.getFileByPath(filepath);
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file);

  } catch (error) {
    new Notice(`JARVIS Error: ${error.message}`);
  }
}

// Main execution
async function main() {
  const today = new Date();
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Check if forced (params.force) or if it's Sunday
  if (params.force === "true" || isSunday()) {
    await createWeeklyReview();
  } else {
    new Notice(`JARVIS: Weekly review runs on Sunday. Today is ${dayName[today.getDay()]}`);
  }
}

await main();
