```markdown
# Obsidian-Vault- Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill documents the core development patterns, coding conventions, and automation workflows used in the `Obsidian-Vault-` repository. The codebase is primarily JavaScript (no framework), with a focus on automation, smart home diagnostics, and skill engine workflows for the JARVIS assistant. It emphasizes modularity, reproducible workflows, and clear documentation, supporting both manual and automated processes.

---

## Coding Conventions

**File Naming**

- Use `camelCase` for JavaScript files and scripts.
  - Example: `runner.mjs`, `localTest.mjs`
- Markdown and YAML files follow descriptive, lowercase, or kebab-case naming.
  - Example: `capture-router-log.md`, `jellybean-dashboard.yaml`

**Import Style**

- Use relative imports in JavaScript modules.
  ```js
  import { runSkill } from './runner.mjs';
  ```

**Export Style**

- Mixed: both named and default exports are present.
  ```js
  // Named export
  export function runSkill() { ... }

  // Default export
  export default SkillEngine;
  ```

**Commit Patterns**

- Freeform messages, often prefixed with `jarvis` or `fix`.
  - Example: `jarvis: add morning brief workflow`
  - Example: `fix: dashboard entity typo`
- Average commit message length: ~57 characters.

---

## Workflows

### Add or Update JARVIS Skill or Skill Engine
**Trigger:** When adding a new skill, fixing the skill engine, or updating scheduled skill workflows.  
**Command:** `/add-skill`

1. Edit or add workflow YAMLs in `.github/workflows/jarvis-*-*.yml` (one per skill or engine).
2. Edit or add `Assistant Core/jarvis-skills/runner.mjs`.
3. Update `Assistant Core/jarvis-skills/README.md` and/or `MIGRATION.md`.
4. Edit or add tests in `Assistant Core/jarvis-skills/test/local-test.mjs`.
5. Update or create skill documentation in `.claude/skills/*/SKILL.md`.
6. Update memory/log files (e.g., `Claude Memory/Account/capture-router-log.md`, `beliefs.md`, `capture_queue.md`).
7. Run engine tests and verify with drift-check/verify-refs.

**Example:**
```bash
# Add a new skill workflow
cp .github/workflows/jarvis-1-morning-brief.yml .github/workflows/jarvis-new-skill.yml
# Update runner
vim Assistant\ Core/jarvis-skills/runner.mjs
# Run tests
node Assistant\ Core/jarvis-skills/test/local-test.mjs
```

---

### Smart Home Project Diagnostics and Dashboard Update
**Trigger:** When new devices are added, diagnostics are run, or dashboards/hardware configs need correction.  
**Command:** `/run-diagnostics`

1. Run or update diagnostic scripts (`Assistant Core/ha-diagnostics/ha-doctor.mjs`).
2. Update or create diagnostic output files (`Claude Memory/Projects/Smart Home/diagnostics/*.md`).
3. Edit or update dashboard YAMLs (`jellybean-dashboard*.yaml`, `theme.yaml`).
4. Update master plan and index (`_index.md`, `MASTER_PLAN.md`).
5. Update or add hardware guides (`hardware/*.md`, `hardware/*.yaml`).
6. Reconcile findings in `capture_queue.md` and session notes.
7. Propagate canonical device/entity decisions across relevant files.

**Example:**
```bash
node Assistant\ Core/ha-diagnostics/ha-doctor.mjs > Claude\ Memory/Projects/Smart\ Home/diagnostics/2024-06-10.md
vim Claude\ Memory/Projects/Smart\ Home/dashboard/jellybean-dashboard.yaml
```

---

### Merge Pull Request (Smart Home or Skill)
**Trigger:** When merging a feature/fix PR for Smart Home or JARVIS skills.  
**Command:** `/merge-pr`

1. Merge PR affecting Smart Home or skill engine files.
2. Immediately follow up with a commit updating index, dashboard, or `capture_queue.md` to reflect canonical decisions or correct minor issues.
3. Update session notes and runbooks as needed.

---

### Android Client or Skill Framework Integration
**Trigger:** When starting or integrating a new Android client or skill framework.  
**Command:** `/scaffold-android-client`

1. Add or update `.claude/skills/android-development`.
2. Scaffold or update `jarvis-android/*` project structure (app, core/*, feature/*, gradle configs).
3. Add or update Gradle files (`build.gradle.kts`, `settings.gradle.kts`, `libs.versions.toml`).
4. Add sample implementation files (e.g., `CaptureUiState`, `CaptureNavigation`).
5. Update or create `jarvis-android/README.md`.

---

### Recover Deleted Files After Obsidian Git Sync
**Trigger:** When a sync from Obsidian (Jarvis) deletes files due to a stale working copy.  
**Command:** `/recover-sync-deletes`

1. Detect file deletions in a 'Sync from Obsidian' commit (notably `.github/workflows/*.yml`, manifest, setup scripts, `.gitignore`).
2. Restore deleted files from a good branch or backup.
3. Reconcile any conflicts (keep modifications, discard deletions).
4. Document the recurrence and update `CLAUDE.md` or change history.

---

### State-of-System or Audit Note Update
**Trigger:** When verifying system health, reconciling documentation with reality, or after a major incident.  
**Command:** `/audit-system`

1. Create or update `Claude Memory/202*-*-*-jarvis-state-of-the-system.md` or similar audit notes.
2. Update `capture_queue.md` and `beliefs.md` with findings.
3. Edit or update `CLAUDE.md` with change history and reconciled rules.
4. Update `Smart Home/_index.md` or related project indices.

---

## Testing Patterns

- Test files follow the `*.test.*` pattern (e.g., `local-test.mjs`).
- The testing framework is not explicitly specified; tests are typically run via Node.js scripts.
- Example test invocation:
  ```bash
  node Assistant\ Core/jarvis-skills/test/local-test.mjs
  ```
- Tests are updated alongside workflow or skill changes.

---

## Commands

| Command                | Purpose                                                        |
|------------------------|----------------------------------------------------------------|
| /add-skill             | Add or update a JARVIS skill or skill engine                  |
| /run-diagnostics       | Run diagnostics and update Smart Home dashboards               |
| /merge-pr              | Merge PR and propagate canonical decisions/fixes               |
| /scaffold-android-client | Scaffold or integrate a new Android client or skill framework |
| /recover-sync-deletes  | Recover files deleted by Obsidian sync issues                  |
| /audit-system          | Add or update state-of-system or audit notes                   |
```
