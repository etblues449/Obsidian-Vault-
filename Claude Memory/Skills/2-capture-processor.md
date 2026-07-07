# Capture Processor Skill

**Trigger:** Continuous (every capture via n8n webhook)  
**Input:** Raw captures from Tasker (phone) or manual (PC)  
**Output:** Classified → routed to project, processed for patterns  
**Status:** ✅ Already implemented (n8n workflow)

---

## What It Does

When you send a capture (Tasker → n8n webhook):

1. **Normalize** incoming fields (text, source, timestamp)
2. **Classify** with Claude Haiku (inbox? smart home? finance? decision?)
3. **Route** to appropriate project folder
4. **Extract** metadata (tags, links, decision flags)
5. **Commit** to GitHub and sync to vault
6. **Confirm** back to phone (SMS or Obsidian notification)

---

## Current Implementation (n8n)

**Workflow:** `JARVIS - Note Router` (jellybean1875.app.n8n.cloud)

**Nodes:**
1. Webhook trigger → accepts POST with `{text, source, ts}`
2. Normalize → standardize fields
3. Claude Haiku classify → route to category
4. Build markdown → create note file with metadata
5. GitHub commit → push to vault
6. Confirm → notify user

**Categories:**
- `JARVIS/Inbox/` — General captures
- `Claude Memory/Projects/[project]/captures/` — Project-specific
- `Claude Memory/briefings/` — If tagged `#briefing`
- `Claude Memory/decisions.md` — If tagged `#decision`
- `Claude Memory/beliefs.md` — If tagged `#belief`

---

## How to Capture

### Phone (Tasker)
```
Alt+A → Ask JARVIS → Input capture → Sent to webhook
```

### PC (PowerShell)
```powershell
$body = @{
    text = "Your capture here"
    source = "pc-manual"
    ts = (Get-Date -Format "o")
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://jellybean1875.app.n8n.cloud/webhook/jarvis-capture" `
  -Method POST -Body $body -ContentType "application/json"
```

---

## Next Steps

This skill is **already working**. To optimize:

1. Add more classification categories (smart home, finance, health)
2. Implement tag extraction (auto-detect `#decision`, `#belief`, etc.)
3. Add follow-up capture chains ("This links to…")
4. Set up notification confirmation preferences

---

## Integration with Other Skills

- **Connection Finder** reads processed captures
- **Pattern Detector** analyzes capture frequency
- **Weekly Synthesis** pulls from processed captures
- **Belief Tracker** monitors `#belief` tagged captures
- **Decision Intelligence** tracks `#decision` tagged captures
