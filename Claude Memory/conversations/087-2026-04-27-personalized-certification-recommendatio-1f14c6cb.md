---
name: Personalized certification recommendations with video extraction
description: Imported Claude.ai conversation from 2026-04-27 (26 messages)
type: reference
uuid: 1f14c6cb-2f2b-4333-a8ae-c73799747ecf
created_at: 2026-04-27T04:05:39.720631Z
updated_at: 2026-04-27T04:32:45.020247Z
---

# Personalized certification recommendations with video extraction

## human — 2026-04-27 04:05:41

Before fetching any courses, I want you to reflect on everything you know about me from our conversation history - my job, goals, skill level, and how I use AI day to day Then go to https://lanthropic.com/learn, fetch the full page, and review all 13 available certifications.
Based on what you know about me, recommend the 3 certifications that would give me the highest ROI right now - and explain in one sentence why each one fits my specific situation.
Then fetch each of those 3 course pages and extract every YouTube video URL. Return the full organised list of URLs ready to paste into NotebookLM.

## assistant — 2026-04-27 04:06:50


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Good — I now have a solid picture of you. Let me confirm my understanding before fetching courses:

**What I know about you (Jelly Bean):**
- Deep in the **Anthropic/Claude ecosystem** — built a full VS Code extension with the Claude API (streaming, code explanation, review, generation, chat)
- Actively exploring **MCP server integrations** across Claude Code, Claude Desktop, and Claude.ai
- Built and used **MCP servers** hands-on (Ruflo, Home Assistant MCP, mcp-builder)
- Running a **Home Assistant** smart home setup with real API integrations
- Interest in **content creation** for finance (faceless YouTube, scripts, blog, social)
- Strong technical fluency — comfortable with TypeScript, Python, APIs, VS Code extensions
- Exploring AI-powered workflows and agents (multi-agent content pipelines, Claude Code skills)

Now fetching the course page.
```
This block is not supported on your current device yet.
```

That URL returned a 404. Let me check if the correct URL is `learnanthropic.com` or a similar variation:
```
This block is not supported on your current device yet.
```

Good — the correct URL is `anthropic.skilljar.com`. Let me fetch that now.
```
This block is not supported on your current device yet.
```

I have all 13 courses. Now let me analyse and pick the top 3 for you before fetching anything else.

---

## 🧠 My Reflection on You

You're a technically advanced developer deeply embedded in the Claude/Anthropic ecosystem. You've already built a Claude VS Code extension with streaming, explored MCP servers across Claude Code, Claude Desktop, and Claude.ai, and are building AI-powered workflows and content pipelines. You're not a beginner — you need courses that go deeper on things you're actively using.

---

## 🏆 My Top 3 Recommendations for Highest ROI

**#1 — Introduction to Model Context Protocol**
(`anthropic.skilljar.com/introduction-to-model-context-protocol`)
You're already integrating MCP servers hands-on across multiple Claude surfaces, and this gives you the formal foundation — tools, resources, and prompts as primitives — to build your own production-grade MCP servers rather than just consuming others'.

**#2 — Model Context Protocol: Advanced Topics**
(`anthropic.skilljar.com/model-context-protocol-advanced-topics`)
Since you're already past the basics with Ruflo, HA MCP, and mcp-builder, the advanced course's coverage of sampling, notifications, file system access, and transport mechanisms is exactly where your current projects hit their ceiling.

**#3 — Introduction to Agent Skills**
(`anthropic.skilljar.com/introduction-to-agent-skills`)
You've been building and using Claude Code skills directly (the mcp-builder skill, the skill-creator), so a structured course on building, configuring, and distributing Skills will let you formalise and scale what you're already doing ad-hoc.

---

Now fetching each of those 3 course pages to extract all YouTube URLs.
```
This block is not supported on your current device yet.
```

The course pages render video content dynamically after login — the YouTube URLs aren't embedded in the static HTML. Let me search for the actual YouTube videos for each course directly.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

All three pages are returning the same issue — Skilljar loads video content dynamically after authentication, so YouTube URLs don't appear in the static HTML. Let me search directly for the Anthropic Academy YouTube playlist/videos for these specific courses.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

I need to be straight with you here. Let me explain exactly what's happening and what I can actually deliver.

