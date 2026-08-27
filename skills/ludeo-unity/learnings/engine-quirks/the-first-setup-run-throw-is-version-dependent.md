---
category: engine-quirks
tier: generalizable
sourceGame: RoguelikeSample
phase: 1
question: "Running SetupLudeoAssets headlessly and judging whether it worked? Do not use 'did the first run throw?' as the signal - the throw is version-dependent and was absent in plugin 4.3.2. Grep for the last step's own log line instead."
sanitized: true
---

# Don't test for the bug, test for the outcome — the first-run setup throw is version-dependent

[[sdk-setup-needs-two-headless-runs]] records that the first headless
`-executeMethod LudeoSDKUnityEditor.LudeoUnityEditorHelpers.SetupLudeoAssets` on a project with no
settings asset yet **throws**, aborting before the final step
(`UpdateLudeoCoreDllReference`) — which is the step whose absence later shows up as
`WrapperDllNotFound`. The prescribed fix is to run the command twice.

**On plugin 4.3.2 the first run did not throw.** It completed end to end:

```
run 1:  threw exception: 0
        UpdateLudeoCoreDllReference to: LudeoSDK-Win64-Release.dll
run 2:  [Ludeo SDK] LudeoSettings.asset already exists. Keeping existing one.
        UpdateLudeoCoreDllReference to: LudeoSDK-Win64-Release.dll
```

Running it twice is still the right habit — it is cheap, idempotent, and the second run
explicitly preserves an existing settings asset (so `apiKey` values written in between survive).
What must change is **what you check afterwards**.

## The trap

If you internalise "the first run throws" as the model, two opposite mistakes follow:

- **A clean first run reads as suspicious** — "no exception, so maybe the setup silently did
  nothing" — and you go looking for a problem that is not there.
- Worse, on a version where it *does* throw, "no exception on run 2" gets treated as proof that
  everything ran, when run 2 only proves run 2 finished.

Both come from testing for the **bug** rather than for the **outcome**.

## What to check instead

Grep for the last step's own output, in whichever run produced it:

```
grep "UpdateLudeoCoreDllReference to:"   # the step that selects the native DLL - must appear
grep "threw exception"                   # informational: tells you WHICH run completed, not whether setup worked
```

Then confirm on disk, which is version-independent:

- `Assets/LudeoSDK/Resources/LudeoSettings.asset` exists
- `Assets/StreamingAssets/LudeoSDK/` is populated

And remember exit code `0` is not a pass signal in either direction — a batchmode run whose
`-executeMethod` threw still exits 0 and still prints "Exiting batchmode successfully".

## The general rule

Learnings that describe a **defect in a specific version** should be applied as "here is a
failure mode to check for", never as "here is what will happen". When a learning's symptom is
absent, verify the underlying outcome directly rather than concluding either that the learning
was wrong or that something new is broken — and record the version you observed, so the next
reader can tell drift from disagreement.

## Related

- [[sdk-setup-needs-two-headless-runs]] — the original observation. Still run the command twice;
  just do not use the throw as the success signal.
- [[headless-editor-setup-needs-executemethod]] — why the setup must be invoked explicitly at all
  under `-batchmode`.
- [[investigate-before-asking]] §2 — "anything version-dependent: compare the workflow's pinned
  version to the installed one" is exactly this case.
