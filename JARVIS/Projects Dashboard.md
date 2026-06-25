---
type: dashboard
source: jarvis
---

# 🚀 Projects Dashboard

Overview of all active projects and progress.

---

## 📊 Active Projects

```dataview
TABLE WITHOUT ID
  link(file.link, project) AS "Project",
  length(filter(rows, (x) => x.type = "task" AND !x.completed)) AS "Open Tasks",
  length(filter(rows, (x) => x.type = "task" AND x.completed)) AS "Done",
  dateformat(max(rows.created), "MMM dd") AS "Last Activity"
FROM "JARVIS/Inbox"
WHERE project != "General"
GROUP BY project
SORT max(rows.created) DESC
```

---

## 🎯 Smart Home

**Goal:** Fully automated home with HA Green + ESP32

```dataview
TASK
FROM "JARVIS/Inbox"
WHERE !completed AND project = "Smart Home"
SORT priority DESC
LIMIT 5
```

**Progress:** 
- [x] HA setup & API integration
- [x] JARVIS control of lights
- [ ] Complete sensor coverage
- [ ] Automation routines
- [ ] Energy monitoring

---

## 💰 Faceless Finance

**Goal:** CA-credentialed YouTube channel (Wed/Fri/Sun, Wed 4PM priority)

```dataview
TASK
FROM "JARVIS/Inbox"
WHERE !completed AND project = "Faceless Finance"
SORT priority DESC, created DESC
LIMIT 5
```

**Progress:**
- [x] Channel setup
- [ ] Video 1: [Topic]
- [ ] Video 2: [Topic]
- [ ] Publish schedule
- [ ] Audience growth

**Upload schedule:** Wed/Fri/Sun (Wed is priority at 4PM)

---

## 📚 Doc to Learning

**Goal:** Single-file HTML doc→learning app on Claude API

```dataview
TASK
FROM "JARVIS/Inbox"
WHERE !completed AND project = "Doc to Learning"
SORT priority DESC
LIMIT 5
```

**Progress:**
- [ ] MVP design
- [ ] API integration
- [ ] Learning algorithm
- [ ] Beta testing

---

## 💼 Work Financial Forecasting

**Goal:** Select Lifestyles income forecast (.xlsm); Claude as financial director

```dataview
TASK
FROM "JARVIS/Inbox"
WHERE !completed AND project = "Work Forecasting"
SORT priority DESC
LIMIT 5
```

**Progress:**
- [ ] Current month forecast
- [ ] Quarterly projection
- [ ] Risk analysis
- [ ] Recommendations

---

## 🔄 Recurring Project Review

**Last review:** [See Weekly Review]

**Next review:** Sunday evening

---

## 💡 Ideas & Backlog

```dataview
LIST title
FROM "JARVIS/Inbox"
WHERE type = "idea" AND project != "General"
SORT created DESC
LIMIT 10
```

---

**Tip:** Capture daily wins to projects. Weekly review aggregates progress.
