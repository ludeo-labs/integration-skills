---
category: common-mistakes
tier: universal
sourceGame: EndlessFPS
phase: 5
question: null
sanitized: true
---
# Don't paper over a cloud-only symptom with gameplay-altering mitigations — they distort Ludeo fidelity and hide the cause

## The anti-pattern
A symptom appears **only on the cloud** and can't be reproduced locally (e.g. the player dies
instantly on restore). Unable to repro, the integration stacks **gameplay-altering mitigations** to
soften it:

- a wall-clock timer that force-begins gameplay (see [[never-force-begin-without-onroomready]]),
- freezing or slowing enemy AI for a "reaction window" on restore (time dilation),
- capping frame rate / forcing low graphics to dodge a cloud-GPU issue.

Each mitigation that isn't tied to a *proven* cause is a band-aid with two costs.

## Cost 1 — it masks the root cause
The symptom gets quieter, so the real cause — viewer-connect timing, a platform message-routing
bug, a cloud-GPU device-loss — is never found, only hidden. Worse, several band-aids stacked
together interact: the one that "fixed" it may not be the one you think, and the next regression in
that area is now invisible because the band-aid is still absorbing it.

## Cost 2 — it corrupts the captured / replayed moment (Ludeo-specific)
This is the cost that's easy to miss. **The Creator captures, and the Player Flow replays, the
*actual* gameplay.** A mitigation that changes how the game runs — freezing AI, dilating time,
capping fps so reactions lag — changes the moment itself. You don't get the real highlight back;
you get a softened, distorted version of it. Fidelity of the moment is the product, so a band-aid
that alters gameplay degrades the product **even when it "fixes" the symptom**.

## What to do instead
- Add **diagnostics, not mitigations**, to a cloud-only symptom — one cheap, durable trace (see
  [[diagnostics-to-stdout-for-cloud-logs]]) — and find the actual cause before changing behavior.
- Gate strictly on the SDK's real signals (`OnRoomReady`, `OnPauseGameRequested`), never on a
  wall-clock timer or a guess about when an overlay appears. A manual workaround with no SDK
  callback behind it is a guess; when the condition it assumed is false (e.g. the overlay is
  disabled on cloud) it silently becomes dead code or a visible artifact.
- Restore should hand control to a **live, true-speed world** — no AI freeze, no time dilation. The
  reference samples (Lyra / FPSGameStarterKit / VoyagerV2) do not alter gameplay on restore.
- A genuinely-needed *environment* mitigation (e.g. a GPU workaround) should be **opt-in, off by
  default**, scoped to the machine that needs it, and clearly labeled as an environment workaround —
  not baked into the capture path where it changes every recording.

## After the cause is fixed: audit and remove
Once the root cause is resolved, go back through every mitigation added during the debugging push.
**Remove the ones whose underlying issue is now fixed**; keep only those tied to a still-open,
separately-tracked issue, and write down which issue and why. A workaround whose cause is fixed is
dead weight — it distorts fidelity, masks future regressions, and misleads the next integrator into
thinking the behavior is intentional.
