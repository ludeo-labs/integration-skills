---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 3
question: "Are you relying on a controls-gate interface as your zero-edit suppression seam — and does the arbiter's Update have any EARLY RETURN above the line that re-evaluates the gates?"
sanitized: true
---

# A mode flag that early-returns past the controls arbiter locks your gate shut — the seam cannot release what it never re-evaluates

[[controls-gate-interface-is-the-non-ludeoable-census-and-a-zero-edit-suppression-seam]] lists four
preconditions before you trust a controls-gate interface as the layer's suppression seam. **Here is a
fifth, and it is the one that turns a working seam into an unrecoverable soft-lock.**

The arbiter is a *line inside `Update`*, not a subsystem:

```csharp
void Update()
{
    if (m_animDriver.StanceMode) return;      // ← a mode flag, read FIRST
    RecomputeGatesAndToggleInput();           // ← the arbiter — never reached
    Move();
    ApplyGravity();
}
```

Every guarantee the seam offers — "hold the property `false` and the player loses control", "release it
and control comes back" — is really a guarantee about `RecomputeGatesAndToggleInput()` running **this
frame**. An early return above it suspends the arbiter entirely, and the input component keeps whatever
enabled/disabled value it was last given.

## Why this is worse than it sounds: the recovery path is itself gated

Trace the loop in the observed project. The mode flag is toggled by a player input action. The input
action is only delivered while the input component is enabled. The input component's enabled state is
only written by the arbiter. The arbiter only runs when the mode flag is **false**.

So the state `mode flag == true` **and** `input disabled` is a **terminal** state:

- the layer's gate says "release" — nothing reads it;
- the game would normally re-enable input on the next frame — that line is skipped;
- the player would normally toggle the mode off — the toggle is an input they no longer receive.

Nothing errors. `timeScale` is 1. The scene is correct, the entity is at the right position, the restore
report is clean. A human describing it says *"it just stands there and I can't do anything."*

## Two windows expose it, not one

1. **Restore (phase 5).** A capture taken while the mode flag is set restores it — or, worse, leaves the
   *fresh* scene's `false` while the layer's readiness/restore hold is still applied, then releases the
   hold into an arbiter that has already stopped running for some other reason.
2. **⚠ Readiness (phase 3), which is the surprising one.** The readiness gate holds control at scene
   start and releases it once the SDK resolves. If *anything* can set the mode flag during that hold —
   a scripted opener, a queued input, an animation event — the release lands on a suspended arbiter and
   the player never gets control **on a perfectly ordinary capture run, with no Ludeo involved.**

That second window is why this is a phase-3 precondition and not only a phase-5 normalize row.

## The check (do it while you are grepping the arbiter, it costs one read)

Open the arbiter's `Update` and read **every line above** the gate-recompute call:

```
grep -n "return;" <the arbiter's Update>     # any early return above the recompute is a suspect
```

For each early return, ask the two questions that decide whether it is benign:

| Question | Benign | Dangerous |
|---|---|---|
| Can the condition be **true while input is disabled**? | no — it is only ever set from a path that requires live input *and* the arbiter having just run | **yes** |
| Is there **any other writer** that can clear it (a coroutine, an animation event, a timer, another component's `Update`)? | yes — it self-clears | **no — the only writer is the gated input** |

Two "dangerous" answers is a terminal state. One is a stall you can wait out.

Note the flag will usually **not** appear in your agency census, because it does not implement the
controls-gate interface and no one thinks of it as an input flag — in the observed project it lived on a
*presentation* component (an animation/FX driver on a child object) and its declared purpose was to hold
a pose. It suppressed movement, jumping, gravity, attacking **and** the arbiter, all by early-returning
from three different `Update`s.

## The fix, and why it belongs in the apply rather than the gate

Force the flag — and its backing input field — to the permissive value as part of the restore's
per-entity apply, alongside the rest of the agency family
([[normalize-the-whole-agency-suppressing-flag-family-not-just-the-input-one]]). Both halves matter: the
mode flag and the raw input bool that re-sets it, because the driver typically re-derives the mode from
the input on the very next frame.

Do **not** try to fix it by having the layer poke the input component directly. That competes with the
arbiter for the same field, and the moment the arbiter resumes it will overwrite you — you would be
re-implementing the arbiter instead of unblocking it. Unblock the arbiter; let it do its job.

And **log the flag by name** in the restore report next to the other ability gates. "The viewer could not
move" and "the viewer could not attack" have several visually identical causes, and a single boolean in
the log is the difference between a five-minute diagnosis and an afternoon of bisecting the apply.

## The generalization

> **A "zero-edit suppression seam" is only as reliable as the line that reads it. Before trusting any
> polled arbiter, verify that the poll is unconditional — an early return above it converts your gate
> from a lever into a suggestion, and if the flag's only clearer is behind the same gate, the state is
> terminal.**

The same shape appears anywhere a per-frame recompute sits below a guard: a pause-state check above a HUD
refresh, a `IsDead` check above a re-registration sweep, a "cinematic" check above a save-eligibility
recompute. Grep the guard, not just the thing being guarded.
