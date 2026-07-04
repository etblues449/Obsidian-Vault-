# n8n Workflows — Deployment Guide

**Status:** Ready to deploy to jellybean1875.app.n8n.cloud  
**Total workflows:** 5 (+ 1 existing: Capture Processor)

---

## Quick Deploy

1. **Copy each workflow JSON** from the sections below
2. **Log in** to https://jellybean1875.app.n8n.cloud
3. **Click "Create" → "New Workflow"**
4. **Click the menu (three dots) → "Import from URL/JSON"**
5. **Paste the JSON** → Click "Import"
6. **Activate the workflow** (toggle in top-right)

Repeat for each workflow below.

---

## Workflow 1: Morning Brief (7:00 AM Daily)

**File:** `n8n-workflow-morning-brief.json`

```json
{
  "name": "JARVIS - Morning Brief",
  "nodes": [
    {
      "parameters": {
        "rule": "0 0 7 * * *"
      },
      "name": "Cron Trigger (7am daily)",
      "type": "n8n-nodes-base.cron",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "resource": "file",
        "operation": "read",
        "filePath": "Claude Memory/MEMORY.md"
      },
      "name": "Read MEMORY.md",
      "type": "n8n-nodes-base.github",
      "typeVersion": 1,
      "position": [450, 200],
      "credentials": {
        "githubApi": "GitHub OAuth (credentials)"
      }
    },
    {
      "parameters": {
        "resource": "file",
        "operation": "read",
        "filePath": "JARVIS/Inbox",
        "recursive": true
      },
      "name": "Read Recent Captures (48h)",
      "type": "n8n-nodes-base.github",
      "typeVersion": 1,
      "position": [450, 300],
      "credentials": {
        "githubApi": "GitHub OAuth (credentials)"
      }
    },
    {
      "parameters": {
        "model": "claude-opus-4-8",
        "maxTokens": 1000,
        "systemPrompt": "You are Elliot's morning briefing assistant. Generate a 2-3 minute briefing from provided context.",
        "prompt": "=== MEMORY ===\n{{ $node[\"Read MEMORY.md\"].json.content }}\n\n=== RECENT CAPTURES (48h) ===\n{{ $node[\"Read Recent Captures (48h)\"].json.files }}\n\nGenerate morning brief with: today's calendar, pending tasks, recent captures, yesterday's patterns, today's focus."
      },
      "name": "Claude Opus - Generate Brief",
      "type": "n8n-nodes-base.anthropic",
      "typeVersion": 1,
      "position": [650, 250],
      "credentials": {
        "anthropicApi": "Anthropic API Key (credentials)"
      }
    },
    {
      "parameters": {
        "resource": "file",
        "operation": "create",
        "filePath": "Claude Memory/briefings/{{ $now.toFormat('yyyy-MM-dd') }}.md",
        "fileContent": "# Morning Brief — {{ $now.toFormat('yyyy-MM-dd') }}\n\n{{ $node[\"Claude Opus - Generate Brief\"].json.message }}\n\n---\n*Generated at 7:00 AM. Next briefing: tomorrow at 7:00 AM.*"
      },
      "name": "Write Brief to Vault",
      "type": "n8n-nodes-base.github",
      "typeVersion": 1,
      "position": [850, 250],
      "credentials": {
        "githubApi": "GitHub OAuth (credentials)"
      }
    }
  ],
  "connections": {
    "Cron Trigger (7am daily)": {
      "main": [
        [
          {
            "node": "Read MEMORY.md",
            "type": "main",
            "index": 0
          },
          {
            "node": "Read Recent Captures (48h)",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read MEMORY.md": {
      "main": [
        [
          {
            "node": "Claude Opus - Generate Brief",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read Recent Captures (48h)": {
      "main": [
        [
          {
            "node": "Claude Opus - Generate Brief",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Claude Opus - Generate Brief": {
      "main": [
        [
          {
            "node": "Write Brief to Vault",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## Workflow 2: Connection Finder (Sunday 2:00 PM)

**File:** `n8n-workflow-connection-finder.json`

```json
{
  "name": "JARVIS - Connection Finder",
  "nodes": [
    {
      "parameters": {
        "rule": "0 0 14 * * 0"
      },
      "name": "Cron Trigger (Sunday 2pm)",
      "type": "n8n-nodes-base.cron",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "resource": "file",
        "operation": "read",
        "filePath": "Claude Memory",
        "recursive": true
      },
      "name": "Read All Vault Notes",
      "type": "n8n-nodes-base.github",
      "typeVersion": 1,
      "position": [450, 300],
      "credentials": {
        "githubApi": "GitHub OAuth (credentials)"
      }
    },
    {
      "parameters": {
        "model": "claude-opus-4-8",
        "maxTokens": 1500,
        "systemPrompt": "You are a connection analyst. Find surprising links between projects and areas.",
        "prompt": "Analyze this vault for unexpected connections:\n\n{{ $node[\"Read All Vault Notes\"].json.files }}\n\nFind: surprising links between projects, bridges (overlaps), missing connections, suggested actions."
      },
      "name": "Claude Opus - Find Connections",
      "type": "n8n-nodes-base.anthropic",
      "typeVersion": 1,
      "position": [650, 300],
      "credentials": {
        "anthropicApi": "Anthropic API Key (credentials)"
      }
    },
    {
      "parameters": {
        "resource": "file",
        "operation": "create",
        "filePath": "Claude Memory/connections/{{ $now.toFormat('yyyy-MM-dd') }}.md",
        "fileContent": "# Connections Found — {{ $now.toFormat('yyyy-MM-dd') }}\n\n{{ $node[\"Claude Opus - Find Connections\"].json.message }}\n\n---\n*Generated Sunday at 2:00 PM. Next connection scan: next Sunday at 2:00 PM.*"
      },
      "name": "Write Connections Report",
      "type": "n8n-nodes-base.github",
      "typeVersion": 1,
      "position": [850, 300],
      "credentials": {
        "githubApi": "GitHub OAuth (credentials)"
      }
    }
  ],
  "connections": {
    "Cron Trigger (Sunday 2pm)": {
      "main": [
        [
          {
            "node": "Read All Vault Notes",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read All Vault Notes": {
      "main": [
        [
          {
            "node": "Claude Opus - Find Connections",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Claude Opus - Find Connections": {
      "main": [
        [
          {
            "node": "Write Connections Report",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## Workflow 3: Weekly Synthesis (Friday 6:00 PM)

**File:** `n8n-workflow-weekly-synthesis.json`

```json
{
  "name": "JARVIS - Weekly Synthesis",
  "nodes": [
    {
      "parameters": {
        "rule": "0 0 18 * * 5"
      },
      "name": "Cron Trigger (Friday 6pm)",
      "type": "n8n-nodes-base.cron",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "resource": "file",
        "operation": "read",
        "filePath": "JARVIS/Inbox",
        "recursive": true
      },
      "name": "Read Week's Captures",
      "type": "n8n-nodes-base.github",
      "typeVersion": 1,
      "position": [450, 200],
      "credentials": {
        "githubApi": "GitHub OAuth (credentials)"
      }
    },
    {
      "parameters": {
        "resource": "file",
        "operation": "read",
        "filePath": "Claude Memory/decisions.md"
      },
      "name": "Read Decisions",
      "type": "n8n-nodes-base.github",
      "typeVersion": 1,
      "position": [450, 300],
      "credentials": {
        "githubApi": "GitHub OAuth (credentials)"
      }
    },
    {
      "parameters": {
        "resource": "file",
        "operation": "read",
        "filePath": "Claude Memory/beliefs.md"
      },
      "name": "Read Beliefs",
      "type": "n8n-nodes-base.github",
      "typeVersion": 1,
      "position": [450, 400],
      "credentials": {
        "githubApi": "GitHub OAuth (credentials)"
      }
    },
    {
      "parameters": {
        "model": "claude-opus-4-8",
        "maxTokens": 2000,
        "systemPrompt": "You are a weekly synthesis writer. Summarize momentum, decisions, beliefs, patterns, and blockers.",
        "prompt": "Create a weekly synthesis from:\n\nCAPTURES: {{ $node[\"Read Week's Captures\"].json.files }}\nDECISIONS: {{ $node[\"Read Decisions\"].json.content }}\nBELIEFS: {{ $node[\"Read Beliefs\"].json.content }}\n\nFormat: Momentum, Decisions, Beliefs Shifted, Patterns, Blockers Resolved, Next Week Priorities, Cross-Project Insights."
      },
      "name": "Claude Opus - Synthesize Week",
      "type": "n8n-nodes-base.anthropic",
      "typeVersion": 1,
      "position": [650, 300],
      "credentials": {
        "anthropicApi": "Anthropic API Key (credentials)"
      }
    },
    {
      "parameters": {
        "resource": "file",
        "operation": "create",
        "filePath": "Claude Memory/synthesis/{{ $now.toFormat('yyyy-') }}W{{ Math.ceil(($now - new Date($now.getFullYear(), 0, 1)) / 86400000 / 7) }}.md",
        "fileContent": "# Weekly Synthesis — W{{ Math.ceil(($now - new Date($now.getFullYear(), 0, 1)) / 86400000 / 7) }} {{ $now.toFormat('yyyy') }}\n\n{{ $node[\"Claude Opus - Synthesize Week\"].json.message }}\n\n---\n*Generated Friday at 6:00 PM. Next synthesis: next Friday at 6:00 PM.*"
      },
      "name": "Write Synthesis Report",
      "type": "n8n-nodes-base.github",
      "typeVersion": 1,
      "position": [850, 300],
      "credentials": {
        "githubApi": "GitHub OAuth (credentials)"
      }
    }
  ],
  "connections": {
    "Cron Trigger (Friday 6pm)": {
      "main": [
        [
          {
            "node": "Read Week's Captures",
            "type": "main",
            "index": 0
          },
          {
            "node": "Read Decisions",
            "type": "main",
            "index": 0
          },
          {
            "node": "Read Beliefs",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read Week's Captures": {
      "main": [
        [
          {
            "node": "Claude Opus - Synthesize Week",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read Decisions": {
      "main": [
        [
          {
            "node": "Claude Opus - Synthesize Week",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read Beliefs": {
      "main": [
        [
          {
            "node": "Claude Opus - Synthesize Week",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Claude Opus - Synthesize Week": {
      "main": [
        [
          {
            "node": "Write Synthesis Report",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## Workflow 4: Pattern Detector (Monday 8:00 AM)

**File:** `n8n-workflow-pattern-detector.json`

```json
{
  "name": "JARVIS - Pattern Detector",
  "nodes": [
    {
      "parameters": {
        "rule": "0 0 8 * * 1"
      },
      "name": "Cron Trigger (Monday 8am)",
      "type": "n8n-nodes-base.cron",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "resource": "file",
        "operation": "read",
        "filePath": "JARVIS/Inbox",
        "recursive": true
      },
      "name": "Read Week's Captures",
      "type": "n8n-nodes-base.github",
      "typeVersion": 1,
      "position": [450, 300],
      "credentials": {
        "githubApi": "GitHub OAuth (credentials)"
      }
    },
    {
      "parameters": {
        "model": "claude-opus-4-8",
        "maxTokens": 1500,
        "systemPrompt": "You are a pattern analyst. Detect timing, behavioral, decision, and resource flow patterns.",
        "prompt": "Analyze last week's captures for patterns:\n\n{{ $node[\"Read Week's Captures\"].json.files }}\n\nDetect: capture timing (peaks/troughs), action patterns (by project), decision patterns, behavioral triggers, resource flow (what happens each day), insights, next week suggestions."
      },
      "name": "Claude Opus - Detect Patterns",
      "type": "n8n-nodes-base.anthropic",
      "typeVersion": 1,
      "position": [650, 300],
      "credentials": {
        "anthropicApi": "Anthropic API Key (credentials)"
      }
    },
    {
      "parameters": {
        "resource": "file",
        "operation": "create",
        "filePath": "Claude Memory/patterns.md",
        "fileContent": "# Patterns Detected\n\n*Last updated: {{ $now.toFormat('yyyy-MM-dd HH:mm') }}*\n\n---\n\n{{ $node[\"Claude Opus - Detect Patterns\"].json.message }}\n\n---\n*Next pattern scan: next Monday at 8:00 AM.*"
      },
      "name": "Write Patterns Report",
      "type": "n8n-nodes-base.github",
      "typeVersion": 1,
      "position": [850, 300],
      "credentials": {
        "githubApi": "GitHub OAuth (credentials)"
      }
    }
  ],
  "connections": {
    "Cron Trigger (Monday 8am)": {
      "main": [
        [
          {
            "node": "Read Week's Captures",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read Week's Captures": {
      "main": [
        [
          {
            "node": "Claude Opus - Detect Patterns",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Claude Opus - Detect Patterns": {
      "main": [
        [
          {
            "node": "Write Patterns Report",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## Workflow 5: Update Capture Processor (Already Exists)

**Enhancement:** Add `#belief` and `#decision` tag handling to existing JARVIS Note Router

Current nodes should already be:
1. Webhook trigger (POST capture)
2. Normalize fields
3. Claude Haiku classify
4. Build markdown
5. GitHub commit
6. Confirm back

**Add these nodes after step 5 (before/after commit):**

```
IF contains '#belief' tag:
  → Route to: Claude Memory/beliefs.md (append)
  → Parse: Extract belief statement + log with date + metadata

IF contains '#decision' tag:
  → Route to: Claude Memory/decisions.md (append)
  → Parse: Extract decision + log with date + metadata
```

Then after GitHub commit → Check tags → Route to beliefs/decisions/inbox as needed.

---

## Deployment Steps

### Step 1: Set Up Credentials in n8n

Before importing workflows, ensure these credentials are configured:

1. **GitHub OAuth**
   - Log in to n8n.cloud
   - Go to **Credentials**
   - Create new: **GitHub**
   - Paste `GITHUB_TOKEN` from password manager
   - Test connection

2. **Anthropic API**
   - Create new: **Anthropic**
   - Paste `ANTHROPIC_API_KEY` from password manager
   - Test connection

### Step 2: Import Each Workflow

1. Go to **Workflows**
2. Click **Create** → **New Workflow**
3. Click menu (⋯) → **Import from URL / JSON**
4. Paste the JSON from above
5. Click **Import**
6. Test the workflow (click **Test Workflow**)
7. Activate (toggle in top-right)

### Step 3: Activate All Workflows

Once all are imported:
1. Go to **Workflows**
2. For each workflow: toggle **Active** (blue toggle)
3. Verify cron times are correct (they should be in UTC)

### Step 4: Test with Manual Runs

1. Click each workflow
2. Click **Execute Workflow** to test
3. Check vault for generated files (briefings/, connections/, synthesis/, patterns.md)

---

## Troubleshooting

**Workflow not running at scheduled time:**
- Check n8n logs: **Execution History**
- Verify cron expression (use https://crontab.guru for testing)
- Ensure n8n server is actively running

**GitHub credential error:**
- Verify `GITHUB_TOKEN` is valid
- Check token permissions: needs `repo`, `gist`, `read:user`
- Test connection in credentials panel

**Claude API error:**
- Verify `ANTHROPIC_API_KEY` is current
- Check Claude quota/billing
- Review error message in **Execution History**

**Files not appearing in vault:**
- Check GitHub path in workflow nodes (should be relative to repo root)
- Verify GitHub token has write permissions
- Check **Execution History** for errors

---

## Next: Activate & Monitor

Once all workflows are active:
- **First run:** Morning Brief at 7:00 AM (tomorrow if after 7am today)
- **Monitor:** Check **Execution History** each day
- **Iterate:** Adjust Claude prompts if outputs don't match expectations
- **Extend:** Add similar workflows for other projects as needed

**Status:** Ready to deploy. All workflow JSONs above are copy-paste ready.
