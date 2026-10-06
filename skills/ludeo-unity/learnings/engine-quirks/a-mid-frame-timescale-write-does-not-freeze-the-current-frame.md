---
category: engine-quirks
tier: generalizable
sourceGame: TopDownRogueSample
phase: "5"
question: "Does your restore write Time.timeScale = 0 and then apply restored state in the SAME frame, especially from an async continuation (UniTask/await) or a coroutine that can run before the game's own clock or timer MonoBehaviours? Unity fixes Time.deltaTime at frame start, so that frame still advances every deltaTime-driven clock by one full frame, on top of the values you just wrote."
sanitized: true
---

# A mid-frame timeScale write does not freeze the current frame

Unity computes `Time.deltaTime` once, when the frame starts. Writing `Time.timeScale = 0` partway
through a frame changes nothing for the rest of that frame: every `Update` that runs afterwards still
sees the old, non-zero `deltaTime`. The freeze takes effect from the **next** frame.

That turns "freeze, then apply" into "apply, then tick once" whenever both happen in one frame and the
apply runs **before** something that integrates `deltaTime`.

## What it looked like

The game advanced its own elapsed-time clock and a countdown from a MonoBehaviour with the earliest
execution order (`clock += Time.deltaTime * ownScale`). The restore's apply step was an `await`
continuation on the Update player-loop timing, and those run **before every MonoBehaviour's Update**,
including the earliest-ordered one. Frame-probe trace of the frame that froze and applied:

```
arbiter wrote timeScale 0                  [ts=0 dt=0.01667]
apply wrote clock 3.14828                  [dt=0.01667]
clock MonoBehaviour: -> 3.16495            (added the frame's dt on top of the restored value)
```

From the next frame on, `dt` was 0 at every sample point. The layer's read-back caught it as a
one-frame mismatch on the clock and countdown at the first checkpoint, and nothing else.

It looks harmless at 60 fps. It is still a real defect: the freeze is not in force at the moment you
apply, and a restore that applies over several frames, or a game with larger per-frame effects, loses
more than one tick.

## The fix

1. **Freeze, then wait for a frame that starts frozen.** After writing `timeScale = 0`, yield until a
   frame begins with `Time.deltaTime == 0`. Give that wait a named deadline so a stuck freeze fails
   loudly. Only then apply.
2. **For a game-owned clock** with its own time scale, hold it at 0 for the whole frozen window too,
   re-assert it in LateUpdate, and release it to exactly 1 on every exit path.

## How to see it

Put a probe with an execution order earlier than the game's clock, one right after it, and one in
LateUpdate. Log `timeScale`, `deltaTime` and the clock at each, every frame from the freeze to the
release. "Non-zero dt at frame start while frozen" on **one** frame separates this from a component
that re-writes `timeScale` every frame
([[a-restore-write-another-component-re-asserts-every-frame-survives-one-frame]]), which shows non-zero
`dt` on many frames.

## Related

- [[the-window-between-scene-load-and-apply-is-live-because-timescale-zero-does-not-stop-update]]
- [[make-the-restore-verify-every-value-it-writes]]: the read-back is what exposed the one-frame drift.
- [[a-drift-number-cannot-tell-a-missing-write-from-an-overwritten-one]]: here the frame probe settled
  it. The write happened, and was then advanced.
