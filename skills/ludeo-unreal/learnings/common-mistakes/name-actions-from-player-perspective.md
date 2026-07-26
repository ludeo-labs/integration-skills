---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 8
question: "Are action names human-readable and player-facing? Is variable data (team ID, weapon, count) kept out of the action name string?"
sanitized: true
---

# Name actions from the player's perspective — never embed variable data

## The Failure
Three instances of the same mistake:
- `Kill_Rifle` — embedded weapon type in kill action. Correct: `Kill` + `GameplayEffect.DamageType.Rifle` as separate actions.
- `ElimChain` — named from C++ class `ElimChainProcessor`. Correct: `DoubleKill`, `TripleKill`.
- `ControlPointCapture_Team2` — embedded team ID in capture action. Correct: `ControlPointCapture` (team is context, not the action).

## Root Cause
The AI derived action names from code — class names, method names, tag paths. It used `FString::Printf` to embed variable data into action names. It never asked "what would a player call this moment?"

## The Rule
1. **Name from the viewer's perspective.** DoubleKill yes, ElimChain no.
2. **Actions and context are separate.** Kill is always Kill. The weapon/method is a separate action with the full tag path.
3. **NEVER embed variable data in the action name.** No `Kill_Rifle`, no `ControlPointCapture_Team2`, no `Pickup_Shotgun`. If you find yourself using `FString::Printf` or string concatenation to build an action name, you're doing it wrong. Variable data (team ID, weapon name, player name, counts) is context — not part of the action string.
4. **Specific names for specific milestones.** KillStreak5 and KillStreak10 are different achievements, not generic "KillStreak."
5. **Present exact strings for approval** before implementing.