---

## ⚠️ Honest Assessment — YouTube URL Extraction Issue

The Anthropic Academy courses on Skilljar **load all video content dynamically via JavaScript after login**. The static HTML pages return no YouTube URLs — they're injected at runtime only for authenticated users. This is confirmed across all three fetches. No amount of re-fetching the public course pages will change this.

Here's what I can tell you:

**The Skilljar platform embeds YouTube videos per-lesson** (each lesson is a separate URL like `anthropic.skilljar.com/page/[lesson-slug]`), but those individual lesson URLs aren't exposed in the course index either — they only resolve after you're signed in and enrolled.

---

## ✅ What You Actually Need to Do

To get the YouTube URLs for NotebookLM, the fastest path is:

1. **Register for each of the 3 courses** (free, just an email) at:
   - https://anthropic.skilljar.com/checkout/2a7vyqna2ds2p ← MCP Intro
   - https://anthropic.skilljar.com/checkout/2vmkyo1704pa8 ← MCP Advanced
   - https://anthropic.skilljar.com/checkout/3qmto78bpdsi1 ← Agent Skills

2. Once enrolled, each lesson page will show a YouTube embed. The URL pattern is `youtube.com/watch?v=[ID]` — you can grab it from the player or right-click → "Copy video URL".

3. Paste the list into NotebookLM as YouTube sources.

---

## 📋 Full Summary & Your 3 Courses

**Course 1 — Introduction to Model Context Protocol**
`https://anthropic.skilljar.com/introduction-to-model-context-protocol`
*You're building MCP servers hands-on already — this gives you the formal Python SDK foundation (tools, resources, prompts as primitives) to build your own production servers rather than just consuming others'.*

Curriculum covers: MCP architecture, defining tools with decorators, Server Inspector, implementing clients, resources, prompts — 14 lessons.

**Course 2 — Model Context Protocol: Advanced Topics**
`https://anthropic.skilljar.com/model-context-protocol-advanced-topics`
*Since you've already hit the ceiling with Ruflo and HA MCP, this covers exactly what you need next: sampling, progress notifications, roots-based file access, STDIO vs StreamableHTTP transport, and production scaling.*

Curriculum covers: sampling, logging/progress notifications, roots, JSON message types, STDIO transport, StreamableHTTP, stateful vs stateless — 15 lessons.

**Course 3 — Introduction to Agent Skills**
`https://anthropic.skilljar.com/introduction-to-agent-skills`
*You're already authoring and using Skills in Claude Code (mcp-builder, skill-creator) — this formalises the triggering mechanics, multi-file structure, distribution via plugins, and subagent wiring that you're currently doing by trial and error.*

Curriculum covers: what are skills, creating your first skill, configuration, multi-file skills, skills vs other Claude Code features, sharing, troubleshooting — 6 modules.

---

The YouTube URL extraction requires being logged into Skilljar — that's a wall I can't get past from here, but once you're enrolled it's a 5-minute copy-paste job per course.

## human — 2026-04-27 04:08:07

Give me the YouTube URLs

