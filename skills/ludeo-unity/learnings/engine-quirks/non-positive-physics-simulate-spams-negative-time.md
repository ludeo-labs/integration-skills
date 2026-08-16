---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the game step physics from script (SimulationMode.Script + Physics.Simulate(dt)) with a dt derived from a game-owned time scale? If the restore freeze zeroes that scale, every FixedUpdate calls Simulate with a non-positive step and Unity warns 'called with a negative time' each time."
sanitized: true
---

# A frozen game that steps its own physics spams "Physics.Simulate ... negative time"

The game stepped physics from script: `Physics.Simulate(fixedDelta * gameTimeScale)` every
FixedUpdate. The restore freeze sets that scale to 0 — and every fixed step for the whole frozen
wait produced Unity's *"Physics.Simulate(...) was called with a negative time. This is not
supported therefore the simulation was not run."* One pre-play wait logged **1,566** of them; a
longer one, thousands.

Two traps inside the trap:

- **The message says "negative"; the value need not be.** A diagnostic guarding `dt < 0f` sat two
  lines above the Simulate call for days and never fired while Unity warned continuously — the
  step was zero (or non-finite), which `< 0f` does not catch but Unity still rejects. Write such
  checks as `!(dt > 0f)`, which also catches NaN.
- **The spam buries real errors.** At thousands of lines per minute it made every log read a dig,
  and twice masked the actual failure line of the run.

The fix is one guard at the call site, and it is semantically correct, not a workaround: physics
not advancing is exactly what a zero time scale means, so skip the call rather than make it and
have it refused:

```csharp
if (physicsDt > 0f)
    Physics.Simulate(physicsDt);
```

Worth checking in any game whose freeze mechanism is a game-owned time scale rather than
`Time.timeScale` — the engine-driven fixed loop keeps running and keeps calling whatever the game
put in FixedUpdate.
