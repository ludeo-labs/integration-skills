---
category: common-mistakes
tier: generalizable
sourceGame: CoopShooter
phase: 5
question: "Does this game escalate a GLOBAL alert/phase/reinforcement state as a SIDE EFFECT of AI death or destruction (an alarm on an unanswered kill, a 'call it in' radio, aggro/panic spread, a reinforcement timer)? If yes, your Player-Flow restore that destroys or replaces AI actors will trip that mechanic — suppress it across the whole restore window."
sanitized: true
---

# Player-Flow restore that destroys/spawns AI trips the game's own AI-death side effects — which can mutate GLOBAL state

## Precondition
The game has a mechanic where an AI **dying or being destroyed** escalates
**shared/global session state** — e.g. a stealth game where an un-neutralized
guard "calls it in" (radio/pager), a horde game where a death triggers a
reinforcement wave, or any "unanswered kill → raise alarm" counter. AND your
Player-Flow restore destroys/replaces AI actors (to de-dupe level-spawned NPCs,
or to spawn captured corpses for silently-killed enemies).

If AI death has no global side effect in this game, this learning does not apply.

## The trap
Restore is not a passive "set the world to a snapshot." Destroying an actor runs
its **normal destruction path** — `EndPlay` / `Destroyed` / death-cleanup hooks —
and those hooks can fire the game's live gameplay mechanics. On one co-op stealth
game, the restore did two ordinary things:

1. swept level-Blueprint-spawned duplicate guards (destroyed them), and
2. spawned captured corpses for guards the player had killed *silently* during
   creation,

and **both** paths ran the guard's death-cleanup, which incremented an
"unanswered kill" counter and, past a threshold, dispatched a **global alarm**
(stealth → alerted). So a moment captured in clean stealth **booted already
alarmed**, every time — deterministic, not a perception race. Worse, because the
escalation happened *during the restore window* (before the action listeners were
bound), the corresponding action ("stealth broken") was both spuriously implied
at boot AND the genuine later break was swallowed (the state had already left
stealth, so the `wasStealth → notStealth` edge never fired for the real event).

## Diagnosis — instrument the choke point, don't theorize the source
The first three theories (organic AI perception, a specific behavior-tree
"raise alertness" task, our explicit state-restore line) were all wrong. What
settled it: a **callstack dump at the single global-state setter**, gated to the
`stealth → non-stealth` transition. The stack named the real caller in one shot —
our own restore-destroy path running the engine's death→alarm cascade — not any
perception code. When "who set this global state?" is unclear and the game
suppresses its own transition logs, walk the stack at the setter; enumerate every
setter call site first so you know the dump will catch all of them.

## Fix — suppress the death-side-effect across the restore window
Add an engine-side suppression flag on the global-state owner and early-out the
escalation dispatch while it's set:

```cpp
bool AHeistState::OnKillEscalationChanged(...)   // the death→alarm choke
{
    if (bLudeoSuppressEscalation) return false;   // no fail, no dispatch
    ...
}
void AHeistState::Ludeo_SetSuppressEscalation(bool b) { bLudeoSuppressEscalation = b; }
void AHeistState::Ludeo_ResetEscalationCount()        { UnansweredKills = 0; }
```

Integration side (Player Flow only):
- set suppression at the **start** of restore (before the destroy/spawn churn),
- **also neutralize the per-entity mechanic state on restored corpses** (e.g.
  disable the dead guard's radio) so they can't participate once suppression
  lifts — the caller explicitly wanted silently-killed guards to stay silent,
- **reset the accumulated counter and lift suppression** at the very end of the
  restore window (after the last post-unpause cleanup sweep, since sweeps run
  both before and after the gameplay-start gate — a one-shot revert gets
  re-tripped),
- lift suppression **defensively on teardown** too, so a restore aborted before
  its final sweep can't leave the mechanic disabled for the next play.

Suppress-during-restore beats escalate-then-revert: reverting still emits a
spurious transition and can re-trip while later sweeps run. Prevent it instead.

## Why this is the right altitude
Keep everything gated behind the integration's offline/build define so retail is
byte-identical. The fix is small (one flag + two setters + one early-out + a few
integration call sites) and general: **any** Player-Flow restore that destroys or
spawns AI must audit those actors' death/spawn hooks for side effects that mutate
shared state, and bracket the restore window against them. Restore runs real game
code — treat every destroy/spawn as a live gameplay event, not a silent memcpy.
