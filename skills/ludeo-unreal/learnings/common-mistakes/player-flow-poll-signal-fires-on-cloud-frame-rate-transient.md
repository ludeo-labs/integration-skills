---
category: common-mistakes
tier: generalizable
sourceGame: TacticsGame
phase: 3
question: "Does a Player-Flow feature compute a per-poll signal/action from transient game state (an active-unit reference, a phase value, an 'is X happening now' flag)? If so, that state can be momentarily ABSENT (null / between values) during moves, animations, or transitions — and the cloud's slower/variable frame rate will land your poll inside that transient window even when local play never does."
sanitized: true
---

# A Player-Flow poll signal that infers state from "not the positive case" fires spuriously on the cloud

## The bug

A Player-Flow action paused the Ludeo timer during the enemy's turn (`SendAction("EnemyTurnPause")`
/ `EnemyTurnResume`). It was written as "pause whenever it is NOT the player's turn":

```cpp
bool bPlayerTurn = false;                       // default: "not the player"
if (TurnManager && ActiveActor != nullptr && !IsAIControlled(ActiveActor))
    bPlayerTurn = true;
if (!bPlayerTurn) SendAction("EnemyTurnPause");  // <-- fires when ActiveActor is null TOO
```

On the **player's own turn**, *moving* fired `EnemyTurnPause` — but only **on the cloud**, never
locally. Root cause: the turn manager's active-unit reference goes **transiently null** during a
move / between-turn transition (a known per-tick artifact in this toolkit). The "not the player's
turn" test treats that null as the enemy's turn. **Local play runs fast enough that the poll never
samples the brief null; the cloud runs at a slower/variable frame rate and the poll lands right in
it** → spurious pause.

## Why it's a cloud-specific trap

Per-poll logic that's been "working locally" can be wrong and you won't see it, because local frame
timing skips the transient windows. The cloud streamer's lower/variable FPS changes *when* your poll
samples, surfacing transients that were always there. **"Works locally" is not evidence a poll-based
Player-Flow signal is correct** — reason about the transient states explicitly.

## The fixes (apply all three)

1. **Detect the POSITIVE condition explicitly — never infer it from "not the negative."** It is the
   enemy's turn *only* when the active unit **exists AND is AI-controlled**. A null/absent active
   unit is a transition, not the enemy — so it must not trigger the action:
   ```cpp
   bool bEnemyTurnNow = (ActiveActor != nullptr) && IsAIControlled(ActiveActor); // null => false
   ```
2. **Debounce the transition.** Only flip the committed state after the new value holds for N
   consecutive polls (~0.3s), so brief transients on either side can't toggle the signal.
3. **Fail-safe the default.** If the discriminating read fails (e.g. the is-AI flag can't be read),
   default to the *non-triggering* side, so a read failure can never produce the spurious action.

## Detection / how to apply

When you add any per-poll Player-Flow signal, list the game states the polled value passes through —
including the **momentary absent/null state** during moves, animations, async loads, and transitions.
If "absent" falls on the side that triggers your action, you have this bug latent; it will appear on
the cloud. Prefer positive-condition detection + debounce + fail-safe-default.

## Cross-reference

- `engine-quirks/diagnostics-to-stdout-for-cloud-logs.md` — you often can't *see* this in the cloud
  log (Shipping strips `UE_LOG`), so reason it out or add stdout diagnostics to confirm.
- `architecture/restore-timing-can-be-core-not-polish.md` — related: turn-based toolkit timing/transient
  states are integral, not polish.
