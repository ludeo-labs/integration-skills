---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 5
question: "Did the restore write a GameObject's active state, a component's enabled flag, or a mode flag — and is there any OTHER component that re-asserts that same value from its own Update/LateUpdate every frame?"
sanitized: true
---

# A restore write that another component re-asserts every frame survives less than one frame

The apply is synchronous, so within it nothing can interfere — which is exactly why the failure is so
confusing. The write lands, the apply's own diagnostics read it back correctly, the reveal-time log confirms
it, and then the **next `LateUpdate`** puts it back and the symptom appears anyway.

Observed shape:

```csharp
// the restore, during the frozen apply
mgr.gameObject.SetActive(false);      // reach the manager's own terminal state

// somewhere else entirely, running every frame
void LateUpdate()
{
    if (logCameraManager != null)
        logCameraManager.gameObject.SetActive(enableTooltips);   // no guard, every frame
}
```

The restore deactivated a cutscene driver so it could not re-fire a moment the creator had already seen. A
different manager re-activated it on the very next `LateUpdate`, and the `Update` after that fired the
cutscene. Elapsed lifetime of a correct restore write: **less than one frame**.

## Why the diagnostics agree with you right up until they don't

Every log the apply can produce is taken **inside** the apply, before any `Update`/`LateUpdate` runs. So:

- the apply's own write-back log says the value is correct — it is
- a reveal-time / end-of-apply diagnostic says the value is correct — it still is
- the symptom happens anyway, and the first frame-accurate trace *after* the sim resumes shows the opposite

If an end-of-apply diagnostic and a post-resume trace disagree about the same field, **stop looking for who
failed to write it and start looking for who re-writes it.** That disagreement is the signature; nothing else
produces it.

## The precondition that got missed: "inert" was decided from the wrong branch

The re-asserting component had already been analysed and **cleared** — the plan recorded it as inert for
this level because a persisted flag it reads was disabled there. That was true of the branch the row was
about:

```csharp
void LateUpdate()
{
    if (Load() && useSavedData) { ... }        // ← the row checked THIS, correctly: dead here
    EnableThings(enableTooltips);
    if (other != null) other.SetActive(enableTooltips);   // ← unguarded, and the one that mattered
}
```

**Clearing a component is a claim about every branch of every method it runs, not about the one your row
names.** A row that says "component X is inert in this level" needs the whole method read, not the
conditional the row was written about.

## Fixes, cheapest first

1. **Disable the re-asserting COMPONENT** (`component.enabled = false`), not its GameObject — it stops the
   loop without discarding whatever its other per-frame work already established, and a scene reload restores
   it for the next run.
2. **Reach a terminal state the re-assertion cannot undo** — many drivers have an early-return branch (a
   null/− sentinel) that self-deactivates *before* the branch that fires. Setting that input makes the
   re-activation harmless, because the driver immediately stands down again.
3. Editing the re-asserting component is usually **not** available — it is rarely on the approved edit
   surface, which is another reason to prefer 1 or 2.

Gate the fix on the same restored value that motivated the original write, so a creator who had *not* seen
the moment still gets it.

## Where else this shape hides

Anything a "manager of managers" mirrors every frame: enabled/disabled UI panels, AI toggles driven by a
difficulty or accessibility singleton, input maps re-applied by a settings watcher, `Time.timeScale` itself
(a per-frame writer is why the timescale arbiter needs a re-assert of its own). **Grep for the field you
wrote — if any *other* file writes it from `Update`/`LateUpdate` with no state guard, your restore write is
temporary.**

> **The apply is a frame. The game is a loop. A value the loop re-asserts is not restored by writing it once
> — and every diagnostic you have runs inside the frame, where it still looks correct.**
