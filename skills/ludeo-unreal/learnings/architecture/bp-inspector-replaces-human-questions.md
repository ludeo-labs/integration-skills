---
category: architecture
tier: universal
sourceGame: FTPS_Online
phase: 3
question: null
sanitized: true
---

# BP Inspector tool eliminates most human-facing questions for BP-only games

## What happened

During FTPS_Online Stage 1-2, the agent asked the human 6+ questions about Blueprint internals (parent class, Health variable type, movement component, spawn logic, match-end signals). After the BP Inspector was deployed, a single `RunBPInspector.bat inspect` + `graph` run answered ALL of them in ~90 seconds with zero human effort.

## Questions the tool answered

| Question | Answer from tool |
|---|---|
| Is BP_Pilot_Base a Pawn or Character? | `parentClass: "Pawn"` |
| What movement component? | `components: ["FloatingPawnMovement:FloatingPawnMovement"]` |
| Is Health a float or double? | `type: "real"` (double), `replicated: true`, `default: 100.0` |
| What fires at match start? | `ReceiveBeginPlay` → `InitializeMatch` → `Delay` → `AISpawner` |
| Match-end signal? | `GameOver` sets `IsGameOver?` → `DisconnectPlayers` |
| How are bots spawned? | `AISpawner` → cast to `BP_GInstance` → `AI_Numbers_A/B` → `Spawn AIPawn` |
| Kill flow hooks? | `killPlayer` → `KillPlayer_Event` RPC |

## Critical design correction found

The tool revealed BP_Pilot_Base uses `FloatingPawnMovement` (NOT physics). The Stage 1 TDD had planned `SetPhysicsLinearVelocity` for restoration — completely wrong. Without the tool, this would have been discovered in Stage 3 after hours of failed restoration code.

## When to run

- **Stage 0 step 6:** Deploy the BP Inspector plugin
- **Stage 1:** Run `inspect` + `graph` before asking the human any BP-structural questions
- **Stage 3:** Use results to build exact state schema
- **Stage 4:** Use `graph` to identify action hook points
- **Any stage:** When about to ask "what does this Blueprint do?" — run `graph-function` first
