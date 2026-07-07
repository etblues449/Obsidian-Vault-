---
name: Smart home dashboard artifact
description: Imported Claude.ai conversation from 2026-04-22 (6 messages)
type: reference
uuid: 1aae4883-760f-4f21-ac87-f7c49bb2d12e
created_at: 2026-04-22T07:45:38.036334Z
updated_at: 2026-04-22T07:46:51.282642Z
---

# Smart home dashboard artifact

## human — 2026-04-22 07:45:38

I want to build an artifact for my smart home so you have a full picture of everything that is going on

## assistant — 2026-04-22 07:45:50


```
This block is not supported on your current device yet.
```

Before I build anything, I want to make sure it fits your setup perfectly. Let me ask a few questions first:
```
This block is not supported on your current device yet.
```



## human — 2026-04-22 07:46:26

Q: What kinds of smart home devices do you have?
A: Lights / bulbs, Security cameras / locks, Sensors (motion, door, temp), Media / speakers

Q: How do you want data to come in?
A: Pull from a real API (e.g. Home Assistant, SmartThings)

Q: What's the most important thing to see at a glance?
A: Room-by-room breakdown

## assistant — 2026-04-22 07:46:31

 Which smart home platform are you using?
```
This block is not supported on your current device yet.
```



## human — 2026-04-22 07:46:45

Q: Which platform are you pulling from?
A: Home Assistant

Q: Do you have your API credentials ready?
A: No, I'll need help getting them

## assistant — 2026-04-22 07:46:51

 No problem — here's how to get your Home Assistant credentials:

**You'll need two things:**

**1. Your Home Assistant URL**
This is the address you use to access Home Assistant locally, usually something like:
- `http://homeassistant.local:8123`
- `http://192.168.1.X:8123`

If you use Nabu Casa (Home Assistant Cloud), you'll have a remote URL too.

**2. A Long-Lived Access Token**
1. Open Home Assistant in your browser
2. Click your **profile icon** (bottom-left corner)
3. Scroll all the way down to **"Long-Lived Access Tokens"**
4. Click **"Create Token"**, give it a name (e.g. "Dashboard"), and copy it — you won't see it again

---

Once you have both, come back and I'll build the dashboard. The artifact will let you paste them in directly — your token stays in your browser and is never sent anywhere except your own Home Assistant instance.

Do you have them ready, or do you have any questions about the steps above?