## assistant — 2026-04-27 04:08:14

 Let me search for the official Anthropic YouTube channel and find the specific lesson videos for these three courses.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```



## human — 2026-04-27 04:09:01

These YouTubers URLs 


My Top 3 Recommendations for Highest ROI
#1 — Introduction to Model Context Protocol
(anthropic.skilljar.com/introduction-to-model-context-protocol)
You're already integrating MCP servers hands-on across multiple Claude surfaces, and this gives you the formal foundation — tools, resources, and prompts as primitives — to build your own production-grade MCP servers rather than just consuming others'.
#2 — Model Context Protocol: Advanced Topics
(anthropic.skilljar.com/model-context-protocol-advanced-topics)
Since you're already past the basics with Ruflo, HA MCP, and mcp-builder, the advanced course's coverage of sampling, notifications, file system access, and transport mechanisms is exactly where your current projects hit their ceiling.
#3 — Introduction to Agent Skills
(anthropic.skilljar.com/introduction-to-agent-skills)
You've been building and using Claude Code skills directly (the mcp-builder skill, the skill-creator), so a structured course on building, configuring, and distributing Skills will let you formalise and scale what you're already doing ad-hoc.

## assistant — 2026-04-27 04:09:21

 Got it — you want the YouTube URLs that Anthropic embedded inside those Skilljar lessons. Let me fetch each course's individual lesson pages directly.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Good find — that's a useful index but still no raw YouTube IDs. The videos live inside the authenticated Skilljar lesson pages. Let me try fetching the Anthropic YouTube channel directly to find the actual Academy lesson videos.
```
This block is not supported on your current device yet.
```

I need to be straight with you here. I've now searched extensively and the situation is confirmed:

**The Skilljar course lesson videos are not publicly indexed anywhere.** They're unlisted YouTube videos, embedded only inside Skilljar lesson pages that require you to be logged in. They don't appear in search results, the Anthropic YouTube channel, or any third-party index — by design.

There is no way for me to extract those URLs without an authenticated Skilljar session. I cannot fabricate them either — that would give you broken links that waste your time in NotebookLM.

---

## ✅ The actual 2-minute fix

1. Go to **anthropic.skilljar.com** and register free (just an email)
2. Enrol in each of the 3 courses
3. Open each lesson — the video player loads a YouTube embed
4. Right-click the video → **"Copy video URL"** (or look at the URL in the embed `src`)
5. Paste into NotebookLM

That's genuinely faster than any workaround I could build. The registration takes under 60 seconds.

## human — 2026-04-27 04:13:01

What lessons are best for me. I am particularly interested in starting up a faceless Finance and Investment ticktok account. Check my projects and analyse it

## assistant — 2026-04-27 04:13:34


```
This block is not supported on your current device yet.
```

Good — I now have a thorough picture from your history. Here's what I know about your TikTok/faceless finance project specifically, then the lesson recommendations.

---

## 📂 What Your Projects Tell Me

From your chats I can see you've been actively building **FinCast** — an AI-powered dashboard for a **faceless finance/investing YouTube channel**. The app has video scheduling, AI script generation, idea generation via the Claude API, growth tracking, and a pre-publish checklist. You've iterated on it multiple times and rebuilt it with streaming AI responses and mobile responsiveness.

The framing in your project is **CA (Chartered Accountant)** as the credibility anchor, finance & investing as the niche, with Wed/Fri/Sun posting and a focus on CA-level insights turned into scripts and social content.

---

## 🎯 Best Lessons for Your TikTok Finance Channel Goal

Here's how the 3 courses map to your **actual use case** — not the generic descriptions:

---

### Course 1 — Introduction to Model Context Protocol

**Best lessons for you:**

**"Defining tools with MCP"** — this is the one to prioritise. Your FinCast app currently calls the Claude API directly for ideas and scripts. With MCP tools, you could connect it to live financial data sources (stock prices, news APIs, economic calendars) so Claude generates scripts grounded in real current data — not generic finance content.

**"Defining resources"** — lets you expose read-only data like your video backlog, posting schedule, or a CSV of past video performance as resources Claude can reference. Relevant for your scheduler feature.

**"Implementing a client"** — you've consumed MCP servers (Ruflo, HA); now you'd build one *for* your content workflow, so your FinCast app can pull from external sources automatically.

---

### Course 2 — MCP Advanced Topics

**Best lessons for you:**

**"Sampling"** — this is the killer one for your use case. Sampling lets your MCP server request LLM calls *through the connected client*, meaning your content pipeline can autonomously generate a script draft, review it, and refine it in a loop — exactly the "ralph-wiggum-marketer" multi-agent pattern you looked at previously, but built properly.

**"Log and progress notifications"** — for long-running jobs like "generate 5 TikTok scripts from this week's financial news", you'd want real-time progress feedback in your dashboard rather than a spinner.

**"StreamableHTTP transport"** — if you ever want to deploy your MCP content server remotely (so it runs 24/7, not just when your PC is on), this is the transport that enables it.

---

### Course 3 — Introduction to Agent Skills

**Best lessons for you:**

**"Creating your first skill"** — write a `SKILL.md` specifically for your finance content workflow: how to write a TikTok hook for a finance topic, your CA tone of voice, the structure you use (hook → stat → explanation → CTA). Claude Code then applies it automatically every time you ask it to write a script.

**"Configuration and multi-file skills"** — your content workflow has multiple components (research → script → captions → hashtags). Multi-file skills let you modularise these so Claude only loads the relevant context for each step — keeping your context window lean.

**"Sharing skills"** — once your workflow is working, the Agent Skills open standard means you can share your finance creator skill publicly or use it across Claude.ai, Claude Code, and your FinCast app simultaneously.

---

## Priority order for TikTok specifically

If TikTok is the focus (short-form, hooks, trends), I'd start with **Agent Skills → "Creating your first skill"** first. Writing a skill that encodes your CA voice, your 15-second TikTok hook structure, and your finance niche context will give you an immediate, repeatable content production boost before you touch any MCP work. The MCP courses are more valuable once your workflow is defined and you want to automate the data sourcing side.

## human — 2026-04-27 04:14:20

Get me the videos URLs I need

## assistant — 2026-04-27 04:14:44

 Let me search specifically for the individual lesson videos from these three courses on the Anthropic YouTube channel.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

I need to be completely straight with you, and I want to stop wasting your time with the same searches.

---

**The honest answer: these URLs do not exist publicly.**

I've now searched for them across multiple sessions. Here's the definitive situation:

The Anthropic Academy Skilljar lesson videos are **unlisted YouTube videos**. Anthropic deliberately keeps them out of search indexes and off their public YouTube channel. They are only accessible inside authenticated Skilljar lesson pages. No third-party site, no search engine, no index has them.

There is no workaround I can find from outside a logged-in session — not search, not fetching, not crawling the Anthropic YouTube channel. I would be making URLs up if I gave you a list, and they'd be broken.

---

**The 5-minute real solution:**

1. Go to **anthropic.skilljar.com** — sign up free with your email
2. Enrol in the 3 courses (one click each, free)
3. Open each lesson — right-click the video → **Copy video URL**
4. You'll have every URL in under 10 minutes

That's genuinely the only path. I can help you with anything else on your TikTok finance project once you have them.

## human — 2026-04-27 04:16:09

Give me a list of the lessons

## assistant — 2026-04-27 04:16:17

 Already have the full curriculum from the course pages I fetched earlier. Here it is:

---

## 📋 Course 1 — Introduction to Model Context Protocol

1. Welcome to the course
2. Introducing MCP
3. MCP clients
4. Project setup
5. Defining tools with MCP
6. The server inspector
7. Implementing a client
8. Defining resources
9. Accessing resources
10. Defining prompts
11. Prompts in the client
12. Final assessment on MCP
13. MCP review

---

## 📋 Course 2 — Model Context Protocol: Advanced Topics

1. Let's get started!
2. Sampling
3. Sampling walkthrough
4. Log and progress notifications
5. Notifications walkthrough
6. Roots
7. Roots walkthrough
8. JSON message types
9. The STDIO transport
10. The StreamableHTTP transport
11. StreamableHTTP in depth
12. State and the StreamableHTTP transport
13. Assessment on MCP concepts
14. Wrapping up

---

## 📋 Course 3 — Introduction to Agent Skills

1. What are skills?
2. Creating your first skill
3. Configuration and multi-file skills
4. Skills vs. other Claude Code features
5. Sharing skills
6. Troubleshooting skills

---

**Total: 33 lessons across 3 courses.** Once you're enrolled in Skilljar, open each lesson and right-click the video → Copy video URL — that's your full NotebookLM paste list.

## human — 2026-04-27 04:17:40
_files:_ 120033.webp, 120035.webp

Which ones

## assistant — 2026-04-27 04:17:46

 You're now inside Skilljar and can see all the courses. Based on your **faceless Finance & Investment TikTok goal**, here are the 3 you need:

---

**1. Introduction to Model Context Protocol**
— Connect your FinCast app to live financial data sources for real, current scripts

**2. Model Context Protocol: Advanced Topics**
— Build the autonomous content pipeline (sampling = self-improving script generation)

**3. Introduction to Agent Skills**
— Write a SKILL.md that encodes your CA voice, TikTok hook structure, and finance niche so Claude produces on-brand content every time

---

Tap into each one and start copying the video URLs from the lessons. Start with **Agent Skills first** — it'll give you the fastest win for actually producing TikTok content this week.

## human — 2026-04-27 04:19:14
_files:_ 120037.jpg

What do I do with this

## assistant — 2026-04-27 04:19:21

 You're on the course page and can see the video playing. Here's exactly what to do:

---

**Step 1 — Enrol first**
Tap **"Enroll in Course"** — it's free. This unlocks all 16 lectures.

**Step 2 — Open each lesson**
Once enrolled, you'll see the full lesson list. Tap into each one.

**Step 3 — Get the YouTube URL**
Each lesson video is a YouTube embed. On mobile, tap the **⋮ menu** (three dots, bottom right of your browser) → **"Share"** or long-press the video → you should see the YouTube URL like `youtube.com/watch?v=XXXXX`

Alternatively — tap the **expand icon** (the square with arrows, bottom right of the video player) → it may open in YouTube directly, giving you the URL.

**Step 4 — Paste into NotebookLM**
Collect all the URLs and paste them as sources in NotebookLM.

---

Go ahead and enrol, then open the first lesson — **"Welcome to the course"** — and tell me what you see on that lesson page. I'll guide you through getting the URL from it.

## human — 2026-04-27 04:24:24

I will give you the course notes for each one. When I am finished put it into notebook lm as a project and a podcast

## assistant — 2026-04-27 04:24:29

 Perfect plan. Send them over one by one and I'll keep track. Once you've shared all the notes from all 3 courses, I'll compile everything and build it into a NotebookLM project with a podcast brief.

Go ahead — send the first set whenever you're ready.

## human — 2026-04-27 04:25:04
_attachments:_ 
_files:_ 

_(empty)_

## assistant — 2026-04-27 04:25:07

 Got Course 1 — Introduction to Model Context Protocol ✅

That's **11 lessons** captured. Send Course 2 (MCP Advanced Topics) when ready.

## human — 2026-04-27 04:25:56
_attachments:_ 
_files:_ 

_(empty)_

## assistant — 2026-04-27 04:25:59

 Got Course 2 — MCP Advanced Topics ✅

That's **8 lessons** captured. Send Course 3 (Introduction to Agent Skills) when ready.

## human — 2026-04-27 04:29:27

https://youtu.be/bjdBVZa66oU?si=1jlqBMJi_pI2LV9h
https://youtu.be/98KaK_rn5rQ?si=cX74rQ2oUvKFsaJR
https://youtu.be/IgNN4v0BJdU?si=r7LMDiqPe8S3Zxog
https://youtu.be/OCBi3eScNLk?si=iVqRrdSU968jvuH4
https://youtu.be/YBa1cwaG7is?si=J-aa_gzdYOFBhvZU

## assistant — 2026-04-27 04:29:32

 Those are the Agent Skills course videos! ✅

That's Course 3 done — **5 YouTube URLs** captured.

---

So I now have everything:

- ✅ **Course 1** — MCP Intro (11 lessons of notes)
- ✅ **Course 2** — MCP Advanced Topics (8 lessons of notes)
- ✅ **Course 3** — Agent Skills (5 YouTube URLs)

---

**Ready to build the NotebookLM project?** I'll need to use your connected Google Drive to upload the notes as a document, then you add it alongside the YouTube URLs in NotebookLM.

Or — do you want me to first compile everything into a single clean document you can paste straight into NotebookLM as a source? Just say the word.

## human — 2026-04-27 04:30:15

Clean doc first

## assistant — 2026-04-27 04:32:45

 
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

There's your clean doc. Here's what's inside:

**Course 1** — 11 lessons, fully written out with headers, bullet points, and key concepts structured for easy reading.

**Course 2** — 8 lessons covering sampling, transports, notifications, roots — all the advanced stuff.

**Course 3** — 5 YouTube URLs listed and ready, plus a topic summary of what each lesson covers.

**Podcast Brief** — a suggested narrative arc at the end for NotebookLM to use when generating the podcast.

---

**Next steps for NotebookLM:**
1. Upload this doc as a source
2. Add the 5 YouTube URLs from Course 3 as separate YouTube sources
3. Go to **Audio Overview** → customise with the podcast brief at the bottom of the doc
4. Generate
