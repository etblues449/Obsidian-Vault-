# FinCast Studio — Project Index

## Goal
A complete AI video generation pipeline for the Faceless Finance YouTube channel. Script in → stitched cinematic video out.

## Status (2026-05-17)
- Next.js app scaffolded and fully built at `/home/user/fincast-studio`
- TypeScript clean, committed locally — **needs pushing to a new GitHub repo**
- HeyGen render in flight (4 scenes, Pexels b-roll, TTS audio)
- Current pipeline working via Cloudflare Worker proxy at `fincast-worker.elliothorton5.workers.dev`

## Architecture

```
Script (114 words)
  ↓ Claude opus-4-7 storyboard (4 scenes × 28 words, + shot + audio direction)
  ↓ Per-scene parallel:
      TTS: ElevenLabs → Google TTS
      Video: Veo 3 → Runway gen4_turbo → Higgsfield dop-turbo → HeyGen+Pexels
  ↓ SSE stream → Next.js studio UI
  ↓ Remotion FincastVideo composition (Sequence × scenes)
  ↓ Local render or AWS Lambda → MP4 download
```

## Known Bug Fixes (as of this build)

| Bug | Fix |
|---|---|
| Veo 3 renders silent | Explicit `Audio:` direction appended to every scene prompt |
| Storyboard collapsed to 1 scene | 28-word limit enforced per scene; sceneCount = wordCount ÷ 28 |
| Runway rejects image (ratio 0.429) | `sharp` pads image to ≥ 0.5 aspect ratio before submission |
| Higgsfield 404 model not found | Model changed from `dop-standard` → `dop-turbo` |

## Key Files

| File | What it does |
|---|---|
| `src/lib/storyboard.ts` | Claude API → JSON scene array (narration + shot + audio) |
| `src/lib/orchestrator.ts` | Provider waterfall per scene (runs TTS + video in parallel) |
| `src/lib/providers/veo3.ts` | Veo 3 with audio direction + long-running operation poll |
| `src/lib/providers/runway.ts` | Runway gen4_turbo with aspect ratio fix |
| `src/lib/providers/higgsfield.ts` | Higgsfield dop-turbo (fixed model name) |
| `src/lib/providers/heygen.ts` | HeyGen + Pexels b-roll final fallback |
| `src/lib/tts.ts` | ElevenLabs → Google TTS |
| `src/app/api/pipeline/start/route.ts` | SSE streaming pipeline endpoint |
| `src/remotion/FincastVideo/` | Remotion composition: OffthreadVideo + Audio per scene |
| `src/app/page.tsx` | Studio UI (dark mode, live scene cards, provider badges) |

## Environment Variables
See `.env.example`. Must set at minimum: `ANTHROPIC_API_KEY` + one video provider + one TTS provider.

## Next Actions
- [ ] Create new GitHub repo (`etblues449/fincast-studio`) and push
- [ ] Copy `.env.example` → `.env` and fill in API keys
- [ ] Run `npm run dev` and test with a real script
- [ ] Verify Runway aspect-ratio fix (reference image was 0.429, needs ≥ 0.5)
- [ ] Verify Higgsfield dop-turbo endpoint (was 404 on dop-standard)
- [ ] Rotate Google API key (Veo 3 quota exhausted on old key)
- [ ] Deploy to Vercel (`vercel.json` already included)
- [ ] Optional: set up AWS Lambda for production-quality renders (`node deploy.mjs`)

## Existing Worker
The Cloudflare Worker at `fincast-worker.elliothorton5.workers.dev` is a CORS proxy.
From Next.js server-side routes there is no CORS issue — providers can be called directly without the proxy.
The fincast-studio app calls providers directly.
