# Outlook Reorg — Proposal v1

> **Scope:** Both stores — `EHorton@selectlifestyles.co.uk` (work) and `Info` shared mailbox.
> **Strategy:** Aggressive auto-routing of noise; anything resembling real work stays in Inbox until you triage it.
> **Safety:** Nothing deleted, ever. Unread state preserved on every move. Existing rules retained.

---

## 1. What gets reorganised vs. left alone

| Touched | Left untouched |
|---|---|
| `Inbox` (9,723 + 169) | `Sent Items`, `Drafts`, `Deleted Items`, `Junk Email` |
| `Archive` (10,257) | `Calendar` (incl. shared cals: Lincoln Road, EFL, BCFC, UK holidays) |
| `NEW SERVICE USER` folder (will be merged into new tree) | `Contacts`, `Tasks`, `Notes`, `Sync Issues`, `RSS Subscriptions` |
| `Inbox\Sandwell Outstanding debt` (will be moved into new tree) | `PersonMetadata`, `Recipient Cache`, system folders |
| `Archive\people` (will be merged) | All `Yammer Root` folders |

The **`Archive` rule stays on** — that's your Office 365 auto-archive policy. We just reorganise *within* the Archive folder.

---

## 2. Folder tree (work mailbox)

```
EHorton@selectlifestyles.co.uk
├── Inbox/                          ← target: <100 items, only real work
│   ├── 1 Action Today
│   ├── 2 Awaiting Reply
│   └── 3 To Read
├── Operations/
│   ├── Properties/
│   │   ├── By Reference/           ← per-ref folders auto-created on demand
│   │   └── Property Safety/        ← FRA, gas safety, fire
│   ├── Service Users/
│   │   ├── New                     ← existing rule keeps feeding this
│   │   ├── Existing/
│   │   └── Sandwell Debt           ← existing rule keeps feeding this
│   ├── HR/
│   │   ├── New Starters/
│   │   ├── Appraisals/
│   │   └── Payroll/
│   ├── Finance/
│   │   ├── Xero/
│   │   ├── Invoices In/
│   │   ├── Invoices Out/
│   │   └── Statements/
│   ├── Legal/
│   │   ├── Carbon Law Partners/
│   │   ├── Mills-Reeve/
│   │   └── SecureMail/             ← client.securemail.management
│   └── Utilities/
│       ├── Gas/
│       ├── Electric/
│       ├── Water/
│       ├── Broadband/
│       └── Other/
├── People/
│   ├── Colleagues/                 ← internal /o=exchangelabs/ senders
│   ├── External/                   ← outside contacts, suppliers
│   └── Personal/                   ← anything from non-work domains you reply to
├── Notifications/                  ← low-attention; unread OK
│   ├── M365 Security/
│   ├── Quarantine/
│   ├── Banking/                    ← Revolut, HSBC, etc.
│   ├── Shipping/                   ← Amazon, Uber Eats, etc.
│   ├── GitHub/
│   └── Tools/                      ← HeyGen, Render, Calendly, etc.
└── Marketing/                      ← retained, out of sight
    ├── Retail/
    ├── Football/
    └── Newsletters/
```

## 3. Folder tree (Info shared mailbox)

Conservative — the shared mailbox stays mostly as-is, just the Inbox gets light triage:

```
Info
└── Inbox/
    ├── Notifications/      ← Microsoft / quarantine / system noise
    └── (everything else stays in Inbox for whoever else uses this mailbox)
```

---

## 4. Categories

Keep all existing (`Red Category`, `Blue Category`, `Purple Category`, `Orange Category`, `Dealt With`, `Follow Up`) **and add**:

| Category | Color | Purpose |
|---|---|---|
| Action Today | Red | (renames `Red Category`) urgent, today |
| This Week | Orange | (renames `Orange Category`) this-week work |
| Reference | Blue | (renames `Blue Category`) keep for reference |
| Personal | Purple | (renames `Purple Category`) non-work |
| FYI | Grey (new) | notifications, no action |

If you'd rather not rename, say so — I'll add new ones alongside.

---

## 5. Rules — server-side first, client-side fallback

These run going forward AND are applied retroactively to all existing messages in Inbox + Archive.

