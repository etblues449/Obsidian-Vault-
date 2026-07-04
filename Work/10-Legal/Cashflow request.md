---
title: Select Lifestyles — Income Cashflow Forecast Spec
type: spec
owner: Jelly Bean
status: draft-v1
last_updated: 2026-06-04
source_data: "C:\\Users\\ElliotHorton\\OneDrive - Select Lifestyles\\Income\\Income"
reference_pdf: "[[Mine_vs_Amy_May_26.pdf]]"
---

# Select Lifestyles — Cashflow / Income Forecast

This note is the **single source of truth** for what my income forecast must do, how it must be built, and the payment-date map for every funding authority. It exists so a reviewer (Amy, a solicitor, an accountant, or a future me) can replicate the forecast line by line from the underlying ledger.

---

## 1. Purpose

Produce a **monthly cashflow / income forecast** for Select Lifestyles that is:

1. **Evidence-based** — every line traces to invoices actually issued in the rolling 3-month ledger (e.g. May forecast = built from Feb / Mar / Apr invoiced data).
2. **Day-accurate** — every forecast amount is dropped onto a specific **calendar day** (D01–D31), not just totalled monthly. This is so I can see the *intra-month liquidity curve*, not just the headline.
3. **Reconcilable** — it must be possible to diff my forecast against Amy's (or any other party's) line-by-line and explain every variance.
4. **Defensible** — if challenged in legal correspondence, each figure must point at: (a) the invoice in the ledger, (b) the contract/rate it was derived from, and (c) the treatment rule applied (recurring / arrears / midpoint / uplift / etc.).

Out of scope: payroll, supplier expenses, P&L — this is **income / receipts only**.

---

## 2. Inputs

| Input | Path | Use |
|---|---|---|
| Income workbook | `C:\Users\ElliotHorton\OneDrive - Select Lifestyles\Income\Income` | Master ledger of invoiced + receipted income |
| 3-month rolling ledger | Same workbook, last 3 closed months | Base evidence for next month's forecast |
| Contract / SLA rates | (to be linked) | Used when an authority changed rate mid-period |
| Prior-month forecast | `10-Legal/` PDFs e.g. [[Mine_vs_Amy_May_26.pdf]] | Reconciliation baseline |

---

## 3. Outputs

For each forecast month the forecast must produce:

1. **Authority table** — one row per funding authority, columns: `Forecast £`, `Last month actual £`, `Variance £`, `Variance %`, `Confidence (H/M/L)`, `Method`, `Notes`.
2. **Daily cash curve** — amount expected on each calendar day D01…D31, summed across all authorities.
3. **Reconciliation table** — `Mine`, `Amy` (or rival), `Mine − Amy`, `Reason for difference` (matches the format of the May 2026 PDF).
4. **Drivers summary** — top 5 variances explained, split into *overstated by rival* and *understated by rival*.
5. **Exception log** — any line where confidence is Low or the method had to deviate from the default rule.

---

## 4. Forecast methodology — the rules

These are the rules the forecast must apply. They were the source of the £69,637.40 gap vs Amy in May 2026, so they need to be explicit.

### 4.1 Default rule — *Recurring from ledger*
If a line item appears in the last 3 months at a stable amount and cadence → forecast = same amount on same day. Confidence **High**.

### 4.2 Weekly cadence rule
If the line is weekly (e.g. Wolverhampton Daycare £5,606.30 every Thursday) → forecast = `weekly_rate × number_of_Thursdays_in_target_month`. Drop each instance on its actual Thursday. Confidence **High**.

### 4.3 Mid-period rate change rule — *Use midpoint, not new rate*
If the authority changed rate part-way through the evidence window → forecast = **midpoint of old and new rates**, not the latest. This avoids overstating when the new rate isn't fully bedded in.
*Example:* Wolverhampton SL — Amy used the new £140,800.84 × 4. I used midpoint £138,055 × 4 + £2,780. **My method is the default.**

### 4.4 Arrears / prior-month catch-up rule — *Exclude unless invoice issued in target month*
If a line is described as "arrears", "back-pay" or "prior-month adjustment", it only counts when there is an invoice **dated within the target forecast month**. Otherwise it would double-count income already taken in earlier months.
*Example:* NHS Black Country D06 £23,999.12 was prior-month arrears → excluded. Use £13,081.46 ledger SI batch only.

### 4.5 Double-booking rule
If the same invoice appears under two dates in a rival forecast (e.g. Solihull SL on both D04 and D19) → keep the **single confirmed ledger date** only. Cross-check against the actual invoice date.
*Example:* Solihull MBC SL — confirmed single monthly invoice 20/04/2026 £33,639.34.

### 4.6 Uplift rule — *Exclude speculative uplifts not yet in ledger*
If a rival has added a percentage uplift (e.g. £5,333.04 weekly uplift on Sandwell SL) that isn't visible as an invoiced amount in the 3-month ledger → exclude until invoiced. Flag as a *known upside risk* in the exception log.

