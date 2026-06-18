---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# Prefer muting the audio/UI subsystem over killing the trigger event

## The mistake

A peer plan for the ActionGame briefing-VO-skip proposed gating `AGameLevelScriptActor::HandleGameplayPhaseStarted()` so the level BP's `GameplayPhaseStarted()` BlueprintImplementableEvent wouldn't fire in Ludeo Player Flow. That would have silenced the briefing VO — but also cut off every other thing the level BP does in response to that event:

- Door / gate opens
- Enemy wave / civilian spawn commands
- Objective marker activation
- HUD-state transitions

For Player Flow (where state is restored from the snapshot and doors/enemies already exist) this *might* have been fine. For regression cases (restoration imperfect, partial state, future slices) it would have left the level empty. The blast radius was way too wide for the symptom.

## The lesson

When a broadcast event drives multiple subsystems (audio, gameplay, UI) and you only want to suppress ONE, **mute that subsystem, don't gag the broadcast.**

Concretely: if `GameplayPhaseStarted` → DialogManager.Play + SpawnManager.Activate + ObjectiveMarker.Show, and you want to silence the dialog only:

- ❌ `#if LUDEO skip GameplayPhaseStarted() #endif` — kills all three.
- ✅ `DialogManager.SuppressForLudeoBoot()` right before `GameplayPhaseStarted()` fires — dialog is queued but dropped; spawns and markers run normally.

## Heuristic: scope the fix to the symptom's subsystem

| Symptom | Fix at this layer |
|---|---|
| Audio/dialog cue | Mute the audio/dialog manager |
| UI widget appears | Hide/destroy the widget or gate the widget-creator function |
| Cutscene plays | Mute/cancel the specific LevelSequence or Sequencer actor |
| Animation plays | Early-out the GAS ability that drives it, or short-circuit the montage play call |
| Timer/delay | Cancel the specific timer by handle, not the whole manager |

**Only** kill the broadcast when:
1. All subscribers of the broadcast are the one thing you're trying to silence (usually false).
2. You've verified no other subscriber does gameplay-critical work.
3. The narrower fix is unavailable (no mute API, no per-queue cancel, no easy way to gate just the ability).

## Test for wide-blast-radius patches

Before committing a patch that gates a broadcast event or a `BlueprintImplementableEvent` or a delegate fire:

1. Grep for every subscriber of the event (find `AddDynamic(`, `AddUObject(`, `OnEventName`, `BindUObject(`).
2. Read each subscriber's body. Does it do gameplay-critical work (spawn, despawn, show/hide gameplay widget)?
3. If yes → the patch is too wide. Find the narrower mute in the specific subsystem.

## Why agents reach for broad patches

Killing a single function call is visually simple: one `#if ... return; #endif`. Muting a subsystem requires finding an API, understanding its state model, and wiring suppress + resume calls. It feels like more work. It's often actually less work over the life of the fix — narrow patches don't regress in future stages.

## How to apply

Any time a Ludeo engine patch proposes to skip, gate, return-early, or suppress a broadcast event / BP event / multicast delegate:

1. List every subscriber (grep the event name).
2. Classify each subscriber: audio/VO, UI, gameplay, statistics, replication.
3. If more than one class is hit and only one is the symptom, the patch is too wide.

If in doubt, implement both (narrow mute AND leave the broadcast firing) and test — narrow virtually always works for audio/UI artifacts.

## Related

- `suppress-engine-vo-via-dialog-manager-mute.md`
- `verify-vo-path-before-proposing-skip.md`
