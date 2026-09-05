---
type: weekly-review
week: <% tp.date.now("YYYY-[W]WW") %>
created: <% tp.date.now("YYYY-MM-DD HH:mm:ss") %>
---

# 📅 Weekly Review — Week <% tp.date.now("WW, YYYY") %>

**Dates:** <% tp.date.now("YYYY-MM-DD") %> to <% tp.date.now("dddd", 6) %>

---

## ✅ This Week's Wins

- [ ] 
- [ ] 
- [ ] 

---

## 📊 This Week's Captures

```dataview
TABLE WITHOUT ID
  link(file.link, title) AS "Capture",
  type AS "Type",
  project AS "Project"
FROM "JARVIS/Inbox"
WHERE created >= date(today) - dur(7 days)
SORT created DESC
```

---

## 🎯 Tasks Completed

```dataview
TASK
FROM "JARVIS/Inbox"
WHERE completed AND created >= date(today) - dur(7 days)
SORT completed DESC
```

---

## 🔥 Habit Streaks

```dataview
TABLE WITHOUT ID
  habit,
  streak,
  "🔥".repeat(min(streak, 10)) AS "Flame"
FROM "JARVIS/Habits"
SORT streak DESC
```

---

## 🚀 By Project This Week

```dataview
TABLE length(rows) AS "Items"
FROM "JARVIS/Inbox"
WHERE created >= date(today) - dur(7 days)
GROUP BY project
SORT length(rows) DESC
```

---

## 💭 Reflections

### What went well?
- 

### What was hard?
- 

### What do I want to change?
- 

---

## 📋 Next Week's Priorities

- [ ] 
- [ ] 
- [ ] 

---

## 🎯 Monthly Goals Progress

- [ ] 
- [ ] 
- [ ] 

---

## 📝 Notes

