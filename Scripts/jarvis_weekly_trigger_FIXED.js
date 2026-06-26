/**
 * JARVIS Weekly Review Trigger
 * Creates weekly review on Sunday
 */

const { Notice } = params.obsidian;

const CONFIG = {
  templateFile: "JARVIS/Weekly Review Template",
  reviewFolder: "JARVIS/Weekly Reviews",
  dayToReview: 0
};

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function isSunday() {
  return new Date().getDay() === CONFIG.dayToReview;
}

async function createWeeklyReview() {
  try {
    const templateFile = app.vault.getFileByPath(`${CONFIG.templateFile}.md`);
    if (!templateFile) {
      new Notice("Template not found");
      return;
    }

    const templateContent = await app.vault.read(templateFile);
    const now = new Date();
    const weekNum = getWeekNumber(now);
    const year = now.getFullYear();
    const weekStart = now.toISOString().split("T")[0];

    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    const reviewContent = templateContent
      .replace(/<% tp\.date\.now\("YYYY-\[W\]WW"\) %>/g, `${year}-W${String(weekNum).padStart(2, "0")}`)
      .replace(/<% tp\.date\.now\("WW, YYYY"\) %>/g, `${weekNum}, ${year}`)
      .replace(/<% tp\.date\.now\("YYYY-MM-DD"\) %>/g, weekStart)
      .replace(/<% tp\.date\.now\("dddd", 6\) %>/g, weekEndStr);

    const folderPath = CONFIG.reviewFolder;
    if (!app.vault.getAbstractFileByPath(folderPath)) {
      await app.vault.createFolder(folderPath);
    }

    const filename = `${year}-W${String(weekNum).padStart(2, "0")}.md`;
    const filepath = `${folderPath}/${filename}`;

    if (app.vault.getFileByPath(filepath)) {
      new Notice(`Review already exists for W${weekNum}`);
      return;
    }

    await app.vault.create(filepath, reviewContent);
    new Notice(`JARVIS ✓ Weekly Review W${weekNum} created`);

    const file = app.vault.getFileByPath(filepath);
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file);
  } catch (error) {
    new Notice(`Error: ${error.message}`);
  }
}

async function main() {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (isSunday()) {
    await createWeeklyReview();
  } else {
    new Notice(`Weekly review runs Sunday. Today is ${dayNames[new Date().getDay()]}`);
  }
}

await main();
