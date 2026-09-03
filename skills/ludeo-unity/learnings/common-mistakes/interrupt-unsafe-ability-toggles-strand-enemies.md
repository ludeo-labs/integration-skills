---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5,8"
question: "Do any enemy abilities toggle collision or visibility OFF at a start stage and back ON only at a later stage (a leap that ghosts through obstacles, a burrow, a teleport fade)? Replayed fights maximize mid-window interrupts, so audit every such pair for symmetric restore in ALL exit paths."
sanitized: true
---

# Interrupt-unsafe ability toggles strand enemies below the world

Enemy abilities often disable the actor's own collision/ground-check at a start stage
(so a leap can pass over obstacles) and re-enable it only at the landing stage. The
skill's Finish/Stop cleanup paths restore gravity, kinematics and buffs - but not the
toggle. Any interrupt between the stages (player stagger, a wave transition stopping the
skill, death of the skill's driver) leaves the actor permanently non-colliding, with
gravity explicitly re-armed by the cleanup: it falls through floor AND scenery until the
game's kill plane deletes it. Presentation reads as "the enemy was inside the rock, then
gone."

Why replays surface it when live play never did: a moment is one dense fight replayed
over and over by a player who compares against the video, and restored mid-fight state
plus a fresh player's interrupt pattern rolls the interrupt dice far more often than any
single live run. The kill plane's silent cleanup is the game team's own tell that falls
were a known, tolerated live phenomenon.

**Fix shape (game-side, small):** track the pending toggle in a flag set at the
disable, cleared at the enable stage, and restored in BOTH `FinishSkill`-style and
`StopSkill`-style cleanup paths (guarded on the actor being alive, so the death path's
own collision handling is not stomped). Reset the flag in the skill's pooled-init.

**Sibling of the same disease:** a ragdoll knockdown whose stand-up aligns the actor's
root to wherever the ragdoll hip ended - with no ground validation - plants survivors
UNDER the floor when a heavy hit drags the hip through geometry. Add a downward raycast
at stand-up: snap to the hit, and when there is no floor under the hip at all, leave the
root where the knockdown began (ground it stood on moments earlier).

Diagnosis shortcut for both: enemies found at impossible depths with full health and AI
running, whose fall START times (back-computed from depth via 0.5*g*t^2) land mid-fight
rather than at spawn - placement was fine; a mid-fight event removed their footing.
