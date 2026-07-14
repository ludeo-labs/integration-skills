---
category: common-mistakes
tier: universal
sourceGame: TacticsGame
phase: 3
question: null
sanitized: true
---

# Verify every planned hook has a live caller reachable in the curated slice

## The Mistake (caught before it shipped)

Stage 1 analysis on TacticsGame identified the studio's C++ GameMode bridge methods as the
lifecycle hooks: a `FinishedSpawning()`-style battle-ready callback (room open) and
`CompleteMissionSuccess/Fail/Surrender` mission-end methods (room close). They were
BlueprintCallable, well-named, and clearly *designed* as the toolkit→C++ bridge.

Stage 2 verification showed **none of them fire in the curated slice**:

- The battle-ready callback's only BP caller was a spawn-manager Blueprint that is **not placed
  in the curated quick-play maps** — those maps have units pre-placed in the umap, so the
  spawn flow (and the callback) never runs there.
- The mission-end methods had **zero BP callers anywhere** in Content — designed but never wired
  (dead code).

Had Stage 2 scaffolded room open/close on those hooks, the integration would have compiled, run,
and silently never opened or closed a room — the classic silent N-way-gate failure.

## The Rule

A hook is not a hook until you have verified the **complete firing path** in the curated slice:

1. **Who calls it?** For BlueprintCallable C++ methods, ASCII-scan Content for the method name
   (`[IO.File]::ReadAllBytes` + string search across `.uasset`/`.umap`) or use the BP graph
   report. Zero callers = dead code, regardless of how intentional the method looks.
2. **Does the caller exist in the slice?** A caller BP that exists as an asset but is not placed
   in (or spawned for) the curated maps will never run. Scan the slice's `.umap` files for the
   caller's class name.
3. **Empty bodies are a red flag, not a feature.** "C++ body is empty, driven from BP" often
   means "the studio planned this and never finished it." Treat empty-bodied methods as
   unverified until a caller is proven.

## What to use instead

When the designed bridge is dead, the live signals are usually on the toolkit's own
GameState/manager Blueprints (phase enums, multicast delegates) — reachable via reflection with
zero BP edits. See [[toolkit-gamestate-phase-enum-is-the-gate]].

## Cost of skipping this check

The dead hooks were found with ~3 minutes of uasset scanning. Discovering them at runtime
verification would have cost a full build + test cycle and looked like an SDK bug ("room never
opens") instead of a game-analysis bug.
