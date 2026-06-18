---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: 4
question: "Does the game have a central dialog/VO manager with a `bCanPlay`-style master gate and a `Clear`/`InterruptAll` that cancels pre-delay queued dialogs? If yes, muting the manager for a boot window beats killing the trigger event."
sanitized: true
---

# Suppress engine briefing VO by muting the dialog manager, not by killing the trigger event

## Precondition

This applies when:
- The game plays briefing / setup / intro VO via a central dialog manager (e.g., `UDialogManager`, `UDialogSystem`, `UNarrativeManager`) — not directly via `UAudioComponent::Play` calls from the level BP.
- The manager gates every dialog play through a master boolean (`bCanPlayDialogs`-style) that external code can flip.
- The manager owns the queue, including pre-delay timers (each queued line has an `InitialLineDelayHandle`-style timer), and has a `Clear()` or `InterruptAll()` method that cancels those timers.
- The VO is kicked off from a broadcast event (`GameplayPhaseStarted` BP event, `OnMissionStart` delegate) that *also* drives gameplay setup (door opens, enemy spawns, objective markers).

## Problem

The obvious "kill the trigger event" fix — skipping `HandleGameplayPhaseStarted()` in C++ so the level BP's `GameplayPhaseStarted()` never fires — also cuts off the gameplay setup those BPs perform. The restored Player Flow session ends up in an empty level: no doors opening, no enemies spawning, no objective markers.

## Mitigation

Add a small pair of public helpers to the dialog manager that mirror its own existing `HandleRestartLevelStarted` / `HandleBlackScreenStarted` pattern:

```cpp
// Header
void SuppressForLudeoBoot();
void ResumeAfterLudeoBoot();

// Impl
void UDialogManager::SuppressForLudeoBoot()
{
    bCanPlayDialogs = false;
    Clear();  // cancels ActiveDialogs + their pre-delay timers
}

void UDialogManager::ResumeAfterLudeoBoot()
{
    bCanPlayDialogs = true;
}
```

Call `Suppress` from the game state's `OnMissionActiveChanged` (or equivalent) during the Ludeo-skip-setup path, before the mission-state jump to Alarm. Call `Resume` from the Ludeo component at the `BeginGameplay` unpause site (last step of the Player-Flow sequence: pause → poll pawn → unpause → restore → settle → re-pause → open room → begin gameplay).

The level BP's trigger event still fires, so gameplay setup (doors/spawns/objectives) runs normally. Only the dialog queue gets dropped.

## Why Clear() also kills pre-delay lines

`FActiveDialogData` stores `InitialLineDelayHandle` (default 0.2s before the first line plays). The manager's `Clear()` iterates `ActiveDialogs`, calls `InterruptPerformers`, and — crucially — calls `TimerManager.ClearTimer(Dialog.Value.InitialLineDelayHandle)`. So a dialog that was just queued the same frame but hasn't started its first line yet gets cancelled.

## How to apply

Stage 3 (Player Flow restoration), when diagnosing "briefing VO still plays during Player Flow":

1. Find the dialog manager class (grep `class\s+\w+DialogManager`, `class\s+\w+VoiceComponent`, `DialogueManager`).
2. Check for a master gate (`bCanPlayDialogs`, `bMuted`, `bEnabled`).
3. Check if `Clear()` or equivalent clears pre-delay timers.
4. If both present, use the suppress/resume pair. If not, fall back to broader measures (kill the trigger event, or find the specific data asset and `InterruptDialog(it)`).

## Related learnings

- `prefer-narrow-mute-over-killing-trigger-event.md` — why this pattern exists.
- `verify-vo-path-before-proposing-skip.md` — how to find which subsystem actually plays the VO before proposing any fix.
