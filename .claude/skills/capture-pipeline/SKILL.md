---
name: capture-pipeline
description: >-
  Work on the JARVIS capture path — Tasker tasks, Termux:Widget shortcuts, the capture
  webhook/router, classification rules, junk filtering, and the event-driven skills 2/5/7
  (capture processor, #belief tracker, #decision intelligence). Use for empty or placeholder
  captures, notes that never arrive in the vault, routing to the wrong folder, adding a capture
  category, and migrating capture off paid n8n onto a £0 GitHub-push router. Also use when
  re-fixing a capture bug that came back. NOT for building Android apps (that is
  android-development) — this is about getting a thought from the Fold 7 into the vault intact.
when_to_use: >-
  Trigger on: capture didn't arrive, empty or placeholder capture, note went to the wrong
  folder, Tasker variable not reaching the webhook, add a capture category, retire the paid n8n
  webhook, the capture bug came back. Do NOT trigger for building an Android application — that
  is android-development. This is about a thought reaching the vault intact.
---

# Capture pipeline

Capture is the highest-frequency path in JARVIS and the first thing anyone notices
breaking. It has three legs, and every change must state which leg it touched:

```
phone  →  transport  →  vault
Tasker    webhook /     JARVIS/Inbox/ → classified folder
Widget    router
voice
```

A change with an unstated leg is where regressions hide. Read `vault-conventions` for
destination paths and the write path.

## The failure mode that matters

A capture that fires and posts placeholder text (`"your note here"`) **reports success
while carrying nothing**. The phone says "captured", the webhook returns 200, a file
appears. Nothing is wrong except the content. This has happened at least three times on
the "Ask JARVIS" shortcut — the Tasker input variable is not reaching the HTTP Request
body.

Treat silent success as severity-1, above anything that visibly errors. A user who sees
an error re-captures. A user who sees "captured" does not.

## Diagnosing a capture failure

Work the legs in order — do not guess:

1. **Phone.** Does the variable hold the text at the moment of the HTTP action? Log it
   to a Flash/notification immediately before the request. Tasker variable scope is the
   usual culprit, not the network.
2. **Transport.** Capture the actual request body server-side. Compare byte-for-byte
   with what the phone believed it sent.
3. **Vault.** Did the note land at the expected path, with the expected front-matter?

Only after locating the leg do you change anything.

## Rules

- **A junk filter is a second line of defence, never the fix.** Filter empty bodies,
  whitespace-only text, and known placeholder strings — *and* repair the source. Shipping
  only the filter converts a visible bug into an invisible one.
- **Fail loud on the phone.** A rejected capture must produce speech or a notification.
  A silent drop is worse than an error, because the thought is gone and Jelly Bean
  believes it was saved.
- **Idempotence.** Key on `(timestamp, hash-of-text)` so a retry cannot duplicate.
- **Never drop an unclassifiable capture.** Unknown category routes to `JARVIS/Inbox/`
  and flags the gap. Losing a capture is the one unrecoverable outcome here.
- **Classification is a written rule set.** If you cannot state the rule that routed a
  note, the rule is unmaintainable. Keep the table in this repo, not in a prompt.
- **Never write to `master` directly.** Hand routed notes to the vault keeper's single
  write path. A second automated committer is what corrupted this vault before.
- **A destination folder must exist before the rule that targets it ships.**

## The £0 constraint (C1)

Capture currently posts to `https://jellybean1875.app.n8n.cloud/webhook/jarvis-capture`,
which is a paid dependency. The migration target is a GitHub `on: push` router, designed
in `Assistant Core/jarvis-skills/MIGRATION.md` → "Phase 2", not yet built.

When evaluating any component, "free tier" usually means trial credits. Vapi, Retell,
LiveKit Cloud, Deepgram and ElevenLabs are trial credits. Browser Web Speech API and
Groq's free tier are genuinely free. Twilio UK numbers require a regulatory compliance
bundle and are not a viable free path.

If a proposal introduces cost, stop and surface the C1 violation before building.

## Every pipeline change ships with three things

```
1. The changed component, rewritten in full
   (Tasker task export / router source / workflow YAML)
2. A test that fails on the old behaviour and passes on the new
3. A one-line manual verification runnable on the Fold 7
```

Two of three is an incomplete change.

## Re-running

If the same defect is reported twice after a shipped fix, **do not re-apply the same
fix**. A repeated symptom after a fix means the diagnosis was wrong — go back to leg
isolation. Read the previous rule table before proposing a new rule; routing rules
accumulate and quietly contradict each other.

## Gotchas

- **Placeholder text returns HTTP 200.** A capture carrying `"your note here"` succeeds at
  every layer: the phone confirms, the webhook returns 200, a file appears. Status codes
  prove transport, never content.
- **It is almost never the network.** Tasker variable scope at the moment of the HTTP
  action is the usual cause. Log the variable immediately before the request.
- **A junk filter hides the bug it appears to fix.** Ship the filter *and* the source fix,
  or you have converted a visible defect into an invisible one.
- **"Free tier" usually means trial credits.** Vapi, Retell, LiveKit Cloud, Deepgram and
  ElevenLabs are credits. Browser Web Speech API and Groq's free tier are genuinely free.
  Twilio UK numbers need a regulatory compliance bundle.
- **A dropped capture is unrecoverable.** Route anything unclassifiable to `JARVIS/Inbox/`
  and flag it. Never discard.
