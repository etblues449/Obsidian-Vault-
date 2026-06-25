---
type: goals-tracker
source: jarvis
---

# 🎯 Goals & Outcomes

Track progress on 4 major projects + personal goals. Review quarterly.

---

## 🎬 Faceless Finance

**Goal:** CA-credentialed YouTube channel, 100+ subscribers by year-end

**Timeline:** Wed/Fri/Sun uploads, 4PM Wed priority

| Milestone | Status | Due | Notes |
|-----------|--------|-----|-------|
| Channel setup | ✅ Done | — | YouTube + branding |
| First video published | ⏳ In Progress | Jun 24 | Financial basics intro |
| 3 videos published | ⏳ Week 4 | Jul 14 | Establish cadence |
| 10 subscribers | ⏳ Week 6 | Jul 28 | Initial traction |
| 50 subscribers | ⏳ Week 12 | Sep 8 | Growing audience |
| 100 subscribers | ⏳ Q4 | Dec 31 | Year-end target |

**Key Metrics:**
- Videos uploaded this month: 0
- Total subscribers: 0 (launching)
- Avg views per video: —
- Engagement rate: —

**Next Action:** Film first video by Thu 19 Jun

---

## 🏠 Smart Home

**Goal:** Fully automated home (HA Green + ESP32) with climate, lighting, security

**Timeline:** Ongoing, weekly reviews

| Milestone | Status | Due | Notes |
|-----------|--------|-----|-------|
| HA Green setup | ✅ Done | — | Running, API accessible |
| Light control (4 bulbs) | ✅ Done | — | Living room, stairs, 2× bedroom |
| Climate automation | ⏳ In Progress | Jun 30 | Smart thermostat integration |
| Motion sensors | ⏳ Q3 | Jul 31 | Hallway + bedroom |
| Door locks | ⏳ Q3 | Aug 15 | Front + back doors |
| Energy monitoring | ⏳ Q4 | Oct 31 | Real-time usage dashboard |

**Coverage:**
- Lights: 4/4 controlled ✅
- Climate: 1/3 zones (living room only)
- Security: 0 (planned)
- Sensors: 0 (planned)

**Next Action:** Research smart thermostat options (budget £100-150)

---

## 📚 Doc to Learning

**Goal:** Single-file HTML doc → learning app on Claude API + quiz engine

**Timeline:** MVP by end Q3 2026

| Milestone | Status | Due | Notes |
|-----------|--------|-----|-------|
| Architecture design | ⏳ In Progress | Jun 24 | Claude API + vector embeddings decision |
| API integration | ⏳ Week 2 | Jul 1 | Claude messages endpoint |
| Document parser | ⏳ Week 2 | Jul 1 | HTML → markdown → chunks |
| Quiz generator | ⏳ Week 3 | Jul 8 | Claude generates questions from content |
| Frontend UI | ⏳ Week 4 | Jul 15 | Simple web interface |
| Beta testing | ⏳ Week 5 | Jul 22 | Internal testing with sample doc |
| Launch | ⏳ Q3 | Aug 31 | Public beta / feature test |

**Tech Stack:**
- Frontend: HTML/CSS/JS (simple, embeddable)
- Backend: Claude API (no infrastructure)
- Storage: LocalStorage (MVP phase)

**Next Action:** Define API contract for document processing

---

## 💼 Work Financial Forecasting

**Goal:** Select Lifestyles income forecast with Claude as financial director

**Timeline:** Monthly forecasts + quarterly analysis

| Milestone | Status | Due | Notes |
|-----------|--------|-----|-------|
| Current month forecast | ⏳ In Progress | 1st of month | Actuals vs. budget |
| Quarterly projection | ⏳ Monthly | 5th of month | Q-over-Q trends |
| Risk analysis | ⏳ Monthly | 15th of month | Contingency planning |
| Recommendations | ⏳ Monthly | 20th of month | Claude financial director advice |
| 6-month forecast | ⏳ Quarterly | EOM | Half-year planning |

**Recent Data:**
- Current month income: [Track in Finance Tracker]
- Monthly target: [Your baseline]
- Variance: —
- Key risks: —

**Next Action:** Set up monthly review schedule for 1st of each month

---

## 🎯 Personal Goals

### Health & Habits
- [ ] Exercise: 3x week consistency (current: 3x week ✅)
- [ ] Sleep: 8 hours target (current: 7-7.5 avg)
- [ ] Read: 30 min daily (current: daily ✅)
- [ ] Meditate: 10 min daily (current: 2x week)

### Learning
- [ ] Complete Doc to Learning MVP (timeline: Aug 31)
- [ ] Deepen Claude API expertise (ongoing)
- [ ] Learn Home Assistant advanced automation (Q3)

### Productivity
- [ ] Weekly reviews (target: 100% of weeks) — current: 4/4 weeks ✅
- [ ] Daily plans (target: 5/7 days) — current: varies
- [ ] Inbox zero (JARVIS inbox) — current: reviewing after captures

### Financial
- [ ] Build 3-month emergency fund (timeline: Dec 31)
- [ ] Track all expenses (current: starting with JARVIS classifier)
- [ ] Reduce discretionary spending (target: 20% reduction)

---

## 📊 Progress Dashboard

```dataview
TABLE WITHOUT ID
  project,
  status,
  due,
  (progress / 100) AS "% Complete"
FROM "JARVIS/Projects Dashboard"
WHERE type = "project"
SORT status DESC, due ASC
```

---

## 🔄 Review Schedule

- **Daily:** Check daily plan, log habits
- **Weekly (Sunday):** Review captures, update goals, plan week
- **Monthly (1st):** Financial review, goal checkpoint, decide next month
- **Quarterly (1st of Jan/Apr/Jul/Oct):** Major goals assessment, adjust roadmap

---

## 💭 How This Works

1. **Define goals** here with clear milestones + due dates
2. **Capture progress** to JARVIS as you work (e.g., "uploaded first video")
3. **Weekly review** checks captures against goals, updates status
4. **Monthly review** updates Finance Tracker + financial director analysis
5. **Quarterly review** re-assesses goals, adjusts timelines if needed

---

**Next Steps:**

- [ ] Set personal goal targets (sleep, meditation, etc.)
- [ ] Add your baseline Select Lifestyles income to Work Forecasting
- [ ] Schedule monthly financial reviews (add to calendar)
- [ ] Define smart home end state (zones, automation rules, budget)
- [ ] Pick Doc to Learning tech stack (decide on vector DB, etc.)
