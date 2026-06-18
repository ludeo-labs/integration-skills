---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: 4
question: "Does the Player Flow restore path destroy actors (in-flight projectiles, weapons-in-hand, throwables) before re-applying state, AND does it refill any attribute (ammo, inventory, throwable count) that also needs the destroyed actor re-spawned?"
sanitized: true
---

# Destroy-and-refill must decouple "actor exists" from "attribute is correct"

## Precondition

Applies when the Player Flow restore path does both:

1. **Destroys** game actors world-wide before applying state — typical for in-place reset, where stale actors from the previous replay would otherwise survive (in-flight projectiles, currently-equipped weapons, throwable in hand, drone followers, etc.).
2. **Refills** an attribute that determines whether the engine re-spawns the destroyed actor on demand (throwable inventory drives `PrepareNewThrowable`; weapon ammo drives equip; pickup count drives spawn).

If either condition does not hold (no destruction sweep, or refilled attribute is independent of actor existence), this learning does not apply.

## The mistake

Combining the value-equality short-circuit and the actor-existence check inside one block:

```cpp
if (!IsNearlyEqual(CurInventory, MaxInventory))
{
    SetInventory(MaxInventory);
    if (GetCurrentActor() == nullptr)
    {
        Engine->PrepareNewActor();   // <-- buried inside the guard
    }
}
```

On the **first** replay this works: prior session left inventory below max, the branch enters, `PrepareNewActor` runs, gameplay works.

On the **second** replay (in-place reset of the same Ludeo, no usage during replay 1):
- Destruction sweep destroyed the actor → `GetCurrentActor() == nullptr` is true.
- Inventory is still at max from replay 1's refill → `IsNearlyEqual` is true → **whole block is skipped, including `PrepareNewActor`**.
- Player has full count in the UI but no actor to fire/use. Input does nothing.

This mistake is especially insidious because the symptom looks like a different bug: "input not registering", "ability stuck", "weapon broken" — none of which point at a refill-loop guard.

## Why it tends to get marked "resolved" prematurely

Test paths that use the resource during replay 1 deplete the attribute, so on replay 2 the guard branch enters and the actor gets re-prepared. Bug only reproduces when the user does *not* exercise the resource on replay N. QA passes on the rare-noticed path; bug ships.

## How to apply

When writing or reviewing destroy-and-refill code:

1. **Two independent checks, not one nested.** The attribute write and the actor (re-)spawn are different invariants — keep them at the same scope:

   ```cpp
   if (!IsNearlyEqual(CurInventory, MaxInventory))
   {
       SetInventory(MaxInventory);
       ++RefillCount;
   }

   // Independent — runs regardless of whether inventory needed refilling.
   if (GetCurrentActor() == nullptr)
   {
       Engine->PrepareNewActor();
       ++RefillCount;
   }
   ```

2. **Mirror the engine's own callsites.** Pickup / ammo / throwable handlers in the game's source almost always use the bare `if (GetCurrentActor() == nullptr) Prepare()` pattern, with no surrounding attribute guard. Search for existing `PrepareNew*` / `Spawn*` / `Equip*` callsites in the engine and copy the conditional structure directly — don't invent your own.

3. **Test path: "no use" replay.** Verification must include a replay where the user does *not* use the resource — capture, replay, replay again without firing/throwing/picking up. If the resource works only when first-replay usage happened, the guard structure is wrong even if QA shows it "works".

4. **Search for the same shape elsewhere.** This is a code-shape bug, not a domain-specific one. Grep the integration for any block matching `if (!IsNearlyEqual(...) || ...) { ...; if (...nullptr...) <create>; }` and audit each one. Weapon ammo, placeable counts, drone state, helper bot inventory — anywhere refill happens after a destruction sweep.

## Reference incident

ActionGame, Stage 3 — the throwable refill loop in `ActionGameLudeoComponent`. Originally marked "resolved" after settling improvements; the structural guard bug only surfaced once the test path included a "no-throw replay 1" run.
