---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 4
question: null
sanitized: true
---

# Always ask about pre-gameplay phases during Player Flow implementation

During Stage 3 Player Flow implementation, the AI must ask: **"Does the curated slice have a warmup, countdown, or 'waiting for players' phase before gameplay starts?"**

If yes (almost always for multiplayer/competitive games), Player Flow must skip it. This is NOT optional — without it, the player sits through a meaningless warmup before the restored state is applied.

This question should be in the Phase 03 reference file's "Questions to Ask the Human" section. The answer drives a core game modification (adding SkipPhase to the phase system) which cannot be inferred from code alone — it requires understanding the Player Flow user experience.

**Games that typically have pre-gameplay phases:**
- FPS/TPS with warmup (Lyra, Fortnite-style)
- MOBAs with pick/ban phases
- Battle royale with lobby/bus phases
- Racing games with countdown
- Any game with a "waiting for players" state
