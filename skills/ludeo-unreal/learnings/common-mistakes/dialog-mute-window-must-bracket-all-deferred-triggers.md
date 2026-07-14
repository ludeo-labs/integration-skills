---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: 5
question: "What's the latest possible moment the audio/dialog subsystem you're muting can be triggered? Does your Suppress→Resume window bracket that moment?"
sanitized: true
---

# A dialog / VO mute window must stay closed until AFTER every deferred trigger has fired

## Precondition

This applies when:
- You're suppressing an audio/dialog subsystem via a boolean gate (e.g., `bCanPlayDialogs = false`) that the subsystem checks at play time.
- The trigger that would have fired the audio is **deferred** — runs later than the event that seems to "cause" it (common with BP events, GAS events, latent-function BP nodes, replicated state changes).
- You're only suppressing in a short window — e.g., Suppress in `OnMissionActiveChanged`, Resume in `TryBeginGameplay`.

## Symptom

Your suppress call fires (log confirms). The subsystem honors the gate (code check confirms). Yet the audio still plays later.

## Root cause

The suppress window closed before the deferred trigger ran. By the time the trigger calls `PlayDialog(...)`, the gate is back open, and the dialog plays normally.

## The ActionGame example

- Suppress (`bCanPlayDialogs = false`) fires at `OnMissionActiveChanged`.
- Resume (`bCanPlayDialogs = true`) fires at `TryBeginGameplay`, which runs after `OpenRoom` + `AddPlayer` complete.
- The level BP's `GameplayPhaseStarted` event queues the briefing `PlayDialog` ONLY after loadout async-loads (~1–2 s later).
- If `TryBeginGameplay` fires before loadout-load completes (fast-click), Resume happens before the BP's PlayDialog call. Gate re-opens. Briefing plays.

## The fix (general)

Push ONE end of the window so that the Suppress→Resume bracket covers every possible deferred trigger point:

- **Push Resume later** — don't call it until the last deferred trigger has had a chance to fire and be blocked.
- OR **Push the Resume-triggering event later** — e.g., gate `OpenRoom` on the same signal the deferred trigger waits for (in ActionGame: `IsLoadoutLoaded`). That way Resume (still at `TryBeginGameplay`) fires after the BP's PlayDialog has already tried and been rejected.

ActionGame chose option 2 — gating `OpenRoom` on `IsLoadoutLoaded` extends the effective Suppress window to cover the BP's deferred PlayDialog window.

## Diagnostic

If Suppress fires (per log) and the subsystem's gate check exists (per code), and audio still plays: map the audio's trigger to a SPECIFIC timestamp in the log. Compare to the Resume timestamp. If trigger > Resume, your window is too narrow.

## Questions to answer per game

- What's the latest possible moment a blocked trigger could fire? (Usually the most deferred path: latent BP node, GAS event bound to a replicated state change, timer.)
- Does your Resume point come AFTER that? If not, either push Resume later, or push the Resume-triggering call later.

## Related

- `gate-openroom-on-loadout-ready.md` — the specific fix for this category in ActionGame.
- `prefer-narrow-mute-over-killing-trigger-event.md` — muting is better than killing the event, but the mute window must be correct.
