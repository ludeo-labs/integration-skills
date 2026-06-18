---
category: common-mistakes
tier: universal
sourceGame: FPSGameStarterKit
phase: 4
question: null
sanitized: true
---

# set-savegame must target the BP where the variable is DEFINED, not derived classes

## The Mistake

Running `RunBPInspector.bat set-savegame /Game/FPS_Game/Blueprints/Bonus/AI/AI_Soldier Health true` — targeting the top-level spawned BP (`AI_Soldier`) instead of the base class where `Health` is actually defined (`BP_AI_CharSoldier` in a subdirectory).

## Why It Fails Silently

`SetSaveGameFlag` operates on `UBlueprint::NewVariables` — the list of variables defined on THAT specific Blueprint. Inherited variables from parent BPs are NOT in `NewVariables`. If the target BP inherits `Health` from a parent, `SetSaveGameFlag` won't find it and returns false.

## How to Find the Right BP

1. Run `RunBPInspector.bat inspect` → check the report JSON
2. Look at which BP has `Health` in its `variables` array
3. That's the BP to target with `set-savegame`

In FPSGameStarterKit:
- `Health` and `isDead` are defined on `BP_AI_CharSoldier`, `BP_AI_CharZombie`, `BP_AI_Charger`, `BP_AI_CharPatrol` (in subdirectories under `Bonus/AI/`)
- NOT on `AI_Soldier`, `AI_Zombie`, `AI_Charger`, `AI_Patrol` (top-level spawned BPs that inherit from the above)
- `HealthCurrent`, `HealthMax`, `isDead` are defined on `BP_CharacterBase` (the player base class)

## Prevention

Always check the inspection report before running `set-savegame-batch`. The report lists variables per BP — only BPs that DEFINE the variable (in their `NewVariables`) will appear with that variable in the list. Derived BPs inherit the flag once it's set on the base class.