### 4.7 Speculative new SI rule
New "Standing Instruction" / new package starts only count if the invoice or contract activation is in hand. Otherwise excluded with note.
*Example:* Ideal for All May SI £4,120.96 — excluded until invoiced.

### 4.8 Back-pay rule
Back-pay only counts where there's a written authority confirmation or invoice. Verbal/expected back-pay is excluded.
*Example:* Haringey D14 £7,542.79 likely back-pay — excluded; baseline £6,000 used.

### 4.9 SI batch completeness rule
For SI batches (e.g. People Plus, Ideal for All, NHS) the forecast must list **every named beneficiary line** from the most recent batch, not a single rounded total. Missing names = understated forecast.
*Example:* People Plus — Apr SI batch £15,204.20 covered Brandon Ross, Zubair, Satvinder, Hamad Ali, Kirsty Prosser, Alana, Adrian Wall. All must be enumerated.

### 4.10 No-evidence rule
If an authority has no invoices in any of the 3 ledger months → forecast = £0 with note "no ledger evidence".
*Example:* Walsall Daycare = £0.

---

## 5. Authority payment-date map (canonical)

Day codes: **D01 = 1st of month**, D02 = 2nd, … D31 = 31st. *"Every Thu"* = each Thursday in the target month.

| # | Authority / Line | Cadence | Day(s) | Typical amount £ | Method | Notes |
|---|---|---|---|---|---|---|
| 1 | Birmingham City Council — Supported Living | Monthly, 2 tranches | **D08 + D21** | 9,591.88 + 59,419.08 = **69,010.96** | Recurring | Stable across ledger |
| 2 | Haringey | Monthly baseline | **~D14** | **6,000.00** | Recurring (baseline only) | Exclude any back-pay unless invoiced |
| 3 | Sandwell MBC — Respite | Monthly | **D01** | **3,419.08** | Recurring | Ledger confirmed |
| 4 | Sandwell MBC — Daycare | Monthly | **D08** | **6,866.40** | Recurring | Matches Sandwell SA receipt 08/MM/YYYY |
| 5 | Wolverhampton — Respite | Weekly | **Every Thu** (D07/14/21/28 in May) | **930.65 / wk** → ~3,722.60 / mo | Weekly | × number of Thursdays |
| 6 | Wolverhampton — Daycare | Weekly | **Every Thu** | **5,606.30 / wk** → ~22,425.20 / mo | Weekly | × number of Thursdays |
| 7 | Walsall — Respite | Monthly batch | **D05** | **18,171.66** | Recurring | Recurring monthly batch |
| 8 | Walsall — Daycare | — | — | **0.00** | No-evidence | Never appeared in ledger |
| 9 | Ideal for All Ltd — Direct Payments | Monthly allocations | **~D14 cluster** | **7,664.06** (Apr actual) | Recurring (ledger) | Exclude speculative new SIs |
| 10 | Kirklees — Supported Living | Monthly | **D14** | **6,221.40** | Recurring | Stable |
| 11 | LB Hillingdon — Supported Living | Monthly | **D14** | **5,203.80** | Recurring | Stable |
| 12 | NHS Birmingham & Solihull ICB | Monthly, 2 tranches | **D07 + D11** | 7,562.10 + 2,091.66 = **9,653.76** | Recurring | Stable |
| 13 | NHS Black Country ICB | Monthly SI batch | **~D06** (target-month only) | **13,081.46** | Recurring (ledger) | Exclude prior-month arrears |
| 14 | Sandwell — HB | Monthly | **D25** | **380.00** | Recurring | Stable |
| 15 | Sandwell MBC — Supported Living | Weekly Lee Alford runs ×2 + adjustments | **Weekly** | **~280,737.78 / mo** | Weekly + adj | Exclude uninvoiced uplift |
| 16 | Solihull MBC — Supported Living | Monthly | **D20-ish** (single invoice) | **33,639.34** | Recurring | Single invoice; never double-book |
| 17 | Walsall — Supported Living | Monthly main batch + dailies | **D05** main + minor | **~353,453.65 / mo** | Recurring (batch) | Main batch £351,231.98 on D05 |
| 18 | Wolverhampton — Supported Living | Weekly | **Every Thu + monthly £2,780** | **138,055 (midpoint) × 4 + 2,780** | Weekly midpoint | Use midpoint while rate change beds in |
| 19 | People Plus — Direct Payments | Monthly SI batch | **~D14** | **15,204.20** | Recurring (full batch) | Enumerate every named beneficiary |
| 20 | Middlesbrough — Supported Living | Monthly | **D06** | **6,116.04** | Recurring | Stable |
| 21 | Other HB and SC | Monthly | **D05** | **119,484.32** | Recurring | Includes minor £50 line item |

