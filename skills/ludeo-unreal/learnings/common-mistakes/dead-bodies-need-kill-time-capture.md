---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# Dead-body capture needs a kill-time buffer — snapshot-tick iteration catches zero in games that GC corpses fast

## The Mistake

The first-pass design tried to capture corpses at the same tick as every other snapshot attribute:

```cpp
// WRONG — iterates dead actors at snapshot time
for (TActorIterator<AAICharacter> It(World); It; ++It)
{
    if (!It->IsAlive())
    {
        CorpseClasses.Add(It->GetClass()->GetPathName());
        CorpseTransforms.Add(It->GetActorTransform());
    }
}
Obj.WriteData(LudeoAttr::DeadBodies, SerializeBlob(CorpseClasses, CorpseTransforms));
```

Result: `CorpseClasses.Num() == 0` on every tick, even in heavy combat.

## Why It Fails

ActionGame (and many similar shooters) destroy dead-AI actors within 1-2 frames of death. Ragdoll is typically a separate spawned actor or a component-level visual effect; the logical `AActor` is `Destroy()`ed almost immediately. By the time the next snapshot tick runs, the dead actors are no longer in the world — `TActorIterator<>` only sees live entities.

This means "iterate dead actors" returns zero in steady state. The capture is correct in principle but the observation window is wrong.

## The Rule

**Capture corpse metadata at the moment of death, not at the snapshot tick.** Keep a FIFO buffer in the integration component:

```cpp
// On entity registration / in WriteTrackedState — cache last-known state every tick
Entity.LastKnownClassPath = Actor->GetClass()->GetPathName();
Entity.LastKnownTransform = Actor->GetActorTransform();

// In DetectKillActions — when we observe the death transition:
if (!GameChar->IsAlive() && Entity.bWasAlive)
{
    Entity.bWasAlive = false;
    CapturedCorpses.Emplace(Entity.LastKnownClassPath, Entity.LastKnownTransform);
    if (CapturedCorpses.Num() > MaxCapturedCorpses)
    {
        CapturedCorpses.RemoveAt(0); // FIFO cap
    }
}

// In WriteGameMetadata — serialize the buffer every tick (always-write, empty-safe):
Obj.WriteData(LudeoAttr::DeadBodies, SerializeBlob(CapturedCorpses));
```

Additionally, because the actor may be GC'd *between* the last alive-tick and the next poll, the kill detector needs two death paths:

```cpp
if (Entity.Actor.IsValid() && !Cast<AGameCharacter>(Entity.Actor.Get())->IsAlive())
{
    // path A: observed death — cache is current
}
else if (!Entity.Actor.IsValid() && !Entity.LastKnownClassPath.IsEmpty())
{
    // path B: GC'd before we could observe — cache was refreshed last tick, still usable
}
```

## The Replay-Visibility Caveat

Even with a correct kill-time buffer, the replay may still show zero corpses. Why? The Ludeo cloud picks one frame from the recording, and `CapturedCorpses.Num()` at that frame is whatever was in the buffer *at that specific tick*. If the picked frame is early in the recording (before any kills happened), the snapshot legitimately contains zero bodies — the replay faithfully reproduces that.

This is not a code bug; it's a **cumulative-state vs. picked-frame** mismatch. See `snapshot-frame-vs-mental-model-gap.md`. For ActionGame, the team accepted this tradeoff and parked replay-visibility work.

## FIFO cap rationale

Why cap the buffer? Without a cap, long missions can accumulate hundreds of kills, which bloats the `DeadBodies` base64 attribute size. Games with frequent dying (ActionGame's wave-combat mode) hit this cap routinely. A cap of 50 is typical — enough to show "several recent bodies" on most picked frames, small enough to keep attribute payloads bounded.

## Detection before release

Add a verbose log per capture so you can confirm the buffer is actually accumulating:

```cpp
UE_LOG(LogX, Verbose, TEXT("Action: Kill (%s) — corpse captured at (%s), total=%d"),
    Entity.Actor.IsValid() ? TEXT("observed") : TEXT("gc-implied"),
    *Entity.LastKnownTransform.GetLocation().ToString(),
    CapturedCorpses.Num());
```

If the total stays at 0 during heavy combat, your kill-detection transition isn't firing — debug that, not the serialization.

## Cross-reference

- `snapshot-frame-vs-mental-model-gap.md` — why replay-visibility may still be zero even with this fix.
- `sdk-readdata-asserts-on-missing-attribute.md` — serialize DeadBodies every tick (even empty) to avoid `bHasGetSize` assert on replay.
- `ondestroyed-fires-on-gc-not-on-kill.md` — why `OnDestroyed` is too late for this capture window.
