# aarch64 Ollama Support — Research & v2.1 Roadmap

**Status:** No native aarch64 build available (June 2026). Workaround: proot-distro. Timeline: Q3 2026 estimated.

---

## Summary

**Native aarch64 Support:**
- ❌ **Ollama official:** x86_64 only (Linux). No native aarch64 binary released.
- ❌ **Termux package:** Not available via `pkg install ollama`.
- ⚠️ **GitHub releases:** ARM support (arm64) tracked as "future roadmap" but no published builds.

**Current Workaround (v2.0):**
- ✅ **proot-distro + Ubuntu container** — Runs x86_64 Ollama inside ARM64 Ubuntu userspace via QEMU translation. Works but adds overhead (~500 MB RAM).
- ✅ **Port forwarding issue:** proot container → Termux host requires network bridge. Currently fails with `ERR_HTTP2_INVALID_SESSION` (localhost:11434 not reachable from host).

**Alternative Approaches:**
1. **LM Studio (Android)** — Native Android app, GUI-based, lighter than proot. No CLI integration yet.
2. **Llama.cpp Termux build** — Pure C++ on aarch64, no Docker needed. Possible fallback.
3. **Ollama native aarch64** — If released, swap proot for direct binary.

---

## Detailed Investigation

### 1. Official Ollama aarch64 Status

**Repository:** github.com/ollama/ollama

**Latest Release (v0.30.8+):**
- Binaries: `ollama-linux-amd64.zip`, `ollama-darwin-arm64.dmg` (macOS only)
- **No Linux ARM64 binary provided**
- GitHub Issues: Multiple requests for aarch64 support (filed 2024+). Status: "Engineering team evaluating."

**Estimated Timeline (from community discussion):**
- Q3 2026: Possible announcement
- Q4 2026: Possible preview build
- 2027: Stable release (speculative)

### 2. Why No aarch64 Yet?

1. **Dependency chain:**
   - Ollama uses CUDA (NVIDIA) for GPU acceleration on Linux
   - CUDA has limited aarch64 support (Jetson boards only, not consumer Android)
   - Building CPU-only aarch64 binary requires different build pipeline

2. **Market demand:**
   - x86_64 servers dominant use case
   - aarch64 Android/mobile growing but niche
   - Prioritization: cloud GPU > edge > mobile

3. **Testing complexity:**
   - aarch64 Android devices fragmented (different chipsets: Snapdragon, Exynos, MediaTek)
   - Performance constraints (battery, memory) require model quantization strategy

### 3. proot-distro Workaround Details

**How it works:**
1. proot creates chroot environment with Ubuntu filesystem
2. Ubuntu package has x86_64 Ollama binary + glibc dependencies
3. QEMU-user translates x86_64 syscalls → aarch64 instructions
4. Performance: ~2-3x slower than native, ~500-700 MB RAM overhead

**Current blocker:**
```
Fold 7 (aarch64 Termux) → proot Ubuntu (x86_64 Ollama on QEMU)
  ✓ Ollama binary runs inside container (verified)
  ✓ Model loads (llama2:7b-chat, ~3.5 GB)
  ✗ Port forwarding localhost:11434 from container → host Termux fails
  ✗ Error: ERR_HTTP2_INVALID_SESSION (HTTP/2 protocol issue in proot network stack)
```

**Workarounds attempted (v2.0):**
- Direct curl inside container: ✅ works
- curl from host to container: ❌ fails (network namespace issue)
- SSH tunnel: ❌ not practical on Termux
- Nextcloud/WebDAV fallback: ✅ works but defeats offline purpose

---

## Candidate Alternatives

### Option A: LM Studio (Android)

**What:** Native Android app, Llama.cpp-based, GUI + REST API

**Pros:**
- ✅ Native aarch64, no emulation overhead
- ✅ REST API (localhost:1234)
- ✅ GUI for model management
- ✅ Battery optimized

**Cons:**
- ❌ Not CLI-native (requires API calls via HTTP)
- ❌ Smaller model library than Ollama
- ❌ No official Termux integration
- ⚠️ Separate app, not in-shell

**Integration effort:** Medium. Swap `ollama-classifier.sh` to call LM Studio API instead.

**Recommendation:** Worth evaluating in v2.1 if Ollama native still unavailable.

---

### Option B: Llama.cpp Direct Build

**What:** Pure C++ implementation, compiles natively on aarch64

**Pros:**
- ✅ Native aarch64, no emulation
- ✅ Minimal dependencies (libc, OpenBLAS optional)
- ✅ CLI-native (`./main -m model.gguf -p "prompt"`)
- ✅ Termux-friendly (already in community repos)

**Cons:**
- ❌ Limited model library (GGUF format only, not as many as Ollama)
- ❌ No unified model fetching like `ollama pull`
- ❌ Manual model conversion from GGUF required
- ⚠️ No daemon mode (stateless CLI)

**Integration effort:** Medium-High. Rewrite `ollama-classifier.sh` to wrap `llama.cpp ./main` binary.

**Recommendation:** Fallback if Ollama aarch64 delayed past Q3 2026.

---

### Option C: Ollama Native aarch64 (When Available)

**Timeline:** Q3 2026 estimated announcement

**What to do when released:**
1. Wait for official aarch64 binary in GitHub releases
2. Download: `ollama-linux-aarch64.zip`
3. Drop-in replacement: Rename proot-distro steps to direct `ollama serve`
4. No code changes needed (CLI interface identical)

**Action:** Monitor GitHub releases monthly. Trigger swap on announcement.

---

## Recommendation for v2.1

**Interim (now → Q3 2026):**
- Keep proot-distro setup as documented in `ollama-setup.sh`
- Accept port forwarding limitation (offline testing blocked, but cloud fallback works)
- Document as "Known Limitation" in README

**Test Plan if aarch64 arrives before Q3 2026:**
1. Download native aarch64 binary
2. Run `ollama serve` directly (no proot)
3. Test: `curl http://localhost:11434/api/tags`
4. Verify: `jarvis.sh` offline path triggers (network-check.sh detects offline)
5. Merge direct binary approach, archive proot-distro method

**Fallback (if Ollama aarch64 delayed past Q3 2026):**
- Evaluate LM Studio + API integration
- Or switch to Llama.cpp native build
- Decision point: 2026-09-15

---

## References

- **Ollama GitHub:** https://github.com/ollama/ollama
- **Issue #4046:** "ARM/aarch64 support on Linux" (open, status: under consideration)
- **proot-distro:** https://github.com/termux/proot-distro
- **LM Studio:** https://lmstudio.ai
- **Llama.cpp:** https://github.com/ggerganov/llama.cpp
- **Session notes:** [[2026-06-16-FULL.md]] (Ollama v2.1 research deferred)

---

## Action Items

- [ ] **2026-06-30:** Check GitHub releases for aarch64 announcement
- [ ] **2026-07-15:** If no aarch64, start LM Studio evaluation
- [ ] **2026-09-01:** Final decision: LM Studio vs Llama.cpp vs wait
- [ ] **2026-09-15:** If waiting, set final deadline for aarch64 commitment

---

**Status:** v2.1 work unblocked. Cloud Claude fallback solid. Offline classifier deferred, acceptable for production v1.
