# HA Assist Integration — v2 Evaluation

**Status:** Research phase. No bundled implementation yet.

**Goal:** Evaluate Home Assistant's native voice assistant (HA Assist) as a complement or future replacement for phone-native JARVIS.

---

## What is HA Assist?

HA Assist is Home Assistant's built-in voice assistant (released ~2023, improving continuously). It runs on the HA hub and can:
- Listen for voice commands (via HA Companion app on phone or dedicated device)
- Understand intents (turn on light, set temperature, etc.)
- Execute actions directly or route to custom services
- Multi-language support

**Key difference:** HA Assist is hub-native; phone JARVIS is phone-native.

---

## Comparison: HA Assist vs Phone JARVIS

| Aspect | HA Assist | Phone JARVIS v2 |
|--------|-----------|-----------------|
| **Location** | HA hub (centralized) | Phone (decentralized) |
| **Latency** | ~1-2s (network) | ~0.5-1s (local) |
| **Offline** | Requires hub network | Works locally + Ollama |
| **Privacy** | Routes through HA | Phone-native, Keystore |
| **Wake word** | App-triggered or Nabu Casa | "Hey Jarvis" local detection |
| **Extensibility** | YAML automations | Bash scripts + Claude |
| **Phone dependency** | HA Companion app | Native Termux |

---

## Integration Pathways (v2.1+)

### Option A: Parallel (Recommended for v2)
Both systems run independently:
- **Phone JARVIS:** Primary for personal capture, quick actions, offline
- **HA Assist:** Companion for hub-based automations, group commands
- **Bridge:** HA automation can trigger JARVIS action via HTTP

**Pros:**
- No single point of failure
- Choose tool per task
- Gradual migration path

**Cons:**
- Dual voice assistants (confusing UX)
- Potential conflicts if both respond

### Option B: Phone JARVIS routes to HA Assist
Phone JARVIS catches wake word, then delegates to HA Assist for intent understanding:
- Phone listens → "hey jarvis, turn on the lights" → routes to HA Assist → HA executes
- Reuses HA Assist's intent engine

**Pros:**
- Single source of truth (HA Assist for intents)
- Reuse HA automations

**Cons:**
- Network dependency (HA hub must be reachable)
- Adds latency
- Breaks offline mode

### Option C: HA Assist routes to Phone JARVIS
HA Assist triggers, phone JARVIS executes:
- HA Assist recognizes command → sends to phone JARVIS via MQTT/HTTP → classification + action
- Reuses JARVIS's flexibility

**Pros:**
- Phone handles everything (Keystore, offline fallback)
- HA stays simple

**Cons:**
- Still requires network
- Complexity in bidirectional routing

### Option D: Migrate to HA Assist (v2.2+)
Deprecate phone JARVIS, move all to HA Assist + HA Companion:
- HA Assist as primary voice interface
- Companion app on phone for capture/actions
- JARVIS as fallback

**Pros:**
- Single interface
- HA ecosystem integration

**Cons:**
- Loses phone-native independence
- Requires HA hub always online
- Network dependency

---

## Recommended Path (v2–v3)

**v2 (now):**
- Keep phone JARVIS as primary, HA Assist as optional companion
- No bridge code yet
- Document integration path

**v2.1 (Q3 2026):**
- Add optional `ha-assist-bridge.sh` (triggers HA Assist intent recognition)
- Test Option A (parallel)

**v2.2 (Q4 2026):**
- Evaluate HA Assist maturity
- If HA Assist speech-to-text + offline support improves, consider Option D
- Otherwise, keep both as complementary

---

## Implementation Checklist (Optional, v2.1+)

- [ ] Test HA Assist on your hub (Settings → Voice assistants → Home Assistant)
- [ ] Check HA Assist's speech-to-text (local or Nabu Casa cloud)
- [ ] Create sample HA Assist intent (e.g., "turn on lounge lights")
- [ ] Design MQTT/HTTP bridge protocol (if going with Option A)
- [ ] Document decision in this file with test results

---

## Known Limitations (HA Assist 2026)

1. **Speech-to-text:** Requires cloud (Nabu Casa) or locally-trained model
2. **Offline mode:** Limited (needs pre-cached responses)
3. **Customization:** YAML automations, not Claude-powered classification
4. **Phone capture:** Still needs Companion app or manual input
5. **Wake word:** Not built-in; app-triggered or always-listening (battery drain)

**Status:** HA Assist is improving; re-evaluate Q3 2026.

---

## Decision Framework

**Choose HA Assist if:**
- You want hub-native, always-on setup
- Privacy concerns with cloud STT (use local model)
- Happy with YAML automations
- Don't need phone-offline capability

**Keep Phone JARVIS if:**
- Want phone independence + offline Ollama
- Prefer Claude classification over YAML
- Need wake-word on phone without always-listening
- Value Keystore secrets management

**Use Both if:**
- Hub automation + phone capture both valuable
- Can tolerate dual interfaces
- Want Options A or B above

---

## Next Steps

1. **Test HA Assist:** Set up on your hub, test intent recognition
2. **Document findings:** Add test results to this file
3. **Decide:** Option A (parallel), B (delegated), C, or D
4. **v2.1:** Implement bridge if Option A chosen
5. **Revisit:** Q3 2026 when HA Assist matures further

---

## References

- [HA Assist docs](https://www.home-assistant.io/voice_control/)
- [HA Companion app](https://companion.home-assistant.io/)
- [Nabu Casa cloud STT](https://www.nabucasa.com/)
- JARVIS Phone-Native: `../phone/README.md`, `SPEC.md`

---

**Last updated:** 2026-06-16  
**Status:** Research; no breaking changes to JARVIS v2  
**Revisit:** Q3 2026
