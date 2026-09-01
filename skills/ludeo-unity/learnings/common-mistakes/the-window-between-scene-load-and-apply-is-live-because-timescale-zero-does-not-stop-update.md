---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 5
question: "Does your restore hold Time.timeScale = 0 from scene load until the apply runs at RoomReady — and are you treating that window as inert?"
sanitized: true
---

# The window between scene-load and apply is LIVE — `timeScale = 0` stops `FixedUpdate`, not `Update`

Every restore plan has this gap in it, because the flow makes it easy to miss. The layer freezes at
Ludeo-selection time, starts the scene load, and applies at `RoomReady`. In between, the SDK room chain
(`OpenRoom` → `AddPlayer` → `RoomReady`) is **async and takes real time** — seconds, on a cold session. So
there is a stretch of **many frames** in which:

- the captured scene is fully assembled and every `Awake`/`Start` has run;
- **the player is at its authored spawn point**, not the restored one;
- every counter is at its scene-start value;
- `Time.timeScale == 0`.

The plan then reasons "the sim is frozen, nothing can happen." **`Time.timeScale = 0` stops `FixedUpdate`
and makes `Time.deltaTime` zero. `Update` and `LateUpdate` keep running every frame.** So the window is
live, and what happens in it depends on a distinction nobody writes down:

| An `Update` that… | Behaviour at `timeScale = 0` | Window hazard |
|---|---|---|
| advances a timer (`t -= Time.deltaTime`, `t += Time.deltaTime`) and acts when it crosses a threshold | **inert** — the timer never moves | none |
| yields on `WaitForSeconds` in a coroutine | **inert** — scaled waits never resume | none |
| tests a **distance / overlap / count** every frame, with no timer at all | ⚠ **fires** | real |
| tests a **flag** every frame | ⚠ **fires** | real |

In the observed project, auditing the window one component at a time produced exactly this split. The
proximity poll that collects pickups was gated `if (intervalTimer < 0)` with a `Time.deltaTime` decrement —
**structurally unable to fire while frozen.** But two other components tested only distance:

- the world-pickup script's `Update` compared squared distance to the player against a ~1 m radius with **no
  timer**, so a pickup authored near the level's spawn point was **collected during the window** — added to
  the inventory and destroyed, before the apply had written a single row;
- the escort-companion AI's `Update` compared distance to the player against a follow radius, and on a hit
  called the *owner's* `CollectBaby`-shaped method, which **appended to a collection and incremented a
  counter** — so the collection the restore was about to rebuild already had an extra member in it.

Both are silent. Neither logs. Both leave the apply writing onto a state it did not expect.

## Why the two obvious guards do not cover it

- **The controls gate / input suppression does not help.** These are not player-driven: they are
  proximity-driven `Update`s. Withholding input changes nothing.
- **The freeze does not help** — that is the whole point.
- **Shrinking the window is not available**: the room chain's latency is the SDK's, and opening the room
  early is *recommended* precisely to hide that latency behind the load.

## The fix is two baseline resets, not a suppression

The window's damage always lands in the same place: a **collection or a counter that the apply is about to
write anyway**. So the cheap, robust answer is to make the relevant applies **reset-then-rebuild** instead
of **append**:

1. **Clear the collection at the top of its apply, then rebuild it from the buckets** — including the
   collection the game itself seeds in its own `Start()` (e.g. a follower line seeded with `[player]`).
   Rebuilding is idempotent and window-proof; appending is neither.
2. **Warn when the reset finds residue.** `count != 0` at the top of the apply is the only signal that the
   window did something, and it is worth a log line: without it, a spurious pickup is indistinguishable
   from a capture that genuinely held that item.
3. Counters get the same treatment for free if the apply **re-writes them from the snapshot** rather than
   trusting incremental side effects (`07 §9`) — the snapshot is ground truth for a plain `int`.

Suppressing the two `Update`s on `IsInLudeoFlow` also works and is *more* correct, but it is a game-code
change in files the restore otherwise never touches. Price both and say which you chose; the reset is
usually the better trade because it is in the layer and it hardens the apply against re-entry as well.

## Audit it explicitly — the question is one line per component

While planning, walk every component that lives in the captured scene and ask **"does this `Update` advance
a timer, or does it test a distance/flag?"** Only the second class needs a row. In the observed project that
audit was ~12 components and produced 4 findings, two of them load-bearing:

- the pickup and follower cases above (real hazards → the two resets);
- a win-condition check comparing a restored numerator against a scene-derived denominator — which fires in
  the window too, and would have ended the replay on frame 1 if the denominator had been zero (hence a
  **preflight assertion** on that denominator before the apply writes anything);
- a death check calling the game-over path off a plain `bool`, which is why a captured "player is dead" flag
  must be normalized rather than mirrored — the freeze does **not** buy you time to think about it.

And the same reasoning has a positive use: an oscillating-platform driver that recomputes its transform from
a phase value every `Update` is **self-consistent at `deltaTime == 0`**, which is what makes its captured
*position* a cross-check rather than the placement authority. The audit tells you which captured attributes
are authoritative and which are diagnostics.

## The generalization

> **A restore freeze protects against physics and against time, not against per-frame logic.** Any
> `Update`/`LateUpdate` whose trigger is a distance, an overlap, a count or a flag runs at full rate through
> the entire pre-apply window — against the *authored* world, not the restored one. Enumerate them, and make
> every collection the apply touches **reset-then-rebuild** so the window cannot poison it.
