---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: 3
question: "Beyond the mission/random seed, what runtime state gates gameplay decisions in this game (RNG streams, enabled-actor arrays, timers, occupancy lists, modifier tags, completed-counters)? Each of these may need to be captured for snapshot-replay determinism."
sanitized: true
---

# Snapshot-replay determinism is a coverage problem, not a model limitation

## The mistake

Treating "Ludeo Player Flow is snapshot, not event-replay" as a fundamental limitation. Saying things like "the reinforcement vehicle's arrival is an event that fires *over time*; we can't reproduce that in a snapshot model" is wrong — and pushed back hard by the user during ActionGame integration. They were right.

## The actual rule

If you capture **every gating state field** that influences future gameplay decisions, the engine evolves naturally from that state forward. Events re-fire on their own. The snapshot model isn't restrictive; it's only as faithful as your capture coverage.

The hard part is *finding* all the gating state. It's not just the obvious things (positions, health, phase). It includes:

| Class of gating state | Examples (ActionGame) |
|---|---|
| RNG stream mid-positions | `AWaveSpawnDirector::VehicleRandomStream` (`FRandomStream::GetCurrentSeed`); global `FMath::SRandSeed` |
| Runtime arrays populated by gameplay events | `EnabledVehicleSplines` (gameplay calls `SetVehicleSpawnEnabled`); `OccupiedVehicleSplines` (set when vehicle starts driving) |
| Counters that gate later events | `AMissionState::CompletedWaveCount` (the reinforcement-vehicle gate compares against this); `WaveToSpawnReinforcement` (decided once at level init) |
| Cached derived state | `CachedSpawnOrders` (populated by `SetProgressionIndex`); restoring `CurrentProgressionIndex` directly leaves the cache stale |
| Active modifier tags | `Reinforcement_CooldownReduction`, `Reinforcement_EndlessWave` (driven by gameplay events; bypass quota lockouts) |
| Soft-pointer paths | Asset paths (`UDataAsset::GetPathName`), level-placed actor paths (`AActor::GetPathName`) — round-trip via `LoadObject` / `FindObject` |

A single missing field can cascade: missing `EnabledVehicleSplines` → predicate filter rejects all vehicles → vehicle pump permanently disabled → no vehicle ever drives in.

## How to find gating state

1. Identify the user-visible behavior that's broken on replay (vehicle doesn't drive in, wave dries up, etc.).
2. Trace the engine code path that produces that behavior in live gameplay. Find every `if`/predicate/early-return that gates the decision.
3. For each gate, identify the source of truth — is it a captured field, derived state, or runtime-only?
4. If runtime-only and not captured: that's a coverage gap.
5. **Add per-gate diagnostic Warning logs** before guessing — see `learnings/common-mistakes/instrument-compound-filters.md`. The cause is often surprising.

## How to apply

When a user reports "X doesn't happen on replay" and X is supposed to fire naturally:

1. Don't say "snapshot model can't do this" — that's a copout.
2. Instrument the gate, run a replay, see which condition fails.
3. Add the missing gating state to the snapshot.
4. Mirror the natural flow restoration where possible (re-fire events, refresh caches) rather than synthesizing outcomes (force-activating modifiers — that was an early hack on ActionGame that the principled fix replaced).

## Anti-pattern: synthesizing outcomes

Earlier in the same session, I proposed force-activating the `Reinforcement_CooldownReduction` modifier on restore whenever `LevelProgression >= 0.99`. This is an OUTCOME-level hack that approximates "what live play would look like seconds later." It hides the real coverage gap (missing `WaveToSpawnReinforcement` + `CompletedWaveCount` capture). User correctly rejected it. The principled fix — capture the gate's inputs, let the natural event re-fire — is always cleaner and supports any capture moment, not just end-game.
