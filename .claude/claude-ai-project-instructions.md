# claude.ai chat-app instructions (plan / execute / delegate / review)

This file is **not** a Claude Code command. The general **claude.ai chat app**
(the consumer assistant at `claude.ai`, *not* Claude Code at `claude.ai/code`)
does not read your repo, can't spawn sub-agents, and can't loop in the
background. So you can't install real `/ultraplan`-style commands there.

What you *can* do: paste the block below into a claude.ai **Project → custom
instructions** field (or your account-level custom instructions). It gives the
chat app keyword-triggered behavior that approximates this framework's
workflow, in pure-prompt form.

To use it, start a message with one of the keywords (e.g. `ULTRAPLAN: add dark
mode to the settings page`).

---8<--- copy everything below this line into the Project's custom instructions ---8<---

You support a four-stage workflow triggered by keywords at the start of my
message. Keep the stages distinct, and be honest about what you cannot verify
in this chat environment (you have no access to my repo, a shell, sub-agents,
or background execution unless I explicitly enable tools/files).

ULTRAPLAN: <goal>
  Plan only — do not write the full solution yet. Produce:
  1) the goal restated in one line, plus concrete, checkable SUCCESS CRITERIA;
  2) a brief look at approaches and the tradeoff you'd pick;
  3) an ordered checklist of steps, each with: what to do, why, and how it
     would be verified;
  4) risks and any decisions you need from me.
  End by inviting me to type GOAL to execute.

GOAL
  Execute the most recent ULTRAPLAN, step by step. For each step: do the work,
  then state how it should be verified and what you'd expect (since you can't
  run my tests yourself, tell me the exact command/output to check). Mark each
  step done and continue. Pause and ask if a step needs info only I have or a
  risky/irreversible decision. Never claim verification you didn't actually do.
  Give a short summary at the end.

AGENTS
  This chat app can't run real background agents. Instead, split the work into
  INDEPENDENT chunks and output, for each chunk, a self-contained prompt I can
  run in parallel (in separate chats, or in Claude Code). Each prompt must
  carry its own context, the files/areas it owns, and its own success check —
  no chunk should depend on another running at the same time.

ULTRAREVIEW
  Review code I provide (pasted or attached) across four lenses: correctness,
  security, tests, and style/maintainability. Output findings as a prioritized
  list — each with a severity (blocker / high / medium / nit), a location, and
  a concrete suggested fix. Then give a verdict: approve / approve with nits /
  changes requested. Review only; don't rewrite the code unless I ask.

General: prefer concrete, checkable steps over vague advice; keep planning and
execution separate; and say so plainly when something is outside what the chat
app can actually do.

---8<--- end of custom-instructions block ---8<---

## How this differs from the Claude Code version

| | Claude Code (`.claude/commands/`) | claude.ai chat app (this file) |
| --- | --- | --- |
| Trigger | real `/ultraplan` slash command | typed keyword `ULTRAPLAN:` |
| Repo access | yes — reads/writes your files | no — you paste/attach code |
| Sub-agents | real, parallel, background | simulated as prompts you run yourself |
| Verification | runs builds/tests for real | reasons + tells you what to run |
| Install | committed in repo, travels with it | manually pasted per Project, per account |
