---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: 5
question: "Does the game run a startup choreography / queued-animation / state-machine sequence AFTER its 'gameplay active' signal (turn-based action queues, scripted intros, staged spawns)? If yes, restore-timing correctness is STAGE 3 work — gate the restore on the game's own idle signals; do not reflex-defer 'timing' to the polish stage."
sanitized: true
---

# Restore timing can be integral to game mechanics — don't reflex-defer it to the polish stage

## The trap in the stage map

The skill files "deferred property application / restore timing" under Stage 7
(Player Flow polish). That framing invites the agent to label every timing problem
"Stage 7 territory" — the human on TacticsGame challenged exactly that, and was
right: **in a turn-based game, WHEN the restore applies is not polish, it is the
mechanics.** The game's interaction loop (whose turn, what's animating, what input is
legal) is a choreography; restoring into the middle of it produces nondeterministic,
demo-breaking failures (intermittent empty ability bar, wedged input, un-advanceable
turns) that no amount of correct DATA fixes.

Heuristic: if the game runs a queued/staged sequence after its "gameplay active"
signal — turn-based action/animation queues, scripted battle intros, staged spawn
waves, state-machine boots — then restore timing belongs in Stage 3, with the same
rigor as the data itself.

## The pattern that worked (TacticsGame)

Three pieces, all driven by the GAME's own signals — none by wall-clock guesses:

1. **Restore only into a settled engine.** After the gameplay-active gate, ALSO wait
   until the game's own "something is animating" signals (here: the toolkit
   ActionManager's OngoingActions + BlockingActions sets) have been continuously
   empty for ~0.5s. The startup choreography finishes playing; the restore then lands
   on a quiescent state machine. This killed an intermittent (1-in-3) empty-ability-
   bar race that data-side fixes could never touch.
2. **Capture only from actionable moments** (the write-side dual): gate per-tick
   writes on "a player unit is active AND nothing is animating" — then EVERY frame a
   user can trim to restores to a player-actionable choice moment by construction.
   Critical because the platform's restore point follows the user's TRIM, not the
   capture press — per-frame validity is mandatory.
3. **Move through the game's own flow, not around it.** To start the replay on the
   captured unit, advance turns via the game's own end-turn input function (guarded:
   only across player-controlled units, never crossing a round boundary) — each
   transition rebuilds UI/animate layers natively. Direct state overwrites of the
   turn system were what desynced the controller/UI layers in the first place.

## The rule

"Timing" items earn Stage 3 status whenever they gate CORE playability of the
restored moment (can the player act? is the input loop alive? is the right actor's
turn running?). Defer to Stage 7 only timing work that is genuinely cosmetic
(animation blending, camera easing, late-loading visuals).
