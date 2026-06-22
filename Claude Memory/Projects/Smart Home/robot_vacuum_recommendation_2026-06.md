---
tags: [smart-home, research, shopping, robot-vacuum]
created: 2026-06-22
status: research-complete
---

# Robot Vacuum / Mop — Buying Report (June 2026)

**For:** Downstairs — mainly carpet + hard-floor kitchen & utility.
**Hard constraints:** Budget ceiling **£450 total (incl. dock)** · **pet hair** a big factor · **auto mop-lift on carpet is CRITICAL** (carpet must stay dry) · **good Home Assistant / local control preferred**.

> Research method: 5 parallel web-research agents (roundups, mop-lift mechanisms, Home Assistant integration, pet-hair/anti-tangle testing, live UK pricing) + brand-by-brand UK price checks. Prices accessed **22 June 2026** and are deal-driven — **re-confirm at checkout**.

---

## TL;DR — my pick for your home

**Buy the Dreame L10s Ultra Gen 2 (~£289–£359).**
It is the only sub-£450 model that ticks *all three* of your priorities at once:
- **Auto mop-lift 10.5 mm** (MopExtend) — genuinely keeps medium-pile carpet dry.
- **Full auto dock** — self-empty + mop self-wash + auto-dry + water refill.
- **Best-in-class Home Assistant story** — Dreame is the easiest brand to **root for Valetudo** (100% local, no cloud) *and* has the best custom HA integration (Tasshack). Nothing else here comes close on local control.

If you want **maximum carpet-dry insurance** (thick/plush carpet) and don't mind weaker HA → **Eufy X10 Pro Omni (~£429, 12 mm lift)**.
If you want the **cheapest** model that still does everything → **Ecovacs Deebot N30 Pro Omni (~£249)**.

---

## The three tiers

