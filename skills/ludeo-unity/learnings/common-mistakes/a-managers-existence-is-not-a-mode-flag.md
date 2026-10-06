---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 3
question: "Does your layer refuse capture in some game mode (multiplayer, co-op, tutorial, spectator, replay)? Check what the predicate actually tests — if it tests whether a manager component or singleton EXISTS, it is almost certainly wrong, because such managers are usually present in every session regardless of mode."
sanitized: true
---

# A manager's existence is not a mode flag — and the refusal it logs will reassure you

Refusing to capture in an unsupported mode is correct: a co-op run produces clips that cannot be
replayed, because the other players' entities are on a separate, untracked path. The trap is in how the
refusal decides.

Observed. The layer's guard was:

```csharp
// wrong
public static bool IsMultiplayerActive
    => SessionNetworkManager.Instance != null || !Net.IsOffline;
```

The manager assigns its own static instance in `Awake` and is **present in every gameplay scene, in
every mode**. Measured live, mid-run, in a plainly single-player game:

```
SessionNetworkManager.Instance != null = True  <-- the guard fires on this
Net.IsOffline                          = True  <-- the real answer: single player
```

Both true at once. The guard therefore refused capture on **every run the integration would ever want**,
and no capture room opened, ever.

## Why this one hides so well

It does not fail silently — it does something worse. It logs:

> `a multiplayer session is active - not capturing this run.`

That line reads like the system working as designed. Skimming a log for problems, you skip straight past
it, because refusing multiplayer is exactly what you told it to do. **A refusal message is only evidence
that the guard fired, never that the guard was right.** When a log line explains an absence, check the
predicate behind it before accepting the explanation.

## The fix, and why the obvious one is still too narrow

Do not hand-roll the negation (`!Net.IsOffline`). **Search the game for its own mode predicate first** —
here it already existed:

```csharp
public static bool IsMultiplayerMode => !Net.IsOffline || IsLocalCoop;   // synthetic illustration
```

which is *stricter* than the hand-rolled version: it also catches local couch co-op, a second untracked-
player case the hand-rolled test would have let through into capture. The game's own predicate encodes
mode distinctions you have not learned yet — prefer it over your own, and grep for `Is*Mode` before
writing one.

## How to check a guard you have already written

Read **each half of a compound condition separately, at runtime, in the state where the guard should be
false.** A compound `A || B` that is wrong in `A` is invisible while you only observe the result. One
bridge call printing both halves settled this in seconds after a day of it being invisible.

Two companions to this: [[a-guard-that-cannot-fire-is-not-evidence]] is the exact inverse (a guard that
can never fire, so its silence proves nothing) — together they are the same discipline, which is that a
guard's *behaviour* must be observed rather than assumed from its name. And guards stack: this one was
found only after fixing the guard in front of it (an event handler that had been reading the wrong
argument). Expect a fixed gate to reveal the next one,
and treat each newly reached guard as unverified rather than assuming the path is now clear.