**Indicative monthly total (May 2026 evidence base): £1,535,455.71**

---

## 6. Daily cash curve — May 2026 example

The forecast must drop each line onto the right day so the daily curve is visible. May 2026 (Thursdays = 7, 14, 21, 28):

| Day | Source | £ |
|---|---|---|
| D01 | Sandwell MBC Respite | 3,419.08 |
| D05 | Walsall Respite + Walsall SL batch + Other HB & SC | 18,171.66 + 351,231.98 + 119,484.32 |
| D06 | Middlesbrough SL + NHS Black Country ICB | 6,116.04 + 13,081.46 |
| D07 | NHS B&S ICB tranche 1 + Wolves Respite Thu + Wolves Daycare Thu + Wolves SL Thu | 7,562.10 + 930.65 + 5,606.30 + 138,055.00 |
| D08 | Birmingham CC tranche 1 + Sandwell Daycare | 9,591.88 + 6,866.40 |
| D11 | NHS B&S ICB tranche 2 | 2,091.66 |
| D14 | Wolves (Thu) + Haringey + Ideal for All + Kirklees + LB Hillingdon + People Plus | 930.65 + 5,606.30 + 138,055.00 + 6,000.00 + 7,664.06 + 6,221.40 + 5,203.80 + 15,204.20 |
| D20 | Solihull MBC SL | 33,639.34 |
| D21 | Birmingham CC tranche 2 + Wolves (Thu) | 59,419.08 + 930.65 + 5,606.30 + 138,055.00 |
| D25 | Sandwell HB | 380.00 |
| D28 | Wolves (Thu) | 930.65 + 5,606.30 + 138,055.00 |
| weekly | Sandwell MBC SL (Lee Alford runs ×2) + Wolves SL monthly add | 280,737.78 spread + 2,780.00 |

(Day-by-day numbers should be auto-generated from the workbook; the table above is the *shape* the forecast must produce.)

---

## 7. Reconciliation against rival forecast

Every month the forecast must produce a side-by-side reconciliation table in the format of `Mine_vs_Amy_May_26.pdf`:

| Line item | Mine £ | Rival £ | Mine − Rival £ | Reason for difference |

…and a drivers summary splitting variances into **rival overstated** and **rival understated**, ordered by absolute £ impact.

For May 2026 the gap was **−£69,637.40** driven by 6 overstated lines (Solihull, NHS Black Country, Wolves SL, Haringey, Sandwell SL, Ideal for All) and 2 understated lines (People Plus, Walsall SL). The forecast must always make these drivers visible.

---

## 8. Confidence flags

Each line tagged H / M / L:

- **H** — Recurring, stable amount + stable day across all 3 ledger months.
- **M** — Recurring but with rate change, cadence change, or partial evidence (e.g. only 2 of 3 months).
- **L** — Speculative, awaiting invoice, or relies on verbal authority confirmation.

Anything **L** must be listed in the exception log with: source, expected £, expected day, blocker, and what would move it to M/H.

---

## 9. Exception log (template)

| Line | £ | Expected day | Status | Blocker | What unlocks it |
|---|---|---|---|---|---|
| e.g. Ideal for All new SI | 4,120.96 | D14 | Excluded | No invoice yet | First May invoice OR contract activation letter |
| e.g. Haringey back-pay | 7,542.79 | D14 | Excluded | No written confirmation | Authority confirmation email / invoice |

---

## 10. Workflow each month

1. **Close prior month** — lock the ledger, mark all invoices as either *invoiced* or *invoiced + receipted*.
2. **Refresh 3-month window** — drop the oldest month, add the just-closed month.
3. **Regenerate authority table** using §4 rules.
4. **Build daily curve** by dropping each line on its day per §5.
5. **Pull rival forecast** (Amy's) and produce reconciliation table per §7.
6. **Tag confidence** per §8 and fill exception log §9.
7. **Save** the output as `10-Legal/Mine_vs_<rival>_<MMM>_<YY>.pdf` for the legal record.

---

## 11. Open questions / TODO

- [ ] Link contract / SLA rate sheet for §4.3 midpoint rule.
- [ ] Confirm exact day for Haringey (notes say "monthly baseline" — pin to actual D-code).
- [ ] Confirm exact day for Ideal for All Direct Payments cluster.
- [ ] Confirm Sandwell MBC SL weekly run days (Lee Alford runs).
- [ ] Decide whether to forecast £0 lines (Walsall Daycare) explicitly or hide.
- [ ] Automate generation from the Income workbook (script in `Select Cashflow/`).

---

## Reference

Source PDF for May 2026 baseline: [Mine_vs_Amy_May_26.pdf](../../attachments/Mine_vs_Amy_May_26.pdf)
Income workbook path: `C:\Users\ElliotHorton\OneDrive - Select Lifestyles\Income\Income`
