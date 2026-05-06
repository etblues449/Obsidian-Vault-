# Outlook Reorg — Proposal v2 (department-based)

> **Big change from v1:** primary axis is now **department of correspondent**, not topic. Replied conversations get filed by who you replied to. Topics (Gas, Banking, etc.) demoted to secondary buckets only for non-staff senders.
>
> **Safety unchanged:** nothing deleted, unread state preserved, existing rules retained.

---

## 1. Filing logic

For every conversation in Inbox + Archive:

1. **Have you sent at least one reply in this thread?**
   - **Yes** → file the entire thread under the **department** of the *other party*.
   - **No, but the sender is internal staff** → still file under their department.
   - **No, sender is external & matches a noise rule** (Microsoft security, marketing, etc.) → file to that noise folder.
   - **No, sender is external & no rule matches** → leave in **Inbox** (it's something to triage).

2. **Scheme tagging (orthogonal):** if subject contains a scheme name (e.g. "Lincoln Road", "47212"), apply a **category** with that scheme name. Doesn't change the folder — lets you filter across departments by property.

Result:
- Every conversation you've engaged with → in a department folder.
- Every conversation you haven't engaged with that's not noise → still in Inbox, awaiting your call.
- Noise → routed out of sight.

---

## 2. New folder tree (work mailbox)

```
EHorton@selectlifestyles.co.uk
├── Inbox/                              ← only items needing your triage
├── Departments/
│   ├── 1. Executive/                   ← MD, EDs, NEDs (incl. you in Sent)
│   │   ├── Nick Horton (MD)
│   │   ├── Emma Franks
│   │   ├── Sumedh Jassal
│   │   ├── Les Trumpeter
│   │   ├── Alex Ford
│   │   ├── Liz Grice
│   │   └── Christine Horton / Sue Grice (NEDs)
│   ├── 2. Care & Compliance/
│   │   ├── John Roberts (Head)
│   │   ├── Operations/
│   │   │   ├── Stephen McGough (Ops Mgr)
│   │   │   ├── Jeri-Lee Saunders (RM Regent)
│   │   │   ├── Donna Poole (Snr RM Union Park)
│   │   │   ├── Samantha Morrison (RM)
│   │   │   ├── Doris Ukwu (CQC Mgr — New Peak)
│   │   │   ├── Stacey Turner (CQC Mgr — Mil Water)
│   │   │   ├── Jennifer Currier (CQC Mgr — All Saints Way)
│   │   │   ├── Sangeeta Rani / Aneel Jassal (CQC — Helenny)
│   │   │   ├── Carol Austin (CQC Mgr — John Street)
│   │   │   └── Katie Bromwich (Day Services — Throne)
│   │   ├── Systems & Monitoring (Craig McGough)
│   │   ├── Training (Wayne Phillips)
│   │   ├── Marketing (Constance Mhishi)
│   │   └── Office / PA (Nicky Kaur, Amanda Johnson)
│   ├── 3. Finance/
│   │   ├── Harry Jordanou (Head)
│   │   ├── Lin Goodwin (Mgr)
│   │   ├── Payroll (Kelly Russell, Ann Russell)
│   │   ├── Accounts (James Shuker)
│   │   └── Benefits (Asha Bibi)
│   ├── 4. Estates/
│   │   ├── Wayne Etheridge (Head)
│   │   └── Maintenance Team
│   └── 5. HR/
│       ├── Dipa Lekhi (Advisor)
│       └── HR Team (Lydia / Catherine / Usman)
├── External/                           ← non-staff correspondents you've replied to
│   ├── Legal/                          ← Carbon Law, Mills-Reeve, SecureMail
│   ├── Suppliers/                      ← anyone supplying services
│   ├── Utilities/                      ← Gas, Electric, Water, Broadband
│   ├── Banking & Finance/              ← Revolut, HSBC, Xero
│   └── Other/
├── Notifications/                      ← system noise; unread OK
│   ├── M365 Security
│   ├── Quarantine
│   ├── GitHub
│   ├── Tools (HeyGen, Render, Calendly)
│   ├── Shipping (Amazon, Uber Eats)
│   └── Banking alerts
└── Marketing/                          ← retail, football, newsletters
```

**Existing custom folders** (`NEW SERVICE USER`, `Inbox\Sandwell Outstanding debt`, `Archive\people`) — contents merged into the new tree, then folders deleted (with your OK).

**Untouched:** Sent Items, Drafts, Deleted Items, Junk, Calendar (all of them), Contacts, Tasks, Notes, Sync Issues, RSS, system folders.

---

## 3. Schemes — categories, not folders

Every scheme gets a **category** in Outlook. When subject contains the scheme name (or its numeric ref where I can map it), the message gets tagged.

Scheme categories created (one per property, all neutral grey unless you specify otherwise):

> Stafford Road · St Marks · Horsehills Drive · Oaks Crescent · Fellows Road · Dudding Road · St John Square · Himley Road · Peacock Close · Vicarage Road · Beeches Road · Stony Lane · Greswold Street · Moor Lane · Tiverton Drive · The Bantocks · Hawbush Road · Harrison Street · Doveridge Place · Walsall Road · Oberon Grove · Knipersley Road · Goodison Gardens · Penns Lane · Chester Road · Marsons Court · Lincoln Road · Stratford Road · All Saints Way · Helenny Close · John Street · Throne Road

You can then "search by category" to see all mail for one property across all departments.

---

## 4. Categories for triage state

Existing kept; add three:

| Category | Color | Use |
|---|---|---|
| Action Today | Red | (rename of `Red Category`) |
| This Week | Orange | (rename of `Orange Category`) |
| Awaiting Reply | (existing `Follow Up`) | |
| Reference | Blue | (rename of `Blue Category`) |
| Personal | Purple | (rename of `Purple Category`) |
| Dealt With | (existing) | |
| FYI | Grey (new) | notifications |

---

## 5. Existing rules

| Rule | Action |
|---|---|
| `Archive` (O365 auto-archive) | **Keep on**, untouched |
| `New Service Users` | **Keep on**, retarget to `Departments/2. Care & Compliance/Operations/_New Service Users` |
| `Sandwell outstanding debt` | **Keep on**, retarget to `External/Legal/Sandwell Debt` (it's debt collection) |

---

## 6. New rules (server-side where eligible, retroactively applied)

### Department routing (internal staff)
For each named person above, a rule: *if sender = their address (or to/from any of their address aliases), move to their folder.*

Internal /o=exchangelabs/ senders that I haven't mapped yet → `Departments/_Unmapped` for you to sort once.

### Noise routing
Same as v1, condensed:

| Trigger | Folder |
|---|---|
| Subject "Quarantine report for" / sender domain `messaging.microsoft.com` | `Notifications/Quarantine` |
| Subject "Microsoft 365 Security:" | `Notifications/M365 Security` |
| Sender domain `github.com` | `Notifications/GitHub` |
| Sender domains `email.heygen.com`, `render.com`, `calendly.com` | `Notifications/Tools` |
| Sender domains `amazon.co.uk`, `uber.com` | `Notifications/Shipping` |
| Sender `no-reply@revolut.com`, domain `email1.hsbc.co.uk` | `Notifications/Banking alerts` |
| Marketing senders (TikTok, TopCashback, Fragrance Shop, Whop, Outplayed, BCFC) | `Marketing/...` |

### External counterparties (kept once you've replied)
| Trigger | Folder |
|---|---|
| `kian.golestani@carbonlawpartners.com` / domain `carbonlawpartners.com` | `External/Legal/Carbon Law Partners` |
| Domain `mills-reeve.com` | `External/Legal/Mills-Reeve` |
| Domain `client.securemail.management` | `External/Legal/SecureMail` |
| Domain `caresafetyinnovations.com` | `External/Suppliers/Care Safety Innovations` |
| Domains `britishgas.co.uk`, `britishgaslite.co.uk`, "totalenergies", `everflowutilities.com` | `External/Utilities/...` |
| Domain `post.xero.com` | `External/Banking & Finance/Xero` |

---

## 7. The `Info` shared mailbox

Light touch only — others may use it:

```
Info/Inbox/
├── Notifications/  (M365 / quarantine / system)
└── (everything else stays put)
```

No department tree on `Info` — that's your personal axis, not the shared mailbox's.

---

## 8. Sign-off

Before I write the apply script, I need:

1. **Org chart accuracy** — is anyone above gone, or any current staff missing? Open `reference/org-structure.md` and edit names, then commit. (Or just reply with a list of changes.)
2. **Department naming** — happy with the 5 departments + Operations sub-tree, or want different splits?
3. **Person-level subfolders** — do you want a folder *per person* (current proposal) or just one folder per department?
4. **External tree** — fold "Legal / Suppliers / Utilities / Banking" into Departments somehow, or keep separate as proposed?
5. **Schemes as categories** — yes, or do you want scheme folders instead?
6. **Old custom folders** (`NEW SERVICE USER`, `Sandwell debt`, `Archive\people`) — OK to delete after merging contents into new tree?
7. **Category renames** — OK to rename `Red Category` → `Action Today` etc., or add-only?

A short reply like *"all good except: 4 = fold into Departments, 6 = keep all old folders, Liz Grice has left"* is fine.
