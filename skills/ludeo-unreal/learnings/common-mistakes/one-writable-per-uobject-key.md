---
name: one-writable-per-uobject-key
description: Two FLudeoWritableObjects sharing the same UObject* as Params.Object silently breaks the SDK action-stream / goal-template pipeline. Always use a distinct UObject identity per writable.
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# One writable per UObject* (always)

`FLudeoRoomWriter::CreateObject(Params)` keys the resulting writable on `Params.Object`. The SDK keeps a weak ref back to that UObject and uses it for internal tracking — every writable in the room MUST own a distinct UObject identity. Two writables on one `UObject*` is undefined behavior in the binary DLL.

## How the failure presents

- `CreateObject(...)` **returns success** for the second writable. No SDK-side error, no log.
- `SendAction(...)` **returns success** at every action call site.
- Capture / replay state writes look fine in logs.
- **The action stream / goal-template generation goes to zero or near-zero** — the cloud produces a Ludeo with empty goal templates, the highlight extractor can't classify the run, downstream "best moment" inference breaks.
- Reverting the double-writable change and re-capturing produces a working Ludeo with full templates. The breakage is **reproducible by A/B comparison only** — there is no error you can grep for.

This is a silent corruption. You cannot detect it from open-source code or from the SDK's public surface; it manifests downstream of the WriteData pipeline, inside the binary DLL.

## What "the same UObject*" actually means

Wrong:
```cpp
// liveAI already registered as ObjType_EnemyAI via OnActorSpawned
FLudeoRoomWriterCreateObjectParameters Params;
Params.Object    = liveAI;                  // ← SAME AActor* as the EnemyAI writable
Params.ObjectType = LudeoAttr::ObjType_DeadBody;
Writer.CreateObject(Params);                // boom — two writables, one UObject key
```

Right (cleanest) — **don't allocate a parallel writable**; mutate the existing one in place. This is the preferred shape when the conceptual "second" entity is a state transition of the first (corpse-of-the-AI, broken-of-the-prop, etc.):
```cpp
// AI just died — write the final character snapshot to the SAME writable,
// mark Entity.bPersistOnActorDeath so the per-tick loop preserves the
// writable after the engine GCs the actor.
const FLudeoWritableObject& Obj = Entity.WritableObj.GetValue();
FScopedLudeoDataReadWriteEnterObjectGuard Guard(Obj);
WriteCharacterState(Obj, DeadAI, Entity.ObjectType);   // writes bIsAlive=false + Transform + ClassPath
Entity.bPersistOnActorDeath = true;
```
This is the ActionGame Phase 5 final shape. Zero new `CreateObject` calls; the action-stream blast radius is provably zero.

Right — use a component the actor owns as the key:
```cpp
// Prop damage lives on a component; the component is its own UObject distinct
// from any actor-keyed writable elsewhere.
Params.Object = Actor->FindComponentByClass<UDestructibleComponent>();
```

Right — destroy the prior writable first, then reuse the actor (in-place rebuild):
```cpp
UnregisterEntity(liveIndex);                // DestroyObject the EnemyAI writable first
// now liveAI has no associated writable
FLudeoRoomWriterCreateObjectParameters Params;
Params.Object    = liveAI;                  // reuse the same UObject — but with the old writable destroyed first
Params.ObjectType = LudeoAttr::ObjType_DeadBody;
Writer.CreateObject(Params);
```

