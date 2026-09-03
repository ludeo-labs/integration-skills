---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 5
question: "Did the per-entity field-disposition table (phase 4 Part B / phase 5 task 0) check READABILITY of each capture-marked field from outside its class, or only that the field exists?"
sanitized: true
---

# A field disposition of "capture" is not the same as "capture code can read it"

The phase-4 Part B / task-0 completeness gate enumerates every state field of an entity and gives each
a disposition (`capture | defer→wave N | exclude`). The human gate then approves that table. It is easy
for both the agent and the reviewer to treat approval as "task 1 can now just write the code" — but the
table records **field existence and relevance**, not **accessibility**.

Gameplay classes routinely expose a setter and no getter: `SetCanPause(bool)` with a private
`m_CanPause`, `EnableCollisionsWithEnemies(bool)` with a private flag, `SetSoftRespawnPosition(...)`
with no reader, a private `List<StatusEffect>` behind only a `HasStatusEffect(type)` boolean. The
writers live in game code that already knows the value; nothing ever needed to read it back until
capture did.

The result is a gate-approval mismatch: the reviewer approved *N* accessor edits (the ones task 0
happened to notice), and task 1 discovers it needs *N + M*. The alternative — silently dropping the
unreadable fields — is worse: they were approved as load-bearing, and under-tracked invisible
forward-play state passes a first-frame restore gate and diverges later (`06 §9.1` mode 4).

## Do this at task 0, not task 1

While building the field-disposition table, mark each `capture` row with **how the value will be read**:
public field · existing getter · **accessor needed**. Total the third column and put it in the gate ask
as one line ("this wave needs K read-only accessors across F game files"). One approval, no surprises,
and the reviewer sees the real edit surface before code exists.

## Three qualifiers worth knowing

- **Some "missing" accessors already exist.** Verify each one against the file rather than trusting the
  plan row — in the observed project one of the three approved accessor edits was unnecessary because a
  public getter was already there, and the *remaining* duration was then computable in the layer with no
  edit at all.
- **A sibling component needs no accessor.** State that lives on a separate MonoBehaviour on the same
  GameObject is reachable with `GetComponent<T>()` from the layer. Check component boundaries before
  proposing a game edit; only fields private to the anchor class itself need one.
- **Never read state through a method that recomputes.** A perception getter shaped like
  `CanSeePlayer()` may fire raycasts and write back a cache. Capture must be side-effect-free and runs
  every tick, so add a pure getter that returns the cached field instead of calling the recomputing
  method — otherwise capture is quietly mutating the game it is sampling.

Reflection is not the escape hatch: it is fragile against renames and hides the edit from review.
