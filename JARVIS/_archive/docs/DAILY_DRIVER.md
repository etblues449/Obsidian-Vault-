# Daily Driver — Using Jarvis Once Built

After all 5 days are done, this is the normal workflow.

## On the phone (Fold 7)

### Quick capture (90% of use)
- Trigger Tasker `Jarvis Voice` (power-button double-press, edge panel, or homescreen icon)
- Speak naturally: *"video idea: thumbnail A/B test for finance niche"*
- Flash confirms `Jarvis: captured`
- ~3 seconds later it lands in `Claude Memory/Projects/Faceless Finance/_inbox.md`

### HA control
- *"turn on movie mode"* → scene runs
- *"play Spotify on lounge TV"* → starts playing
- *"dim bedroom to 20"* → done

### Notes / tasks
- *"remind me to call dentist Friday"* → task in `Tasks/open.md` with due date
- *"journal: feeling productive today, finished 3 automations"* → today's journal file
- *"note for smart home: upstairs node still has BLE conflict, try splitting"* → appended to project file

### When offline / PC down
- Tap Obsidian Quick Capture widget instead → types into `Inbox/quick-capture.md`
- Next time Claude Code opens, invoke Jarvis → it drains the inbox automatically

## On Claude Code (any device)

### Process accumulated captures
```
> jarvis drain inbox
```
Claude reads `Inbox/` items, classifies them, writes to project files, marks them processed.

### Direct invocation
```
> jarvis note: refactor the lounge automation to use input_boolean instead of hardcoded times
> jarvis remind me to update HA next month
> jarvis turn on the kitchen lights
```

### Status check
```
> jarvis status
```
Shows rollout state + inbox depth + config presence.

## Daily rhythm (suggested)

| Time | Action |
|---|---|
| Throughout day | Voice/widget capture as ideas hit |
| Evening | Open Claude Code, `jarvis drain inbox` (catches anything mis-routed) |
| Sunday | Weekly review workflow runs automatically — read it Monday morning |

## When Jarvis gets something wrong

- The misrouted item is still findable (search vault for the text)
- Move it to the right file manually
- If a pattern emerges (e.g., "study notes" keep going to finance), update `resources/classification.md` and the classifier prompt in n8n

## Adding new projects

1. Create the destination file (or `_inbox.md` inside a project folder)
2. Add a row to the table in `resources/classification.md` and `SKILL.md` Project Map
3. Update the classifier system prompt in n8n's Capture Router workflow
4. Commit — next capture routes correctly

## Backups

- Vault is git-tracked → push happens via Obsidian Git plugin auto-commit every 10 min
- n8n workflows: export JSON periodically to `Claude Memory/Backups/n8n/`
- HA config: snapshot weekly to NAS or off-site
- `config.yaml` (with HA token): keep one encrypted copy in a password manager, never in git
