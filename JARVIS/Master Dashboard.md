---
type: dashboard
source: jarvis
---

# 🎯 Master Dashboard

**Today:** 2026-06-17 | **Week view** | [Weekly Review](JARVIS/Weekly%20Review%202026-06-17.md)

---

## ⚡ Quick Actions

- [📝 Capture](obsidian://open?vault=Obsidian%20Vault&commandid=quickadd%3Achoice%3AJARVIS%20Capture) | [🤖 Ask JARVIS](obsidian://open?vault=Obsidian%20Vault&commandid=quickadd%3Achoice%3AJARVIS%20Ask) | [📊 Digest](obsidian://open?vault=Obsidian%20Vault&commandid=quickadd%3Achoice%3AJARVIS%20Digest)

---

## 📋 Open Tasks (Priority)

```dataview
TASK
FROM "JARVIS/Inbox"
WHERE !completed AND type = "task"
SORT priority DESC, created DESC
LIMIT 10
```

---

## 🎬 This Week's Captures

```dataview
TABLE WITHOUT ID
  link(file.link, title) AS "Capture",
  type AS "Kind",
  project AS "Project",
  created AS "When"
FROM "JARVIS/Inbox"
WHERE created >= date(today) - dur(7 days)
SORT created DESC
```

---

## 💡 By Project

```dataview
TABLE length(rows) AS "Captures", 
  ("[ ] " + join(rows.title, ", [ ] ")) AS "Items"
FROM "JARVIS/Inbox"
WHERE type = "task" AND !completed
GROUP BY project
SORT length(rows) DESC
```

---

## 📚 Open Questions

```dataview
LIST
FROM "JARVIS/Inbox"
WHERE type = "question"
SORT created DESC
LIMIT 8
```

---

## 📓 This Week's Journal

```dataview
LIST link(file.link, file.name)
FROM "Journal"
WHERE created >= date(today) - dur(7 days)
SORT file.name DESC
```

---

## 🔥 Streak Tracking

```dataview
TABLE WITHOUT ID
  habit AS "Habit",
  last_done AS "Last Done",
  streak AS "🔥 Streak"
FROM "JARVIS/Habits"
SORT streak DESC
```

---

## 🏠 Home Assistant Status

- **Lounge Light:** [Check Status](http://192.168.0.200:8123/developer-tools/service)
- **Climate:** [Living Room](http://192.168.0.200:8123)
- **Automations:** Ready

---

## 📊 Insights

- **Captures this week:** `=length(filter(this.file.lists, (x) => x.created >= date(today) - dur(7 days)))`
- **Tasks completed:** [View](JARVIS/Weekly%20Review.md)
- **Avg. captures/day:** `=round(length(filter(this.file.lists, (x) => x.created >= date(today) - dur(7 days))) / 7, 1)`

---

## 🎯 Next Actions

1. Review open questions (Ask JARVIS for answers)
2. Process today's captures into projects
3. Check weekly streaks (habits due)
4. Plan tomorrow via capture

---

**Last updated:** `=dateformat(now, "HH:mm:ss")`
