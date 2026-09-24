---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 3,5
question: "Does the game show a run-over / results / death screen while the gameplay world is still loaded? If your capture closes on the run-finalisation signal, every highlight the player marks on that screen fails — close the segment when they LEAVE the screen instead."
sanitized: true
---

# The run-over screen is inside the captured segment, not after it

Once you have found the game's run-finalisation funnel and hooked it as your keep path
([[the-run-over-signal-is-not-the-character-death-signal]]), there is a second, less obvious
question: **is that signal the right place to CLOSE the segment?**

Usually it is not. The finalisation signal fires when the run-over screen *opens*, and the player is
then sitting on that screen for many seconds — watching the death that just happened, reading their
score. **That is one of the moments they most want to clip.** A capture that closes when the screen
opens rejects every mark made there.

## What it looked like

The integrator played an 11-minute run and marked five highlights. The three marked during play
succeeded. The two marked while the run-over screen was up both failed, and the two failures had
**different result codes**, which is the tell:

| Mark | Result | Why |
|---|---|---|
| during play ×3 | `Success` | segment open |
| ~0.2 s after the segment's end call | `NetworkError` | end was in flight, room not yet closed |
| ~2.5 s later | `WrongState` | room closed; the SDK now rejects it outright |

`NetworkError` on the first one is misleading — nothing was wrong with the network. It is what a
mark racing an in-flight close looks like, and it will send you debugging connectivity if you read it
literally. Only the second failure names the real problem.

## Check this before choosing the close point

The reason the fix is cheap is that the finalisation path usually **does not tear the world down**.
Read the funnel's body: the one here saved progress, re-enabled the menu and emitted an analytics
event, but changed no scene and destroyed no world. So the tracked objects were all still alive and
the attribute stream kept flowing with no change at all to the capture code.

Verify both halves before moving the boundary:

1. **The world survives the run-over screen** — no scene change, no world teardown in the funnel.
2. **The per-tick writers tolerate a dead player.** Ours already did, because the player writer
   wrote a `Possessed` flag and returned early when nothing was possessed. A writer that instead
   dereferences the player would start throwing once per frame the moment the screen appeared.

## The shape of the fix

Split the one latch into **two states**, because "the run ended" and "the segment is closed" are now
different moments:

- `runOver` — set by the finalisation signal. Capture stays **open**; log that it is still capturing.
- `runKept` — set when the segment is actually submitted.

Then submit on the screen's **exits** (its "play again" and "main menu" buttons), and make every
backstop keep-rather-than-discard once `runOver` is set:

| Path | Before | After |
|---|---|---|
| finalisation signal | submit | mark `runOver`, keep capturing |
| results-screen button | — | **submit** |
| leaving the gameplay scene | discard unless kept | submit if `runOver`, else discard |
| scene unload backstop | discard unless kept | submit if `runOver`, else discard |
| quit | submit | submit (latch `runKept` so the unload backstop cannot abort the in-flight submit) |

Keeping the backstops as *keep* paths matters: it means the two button hooks are belt-and-braces
rather than load-bearing, so an exit route you did not find (a controller shortcut, a disconnect, a
button added later) still keeps the run instead of throwing it away.

## Also drop the death hook when you do this

A character-death hook that submits at the moment of death causes exactly the bug this learning is
about — it closes the segment *before* the run-over screen even appears. If the finalisation funnel
covers death (it usually does, as one of its reason values), the death hook is now purely harmful:
remove it rather than leaving it as "belt-and-braces". Two keep paths at two different times is not
redundancy, it is a race in which the earlier one always wins.

Related: [[per-frame-open-needs-a-closed-latch]],
[[ending-a-recording-is-async-do-not-shut-down-on-the-next-line]].