### 🟢 Budget-friendly — Ecovacs Deebot N30 Pro Omni · ~£249
*(verify it's the **Pro Omni** SKU and in stock — see caveat)*

| Spec | Detail |
|---|---|
| Suction | **10,000 Pa** |
| Auto mop-lift | **Yes — 9 mm**, ultrasonic carpet detect |
| Brush (pet hair) | **ZeroTangle 2.0** comb system — actively de-tangles long hair |
| Dock | **Full Omni** — self-empty (2.6 L bag, ~75 days) + **hot-water (60°C) mop wash** + hot-air dry |
| Home Assistant | Official HA integration, but **cloud-bound** (Ecovacs account) — no local/Valetudo path |
| Price | ~£249 (Amazon UK). Ecovacs' own UK store currently **sold out** |

**Why it's remarkable:** a full hot-wash Omni dock + 10,000 Pa + auto mop-lift + anti-tangle brush for ~£250 is exceptional value and meets every functional requirement.
**Caveats:** (1) The £249 price is low enough that you must confirm it's the *N30 **Pro** Omni* (not the cheaper non-Pro N30) and not a lapsed lightning deal. (2) **9 mm lift** is the lowest of the recommended set — fine for low/medium pile, but **borderline on thick/plush carpet**. (3) Cloud-only for HA.

---

### 🟡 Mid-range — Dreame L10s Ultra Gen 2 · ~£289–£359  ⭐ *best overall for you*

| Spec | Detail |
|---|---|
| Suction | **~10,000 Pa** (Dreame Vormax rating) |
| Auto mop-lift | **Yes — 10.5 mm** (MopExtend) — clears medium-pile carpet, keeps it dry |
| Brush (pet hair) | Floating tangle-resistant rubber brush + ultrasonic carpet recognition |
| Dock | **Full auto** — self-empty + mop self-wash + auto-dry + water refill |
| Home Assistant | **Best in class.** Rootable for **Valetudo** (fully local, no cloud) + excellent **Tasshack** custom integration (live maps, per-room, zones) |
| Price | **£289** (Dreame UK store, Gen 2) · ~£349 (Gen 3 Kit) · up to £479 mainstream |

**Why it's my top pick:** it's the sweet spot — strong 10.5 mm lift, full dock, decent pet-hair brush, and it's the *only* brand here that lets you cut the cloud entirely. For an HA Green household that values local control, that's decisive. It also costs **less than the "best" tier**, so you're not paying more for the right answer.
**Caveats:** Confusing product naming (Gen 2 vs Gen 3 Kit vs original) — buy the **Gen 2** for the 10.5 mm MopExtend lift at ~£289. Its single rubber brush is good-but-not-elite on tangle vs the dual-roller models below.

---

### 🔴 Best within budget — two strong options (~£399–£429)

**Option A — Roborock Qrevo S5V · £399.99** *(Roborock UK store; cheapest Roborock with mop-lift)*

| Spec | Detail |
|---|---|
| Suction | **12,000 Pa** |
| Auto mop-lift | **Yes — 10 mm**, single-run carpet+floor cleaning |
| Brush (pet hair) | **DuoRoller** dual rubber rollers — ~99% pet-hair pickup, genuinely anti-tangle |
| Dock | **All-in-One** — self-empty + mop self-wash + warm-air dry + water refill |
| Home Assistant | **Official, polished** Roborock HA integration (maps, room cleaning). **But cloud-tethered** — maps/routines always fetched via cloud; new units may **not** be Valetudo-rootable |
| Price | **£399.99** (uk.roborock.com, was £599.99) |

**Best for:** strongest pet-hair brush of the set + the most polished out-of-the-box HA experience — *if* you accept Roborock's cloud for maps.

**Option B — Eufy X10 Pro Omni · ~£429** *(max carpet-dry insurance)*

| Spec | Detail |
|---|---|
| Suction | **8,000 Pa** |
| Auto mop-lift | **Yes — 12 mm** (highest in class) — the safest for thick/plush carpet |
| Brush (pet hair) | Twin-turbine + detangling comb; rated "excellent" on pet hair across hard floor *and* carpet |
| Dock | **All-in-One Omni** — self-empty + mop wash + auto-dry + water refill |
| Home Assistant | **Weakest of the three** — community fork only (`damacus/robovac`), local-key extraction, no Valetudo, limited maps |
| Price | **£429** (Argos / Currys, was £599) |

**Best for:** if keeping a **thick carpet bone-dry** outranks HA quality, the 12 mm lift is the strongest guarantee here.

---

## Side-by-side

| Model | Price | Suction | Mop-lift | Pet brush | Dock | HA / local control |
|---|---|---|---|---|---|---|
| **Ecovacs N30 Pro Omni** | ~£249 | 10,000 Pa | 9 mm | ZeroTangle comb | Hot-wash Omni | Cloud only |
| **Dreame L10s Ultra Gen 2** ⭐ | £289–359 | ~10,000 Pa | **10.5 mm** | Rubber, anti-tangle | Full auto | **Valetudo + best integration** |
| **Roborock Qrevo S5V** | £399.99 | 12,000 Pa | 10 mm | **DuoRoller (best)** | Mop-wash Omni | Official, cloud-tethered |
| **Eufy X10 Pro Omni** | £429 | 8,000 Pa | **12 mm (best)** | Twin-turbine + comb | Omni | Community fork, fiddly |

---

## What to AVOID for your home (and why)

- **Roborock Q5 Pro+ / Q7 Max+ / Q8 Max+** — *no auto mop-lift* (fixed pad). The Q8 Max+ vacuums carpet superbly but you'd have to manually remove the mop and run two cycles for your carpet+kitchen layout. Q7 Max+ also scored **poorly on pet hair (1.7/5)**. Only the **Qrevo** line lifts the mop.
- **TP-Link Tapo RV30 Max Plus (~£180)** — cheap and has genuinely *local, no-cloud* HA control, **but no true mop-lift** (it just avoids carpet when mopping) and reviewers said it **struggles with pet hair on carpet**. Doesn't meet your critical requirement.
- **Eufy X8 Pro / RoboVac line** — heavily discounted but **no mop-lift, no mop-wash dock**, and mostly end-of-life clearance stock.
- **Dreame L10s "Plus / Pro / Gen 1"** — only **7 mm** lift; won't keep medium/thick carpet dry. Buy the **Gen 2** specifically.
- **Shark (Matrix Plus / PowerDetect)** — never publishes suction figures, and the **Home Assistant integration is currently broken** (cloud-only workaround). Bad fit for an HA household.

---

## Running costs (rough, per year)

- **Dust bags** (self-empty dock): ~£15–25/yr (a 3-pack lasts ~6–9 months for one pet household).
- **Mop pads:** ~£10–20/yr.
- **Side brush + filter:** ~£10–15/yr.
- **Main brush:** ~£15–20 every 12–18 months.
- **Estimate: ~£45–80/yr** in consumables across all four models — broadly similar. Bagless docks (some Ecovacs/Roborock) save on bags but need more manual cleaning.
- **Hot-water mop-wash docks** (Ecovacs N30 Pro, Dreame, Roborock Qrevo) clean mop pads better → less smell, fewer pad replacements over time.

---

## Home Assistant — local-control ranking (your weighting)

1. **Dreame** — *winner.* Rootable for **Valetudo** (zero cloud, maps stay on-robot) + best custom integration (Tasshack). Buy this if local control matters.
2. **Roborock** — most polished official HA integration, **but never fully cloud-free**; newer budget units may be unrootable. Great if you accept cloud for maps.
3. **Ecovacs** — official HA integration exists but **cloud account required**; no local path.
4. **Tapo (TP-Link)** — genuinely **local, no cloud**, but basic (start/stop/dock/fan only, **no maps/rooms**).
5. **Eufy** — works but **fragmented/fragile** (community forks, local-key extraction, no Valetudo).
6. **Shark** — **avoid**; official integration broken, cloud-only workaround.

---

## Decision shortcut

- **Want the best all-rounder for an HA home, spend the least for the right answer →** **Dreame L10s Ultra Gen 2 (~£289–£359).** ⭐
- **Carpet is thick/plush and dry-carpet is everything →** **Eufy X10 Pro Omni (£429, 12 mm).**
- **Cheapest that still does the whole job →** **Ecovacs Deebot N30 Pro Omni (~£249).**
- **Best pet-hair brush + polished app, OK with cloud →** **Roborock Qrevo S5V (£399.99).**

---

## Caveats / confidence

- All prices are **promotional and move weekly** — confirm the live figure at checkout. The Dreame and Ecovacs in particular swing a lot.
- US test-lab figures (Vacuum Wars, RTINGS) apply to the same models sold in the UK.
- **Verify before buying:** that the Ecovacs is the *N30 **Pro** Omni*; that the Dreame is the *Gen 2* (10.5 mm lift, not the 7 mm older versions); that a new Roborock unit you want to root isn't a post-2024 SkyHigh-NAND build (currently unrootable for Valetudo).

### Key sources
- Eufy X10 Pro Omni: argos.co.uk / currys.co.uk · vacuumwars.com/eufy-x10-pro-omni-review
- Dreame L10s Ultra Gen 2: dreamestore.co.uk · amazon.co.uk (B0DP7S6C3Q) · Tasshack/dreame-vacuum (HA) · valetudo.cloud/pages/installation/dreame
- Roborock Qrevo S5V: uk.roborock.com/products/roborock-qrevo-s5v · home-assistant.io/integrations/roborock
- Ecovacs Deebot N30 Pro Omni / T50 Pro Omni: ecovacs.com/uk · home-assistant.io/integrations/ecovacs
- Pet-hair/anti-tangle testing: vacuumwars.com/best-robot-vacuum-for-pet-hair · rtings.com/robot-vacuum/reviews/best/pet-hair