Right (cautious) — minted UObject subclass as the SDK key. Only when none of the above patterns fit. Note that `NewObject<UObject>(Outer, UObject::StaticClass())` **crashes outside editor builds** (`UObject::StaticClass()` is flagged abstract — see `learnings/engine-quirks/uobject-staticclass-is-abstract-in-non-editor.md`). Always subclass:
```cpp
// In a header:
UCLASS()
class UMyIntegrationEntityKey : public UObject { GENERATED_BODY() };

// At the call site:
UObject* KeyObj = NewObject<UMyIntegrationEntityKey>(GetTransientPackage());
TStrongObjectPtr<UObject> KeyHold(KeyObj);   // GC-root until DestroyObject runs

FLudeoRoomWriterCreateObjectParameters Params;
Params.Object    = KeyObj;
Params.ObjectType = LudeoAttr::ObjType_DeadBody;
Writer.CreateObject(Params);
```
This pattern multiplies code (header file, lifetime management, separate object type, separate restore branch) and should be the LAST resort, not the first. The ActionGame Phase 5 attempts tried it twice and both times ended up reverting to the mutate-in-place shape.

## Common shapes that trigger this

1. **Derived entity from a still-tracked source.** A live AI is tracked; you want to also track its corpse separately. Wrong: pass the same AActor* for both. Right: separate transient UObject for the corpse.
2. **Same actor, multiple aspects.** An actor that's both a Gate AND a damageable prop. Wrong: register it twice. Right: register the gate by the actor and the prop damage by its component.
3. **Re-registering an actor.** Old writable not destroyed before new `CreateObject` on the same UObject. Symptom: works for a few ticks until the second writable's first WriteData broadcasts internally.

## Self-audit

Whenever you call `Writer.CreateObject` with a `Params.Object` that is **already a registered entity's source UObject** in the same room session, you have this bug. Audit checklist for any per-entity refactor:

- For every `CreateObject` call, identify the UObject passed as `Params.Object`.
- For every such UObject, confirm there is no concurrent writable elsewhere in the integration tracking the same `UObject*`.
- If two writables conceptually relate to the same actor, decide **which one of the three patterns** above to use, document the choice, and grep for accidental reuse.

## How we got here

ActionGame Phase 5 spanned two failed attempts before the correct fix.

**Attempt 1.** The agent implementing per-entity DeadBody bodies passed `Params.Object = DeadAI` for the new `ObjType_DeadBody` writable while that same actor was still registered as a `Civilian`/`EnemyAI` writable. After capture, goal-template generation produced empty templates. The agent wrote a handoff doc misdiagnosing the failure as "mid-mission `CreateObject` broke the action stream" and recommended avoiding mid-mission `CreateObject` entirely.

**Attempt 2.** A subsequent session correctly diagnosed Attempt 1 as a one-writable-per-UObject violation and tried to fix it with a fresh transient UObject key via `NewObject<UObject>(GetTransientPackage(), UObject::StaticClass())`. That compiled clean and ran fine in the editor — but crashed in development non-editor the moment an AI died, because `UObject::StaticClass()` is treated as abstract outside editor builds. See `learnings/engine-quirks/uobject-staticclass-is-abstract-in-non-editor.md`.

**Final shape.** Dropped the separate `ObjType_DeadBody` writable entirely. The dying AI keeps its existing `Civilian`/`EnemyAI` writable; `OnAILifetimeChanged(!IsAlive)` runs `WriteCharacterState` one more time (writing `bIsAlive=false` + final Transform + ClassPath) and flips `Entity.bPersistOnActorDeath = true` so the per-tick loop preserves the writable after the engine GCs the actor. The replay side spawns a cold ragdoll when `bIsAlive=false` in the `EnemyAI`/`Civilian` restore branch. No new `CreateObject`, no new UObject identity, no risk of any double-key collision.

The lesson reaching beyond Ludeo: when the second of two writables/keys/identifiers is a state transition of the first, prefer **mutate in place** over **create a parallel object**. Engineers' first instinct is to model new state as new objects; for SDK integrations keyed on UObject identity, that instinct fights the SDK.

## Cross-references

- `learnings/engine-quirks/uobject-staticclass-is-abstract-in-non-editor.md` — why the transient-UObject fallback is a footgun, not a primary path.
- `learnings/common-mistakes/dont-condemn-an-api-without-isolating-the-shape.md` — the parallel meta-lesson on overgeneralizing from a single failure.
