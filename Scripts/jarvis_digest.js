/**
 * JARVIS Digest — Daily Summary
 */

const { Notice } = params.obsidian;

(async function() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const journalFolder = "Journal";
    const digestPath = `${journalFolder}/${today}.md`;

    if (app.vault.getFileByPath(digestPath)) {
      new Notice("JARVIS: Digest already exists for today");
      return;
    }

    if (!app.vault.getAbstractFileByPath(journalFolder)) {
      await app.vault.createFolder(journalFolder);
    }

    const content = `---
type: journal
date: ${today}
---

# Daily Digest — ${today}

## Briefing
Check JARVIS/Inbox for today's captures.

## Next Steps
1. Review captures
2. Plan tomorrow
3. Update habits

*Created by JARVIS Digest*
`;

    await app.vault.create(digestPath, content);
    new Notice("JARVIS ✓ digest created");

  } catch (error) {
    new Notice("Error: " + error.message);
  }
})();
