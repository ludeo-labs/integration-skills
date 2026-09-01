---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 5
question: "Did an earlier wave put a state on the transient/normalize list *because nothing in the restore could advance the entity out of it* — and does the wave you are implementing now restore the thing that advances it?"
sanitized: true
---

# A transient-state classification EXPIRES when a later wave restores its driver

`07 §1.5` tells you to normalize transient action phases (mid-attack, mid-dodge, mid-hit) to an idle state,
because the coroutine or animation event that would have ended them is never run by a restore, so a
verbatim restore jams the entity forever. That rule is sound. **The classification it produces is not
permanent** — and the entry most likely to go stale is the one whose justification was never "this state is
transient" but "**nothing in our restore can get the entity out of it**."

## The shape

A wave-based arena encounter controller in the observed project pre-instantiates its whole roster at scene
load and parks every member in a **holding state**: standing on a spawn perch, movement off, and — the
detail that matters — its `CanReceiveHit()` hard-coded to return `false`. The controller then **releases**
members one at a time (one per kill, in its queue mode), tracking how many with a `spawnIndex` cursor.

Wave 1 of the integration suppressed that controller outright (its activation trigger was gated, so a
replay could not spawn a fresh wave on top of the restored population). With the controller suppressed,
nothing could ever release a parked member — it would never attack, never die, and the encounter would never
clear. So wave 1 added the holding state to the enemy **transient deny-list**, with a comment stating
exactly that reasoning. Correct, and the comment was honest about why.

Wave 2 then restored the encounter properly: the controller's cursor (`active` / `currentWave` /
`spawnIndex`), the roster membership of every restored member **with its kill-callback re-attached**, and a
narrowed activation guard so a restored mid-fight could advance. **Every premise of the wave-1
classification was now false — and the deny-list entry was still there.**

Result: a capture taken at `spawnIndex = 0` — nobody released yet, the whole roster parked — restored with
every parked member normalized to `GetInitialState()`, which for that family is an active airborne pursuit
state. Three parked members became three extra attackers, on top of the two that were genuinely fighting.
Integrator report: *"there were more enemies than there should be."*

## Why it is hard to attribute

- **It is a `07 §9` delayed divergence with a perfect frame 1.** The members are re-created at their
  *captured perch positions*, so the first frame is exactly right; they only leave the perches over the
  following seconds. Every position, HP and reference in the log is correct.
- **The count of objects is right.** Nothing spawned twice. A whole afternoon can go into auditing spawn
  paths, quiesce ordering and deferred `Destroy` before someone checks the members' **state** instead of
  their **number**. In the observed project the pre-spawn branch turned out to contain *no*
  `Instantiate` at all — it only calls "release" on members that already exist — which is what finally
  forced the diagnosis onto state.
- **The restore's own diagnostic reported it as a success.** The normalization log line
  (`normalized: Enemy:<HoldingState>->GetInitialState`) was printed, in the same list as a dozen legitimate
  attack/hit normalizations, and read as correct behaviour.

## The audit that finds it before a gate does

For every entry on a transient/normalize list, ask **why it is there**, and sort the answers:

| Reason the entry exists | Expires? |
|---|---|
| the state is advanced by a coroutine / animation event / timer the restore never runs | **no** — genuinely transient, keep it forever |
| the state is advanced by a *manager* whose progression this wave does not restore | **YES** — re-check it in every later wave |
| the state is advanced by a trigger this wave suppresses | **YES** — re-check when the suppression narrows |

Rows 2 and 3 are **liveness-dependent classifications wearing a transience costume**. Grep the list's
comments for phrases like "suppressed", "never advances", "nothing would release it", "the room never
clears" — each one is a dated assumption. A wave that restores a manager's cursor, re-attaches a roster, or
narrows a suppression guard must re-open the list, not just add rows to it.

## The fix, and why it is "gate the trigger"

`07 §9` says fix the trigger, never the primitive. Here the misbehaving trigger is **your own
normalization** — so that is what stops:

1. Decide it **before** the transient resolver runs, not after. Consulted afterwards, the corrected entity
   still gets reported as normalized, which is the log line that hid the defect in the first place.
