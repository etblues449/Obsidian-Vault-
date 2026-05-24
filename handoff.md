# Session Handoff — Faceless Finance automation

**Date:** 2026-05-20
**Author:** Claude Code session

---

## 1. The goal we're working toward

A **fully automated UK personal-finance short-form video channel**. One consistent
on-camera presenter — "Elliot," a British man in his late 20s (locked spec in
`Faceless-Finance/CHARACTER_BIBLE.md`) — who appears to **walk around real UK
settings while talking to camera**, speaking in the creator's **ElevenLabs voice
clone** ("JB Blues Script").

End-to-end pipeline target: **idea → script → voiceover → talking video →
captions → auto-post to TikTok / YouTube Shorts / Instagram Reels.**

Constraints: paid API keys available; a server available; **no local GPU box**;
content must be **FCA-safe** (education not advice, UK 2025/26 terms).

## 2. Repos & where things live

| Repo | Location | Notes |
|---|---|---|
| **Product** | `github.com/etblues449/Faceless-Finance` (cloned at `/home/user/Obsidian-Vault-/Faceless-Finance`, gitignored from the vault) | All active code. Push access via stored PAT. |
| **This vault** | `github.com/etblues449/Obsidian-Vault-` | Where this handoff lives. Authorized branch: `claude/review-screenshots-8l6ng`. |
| Reference clones (gitignored) | `Fincast/` (ancestor), `claude-android-skill/`, `Stable-Video-Infinity/` | Read-only references. |

## 3. Current state of the code

- **Faceless-Finance was consolidated from 71 branches → 1 branch `main`** (now the
  default branch). `main` = the old `Faceless-Finance-App` tip: the complete
  single-file app (`index.html`), the Cloudflare `worker/`, `CHARACTER_BIBLE.md`,
  Elliot reference photos, and the Pages deploy workflow. All other branches were
  squash-merged or stale and were deleted.
- `index.html` is a **~5,060-line single-file React app** (React 18 via esm.sh
  importmap + in-browser Babel). **Verified mounting cleanly** in a real browser:
  0 page errors, 0 console errors, all 7 tabs render.
- **Two OPEN DRAFT PRs against `main` (neither merged yet):**
  - **#76 `feat/automation-pipeline`** — the NEW recommended production pipeline in
    `pipeline/` (see §5). Zero deps, 28 passing tests, full docs.
  - **#77 `fix/remove-longcat-provider`** — removes the dead LongCat HF-Space
    provider from `index.html` (−241 lines). Verified app still mounts + all tabs OK.
- Video providers still in `index.html`: Veo 3 (top fast-path), Runway Gen-4, Fal
  Seedance 2.0, Higgsfield, HeyGen, Hedra. (LongCat removed on the #77 branch.)
- The app's `worker/` (Cloudflare Worker for CORS proxy + social auto-publish)
  still exists on `main` but is **superseded** by the Postiz approach in the pipeline.

## 4. Key decisions made this session

- **Research verdict — best ready-built path:** **HeyGen Avatar V** is the only 2026
  product that delivers a *consistent twin walking while talking to camera* with an
  API + native ElevenLabs. Pair with **self-hosted Postiz** for free, official-API
  auto-posting to all three platforms. (Argil = runner-up but talking-head only;
  AutoShorts = faceless autopilot.) Strategic call: **lean on HeyGen + Postiz rather
  than finishing the bespoke multi-provider engine.**
- **Provider priority in `index.html`:** Veo 3 first (free via Google AI Studio
  quota), Runway paid fallback.
- **Open product question (NOT decided):** `index.html` currently *forbids*
  direct-to-camera (cinematic b-roll + voiceover only). The user wants "walking AND
  talking to camera." The new pipeline (HeyGen Avatar V) is built for the
  talk-to-camera vision; the legacy app still enforces the no-talking-head rule.

## 5. Files touched / actively being modified

**New — `pipeline/` (branch `feat/automation-pipeline`, PR #76):**
- `src/{config,logger,http,anthropic,elevenlabs,heygen,captions,postiz,ideas,pipeline,cli}.js`
- `test/{captions,anthropic,heygen,postiz,pipeline}.test.js` — 28 tests, run via `npm test`, no network/keys
- `deploy/postiz/{docker-compose.yml,README.md,.env.example}`
- `README.md`, `.env.example`, `.gitignore`, `package.json`

**Modified — `index.html`** (branch `fix/remove-longcat-provider`, PR #77): LongCat removal.

**Environment / not in any repo:**
- `~/.config/git/ignore` — added the local reference-clone dirs.
- `~/.git-credentials` — stores the PAT used to push to etblues449 repos.
  ⚠️ **SECURITY: it is a classic token with near-full account scope and was pasted
  into the chat. ROTATE IT.**
- `/tmp/ffcheck/{check.js,nav.js}` — Playwright render/nav verification scripts.

## 6. What was tried that failed, and why

1. **Push to Faceless-Finance via built-in tooling** — failed: GitHub MCP is
   hard-restricted to the vault repo, and the sandbox had no git credentials
   (`git push` → "could not read Username"). **Resolved** once the user supplied a
   PAT (now in `~/.git-credentials`).
2. **Browser render with default Chromium** — failed with
   `ERR_CERT_AUTHORITY_INVALID`: the sandbox has a TLS-intercepting proxy whose cert
   Chromium doesn't trust, so CDN deps (React/Babel) wouldn't load. **Resolved** by
   launching Chromium with `--ignore-certificate-errors` + `ignoreHTTPSErrors: true`.
   (git/curl are unaffected — they trust the chain.)
3. **The LongCat-Avatar HF-Space render (the user's failing logs)** — fails
   permanently: the Space `cpuai/LongCat-Video-Avatar` requests **900s of ZeroGPU
   per call**, above HF's per-call max → *"GPU duration (900s) is larger than the
   maximum allowed"* on every scene. The 900s is hard-coded in the Space, so it is
   **unfixable client-side**. The `"An error occurred"` positional retry was a
   downstream symptom of the same rejection. **Removed in PR #77.**
4. **Live end-to-end render of the new pipeline** — NOT attempted: needs the user's
   real Anthropic/ElevenLabs/HeyGen keys + a created HeyGen Avatar V twin + a running
   Postiz. Pipeline logic is unit-tested with mocked I/O; **the real-API field
   mappings (HeyGen Avatar V payload, Postiz public API) are UNVERIFIED against live
   accounts.**

## 7. The single next thing to try, and why

**Merge PR #77 then PR #76 into `main`, then run one live pipeline `--dry-run` with a
real Anthropic key:**

```bash
cd pipeline
cp .env.example .env        # set at minimum ANTHROPIC_API_KEY
node src/cli.js run --topic "How the £20k ISA allowance works in 2025/26" --dry-run
```

**Why:** #77 is verified low-risk cleanup; #76 is the production path that matches the
goal. The `--dry-run` exercises the script-generation stage end-to-end for pennies and
confirms the wiring. Then, after creating the Avatar V "Elliot" twin in HeyGen and
connecting TikTok/YT/IG in Postiz, drop `--dry-run` for the **first real published
video**. This is the smallest step that converts "built + green unit tests" into
"verified working against real accounts" — the one remaining unknown (§6.4).

(Then, separately: decide the open aesthetic question in §4, and **rotate the PAT**.)
