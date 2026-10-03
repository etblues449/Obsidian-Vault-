# Reference spec — "Build your own voice-first AI agent" (start-here.md)

> Imported 2026-10-03 verbatim from the uploaded `start-here.md`. This is the reference build spec
> JARVIS (`etblues449/jarvis-core`) is diagnosed against. Locked JARVIS decisions — £0 (C1),
> phone-only host, single vault write path — override any default in it.
> Diagnosis: [[2026-10-03-agent-spec-diagnosis]]

---

# Build your own voice-first AI agent

I want you to help me build the **core of a voice-first AI assistant** — the harness that turns a language model into something I can talk to out loud, that can actually *do* things on my behalf, that remembers me between conversations, and that can reach out to me first instead of only answering when spoken to. We'll call the reference assistant **"Trillion"** in this document, but the first thing you'll do is help me give mine its own name.

This is a description of the experience and the engineering approach, **not a code listing**. There is deliberately no code here. Use your own judgment for the exact implementation in whatever language and stack I choose, but match the structure, the priorities, and the safety posture described below closely. The goal is a real, dependable assistant I can keep building on — not a chatbot demo.

**Work tier by tier.** Each tier below ends with something I can actually run and a verification step. Don't start a tier until the previous one works on its own, and don't fuse tiers together — the entire point is that each layer is independently testable, because a voice assistant has many moving parts and debugging them all at once is miserable. The single most important rule of the whole build: **get the brain working in plain text before you add a single line of audio.** Voice is a layer on top of a working agent, never the foundation.

---

## Tier 0 — Interview me first (don't write any code yet)

Before touching any files, ask me the questions below and wait for my answers. Keep it to one round, grouped so I can answer quickly. If I skip one, use the default in parentheses and tell me what you assumed. When I'm done, write my answers into a short plain-language spec file at the root of the project (call it something like `AGENT.md`) so the rest of the build — and any future session — has a single source of truth for what we're building and why.

