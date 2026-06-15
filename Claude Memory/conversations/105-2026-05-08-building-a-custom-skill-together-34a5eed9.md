---
title: "Building a custom skill together"
date: 2026-05-08
uuid: 34a5eed9-4a29-426f-b6de-c782af954a9d
messages: 6
project: ""
source: claude.ai export 2026-05-08
---

# Building a custom skill together

> 6 messages · 2026-05-08

### Human — 2026-05-08T22:42

Let's create a skill together using your skill-creator skill. First ask me what the skill should do.

### Assistant — 2026-05-08T22:42

I'll read the skill-creator guidance first, then ask you what we're building.---

**What should this skill do?**

Tell me:

1. **What's the core job?** — What workflow or task should Claude handle with this skill?
2. **When does it trigger?** — What user phrases/contexts should make Claude reach for it?
3. **What are you building for?** — Is this for your Faceless Finance channel, your smart home, Claude Code work, something else? (context helps me nail the details)
4. **Edge cases?** — Any tricky scenarios or constraints I should know about upfront?

Take your time — clearer intent now = better skill later.

### Human — 2026-05-08T22:43

to be able to be a financial director of a company and produce cashflow forecasts

### Assistant — 2026-05-08T22:43

/caveman

Got it. Let me dig into the specifics so we build something that actually handles real financial direction work.

**Quick clarifying questions:**

1. **Scope of companies** — Are we talking SMEs (small/medium), startups, or enterprise? Any specific industries or revenue ranges? (This affects complexity of the forecast model)

2. **Forecast horizon & detail** — How far out? (3 months, 1 year, 5 years?) And what granularity? (daily, weekly, monthly, quarterly?)

3. **Input format** — What does the user give you to build a forecast from?
   - Existing financials (P&L, balance sheet)?
   - Raw transaction data?
   - Assumptions (growth rates, payment terms, seasonality)?
   - Mix of all three?

4. **Output format** — What's the deliverable?
   - Excel workbook with line items + assumptions sheet?
   - Narrative report + charts?
   - Rolling forecast model (updatable)?

5. **Key line items** — What MUST be in the forecast?
   - Revenue (breakdown by customer/product/segment)?
   - Operating expenses (payroll, COGS, overheads)?
   - Working capital (AR/AP cycles, inventory)?
   - Capex/debt/equity movements?
   - Tax?
   - All of the above?

6. **Special scenarios** — Does the skill need to handle:
   - Multiple scenarios (base/downside/upside)?
   - Sensitivity analysis (what if X changes)?
   - Currency conversion?
   - Multi-entity consolidation?

7. **Trigger contexts** — When should Claude use this? Examples:
   - "Build a 12-month cash forecast for Q3"
   - "Show me my working capital impact"
   - "I need a 3-statement model"
   - Something else?

Fire away — the more specificity, the tighter the skill.

### Human — 2026-05-08T22:47

1.a large company called select lifestyles limited

1. if needs to be up to april of the next year. the template is already being used and all previous month are avaslible
2. daily bank transactions
3. rolling forecast
4. Income from all sources within the company
5. Sensitivity analysis
6. Build a 12-month cash forecast

### Assistant — 2026-05-08T22:47

/caveman

Perfect. So you've got:
- **Select Lifestyles Limited** (established company, ongoing template)
- **Rolling forecast to April next year** (continuous model, monthly granularity)
- **Daily bank txn data** → aggregate to forecast
- **All income sources** + working capital implications
- **Sensitivity analysis** built in
- **Output: Excel workbook** (rolling model)

Before I write the skill, I need the actual structure:

1. **Show me the current template** — What's the folder/file structure? (Excel file path, Google Drive link, or upload it?)
   - Current sheet layout (income line items, assumptions, calculations)?
   - What months are already populated?
   - Formula structure (hardcoded or links)?

2. **Daily transaction data** — How do you get this?
   - Bank export format (CSV, Excel, API)?
   - What fields? (date, amount, description, account, category?)
   - Multiple bank accounts?

3. **Income sources breakdown** — What are they?
   - Membership fees (recurring, one-off)?
   - Services/products (list types)?
   - Other (grants, interest, etc.)?
   - Do you have historical monthly actuals already coded by source?

4. **Assumptions sheet** — What variables drive the forecast?
   - Growth rates by source?
   - Payment delays (customer AR, supplier AP)?
   - Seasonal adjustments?
   - Known future changes (price changes, new contracts)?

5. **Sensitivity parameters** — What levers should users tweak?
   - Revenue ±10%, ±20%?
   - Payment term changes?
   - Cost inflation?
   - Which variables matter most?

**Can you upload or link the current template + a sample of recent transactions?** That's the north star for the skill design.

