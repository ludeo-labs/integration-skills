---
category: common-mistakes
tier: generalizable
sourceGame: TopDownRogueSample
phase: "5"
question: "Does the game's pool do more work AFTER the pooled instance's OnEnable, such as setting an IsActive flag, running a 'prepare spawn' step, or re-applying cached component enabled flags (a 'soft pool')? Then a restore hook placed in OnEnable, or anything that runs before Get returns, is overwritten by the pool itself."
sanitized: true
---

# A pool's Get can finish after OnEnable and undo your restore

A common restore hook for pooled entities is a flag the entity checks in `OnEnable`: "skip the arrival
sequence, come in already arrived". It worked for one enemy type and silently failed for three others
from the same prefab family, in the same restore.

The difference was one per-type setting: those three used the pool's **soft-pooling** mode. In that
mode `Get()` activates the instance (so `OnEnable` runs, and the hook fires) and **then** continues: it
sets the instance active, and a prepare step restores every behaviour to its **cached prefab enabled
flag**. The movement component was saved disabled in the prefab, because the arrival sequence normally
switches it on at the end. So the restore's "movement on" was reverted on the same frame by the pool.
Normal play never noticed, because the arrival sequence switched it on later. A restore skips that
sequence, so nothing ever did.

The symptom was a replay full of restored enemies standing still, while the layer's read-back reported
the movement component still disabled for every soft-pooled one and for none of the others.

## The rule

- **Put post-spawn restore writes after `Get()` returns**, not in the entity's `OnEnable` and not in a
  callback the pool fires midway. For "arrive already arrived", call an explicit "finish arrival now"
  member that applies the sequence's **end state** (components enabled, animator at its idle state).
- **Check every pool mode the game uses**, per entity type, not just the first type you tested. Here the
  switch was a per-type data flag, invisible from the class code alone.
- **Read the component back after the apply**, and log per type. A counter such as
  `<component>OffAfterSpawn=N` is what made this a one-line diagnosis instead of a hunt.

## Related

- [[a-pooled-entity-needs-the-games-activation-not-just-its-state-flags]]: the pool path also owns
  activation. This is the case where it also owns *de*-activation after your write.
- [[a-restore-write-another-component-re-asserts-every-frame-survives-one-frame]]: the same shape,
  except here it is the pool, once, on spawn.
- [[restored-entities-must-arrive-already-arrived]]
