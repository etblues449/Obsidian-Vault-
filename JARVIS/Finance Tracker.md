---
type: finance-tracker
source: jarvis
---

# 💰 Finance Tracker

Automatic expense tracking and categorization via JARVIS capture. Monthly summary for Select Lifestyles forecasting.

---

## 📋 Expense Categories

Use these when capturing expenses to JARVIS:

- **Food** — groceries, restaurants, coffee
- **Transport** — fuel, public transport, parking, car maintenance
- **Home** — rent/mortgage, utilities, internet, repairs, furniture
- **Tools** — software, hardware, books, courses
- **Health** — gym, medications, doctor, fitness
- **Entertainment** — games, movies, events, hobbies
- **Savings** — transfers to savings account, investments
- **Work** — Select Lifestyles related, reimbursable items
- **Social** — gifts, donations, social events
- **Misc** — uncategorized (review weekly)

---

## 💬 Quick Capture Format

To JARVIS, say: **"Spent £X on [category]"** or **"Expense: £X / [item] / [category]"**

Example:
- "Spent £45 on groceries" → Food, £45
- "Filled up fuel £60" → Transport, £60  
- "Bought coding book £25" → Tools, £25
- "Amazon order £180 for smart bulbs" → Home, £180

JARVIS will classify and route to JARVIS/Inbox with type: `expense`

---

## 📊 This Month's Expenses

```dataview
TABLE WITHOUT ID
  dateformat(created, "MMM dd") AS "Date",
  title AS "Item",
  category AS "Category",
  amount AS "Amount"
FROM "JARVIS/Inbox"
WHERE type = "expense" AND created >= date(today) - dur(30 days)
GROUP BY category
SORT created DESC
```

---

## 💹 Monthly Summary

```dataview
TABLE WITHOUT ID
  category AS "Category",
  length(rows) AS "Count",
  sum(rows.amount) AS "Total"
FROM "JARVIS/Inbox"
WHERE type = "expense" AND created >= date(today) - dur(30 days)
GROUP BY category
SORT sum(rows.amount) DESC
```

---

## 📈 Top Spending (Last 30 Days)

```dataview
TASK
FROM "JARVIS/Inbox"
WHERE type = "expense" AND created >= date(today) - dur(30 days)
SORT amount DESC
LIMIT 5
```

---

## 🎯 Budget Alerts

**Create reminders for high-spend months:**

- Food: Target £150-200/month
- Transport: Target £100-150/month (car payment separate)
- Home: Track utilities separately
- Tools/Learning: Budget £100/month
- Total discretionary: Review monthly

---

## 📝 Monthly Finance Review

Add to your monthly review template:

```
## 💰 Financial Summary

- Total expenses (last 30 days): [See Finance Tracker]
- Biggest category: [Check Dashboard]
- Changes from last month: 
- Savings rate: 
- Notes for Select Lifestyles forecast: [Key financial events/changes]
```

---

## 🔗 Select Lifestyles Integration

For your monthly **Work Financial Forecasting** project:

1. Check Finance Tracker for personal expense summary
2. Review Select Lifestyles income (capture actual vs. forecast)
3. Note any unusual spending or income gaps
4. Update forecast spreadsheet with actuals
5. Flag to Claude for financial director analysis

---

**Tip:** Log expenses immediately (within 24h of purchase). Dataview dashboard auto-calculates totals. Review monthly to adjust budgets and spot patterns.
