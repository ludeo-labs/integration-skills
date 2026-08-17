---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: 5
question: "Do the game's pooled entities go through an explicit activation step after leaving the pool (StartAI, a state-machine kick, a wave trigger) - i.e. is a freshly-pulled instance 'parked' until something starts it?"
sanitized: true
---

# A pooled entity needs the game's activation, not just its state flags

Restored enemies spawned from the pool, placed, health-set, arrival-completed and
visibility-flagged - and stood there as unshootable statues. The pool's get callback
parks an instance in a neutral state and the pool's cleanup stops its behaviour tree;
the game un-parks an entity only through its activation call (here `StartAI()`, run by
the wave logic when a fight starts). The restore had reproduced every *value* on the
enemy and skipped the one *call* that makes it an enemy.

Two compounding traps:

1. **Flag-setting is not activation.** Visibility flags, arrival flags and dissolve state
   can all read "correct" while the entity's driver (tree/state machine) is stopped. The
   parked state is invisible to value checks - only a rendered-result criterion and an
   after-gameplay-begins checkpoint exposed it.
2. **Do not release-then-get from the same pool in one pass.** The restore first released
   the world's pre-spawned population, then pulled instances for the captured enemies -
   and got the just-released bodies back, carrying hidden renderers and stopped trees
   that no flag-setting cured (the counts matched exactly: 20 released, 20 broken).
   Spawn the restored set FIRST, release the replaced population after.

3. **Visual work races the entity's async init.** Even with activation running and clean
   instances, calling the reveal path (show renderers, clear the spawn dissolve) at
   spawn time can land before the entity's effect controller finishes its asynchronous
   init - renderer lists are still empty and the init then applies its own hidden
   baseline over your cleared state. Every flag reads correct; the entity is invisible.
   The game's own spawn node waited on an `isReady` flag before any visual work - the
   restore must wait on the same condition: queue the entity and re-run the reveal once
   its controller reports ready.

## The rule

After a restore spawns a pooled entity and applies its values, run the **same activation
call the game's own spawn flow ends with** - after the values, so a restored mid-death
entity resumes dying instead of fighting. And sequence pool traffic so the restore never
consumes instances it just released.

This is the strongest form of this integration's recurring lesson ("the restore writes a
value; something else owns it"): sometimes what's missing isn't a value at all - it's a
method call.
