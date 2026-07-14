---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# Verify which subsystem actually plays the briefing VO before proposing any skip

## The mistake

Stage 3 of the ActionGame integration: a briefing VO (a short scene-setting line played as the level begins) played at Player Flow start instead of dropping the player straight into the active gameplay phase. My first plan proposed using the game's official state-machine "skip intro sequence" mechanism: `UGameStateMachineSettings::SetSkipIntroSequence`, `AMissionState::Multicast_SkipIntroSequence`, and `UGameStateMachine::RequestEndIntroSequence`.

That plan would have changed nothing. The "intro sequence" controlled by the lobby overview screen is the lobby/job-overview intro — a completely different audio path from the per-level briefing VO. The briefing VO is played by `AGameLevelScriptActor::HandleGameplayPhaseStarted` calling the `GameplayPhaseStarted()` BP event, which the level blueprint uses to invoke `UDialogManager::PlayDialog(briefing-asset, ...)`.

The Explore agent had run a preliminary investigation and reported "lobby overview intro sequence" as the hypothesis without verifying which code actually plays the VO the user heard. I accepted the hypothesis and built a whole plan on it.

## The lesson

"Intro sequence" means different things in different games. **Before proposing a VO-skip mechanism, map the actual play path from observation to code.**

Diagnostic checklist:

1. What does the user *hear*? (Exact words, approximate length, when it starts relative to level load.)
2. Grep `BlueprintImplementableEvent`, `BlueprintNativeEvent`, `DECLARE_DYNAMIC_MULTICAST_DELEGATE.*Action` in the level script actor and mission state — the VO is almost always fanned out through one of these.
3. Grep `DialogManager`, `DialogueManager`, `VoiceComponent`, `NarrativeManager`, `BarkManager` — find the central VO subsystem.
4. Check what the level BP does on `GameplayPhaseStarted` / `OnMissionStart` / equivalent — it likely calls `DialogManager::PlayDialog(...)` with a data-asset that holds the audio.
5. Only now is your hypothesis about "which mechanism to skip" grounded.

## Anti-pattern: "There's a skip-intro system, use it"

If grep finds any function with "Skip" + "Intro" / "Cinematic" / "Sequence" in its name, **don't assume it controls the VO you want to silence.** It likely controls a different cinematic stage (menu intro, cutscene cinematic, pre-mission briefing UI).

The state-machine intro-sequence stuff in ActionGame (`ServerCheckSkipIntroSequence`, `bIsIntroSequenceSkipped`) is real and works — for the lobby/overview intro. It wouldn't have touched the per-level briefing dialog that started playing once the mission went active.

## How to apply

During Stages 3 and 5 (Player Flow restoration, non-gameplay handling), when a user reports a cosmetic artifact (VO, UI overlay, cutscene) during Ludeo playback:

1. Grep for the literal words they describe (the exact VO line) — sometimes dialog assets are named after the line.
2. Find the audio subsystem that plays it (dialog manager, voice component, Wwise event).
3. Find what broadcast triggers that subsystem.
4. Only then design the mitigation. Prefer muting the audio subsystem (narrow) over killing the broadcast (broad — see `prefer-narrow-mute-over-killing-trigger-event.md`).

## Related

- `prefer-narrow-mute-over-killing-trigger-event.md`
- `suppress-engine-vo-via-dialog-manager-mute.md`
- `always-read-sdk-docs-before-sdk-api-calls.md` (same pattern: don't guess at which API solves the problem — grounding first)
