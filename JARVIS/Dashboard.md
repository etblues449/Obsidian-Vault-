---
type: dashboard
source: jarvis
---
# 🧠 JARVIS Dashboard

> Requires the **Dataview** community plugin. This is your home base — captures,
> tasks, and recent activity, all live from the vault.

## ✅ Open Tasks
```dataview
TASK
FROM "JARVIS/Inbox"
WHERE !completed AND type = "task"
SORT created DESC
```

## 📥 Recent Captures (7 days)
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

## 💡 Ideas
```dataview
LIST
FROM "JARVIS/Inbox"
WHERE type = "idea"
SORT created DESC
LIMIT 15
```

## ❓ Open Questions
```dataview
LIST
FROM "JARVIS/Inbox"
WHERE type = "question"
SORT created DESC
LIMIT 15
```

## 📓 Recent Journal / Digests
```dataview
LIST
FROM "Journal"
SORT file.name DESC
LIMIT 10
```

## 📊 Captures by Project
```dataview
TABLE length(rows) AS "Count"
FROM "JARVIS/Inbox"
GROUP BY project
SORT length(rows) DESC
```
