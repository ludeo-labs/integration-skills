---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Are you capturing an encounter/wave/phase system through boolean flags (isStarted, isFinished, isActive) instead of its underlying state enum? Find every writer of each boolean first - if any writer clears it while the system is still mid-life, moments captured at that instant will be misclassified, and players mark moments exactly at those transitions."
sanitized: true
---

# Capture the state machine, not its derived booleans

Encounter and wave systems are state machines; the booleans they expose are projections of that
machine, written for the game's own narrow needs. A projection can be momentarily false about the
whole: here, the only writer of `isSpawn = false` was `FinishWave` — which fires when the
encounter runs OUT OF CONFIGURED WAVES, even while survivors are still fighting. A moment marked
there captured "never started" for a live fight; the restore discarded the recorded enemies and
the game ran a fresh encounter over the room.

The compounding factor is behavioral: **players mark moments right after clearing a wave**, so
clip starts cluster exactly on the boundaries where the derived flags are at their least truthful.
This one family of misreads produced three separately-diagnosed bugs before the root pattern was
named (a dead finished-flag, an alive-list that drops members at transitions, and the
started-classification miss).

## The fix shape

Expose and capture the enum itself (a one-line read-only accessor on the manager keeps it
private), and classify on restore from the enum. Two practical notes:

- **Transient states cannot be restored as themselves.** A state that only exists inside a
  synchronous call, or whose in-flight async queues cannot be rebuilt from a recording (a
  `Spawning` state with pending spawn tasks), must map to the nearest stable state and let the
  machine re-derive the transition through its own logic.
- **Keep the boolean path as a fallback** for recordings made before the enum was captured.
