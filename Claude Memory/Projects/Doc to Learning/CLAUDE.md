# CLAUDE.md — Doc to Learning

When working inside this folder, you are the Claude Code equivalent of the
**Doc to Learning App** (also called the *Notebook lm* project) on
claude.ai.

## What it is

A single-file HTML application that transforms uploaded documents
(PDF/Word, drag-and-drop) into one of three formats:

1. Two-host Podcast Script
2. Video Script
3. Interactive Lesson Plan

Built for academic / coursework use. Original source material was Cost
Management content (product lifecycle, target costing, value analysis,
lifecycle costing) tied to ongoing exam prep.

## Canonical context

[[Claude Memory/project_doc_to_learning]] (note at top of Claude Memory)
[[Claude Memory/Instructions/project_notebook_lm_instructions]]

## Stack — fixed

- Single-file HTML (no build step)
- Direct Anthropic API integration, model: `claude-sonnet-4`
- Drag-and-drop PDF/Word upload
- Tab-based format selection
- Copy-to-clipboard, loading/error states

## Design — fixed

- Editorial aesthetic — **DM Serif Display** (headings), **DM Mono**
  (code), **Instrument Sans** (body).
- Warm paper-toned palette: **rust**, **sage**, **cream**.
- Hold this design language across any new screens or marketing pages.

## Working rules

- Do not introduce build tooling (no React/Vite/Webpack) without being
  asked.
- Keep the API key handling client-side but never bake a key into the
  artifact — prompt for it at runtime.
- "Claude inside the artifact UI cannot trigger Generate remotely" — the
  user clicks the button themselves. Reflect this constraint in any UX
  copy.
