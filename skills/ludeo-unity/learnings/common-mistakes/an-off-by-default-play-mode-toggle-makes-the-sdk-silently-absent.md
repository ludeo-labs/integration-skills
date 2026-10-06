---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "3,5,6,8"
question: "Did the integration add an Editor toggle that gates whether the SDK starts in play mode (usually off by default, because the SDK overlay hooks the OS cursor)? Then verify it is ON as the FIRST step of every automated replay run — with it off the SDK never activates, the game just plays normally, and nothing in the log says why."
sanitized: true
---

# An off-by-default play-mode toggle makes the SDK silently absent

Integrations commonly add an Editor-only switch that decides whether the SDK starts during play mode,
and it is usually **off by default for a good reason**: the SDK's native overlay hooks the OS cursor
and input, and the Editor does not reliably release that when play mode stops, so an ordinary play
session can leave the whole Editor with a hooked cursor until it is restarted. Making every casual
press of Play start the SDK is worse than making it opt-in.

The cost of that correct decision is a **silent precondition**. With the toggle off, the game boots and
plays exactly as normal: front end, menu, everything. The SDK simply never activates. There is no
warning, no error, and no line saying "the integration is disabled" — **its absence is the only
signal**, and absence is precisely what nobody greps for.

## Why it wastes so much time

The failure has no fingerprint of its own, so it borrows whichever one is nearby. In one session six
consecutive automated runs were lost, and each looked like a different bug:

- a replay harness timing out with "the moment was never restored" (it was never *started*)
- a main menu that appeared to hang (it was just a normal menu, waiting forever for a player)
- a shader compile that happened to be slow in the same window
- an SDK editor post-process throwing at an odd moment

Every one of those got investigated on its own terms. The actual state — `toggle: disabled` — took one
call to read and would have ended the whole sequence immediately.

It is also **off far more often than you expect**, because it is off by default *and* conscientiously
turned back off by whoever tidied up after the previous run. It does not survive sessions the way a
serialized asset setting does; it typically lives in an `EditorPref`.

## The habit

1. **Make reading it step one of the run procedure**, above writing the job file, choosing the clip, or
   anything else. Expose a `Describe()`-style accessor so it is one call, and *log the value on every
   run* rather than checking it only when something breaks.
2. **Assert it rather than set-and-forget.** Turning it on at the start of a batch is not enough; a
   crash, a restart or a tidy-up resets it mid-batch.
3. **Treat "the log has no SDK lines at all" as this, first.** Before theorising about restore
   ordering, the clip, or the world build: if activation never appears, nothing downstream *can*
   appear, and the cause is almost always that the SDK was never switched on.
4. **Prefer the project's own launch helper** over hand-rolling `EditorApplication.EnterPlaymode()`.
   Such a helper usually refuses on the other silent preconditions too (play mode already running, a
   dirty scene) and returns a bool — hand-rolling skips those guards and produces dead runs that look
   like integration failures.

## The general shape

This is one instance of a wider class: **an opt-in switch whose "off" state is indistinguishable from
the feature working normally.** Whenever an integration adds one, the same day you add it, add the
check for it to whatever runs the gates — otherwise every future failure gets one free red herring.
