---
category: architecture
tier: generalizable
sourceGame: ActionRoguelike
phase: 2
question: "Does this game have an explicit game phase/state enum? If not, recommend adding one rather than relying on implicit state detection (e.g., health > 0 = playing)."
sanitized: true
---

Do not rely on implicit state detection (e.g., player health > 0) for the N-way gate's gameplay-active condition. Instead, require an explicit game phase enum (e.g., `Loading`, `Playing`, `Dead`, `Respawning`) in the core game. The Ludeo component reads this enum for reliable phase gating.

Reviewer flagged implicit health-based detection as fragile — it doesn't account for loading, warmup, or transition states.
