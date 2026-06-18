---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# Action stream must pass a 5-point quality checklist before Stage 4 is "done"

The cloud's highlight picker depends on action density and signal quality. Sparse, single-axis action streams produce weak highlights regardless of how good state restoration is. Before declaring Stage 4 complete, the action set must pass **all 5** checks below.

## The 5-point checklist

| # | Check | Why it matters |
|---|---|---|
| 1 | **Per-player attribution** | Every `SendAction` passes `PlayerID`. Co-op highlight reels are split per player; without this, all kills attribute to player 0 (or no one). |
| 2 | **Combat heartbeat** | Per-shot or per-damage-taken actions fire during firefights. Without this the cloud has no "intensity" signal — it can't distinguish a 30-second firefight from 30 seconds of standing still. |
| 3 | **Kill-method split** | `Headshot`, `Melee`, `Explosive`, `Stealth` are separate actions. The cloud cannot derive method from a generic `Kill`. |
| 4 | **Mission-beat actions** | Map-specific scripted moments fire as actions (e.g. `DeviceStarted`, `DeviceActivated`, `AreaBreached`, `ExtractionArrived`). Highlights anchor on these. |
| 5 | **Pause/resume markers** | `PauseGame` / `ResumeGame` fire as actions. The cloud distinguishes player-driven pauses from cloud-driven (Player Flow) pauses, and trims correctly. |

## Anti-pattern: the two-action Stage 4

`MatchStateChange` + a single poll-based `Kill` is **not enough**. Density ≈ 1 action/min. The cloud highlight picker has nothing to work with. Reference Lyra integration tracks 6 actions; ActionGame integration tracked 14.

## How to apply

During Stage 4 design review, walk the 5 checks against the planned action set:

- For each missing check, write down what action(s) would satisfy it.
- Treat any missing check as a **blocker** — surface in the implementation plan, not after Stage 4 closes.
- Do not stub. If a check is hard to satisfy (e.g. no clean damage hook), the right move is to ask, not to skip.

## Cross-reference

- `standard-fps-action-set.md` — concrete FPS action minimums (Lyra reference).
- `name-actions-from-player-perspective.md` — naming rules (no embedded variable data).
- `action-axis-player-method-not-victim-taxonomy.md` — attribution axis.
- `design-actions-for-goals-and-constraints.md` — action design framing.
