---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 7
question: "For objective-based actions (capture, score, deliver), did you consider that Studio Labs needs to distinguish good-for-player vs bad-for-player? Did you track objective state as writable objects, not just actions?"
sanitized: true
---

# Design objective actions for goals and constraints — and track objective state

## The Failure
The AI created `ControlPointCapture` as a single flat action, then `ControlPointCapture_Team2` (embedding variable data). Neither design supports goals/constraints in Studio Labs. A goal like "capture 2 points" needs `CaptureTeam`, and a constraint like "don't lose 2 points" needs `CaptureEnemy` — the system must know the direction relative to the player.

Additionally, the AI initially decided control points only needed actions, not writable objects. But Player Flow needs to reconstruct WHICH point is held by WHICH team — that's ongoing state, not a one-time event.

## The Rule

### 1. Objective actions need player-relative direction
For any objective event that can be good or bad for the player:
- `CaptureTeam` / `CaptureEnemy` (not `ControlPointCapture`)
- `ScoreTeam` / `ScoreEnemy`  
- `DestroyTeam` / `DestroyEnemy`

Compare the event's team ID against the local player's team ID to determine direction.

### 2. Objective state needs writable objects
If an objective has ongoing ownership/progress state that changes during the match, it needs a writable object — not just an action. Actions mark the moment of change; writable objects track the current state for Player Flow reconstruction.

Control point example:
- **Action:** `CaptureTeam` or `CaptureEnemy` (fired on capture event)
- **Writable object:** ControlPoint with `PointName`, `OwnerTeamID`, `Position` (updated on each capture)

### 3. Think about how Studio Labs uses the action
Before naming an action, ask: "How will this be used as a goal or constraint?" If the answer requires knowing team/direction/context, the action name must encode that meaning — not as embedded variable data, but as distinct action names.

## How to Apply
Add to the skill's 6A action discovery (Section 3.6):

> **Step 4f: Goal/constraint analysis.** For every objective-based action, ask: "Could this be a goal? Could it be a constraint?" If yes, the action needs player-relative variants (Team/Enemy). Also determine: does this objective have ongoing state? If yes, it needs a writable object, not just an action.
