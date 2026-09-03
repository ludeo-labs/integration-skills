---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: 7
question: "Will QA (or anyone) run the shipping build locally to CREATE Ludeos — i.e. outside the Ludeo launcher/platform? A ship-posture build (runWithoutLauncher=false) is Ludeo-inert when double-clicked."
sanitized: true
---

# The ship build is Ludeo-dead outside the launcher — QA needs a runtime auth override, or they cannot create Ludeos with it

Phase 7 correctly bakes `runWithoutLauncher=false`: on the cloud the platform is the
launcher and auth comes from it. But hand that same build to QA and they will double-click
the exe, get `Activate: InvalidAuth`, no overlay, no capture — and report the build broken.
The integrator's first local run does exactly the same thing, which is how this surfaces:
"ran the build and no overlay, why?"

The failure is by design (the readiness gate lets the game play normally without Ludeo),
but the *creator flow requires a human playing the game locally* — QA cannot create
Ludeos any other way. A build that only works when the platform launches it can only be
QA'd for the player/replay flow, not the creator flow.

## The fix: an opt-in runtime override, not a second build

Add a small layer class, called first thing in the bootstrap (explicitly ordered —
`RuntimeInitializeOnLoadMethod` order between classes is undefined), that reads the
command line and mutates the settings **in memory** before the SDK initializes:

- `-ludeo-local` → `settings.runWithoutLauncher = true` for this run only
- `-ludeo-user <id>` → `settings.launcherUserId = <id>` so each tester signs as themselves

This works because the SDK reads its settings via `Resources.Load<LudeoSettings>` (a
cached single instance) at Initialize — mutate that instance earlier and the SDK sees the
override; nothing is persisted. Ship the build with **two** bats: `run.bat` (the cloud
exec-path: direct exe call, `-logFile -`, store-platform-free args) and `run-local.bat`
(passes `-ludeo-local`, takes the tester's user id as `%1`).

Absent the flag, behavior is byte-identical to ship posture, and the cloud never passes
it — the override does not weaken the phase-7 gate. (For a build going to real end users
rather than QA, consider stripping the override or gating it harder: a player who finds
the flag can impersonate another user id locally.)

## Why this beats the alternatives

- **A second dev-posture build for QA** splits QA onto a binary that is not the one being
  shipped — the thing they validate is not the thing uploaded.
- **An ini/config file** works too, but an inert file beside the exe is easier to ship by
  accident than an argument nobody passes; args also compose with the other dev flags
  (invulnerability, boot-to-dungeon) already arg-gated in the layer.

This is the phase-1 "QA per-tester config" deferral coming due; plan it as part of phase 7
rather than discovering it from an angry "how is QA supposed to use this?"
