---
category: common-mistakes
tier: universal
sourceGame: FTPS_Online
phase: 6
question: null
sanitized: true
---

# Action listeners MUST register in Player Flow — not just Creator Flow

## The Pattern of Failure

This is a **repeated failure across multiple integrations**. Every agent gets this wrong the same way:

1. Agent reads the Phase 4 reference: "Actions must fire in BOTH Creator and Player Flow"
2. Agent writes a correct comment: `// Stage 4: register action listeners (fires in both Creator and Player Flow)`
3. Agent then writes `CreateWritableObjects()` with `if (bIsPlayerFlow) return` at the top
4. Agent registers action listeners (damage delegates, spawn handlers) inside or downstream of `CreateWritableObjects`
5. The `bIsPlayerFlow` guard cascades: no writable objects → no entity list → no damage bindings → no actions in Player Flow
6. Agent tests Creator Flow (actions work), claims Stage 4 done, never tests actions in Player Flow

## Why It Keeps Happening

The root cause is **conflating "state writing" with "event listening"**:

- State writing (WritableObject creation, WriteData calls) IS Creator-only
- Event listening (OnTakePointDamage, OnActorSpawned → SendAction) is BOTH flows

But the code structure puts both in the same initialization path. When the agent adds a `bIsPlayerFlow` guard to block state writing, it accidentally blocks event listening too.

## The Fix: Separate the Two Concerns

```cpp
void CreateWritableObjects()
{
    // BOTH flows: register spawn handler for bot detection + missile actions
    RegisterSpawnHandler();
    
    // BOTH flows: scan for existing bots → bind damage listeners
    TryRegisterExistingBots(); // binds OnTakePointDamage regardless of flow

    // Creator Flow ONLY: create writable objects for state tracking
    if (bIsPlayerFlow) return;
    
    RegisterTrackedEntities(); // creates FLudeoWritableObject per entity
}

void TryRegisterBotPawn(APawn* Pawn)
{
    // Creator Flow: register writable object
    if (!bIsPlayerFlow)
    {
        RegisterEntity(Pawn, "Bot", false, BotIdentity);
    }
    
    // BOTH flows: bind damage listener for actions
    Pawn->OnTakePointDamage.AddDynamic(this, &ThisClass::OnTrackedPawnTookPointDamage);
}
```

The key structural rule: **damage delegate binding and spawn handler registration MUST be outside any `bIsPlayerFlow` guard.** 

Also: the player pawn's damage listener must be bound in Player Flow too. Do it in `ApplyPlayerFlowState()`:

```cpp
// In ApplyPlayerFlowState, after restoring the player pawn:
PlayerPawn->OnTakePointDamage.AddDynamic(this, &ThisClass::OnTrackedPawnTookPointDamage);
```

## Verification

After implementing actions, check the Player Flow log for `SendAction` lines. If only `MissileFired` appears (from spawn handler) but no `Kill`/`Death`/`MissileHit`, the damage listeners aren't bound. If nothing appears at all, the spawn handler wasn't registered either.

## Why the Reference Isn't Enough

The Phase 4 reference §5.1 says "Do NOT guard `RegisterActionListeners()` with `if (bIsPlayerFlow) return`." Agents read this, understand it, comment it correctly, then violate it through indirect cascading guards. The reference needs to also say: **"Verify that no upstream guard (e.g., on CreateWritableObjects) prevents RegisterActionListeners from executing in Player Flow."** But even without that change, agents should trace the call chain before claiming actions work.
