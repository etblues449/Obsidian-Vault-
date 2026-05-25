#!/usr/bin/env node
/*
 * install-claude-commands.js
 *
 * Propagates the slash-command framework (defined in .claude-commands.json)
 * into another repo's .claude/commands/ directory so the commands are
 * available wherever Claude Code runs against that repo (CLI, web, mobile,
 * desktop).
 *
 * Slash commands in Claude Code are Markdown files, not runtime handlers, so
 * "installing" them just means copying those .md files into the target repo.
 *
 * Usage:
 *   node scripts/install-claude-commands.js [targetRepoPath] [options]
 *
 * Arguments:
 *   targetRepoPath   Repo to install into. Defaults to the current directory.
 *
 * Options:
 *   --list           List the commands in the manifest and exit.
 *   --force          Overwrite command files that already exist in the target.
 *   --dry-run        Show what would happen without writing anything.
 *   --help           Show this help.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FRAMEWORK_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(FRAMEWORK_ROOT, '.claude-commands.json');

function fail(msg) {
  console.error(`\x1b[31merror:\x1b[0m ${msg}`);
  process.exit(1);
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    fail(`manifest not found at ${MANIFEST_PATH}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (e) {
    fail(`could not parse ${MANIFEST_PATH}: ${e.message}`);
  }
  if (!Array.isArray(manifest.commands) || manifest.commands.length === 0) {
    fail('manifest has no "commands" array');
  }
  return manifest;
}

function parseArgs(argv) {
  const opts = { target: null, list: false, force: false, dryRun: false, help: false };
  for (const arg of argv) {
    switch (arg) {
      case '--list': opts.list = true; break;
      case '--force': opts.force = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--help': case '-h': opts.help = true; break;
      default:
        if (arg.startsWith('--')) fail(`unknown option: ${arg}`);
        else if (opts.target === null) opts.target = arg;
        else fail(`unexpected argument: ${arg}`);
    }
  }
  return opts;
}

function printHelp(manifest) {
  console.log(`${manifest.name} v${manifest.version}`);
  console.log(manifest.description);
  console.log('\nUsage: node scripts/install-claude-commands.js [targetRepoPath] [--list] [--force] [--dry-run]\n');
}

function printList(manifest) {
  console.log(`Commands in ${manifest.name} v${manifest.version}:\n`);
  for (const cmd of manifest.commands) {
    console.log(`  /${cmd.name}  ${cmd.argumentHint || ''}`);
    console.log(`      ${cmd.summary}`);
  }
}

function main() {
  const manifest = loadManifest();
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) { printHelp(manifest); return; }
  if (opts.list) { printList(manifest); return; }

  const targetRepo = path.resolve(opts.target || process.cwd());
  const sourceDir = path.join(FRAMEWORK_ROOT, manifest.commandsDir);
  const targetDir = path.join(targetRepo, manifest.commandsDir);

  if (path.resolve(sourceDir) === path.resolve(targetDir)) {
    console.log('Target is the framework repo itself — commands already live here. Nothing to do.');
    return;
  }
  if (!fs.existsSync(targetRepo)) {
    fail(`target repo path does not exist: ${targetRepo}`);
  }

  console.log(`Installing ${manifest.commands.length} commands into ${targetDir}${opts.dryRun ? '  (dry run)' : ''}\n`);

  if (!opts.dryRun) fs.mkdirSync(targetDir, { recursive: true });

  let installed = 0, skipped = 0;
  for (const cmd of manifest.commands) {
    const src = path.join(sourceDir, cmd.file);
    const dest = path.join(targetDir, cmd.file);
    if (!fs.existsSync(src)) { console.warn(`  ! /${cmd.name}: source file missing (${cmd.file}) — skipped`); skipped++; continue; }

    const exists = fs.existsSync(dest);
    if (exists && !opts.force) {
      console.log(`  = /${cmd.name}: already present — skipped (use --force to overwrite)`);
      skipped++;
      continue;
    }
    if (opts.dryRun) {
      console.log(`  + /${cmd.name}: would ${exists ? 'overwrite' : 'create'} ${cmd.file}`);
      installed++;
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log(`  + /${cmd.name}: ${exists ? 'overwritten' : 'installed'} ${cmd.file}`);
    installed++;
  }

  // Ensure a plans directory exists for /ultraplan output.
  const plansDir = path.join(targetRepo, '.claude', 'plans');
  if (!opts.dryRun && !fs.existsSync(plansDir)) {
    fs.mkdirSync(plansDir, { recursive: true });
    fs.writeFileSync(path.join(plansDir, '.gitkeep'), '');
  }

  console.log(`\nDone. ${installed} installed/updated, ${skipped} skipped.`);
  if (!opts.dryRun) {
    console.log('Commit .claude/commands/ in the target repo so the commands travel with it.');
  }
}

main();
