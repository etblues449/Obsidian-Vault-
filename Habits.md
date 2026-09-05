---
type: habits
source: jarvis
---

# 🔥 Habit Tracker

Log daily habits here. Capture format: `[Habit name] - [today/date]` or use the habit capture template.

---

## 📋 Active Habits

Add your habits below in the format:
- `habit:: [Habit Name]` | `last_done:: [YYYY-MM-DD]` | `streak:: [N]`

### Daily Habits

- `habit:: Morning routine` | `last_done:: 2026-06-17` | `streak:: 5`
- `habit:: Exercise` | `last_done:: 2026-06-16` | `streak:: 3`
- `habit:: Read` | `last_done:: 2026-06-17` | `streak:: 12`
- `habit:: Meditate` | `last_done:: 2026-06-15` | `streak:: 2`
- `habit:: Capture to JARVIS` | `last_done:: 2026-06-17` | `streak:: 8`

### Weekly Habits

- `habit:: Weekly review` | `last_done:: 2026-06-16` | `streak:: 4`
- `habit:: Grocery shopping` | `last_done:: 2026-06-16` | `streak:: 8`
- `habit:: Deep work session` | `last_done:: 2026-06-15` | `streak:: 6`

### Monthly Habits

- `habit:: Monthly goals review` | `last_done:: 2026-06-01` | `streak:: 1`
- `habit:: Financial review` | `last_done:: 2026-06-01` | `streak:: 1`

---

## 🔥 Current Streaks

```dataview
TABLE WITHOUT ID
  habit,
  last_done,
  streak,
  "🔥".repeat(min(streak, 20)) AS "Flame"
WHERE habit
SORT streak DESC
```

---

## 📊 Habits Due Today

```dataview
LIST habit
WHERE last_done < date(today)
SORT last_done ASC
```

---

## 📝 Log Entry

**Date:** 2026-06-17

- [x] Morning routine
- [x] Exercise
- [x] Read
- [ ] Meditate
- [x] Capture to JARVIS

---

**Tips:**
1. Log habits daily via JARVIS Capture: "Did 30 min exercise today"
2. Update streaks weekly in the habit list above
3. Check the "Habits Due Today" section on your Master Dashboard
4. Celebrate streaks!
