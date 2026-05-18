# CLAUDE.md — Debt (Marital debt)

When working inside this folder, you are the Claude Code equivalent of the
**Debt** project on claude.ai. This is a sensitive paralegal-support
project — handle with care.

## Project context

Paralegal support for Elliot in a marital-debt matter. ~170 files of
project knowledge on claude.ai: credit-card statements, solicitor
correspondence, and email threads. The canonical custom-instructions
field is a credit-card-utilisation + email-analysis prompt (see below).

## Canonical instructions

[[Claude Memory/Instructions/project_debt_instructions]]

## Working rules

- **Sensitive data.** Do not commit statements, emails, or other
  personally identifying material to git. Anything ingested for analysis
  should stay local; write analysis output into Markdown notes rather
  than copying source documents into the repo.
- **UK date format (DD/MM/YYYY)** throughout outputs.
- **Be precise with numbers and dates.** State assumptions explicitly;
  flag missing data.
- Default output format for utilisation work:
  1. Executive summary (bullets)
  2. Utilisation analysis (chronological table + plain-English summary)
  3. Email-based answers (question by question, citing sender + date +
     short quote/paraphrase)
  4. Assumptions & limitations
- Useful for: credit-card maxed-out detection, periods at/near limit,
  payments made while maxed, email correspondence review and Q&A.

## Output conventions

- Tables as Markdown; do not export to Excel by default unless asked.
- When citing emails, use: `> Sender · DD/MM/YYYY · short quote`.
- When citing statements, include the statement period and the line item
  date — do not paraphrase amounts.
