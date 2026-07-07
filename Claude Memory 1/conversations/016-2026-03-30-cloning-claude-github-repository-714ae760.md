---
name: Cloning Claude-Github repository
description: Imported Claude.ai conversation from 2026-03-30 (20 messages)
type: reference
uuid: 714ae760-558f-4c77-aa33-4392bf7c2372
created_at: 2026-03-30T03:03:05.446943Z
updated_at: 2026-04-26T21:34:06.180853Z
---

# Cloning Claude-Github repository

## human — 2026-03-30 03:03:07

Install this skill 

gh repo clone etblues449/Claude-Github

## assistant — 2026-03-30 03:03:37


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

I'll clone the GitHub repo and install it as a skill for you.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

The repository `etblues449/Claude-Github` doesn't exist on GitHub — it returned a 404. A few possibilities:

- The username or repo name might have a typo
- The repo might be private (and would need authentication)
- It may not have been created yet

Could you double-check the exact GitHub URL? For example: `https://github.com/etblues449/Claude-Github` — does that open for you in a browser?

## human — 2026-03-30 03:04:32

Yes

## assistant — 2026-03-30 03:04:44


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

The page loads in a browser but the GitHub API returns 404 — this usually means the repo is **private**. The API can't access private repos without authentication.

To clone it, I'd need a GitHub Personal Access Token (PAT) with repo access. Do you have one? If so, share it and I'll use it to clone and install the skill.

## human — 2026-03-30 03:10:21

git@gitlab.com:etblues449/just-the-docs.git

## assistant — 2026-03-30 03:10:30


```
This block is not supported on your current device yet.
```

This repo also appears to be private — it needs authentication to clone. To proceed I'll need a GitLab **Personal Access Token** (PAT) with `read_repository` scope.

You can create one at: **GitLab → Settings → Access Tokens → Add new token** → tick `read_repository` → set an expiry → copy the token.

Share it here and I'll use it to clone and install the skill.

## human — 2026-03-30 03:12:11

https://gitlab.com/etblues449/claude.git

## assistant — 2026-03-30 03:12:33


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

This repo cloned successfully, but it's just an empty GitLab starter project — it only contains the default README with no skill content yet.

It looks like this might be the repo you're planning to build your skill in, but nothing has been added to it yet. A few questions:

- Is this the right repo, or did you mean a different one?
- Did you want me to help you **set up** a skill in this repo and push it?

## human — 2026-03-30 03:12:50

Yes

## assistant — 2026-03-30 03:12:53

 What would you like this skill to do? Tell me:

1. What should it enable Claude to do?
2. When should it trigger (what kinds of requests)?

## human — 2026-03-30 03:14:04

Skills

## assistant — 2026-03-30 03:14:06

 Could you tell me a bit more about what you mean? For example:

- Do you want a skill that **helps create or manage other skills**?
- Or something else entirely?

## human — 2026-03-30 03:14:19
_files:_ SKILL.md

_(empty)_

## assistant — 2026-03-30 03:14:38


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Now I need your GitLab credentials to push. Do you have a **Personal Access Token** for `gitlab.com/etblues449`? You can create one at:

**GitLab → Settings → Access Tokens → Add new token** → tick `write_repository` → copy the token

Share it and I'll push the commit.

## human — 2026-03-30 03:17:52

glpat-KAlSV7pyJddHHM0gv3lKsGM6MQpvOjEKdTpsaHJ3bw8.01.171r6yh8e

## assistant — 2026-03-30 03:18:03


```
This block is not supported on your current device yet.
```

Done! The `SKILL.md` has been pushed to `gitlab.com/etblues449/claude`. 

One important note — now that the push is complete, I'd recommend **rotating that token** since it was shared in the chat. You can do that at **GitLab → Settings → Access Tokens**, revoke this one and create a fresh one.

## human — 2026-03-30 03:18:53

Is it available on Claude app

## assistant — 2026-03-30 03:18:57

 No, not yet. The GitLab repo is just storage — to make the skill available in the Claude app, it needs to be installed into Claude's skills system.

Unfortunately, the Claude.ai app doesn't currently have a way to install custom skills directly from a Git URL. Skills in the app are managed by Anthropic.

If you're using **Claude Code** (the CLI tool), you can install skills from a repo. Would you like instructions for that route instead?

## human — 2026-03-30 03:19:12

Yes

## assistant — 2026-03-30 03:19:18

 Here are the steps:

**1. Install Claude Code** (if not already)
```
npm install -g @anthropic-ai/claude-code
```

**2. Clone your skill repo locally**
```
git clone https://gitlab.com/etblues449/claude.git ~/my-skills/claude
```

**3. Run Claude Code from a project folder**
```
cd your-project
claude
```

**4. Tell Claude about your skill**
Once inside Claude Code, say:
> "Use the skill at ~/my-skills/claude/SKILL.md"

Claude Code will read it and follow its instructions for that session.

---

The key thing to know is that **skills aren't "installed" permanently** in Claude Code either — you reference them per-session, or you can add them to a project's `.claude/` folder so they load automatically for that project.

Would you like me to set up a `.claude/` folder structure in your repo so the skill loads automatically?