2. **Re-establish the holding state through the game's own public entry point**, not by activating the
   controller and hoping. The observed controller's `InitState(Transform)` does five things a
   re-implementation would have missed — animator crossfade to the parked pose, a family-specific animator
   bool, a "keep distance" flag the capture also recorded, the character-controller off/on dance, and the
   activation itself.
   ⚠ Pass the **entity's own transform**, not the authored spawn point: the method writes position/rotation
   from that transform back onto the same object, so passing self is a no-op that **preserves the restored
   pose**, while passing the spawn point would teleport the entity off its captured perch. Check that the
   stored reference is not read anywhere else before doing this.
3. **Keep the old behaviour as a guarded fallback, and make the guard a fact, not a flag.** The wave-1 jam
   is still real when nothing can release the entity. The test used was *roster membership* — "does a
   restored manager actually hold this entity in the collection it releases from" — because that is the one
   observation that proves the manager came back **and** re-attached this entity. When it fails, fall back
   to normalization and **log loudly**, naming which half failed.
4. Find the manager **without promoting a per-restore map to a field** (per the "identity is per-Ludeo"
   rule): the entity is already *parented* under the manager's container by the game's own spawn sites and
   by your spawn path, so walking up the transform answers it with no scene walk and no static state.
5. Run it on the **post-`Start` re-assert path too** — a clone's own late `Start()` re-activates
   `GetInitialState()` and would undo it a frame later. If the re-assert re-runs the whole per-entity apply
   (which it should), placing the fix inside that apply covers both paths for free.
6. `IsDead` still wins over everything: never re-park a corpse.

## The diagnostic that makes this class of bug self-evident

The integrator's evidence was a sentence — *"more than there should be"* — with no number in it, and "looks
fine now" cannot close a delayed divergence. Per the tracking-orchestrator's redundant-state rule, add a
**temporary, debug-gated, restore-only heartbeat** that samples every couple of seconds for ~30 s after
control is granted and prints redundant state against ground truth. The single line that turns this defect
from invisible to obvious:

```
room '<name>': spawnIndex=0 · rosterLive=3 authoredMembers=3 · containerChildren=3 · holding=3 expected=3
```

`holding` **below** `expected` means the restore promoted parked members (this defect). **Above** means the
manager's cursor is ahead of its roster. `containerChildren` above `authoredMembers` means a pre-spawned
roster and your restored clones are *both* present (a quiesce that missed). One line, three distinct
failures, each with its own reading — and the baseline for "did anything appear later" is the census taken
at the instant control is granted, because at that point the apply and the one-frame re-assert are both
finished and no gameplay frame has run.

Build it to be deletable: one file, two call sites, no writes, and **no game-code getter added for it** — if
a counter you want is private, find the public collection it is kept in step with and say in the log which
number you are actually showing.

## Two things worth checking while you are in there

- **Positional roster order.** If the manager releases members by *index* into its roster, and your restore
  fills that roster in *bucket order*, the mapping is arbitrary. Harmless when the roster is uniformly
  parked or uniformly released (and when the cursor is 0, which is when this bug is most visible), but a
  mixed roster can have the manager "release" an already-active member and leave a parked one parked
  forever. The captured state of each member is the ground truth for who was released — you do not need a
  cross-reference, just the ordering. The heartbeat line above detects it.
- **A raw post-incremented cursor that equals its own collection count.** `currentWave == waveCount` looks
  like an off-by-one waiting to throw. Trace it before "fixing" it: if the field is post-incremented at the
  end of the advance method, then `N` means "index `N-1` in progress", which is what the class's *own*
  readers assume — and the one site that indexes with the raw value is usually already guarded by
  `if (cursor < count)`. Verify, record it as benign, and print the convention in the diagnostic
  (`currentWave=1/1 (fighting wave 0)`) so the next reader does not re-derive it.

## The generalization

> **A "normalize this state" decision is a claim about what your restore can drive, not only about the
> state. Every wave that widens what the restore drives invalidates some of those claims — and the failure
> mode is not a jam you would notice, it is extra live, aggressive entities that look perfectly correct for
> one frame.**

Practical rule: when a wave adds restoration of a manager's progression cursor, a roster/population
collection, or narrows a suppression guard, **diff the transient list against it in the same wave**. And
write the *reason* next to every deny-list entry when you add it — the observed project's wave-1 comment
spelled out its premise, which is the only thing that made the expiry provable rather than a guess.
