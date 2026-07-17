# JARVIS Actions Dashboard

**Last Updated:** [[<% tp.date.now("YYYY-MM-DD HH:mm") %>]]

## Today's Actions
```dataview
LIST
FROM "JARVIS/Actions"
WHERE file.name = dateformat(now(), "yyyy-MM-dd")
SORT file.mtime DESC
```

## This Week
```dataview
LIST
FROM "JARVIS/Actions"
WHERE file.day >= date(today) - dur(6 day)
GROUP BY file.day
SORT file.day DESC
```

## Action Summary by Type
```dataview
TABLE without id action as "Action Type", count(rows) as "Count"
FROM "JARVIS/Actions"
WHERE file.day >= date(today) - dur(30 day)
GROUP BY action
SORT Count DESC
```

## Recent Chat History
```dataview
LIST
FROM "JARVIS/Chat.md"
LIMIT 10
SORT file.mtime DESC
```

## Quick Stats

| Metric | Value |
|--------|-------|
| Actions Today | [[<% cp.funcs.dataviewjs(dv => { const today = new Date().toISOString().split('T')[0]; const p = dv.pages('"JARVIS/Actions"').where(p => p.file.name === today); return p.length; }) %>]] |
| This Week | [[<% cp.funcs.dataviewjs(dv => { const week = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]; const p = dv.pages('"JARVIS/Actions"').where(p => p.file.name >= week); return p.length; }) %>]] |
| Alarms Set | [[<% cp.funcs.dataviewjs(dv => { const p = dv.pages('"JARVIS/Chat.md"'); const count = p.file.content.match(/⏰ ALARM/g)?.length ?? 0; return count; }) %>]] |
| Messages Sent | [[<% cp.funcs.dataviewjs(dv => { const p = dv.pages('"JARVIS/Chat.md"'); const count = p.file.content.match(/💬 SMS/g)?.length ?? 0; return count; }) %>]] |

## Action Patterns

- Most common action time: *Analyzing...*
- Most active day of week: *Analyzing...*
- Most used features: *Analyzing...*

## Upcoming Actions
```dataview
TASK
FROM "JARVIS"
WHERE !completed AND due <= date(today) + dur(7 day)
SORT due ASC
```

## Integration Points

- **Vault Context:** JARVIS pulls from JARVIS/Inbox, Journal, and Projects
- **Auto-Logging:** Every action logged to JARVIS/Actions/DATE.md + JARVIS/Chat.md
- **Project Updates:** Related projects auto-updated with action context
- **Financial:** Expense actions tracked in Finance Tracker
- **Habits:** Recurring actions linked to Habits system