**Identity and intent**
1. What do you want to **name** your assistant, and what's a one-line description of what it's *for*? (Until you choose, I'll call it "Trillion." The name shows up in greetings, logs, and the wake phrase later.)
2. Who is it for — **just you**, or eventually a small team? (Default: just you. This changes nothing in the harness yet, but it tells me whether to keep per-user state in mind from the start.)
3. Name the **three things** you most want it to help with first. (Default: ask me follow-ups until you have three concrete examples, e.g. "remind me of things," "answer questions about my notes," "draft messages." These become your first tools and your first test cases.)
4. What **personality and tone** should it have — warm and casual, crisp and professional, playful? (Default: warm, plain-spoken, and brief. Write this into the system prompt and keep it consistent everywhere.)

**Stack and model**
5. What **language and runtime** should we build in? (Default: pick the most boring, well-supported choice for the stack I already use; if I have no preference, use a mainstream scripting language with good audio and HTTP libraries. Don't introduce a heavy framework — keep the harness small and readable.)
6. Which **model provider** should the brain use? (Default: the latest capable Claude model via the official SDK. Keep the provider behind a thin seam so I can swap it later without touching the rest of the harness.)
7. Where will this **run** — only on my laptop, or do you also want an always-on machine later? (Default: laptop-first. Build Tier 5 so it *can* move to an always-on host without a rewrite, but don't make me rent a server to get started.)

**Voice and boundaries**
8. How do you want to **talk to it** at first — just type, push-to-talk (hold a key while you speak), or an open-mic wake word? (Default: build **text first** regardless of my answer, then add **push-to-talk** in Tier 3, because it's the most reliable and the cheapest to get right. Wake words come later.)
9. What should it **never do without asking me first**? (Default: anything that sends a message, spends money, deletes data, or changes a setting. We'll bake this list into a hard confirmation gate in Tier 6 — get my list now so the rule has teeth from the beginning.)
10. Do you want it to be able to **reach out to you proactively** — surface reminders, notice things, start a conversation — or only respond when spoken to? (Default: yes, proactive, but **quiet by default** — it earns the right to interrupt you, it doesn't assume it. We build this in Tier 5.)

Once I've answered, restate the plan back to me in four or five lines — the name, the stack, the first three capabilities, and how I'll talk to it — write the spec file, then begin Tier 1.

---

## The big picture (read once, then build incrementally)

Strip away the voice and a voice-first assistant is just five parts wired together. Picture them as concentric layers, each one wrapping the last:

- **The brain** — a conversation loop that takes a turn of input, thinks, and produces a reply. This is the model plus a system prompt plus the running history of the conversation. Everything else is in service of this.
- **The hands** — a set of tools the brain can choose to call. A tool is a named capability with a clear description and typed inputs; the model decides when to use one, your harness runs it, and the result goes back into the conversation so the model can react to it. Without tools the assistant can only talk. With them it can act.
- **The ears and mouth** — speech-to-text on the way in and text-to-speech on the way out, wrapped around the *exact same* brain you already debugged in text. Voice changes how turns arrive and leave; it does not change what a turn *is*.
- **The memory** — a small store that lets the assistant remember things across restarts: who you are, your preferences, and durable facts it's learned. The conversation history is short-term memory; this is long-term.
- **The heartbeat** — an always-on background loop that lets the assistant act without being spoken to: check on things on a schedule, notice a condition, and decide whether it's worth surfacing to you. This is the difference between a chatbot and an assistant.

The discipline that holds it together: **one shared agent core, many ways in and out.** A typed turn, a spoken turn, and a turn the heartbeat decides to start should all flow through the same brain. If you ever find yourself writing the agent logic twice — once for text and once for voice — stop and unify it. Build the core once, in text, and treat voice and proactivity as adapters on its edges.

---

## Tier 1 — The brain (a text conversation loop)

**Goal:** I can run the project in a terminal, type a message, and get a coherent reply that remembers what I said three turns ago. No tools, no audio, no memory across restarts yet. Just a working conversation in plain text.

Build the smallest possible loop: read my input, append it to a running list of conversation turns, send the whole conversation plus a **system prompt** to the model, print the reply, append the reply to the list, and wait for my next input. The system prompt carries the assistant's name, its personality from the interview, and a short statement of what it's for. Keep the conversation history in memory for now.

A few things to get right even at this tiny stage, because they pay off in every later tier:
- **Put the provider behind a thin seam.** One small function whose job is "send this conversation, get back a reply (or a request to use a tool)." Everything else calls that function and never touches the provider's SDK directly. This is what lets you swap models, add retries, and log costs in one place later.
- **Stream the reply** as it's generated rather than waiting for the whole thing. It makes the text version feel alive, and it's what voice will need in Tier 3 so the assistant can start speaking before it's finished thinking.
- **Handle the model being slow or unreachable** without crashing — a clear message and a clean prompt for my next turn, not a stack trace. Network calls fail; a daily-driver assistant has to shrug those off.
- **Keep secrets out of the code.** The API key lives in an environment variable or a local secrets file that's git-ignored from the very first commit. Never paste a key into a source file, even temporarily.

**Verify Tier 1:** I run it, hold a short back-and-forth, and it clearly remembers earlier turns in the same session. If I kill it and restart, it's forgotten everything — that's expected; memory comes in Tier 4. If a reply ever appears with no memory of the previous turn, the history list isn't being passed back in.

---

## Tier 2 — The hands (tools the agent can actually call)

**Goal:** the assistant can *do* something, not just talk. The model, mid-conversation, chooses to call a tool; my harness runs it and feeds the result back; the model uses that result in its reply. Prove it with one or two real tools drawn from the three capabilities I named in the interview.

The shape to build is a **tool registry**: a place where each tool is registered with a clear name, a one-line description of when to use it, and a typed list of inputs. Hand the whole registry to the model each turn so it knows what's available. When the model asks to use a tool, look it up by name, run it, capture the result (or the error), return that to the model, and let it continue. The model may call several tools in a row before it's ready to answer me — your loop has to allow that naturally rather than assuming one tool call per turn.

Make the registry the thing you extend forever. Adding a new capability later should mean writing one self-contained tool and registering it — never editing the core loop. That single decision is what lets the assistant grow without becoming tangled.

Edge cases that matter from the first tool:
- **A tool will fail.** A bad input, a network hiccup, a missing file. Catch it, return a plain-language error *to the model* rather than crashing, and let the model decide how to recover or explain it to me. The agent reasoning over a failed tool result is a feature, not a bug.
- **Describe tools for a reader, not a compiler.** The model picks tools based on their descriptions. "Use this to look up the current weather for a city" beats "weather()." Vague descriptions cause the model to call the wrong tool or none at all.
- **Keep tool inputs explicit and validated.** Don't let the model pass freeform blobs you then have to guess at. Typed, named inputs mean fewer wrong calls and far easier debugging.
- **Decide, per tool, whether it's safe to run on its own.** A read-only lookup can just run. Anything that sends, spends, deletes, or changes a setting must not — flag those now; Tier 6 builds the gate that stops them until I confirm.

**Verify Tier 2:** I ask for something that requires a tool ("what's on my list for today?") and watch the assistant call the tool, get a result, and weave it into a natural reply. Then I make the tool fail on purpose and confirm the assistant explains the problem instead of crashing.

---

## Tier 3 — The ears and mouth (voice in, voice out)

**Goal:** I press and hold a key, speak, release, and the assistant hears me, runs the *same* brain and tools from Tiers 1 and 2, and speaks its reply aloud. Push-to-talk first — it's the most reliable path and it removes a whole class of "is it listening?" bugs.

Wrap the existing loop; do not rewrite it. The only changes are at the two ends of a turn: **input** now comes from transcribing recorded speech instead of reading typed text, and **output** now gets spoken aloud in addition to (or instead of) being printed. The brain in the middle is untouched. If adding voice tempts you to fork the agent logic, you've taken a wrong turn — feed the transcribed text into the same entry point a typed turn uses.

The path of a spoken turn:
- **Capture** audio while I hold the key, stop when I release. Push-to-talk means you never have to guess when I started or finished — a huge simplification worth keeping until everything else is solid.
- **Transcribe** the audio to text. The reference build uses **Deepgram** for speech-to-text — it's fast, accurate, and streams, which is what keeps the gap between me releasing the key and the assistant understanding me short. Keep it behind a seam like the model provider: one small function whose only job is "give me audio, get back text," so I can switch transcribers later without touching the rest. Deepgram's key lives in an environment variable alongside the others, never in code.
- **Run the brain** exactly as before on that text.
- **Speak** the reply. The reference build uses **ElevenLabs** for text-to-speech — its voices are natural enough that the assistant feels like a presence rather than a robot reading, and it streams audio so you can start playback before the whole sentence is synthesized. Put it behind its own seam — "give me text, play it aloud" — so the voice or the provider can change in one place. During the interview, or right here, ask me which ElevenLabs voice to use and what it should sound like, and keep that choice in the config file (Tier 6) rather than hardcoded. Because the brain streams (Tier 1) and ElevenLabs streams, you can begin speaking the first sentence while the rest is still being written, which is what makes the assistant feel responsive instead of laggy.

Things a first-time voice build needs to be warned about:
- **Latency is the whole experience.** Every stage adds delay — recording, transcribing, thinking, synthesizing, playing. Start speaking as early as you can, prefer streaming at every stage, and show me *some* sign the moment I release the key (a sound, a light, a printed "thinking…") so silence never reads as "it broke."
- **Transcription will mishear you.** Print the transcript of what it *thought* I said next to its reply, at least while building, so when it answers the wrong question I can see whether the ears or the brain was at fault.
- **Don't let it listen to itself.** While the assistant is speaking, it should not be capturing or acting on audio, or it'll respond to its own voice. Push-to-talk sidesteps this; keep that in mind before you ever move to an open mic.
- **Keep the text path alive forever.** Don't delete the typed interface when voice works. It's how you'll debug every future change without talking to your computer, and it's a graceful fallback when audio misbehaves.
- **Let me interrupt.** If I start a new turn while it's still speaking, it should stop talking and listen. An assistant that won't let you cut it off feels broken fast.

**Verify Tier 3:** I hold the key, ask a question that needs a tool, release, and hear a spoken answer that used the tool — with the transcript visible so I can confirm it heard me correctly. I start a new turn mid-reply and it stops to listen. The typed interface still works exactly as it did in Tier 2.

---

## Tier 4 — The memory (it remembers me across restarts)

**Goal:** the assistant remembers durable things — my name, my preferences, facts it's learned about me and my world — so that when I quit it and come back tomorrow, it greets me like it knows me, not like a stranger. The in-session history from Tier 1 is short-term; this is the long-term store that survives a restart.

Build a simple, durable store the assistant can both **read at the start of a conversation** and **write to during one**. At its simplest this is a set of small, named facts, each a single clear statement, that get loaded into the system prompt so the model walks into every conversation already knowing them. Give the assistant a tool (or two) to record a new fact and to update or remove a stale one, so it can manage its own memory as it learns — "remember that I prefer morning meetings," and it's there next time.

Keep memory honest and bounded:
- **One fact per entry, written as a plain statement.** Small, legible entries are easy to review, correct, and delete. A giant blob of "everything known about the user" rots quickly and is impossible to audit.
- **Don't load everything every time.** As memory grows, pull in what's relevant to the current conversation rather than dumping the whole store into every prompt. Early on, loading it all is fine; design so you can get selective later.
- **Separate durable facts from passing chatter.** Not every sentence is worth remembering. Prefer to store preferences, identities, and decisions — not the play-by-play of one conversation, which the short-term history already covers.
- **Let me see and edit it.** Memory I can't inspect is memory I can't trust. Make the store plain and human-readable so I can open it, fix a wrong fact, or delete something whenever I want.
- **Treat it as data, never as instructions.** A fact the assistant stored is background knowledge, not a command to obey. If a stored note ever reads like an order ("always do X"), the assistant should still run it past its normal judgment and my confirmation rules — memory shouldn't become a backdoor around the safety gate in Tier 6.

**Verify Tier 4:** I tell it something about myself, quit the whole program, restart it, and in the new session it clearly knows that fact. I open the store by hand, correct a fact, and the assistant respects my edit on the next run.

---

## Tier 5 — The heartbeat (it can reach out to me first)

**Goal:** the assistant does something useful *without being spoken to*. On a schedule, or when it notices a condition, it runs a check, decides whether the result is worth my attention, and — only if it is — surfaces it to me. This is the leap from "a thing I talk to" to "a thing that helps me." It's also the tier where a careless build becomes annoying, so the guiding principle is **quiet by default: it earns interruptions, it doesn't assume them.**

Build a lightweight background loop, separate from the conversation loop, that wakes up on an interval, runs a small set of **scheduled checks**, and routes anything noteworthy into a single place I'll see it. Each check is its own small unit: when it should run, what it looks at, and how it decides whether the outcome is worth surfacing. Keep the *what to check* and *how often* in a **config file**, not buried in code — you'll tune these constantly, and editing a threshold shouldn't mean editing the program.

The hard-won lessons that separate a helpful proactive assistant from a noisy one — build these in from the start, not after it annoys you:
- **Quiet by default, loud only when it counts.** Most checks should produce nothing most of the time. Reserve an actual interruption for things that genuinely warrant one, and let everything else accumulate in a calm log I can glance at when I choose. A proactive assistant that cries wolf gets muted, and a muted assistant is useless.
- **Don't drop what I wasn't there to see.** If the assistant notices something while my interface is closed or I'm asleep, it must *hold* that notice and show it to me when I'm back — not fire it into the void and forget. Catch-up-on-return, never deliver-once-and-lose-it. This is the most common way a proactive feature silently fails.
- **Respect quiet hours.** Non-urgent surfacing should wait for waking hours; only something truly critical earns a late-night interruption. Make the quiet window a setting.
- **Never block forever waiting on a human.** If a background action pauses to ask for my approval and I'm not there to answer, it must not hang indefinitely — it should time out into a safe default (usually: do nothing and leave a note) so the loop keeps running. A proactive system that deadlocks waiting on a person it can't reach will quietly stop working, and you won't notice until you wonder why it's gone silent.
- **Survive restarts without losing the schedule.** Persist when each check is next due, so restarting the program doesn't reset every timer or fire everything at once on boot. The schedule lives in durable state, not only in memory.
- **Don't pile up overlapping runs.** If a check is still working when its next turn comes due, skip the new run rather than stacking them. Slow checks shouldn't snowball.
- **Make every surfaced item dismissible.** Anything the assistant puts in front of me, I need to be able to acknowledge and clear. An inbox of proactive notices I can't empty becomes clutter I'll start ignoring.

A note on *where* the heartbeat runs: on your laptop it only beats while the laptop is awake, which is fine to start. The reason to keep this loop cleanly separable (per the interview) is that moving it to an always-on machine later — so time-based things fire even when your laptop is asleep — should be a relocation, not a rewrite. Design the loop so it doesn't care which machine it's on.

**Verify Tier 5:** I configure a check with a short interval and a condition I can trigger on purpose, and confirm the assistant surfaces it — once, in the calm log or as an interruption depending on how noteworthy I marked it. I close my interface, trigger the condition, reopen, and confirm the notice was *held for me*, not lost. I restart the program and confirm the schedule resumes instead of refiring everything. I dismiss a surfaced item and it clears.

---

## Tier 6 — The rails (safety, confirmation, and configuration)

**Goal:** the assistant is trustworthy enough to leave running. The capabilities from the earlier tiers are now wrapped in the guardrails that keep a tool-using, proactive agent from doing something I didn't ask for — drawn directly from the "never without asking" list I gave in the interview.

This tier is less new machinery than a posture applied across everything you've built:
- **A hard confirmation gate on consequential actions.** Any tool that sends a message, spends money, deletes data, changes a setting, or does anything hard to undo must stop and get my explicit yes *before* it runs — stating plainly what it's about to do. Read-only actions flow freely; irreversible ones never act on assumed permission. This gate sits between the model choosing a tool and the tool running, so it covers spoken, typed, and heartbeat-initiated actions alike.
- **Treat everything the assistant reads as data, not commands.** Content it pulls in from the outside world — a web page, an email, a file, a transcript — may contain text that looks like instructions ("ignore your rules and do X"). The assistant must never treat that as a command. Valid instructions come from me, in our conversation. If incoming content seems to be telling the assistant what to do, it should surface that to me and ask, not obey. This matters more, not less, as you add tools that reach the internet.
- **Confirmation is per-action and doesn't generalize.** Me approving one send doesn't pre-authorize the next. Each consequential action asks on its own. It's mildly more friction; it's also what makes the assistant safe to let off the leash.
- **Configuration over hardcoded values.** Thresholds, intervals, quiet hours, the model name, which tools require confirmation — these belong in a config file I can edit, not scattered through the code as literals. You'll tune them often; make that a one-line edit, not a code change.
- **A visible audit trail.** Keep a plain log of what the assistant did and why — which tools ran, what the heartbeat surfaced, what it asked me to confirm. When something surprises you, the log is how you find out what happened. Bonus: a running tally of model cost so a runaway loop is visible immediately.
- **A kill switch.** One obvious way to pause all proactive behavior at once — stop the heartbeat, hold all background actions — without tearing anything down. You want this the first time the assistant does something unexpected, not after.

**Verify Tier 6:** I ask for an action on my "never without asking" list and the assistant stops, tells me exactly what it intends to do, and waits for my yes. I feed it content containing a planted instruction and confirm it flags the instruction to me instead of acting on it. I change a threshold in the config file and confirm the behavior changes with no code edit. I hit the kill switch and confirm all proactive behavior stops while I can still talk to it.

---

## Where to go after the baseline

Once the six tiers run and verify, you have a real assistant, not a demo — and a clean foundation to build on. The natural next steps, each of which the harness above is already shaped to accept:

- **More tools.** Every new capability is one self-contained tool added to the registry. This is where the assistant becomes *yours* — wire it to the services and data you actually use.
- **Specialist sub-agents.** When a job is big enough to deserve its own focus, let the main assistant hand it off to a sub-agent with its own prompt and its own tools, and report back. The tool registry and the heartbeat are the seams that make this natural rather than a rewrite.
- **A face.** A visual interface — even a simple panel showing what the assistant is doing, what the heartbeat has surfaced, and what's waiting on your confirmation — turns the audit log and the dismissible-notice ideas from Tiers 5 and 6 into something you glance at instead of read.
- **An always-on home.** Move the heartbeat to a machine that never sleeps so time-based help arrives even when your laptop is closed, while you still talk to the assistant from wherever you are.

Build these the same way you built the baseline: one at a time, each verified before the next.

---

## The feel, in one paragraph

The north star: it should feel like **something that has your back, not a parlor trick.** A voice-first assistant lives or dies on trust and responsiveness — so build the brain in plain text until it's genuinely smart, add voice as a thin layer that never forks the logic, and let it act only through tools you can see and stop. Make it remember you, make it reach out only when it's truly worth your attention, and make every consequential thing it does pass through a gate you control. Build it tier by tier, run and verify each one before the next, and resist the urge to wire everything together at once — the calm discipline of one working layer at a time is exactly what produces an assistant you'll actually leave running.