### Existing rules (kept as-is)
- `[ON] Archive` — Office 365 auto-archive policy
- `[ON] New Service Users` → `Operations/Service Users/New`
- `[ON] Sandwell outstanding debt` → `Operations/Service Users/Sandwell Debt`

### New rules to create

| # | Trigger | Destination |
|---:|---|---|
| 1 | Subject starts with "Quarantine report for" OR sender domain `messaging.microsoft.com` | `Notifications/Quarantine` |
| 2 | Subject contains "Microsoft 365 Security" | `Notifications/M365 Security` |
| 3 | Sender domain `github.com` | `Notifications/GitHub` |
| 4 | Sender domain `email.heygen.com` OR `render.com` OR `calendly.com` | `Notifications/Tools` |
| 5 | Sender `no-reply@revolut.com` OR domain `email1.hsbc.co.uk` | `Notifications/Banking` |
| 6 | Sender domain `amazon.co.uk` OR `uber.com` | `Notifications/Shipping` |
| 7 | Sender domain `post.xero.com` | `Operations/Finance/Xero` |
| 8 | Sender `kian.golestani@carbonlawpartners.com` OR domain `carbonlawpartners.com` | `Operations/Legal/Carbon Law Partners` |
| 9 | Sender domain `mills-reeve.com` | `Operations/Legal/Mills-Reeve` |
| 10 | Sender domain `client.securemail.management` | `Operations/Legal/SecureMail` |
| 11 | Sender domain `caresafetyinnovations.com` | `Operations/Properties/Property Safety` |
| 12 | Sender domain `britishgas.co.uk`, `britishgaslite.co.uk`, or contains "totalenergies" | `Operations/Utilities/Gas` |
| 13 | Sender domain `everflowutilities.com` | `Operations/Utilities/Other` |
| 14 | Sender domain `tiktok.com`, `topcashback.co.uk`, `thefragranceshop.co.uk`, `whop.com`, `outplayed.com` | `Marketing/Retail` |
| 15 | Sender domain `bcfc.com` | `Marketing/Football` |
| 16 | Subject contains "appraisal" | `Operations/HR/Appraisals` |
| 17 | Subject starts with "New stater" or "New starter" | `Operations/HR/New Starters` |
| 18 | Internal exchange senders (`/o=exchangelabs/...`) NOT matched by another rule | `People/Colleagues` |

Anything not matched by rules 1–18 stays in **Inbox** for you to triage.

### Categories applied automatically (no move, just colour)
- Subject contains `urgent`, `ASAP`, or `important` → `Action Today` (red)
- Sender = your own SMTP (`ehorton@selectlifestyles.co.uk`) and you sent it to yourself → `Reference`

---

## 6. The 8,449 unread

After applying the rules retroactively, expected outcome:

| Bucket | Approx. moved | Notes |
|---:|---|---|
| Notifications/Quarantine | ~600 | mostly quarantine reports |
| Notifications/M365 Security | ~150 | |
| Marketing | ~400 | |
| Operations/Legal | ~250 | |
| Operations/Finance/Xero | ~250 | |
| Notifications/Banking | ~200 | |
| Notifications/Tools | ~300 | HeyGen alone is ~25/scan |
| People/Colleagues | ~1,500 | internal staff |
| Operations (other) | ~500 | property, HR, utilities |
| **Stays in Inbox** | **~3,000–4,000** | the actual triage pile |

We won't know exact numbers until dry-run. Goal: get Inbox under 4,000 today, **without reading or deleting anything**.

---

## 7. What I need from you

Mark each line:

- [ ] **Folder tree** — approve as-is, or list changes (e.g. "rename Operations to Work", "drop Marketing/Football, I want it in Newsletters", "add Operations/Compliance")
- [ ] **Categories** — OK to rename existing, or add-only?
- [ ] **Rules** — approve all, or any to remove/modify?
- [ ] **Auto-categorise rule for `urgent`/`ASAP`** — yes/no?
- [ ] **Info shared mailbox** — confirm OK to touch (just creating `Notifications` subfolder there)

Reply with your edits and I'll write the apply script. We then do **dry-run** (prints every action, changes nothing) before any real moves.
