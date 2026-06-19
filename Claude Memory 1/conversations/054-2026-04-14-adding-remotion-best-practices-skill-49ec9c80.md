---
name: Adding remotion best practices skill
description: Imported Claude.ai conversation from 2026-04-14 (8 messages)
type: reference
uuid: 49ec9c80-06b5-4a8d-83a5-5108b2d74557
created_at: 2026-04-14T22:03:49.648886Z
updated_at: 2026-04-27T05:37:05.148696Z
---

# Adding remotion best practices skill

## human — 2026-04-14 22:03:50

npx skills add <https://github.com/remotion-dev/skills> --skill remotion-best-practices

## assistant — 2026-04-14 22:04:00


```
This block is not supported on your current device yet.
```

The command you've provided (`npx skills add ...`) is a CLI command meant to be run in a terminal on your computer — it's not something I can run through the browser or install into Claude directly from here.

Here's what that command actually does and what you'd need to do:

**What `npx skills add` is:** This appears to be a CLI tool for adding skill definitions to a local Claude setup (likely Claude Code or a similar local environment). It fetches a skill from a GitHub repo and registers it.

**To install it, you'd need to:**
1. Open a terminal on your computer
2. Run: `npx skills add https://github.com/remotion-dev/skills --skill remotion-best-practices`

**What I *can* do** is install skills into my container environment using `bash_tool`, but the `skills add` command installs to *your local machine's* Claude config, not to me here in the browser chat.

A couple of questions to clarify what you're after:

- Are you trying to set this up for **Claude Code** (the CLI tool) on your machine?
- Or are you looking to add a custom skill/context to our **current conversation** so I can reference Remotion best practices when helping you?

If it's the latter, I can fetch the skill content from that GitHub repo and load it into our session right now. Just let me know!

## human — 2026-04-14 22:05:08

https://github.com/remotion-dev/skills

## assistant — 2026-04-14 22:05:49

 Let me fetch the contents of that GitHub repo so I can load the skill into our session.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

The skill file is at `skills/remotion` in the repo. Let me fetch it directly.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

The skill content has been successfully fetched. Now let me save it to the skills directory so it's available in this session.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

All files downloaded successfully. Now let me read the SKILL.md into my active context so it's loaded and ready to use.
```
This block is not supported on your current device yet.
```

The **remotion-best-practices** skill is now fully loaded and active. Here's what was installed:

**✅ Skill loaded:** `remotion-best-practices` from `remotion-dev/skills`

It includes the main SKILL.md plus **35 rule files** covering:

- Project setup & Remotion Studio preview
- Animations, timing, sequencing, transitions & trimming
- Audio, video, GIFs, images, fonts & assets
- Compositions, 3D (Three.js/R3F), charts & maps
- Captions/subtitles, voiceover (ElevenLabs), FFmpeg
- Text animations, Lottie, light leaks, Tailwind
- Mediabunny utilities (frame extraction, duration, dimensions)
- And more

I'll now automatically reference this skill whenever you ask me to help with Remotion code. Go ahead and paste the next link when you're ready!

## human — 2026-04-27 05:11:27

How to use obsidian as your second brain

## assistant — 2026-04-27 05:11:41

 Obsidian works as a second brain through a few core principles:

**Capture everything, link everything**
Create notes freely and connect them with `[[wikilinks]]`. The power isn't in individual notes — it's in the web of connections between them. Over time, a knowledge graph emerges that mirrors how your mind actually thinks.

**Use the Zettelkasten method**
Keep notes atomic (one idea per note), write in your own words, and always ask "what does this connect to?" before closing a note. This forces understanding rather than passive collection.

**Folders vs. Tags vs. Links**
Don't over-organize with folders. Use a light structure like: `Inbox/`, `Notes/`, `Projects/`, `Archive/`. Let links and tags do the heavy lifting — folders are for broad buckets, not taxonomy.

**Daily Notes as your entry point**
Enable the Daily Notes plugin. Each day starts with a new note where you dump tasks, thoughts, and meeting notes. Link outward from there to permanent notes. It becomes your journal + task log + idea capture in one.

**The processing habit**
Raw capture is worthless without processing. Set aside 15–30 min to take inbox notes and turn them into linked, atomic permanent notes. This is the step most people skip — and why their second brain stays a "first draft brain."

**Plugins worth installing**
- **Dataview** — query your notes like a database (`LIST FROM #project WHERE status = "active"`)
- **Templater** — consistent note structure with dynamic fields
- **Canvas** — visual mind-mapping inside Obsidian
- **Excalidraw** — freehand diagrams linked to notes
- **Periodic Notes** — weekly/monthly review templates

**The graph view reality check**
The graph looks impressive but isn't your daily driver. What actually matters is that when you're writing a new note, related notes *surface naturally* through backlinks and searches.

**The real workflow loop:**
Capture → Process → Link → Review → Resurface

The "second brain" clicks when you open a note you wrote 6 months ago and it already links to something you're thinking about today — without you planning it that way.

## human — 2026-04-27 05:36:52

git clone https://github.com/QtheBuilder/ai-weekend-builds.git
cd ai-weekend-builds

## assistant — 2026-04-27 05:37:05

 Let me run those commands in the container.
```
This block is not supported on your current device yet.
```

The repo appears to be private — GitHub is asking for credentials. A couple of options:

1. **Make it public** on GitHub, then I can clone it directly
2. **Share the contents** by pasting the files here and I'll work with them
3. **Use a personal access token** — you'd run the clone locally with: `git clone https://YOUR_TOKEN@github.com/QtheBuilder/ai-weekend-builds.git`

Which would you prefer?
