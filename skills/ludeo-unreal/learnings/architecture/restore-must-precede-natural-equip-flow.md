---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: 4
question: "Does the host engine have an automatic equip/cosmetic/loadout pipeline that fires post-pawn-spawn or post-loadout-load? If yes, is your Player Flow restore scheduled to run before or after that pipeline, and have you tested both editor AND shipping?"
sanitized: true
---

# Player Flow restore must precede the host engine's natural equip flow

## Precondition

Applies when:

1. The integration restores player state (equipped weapon slot, cosmetic toggles like special-mode-on, attribute values) via reflection-driven OnRep pokes (`SetPropertyValue_InContainer + ProcessEvent("OnRep_X")`) rather than calling the engine's own setter functions.
2. The host engine has a **natural equip / cosmetic / loadout pipeline** that runs as part of normal pawn possession or post-loadout-load — i.e. the engine on its own decides "equip the loadout's primary weapon, attach the special-mode cosmetic, apply default stance" some time after the pawn spawns.
3. The integration uses any kind of pre-restore deferral ("wait N seconds for the level BP to settle before pause+restore", "defer to the next tick after action phase started", etc.).

If you only call the engine's own setter functions (which natural-flow-aware), or there's no natural equip pipeline, this learning doesn't apply.

## The mistake

Adding a pre-restore deferral that *looks fine in editor* but loses an equip race in shipping.

In editor PIE:

- Loadout assets are pre-cached in editor memory.
- The natural equip flow waits on `IsLoadoutLoaded()` (or equivalent), which flips true synchronously.
- The natural flow then runs immediately, but the integration's pre-restore deferral is even slower — the natural defaults get installed, but then your deferred restore arrives later and overwrites them.
- Visible behaviour: looks correct.

In shipping:

- The natural flow's wait condition (`IsLoadoutLoaded()`) flips true after a streamable-loadout async-load — slower than editor.
- BUT the engine's actual equip / special-mode-attach / cosmetic-attach work, once that wait passes, completes within a frame or two.
- Your pre-restore deferral (`5s after OnGameplayPhaseStarted`) is much longer than the natural flow's total time.
- The natural equip flow finishes before your deferred restore even tries to run. Natural defaults stomp captured state. Your reflection pokes either no-op (if they hit unsatisfied preconditions inside the engine's attach functions — see related learning on TPP mesh owner-visibility) or the engine's later post-loadout init treats them as a fresh start and overwrites again.
- Visible behaviour: captured slot doesn't equip (engine default equips instead); cosmetics attach to the wrong mesh.

The mistake is especially insidious because:

- It looks fine in editor and you ship, then notice the bug only on a packaged build.
- Reverting the deferral seems wrong because the deferral was added to fix a *different* problem (level-BP NPC spawns, briefing VO leakage, world-not-yet-settled cosmetics) — and reverting brings those back.

## How to apply

When restoring player / character state:

1. **Run `ReadAndApplyState` immediately** when the pawn is ready (pause + pawn-poll + apply, in one synchronous flow). Don't delay it to "let the world settle". Your restore should win the equip race against the engine's natural defaults.

2. **Move "settle the world / clean up level-BP work" tasks to *after* restore**, not before. After restore + OpenRoom + BeginGameplay unpause, run:
   - A short ticker that sweeps level-BP-spawned non-tracked NPCs every ~0.5s for ~3s.
   - A held dialog-mute over the same window before re-enabling dialog.
   - Any other "the level BP keeps spawning stuff after action phase starts" cleanup.

3. **Test in shipping (or a packaged build) early.** Editor timing is not representative. Allocate at least one playtest cycle in shipping per stage that touches player visual / equip state.

4. **Prefer engine setters over reflection pokes when GAME_API or the equivalent is available.** A direct `SetCurrentEquippableIndex(N)` call is timing-aware and survives the natural flow racing it. Reflection-based byte writes + synthetic OnRep don't.

## Reference incident

ActionGame, Stage 3.

- A commit added "option-H 5s deferred restore" — `ReadAndApplyState` ran 5s after `OnGameplayPhaseStarted` to let the level BP run its t=0 sequence on a settled world. Worked in editor.
- Unnoticed for ~2 days because shipping wasn't tested every change.
- Shipping replay later shows the captured primary weapon visible as the secondary; player cosmetic visible from inside the FPP camera (TPP mesh owner-visibility issue, see related learning).
- Bisection ruled out a throwable-refill regression, an `IsLoadoutLoaded()` gating attempt, and several intervening commits. Root cause: the pre-restore deferral.
- Fix (a later commit): revert the deferral so restore runs immediately at OnGameplayPhaseStarted; reintroduce the stray-AI sweep + dialog-mute hold via a new `StartPostUnpauseSweep` ticker fired from `TryBeginGameplay` (post-unpause), not pre-restore.
