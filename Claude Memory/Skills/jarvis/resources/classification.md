# Classification Rules

Decision tree for routing input. Try rules top-to-bottom, first match wins.

## 1. Explicit prefix wins

| Prefix | Type |
|---|---|
| `note:`, `note that`, `capture:` | note |
| `idea:`, `video idea`, `content idea` | idea (faceless finance unless other project named) |
| `remind me`, `todo:`, `task:` | task |
| `journal:`, `today I`, `feeling` | journal |
| `turn on/off`, `dim`, `play`, `pause`, `cast`, `start`, `stop`, `scene` | ha_action |
| `file under <project>`, `for <project>` | route to that project file |

## 2. Project keyword match

| Keywords | Destination |
|---|---|
| smart home, HA, home assistant, ESPHome, lounge, bedroom node, upstairs node, presence, mmWave, govee, DreamView | `Claude Memory/Projects/Smart Home/_inbox.md` (entity catalog reference: `Claude Memory/project_smart_home.md`) |
| TV, lights, scene, movie mode, automation | ha_action (if imperative verb) or smart_home note (if declarative) |
| video, thumbnail, script, hook, faceless finance, content, channel | `Claude Memory/Projects/Faceless Finance/_inbox.md` |
| studying, course, lesson, learn, exam | `Claude Memory/project_studying_instructions.md` |
| debt, budget, payoff, finance personal, interest | `Claude Memory/project_debt_instructions.md` |
| skill, claude code, plugin, MCP | `Claude Memory/project_skills_instructions.md` |
| FinCast, income forecast, ledger | `fincast-suite/notes.md` |
| God mode | `Claude Memory/God mode/_inbox.md` (create if missing) |

## 3. Imperative verbs → HA action

If input starts with an imperative verb and the noun matches an HA entity, treat as `ha_action`:

- "turn on lounge lights" → `light.turn_on` on the lounge light entities
- "play Spotify on lounge TV" → `media_player.select_source` on `media_player.tv_jelly_beans_tv_2`
- "movie mode" → `scene.turn_on` on `scene.movie_mode` (or call the script that runs it)
- "dim bedroom" → `light.turn_on` with `brightness_pct: 30`

**Entity catalog:** `Claude Memory/project_smart_home.md` (canonical list, including which entities are BROKEN — avoid those).

## 4. Time-bound language → task

Phrases like "tomorrow", "next week", "by Friday", "in 2 hours" → always type: task. Parse the date and include `due:` in frontmatter.

## 5. Default fallback

If no rule matches with confidence ≥ 0.7, write to `Inbox/YYYY-MM-DD.md` with frontmatter `routed: pending`. Will be processed on next inbox drain (or asked about explicitly on next interaction).

## Output schema (n8n / Claude classifier)

When the n8n flow asks Claude to classify, expect this JSON back:

```json
{
  "type": "note|task|idea|journal|ha_action|inbox",
  "project": "smart_home|faceless_finance|studying|debt|skills|fincast|none",
  "destination_file": "relative path from vault root",
  "content": "the cleaned content to write (markdown)",
  "tags": ["tag1", "tag2"],
  "ha_action": { "service": "light.turn_on", "entity_id": "light.x", "data": {} },
  "due": "YYYY-MM-DD or null",
  "confidence": 0.0-1.0
}
```

If `confidence < 0.7`, route to inbox instead and let the user clarify later.
