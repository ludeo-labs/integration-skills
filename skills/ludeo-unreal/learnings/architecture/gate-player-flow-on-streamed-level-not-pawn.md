---
category: architecture
tier: generalizable
sourceGame: EndlessFPS
phase: 4
question: "Does the game load the playable map via level streaming or a loading-screen system (a persistent/root map that streams the gameplay sublevel)? If so, gate Player Flow readiness on the STREAMED level being loaded — pawn-possessed fires before the sublevel streams in."
sanitized: true
---

# Player Flow readiness must gate on the streamed gameplay level, not just pawn-possessed

## Precondition

The game loads the playable map via **level streaming** or a **loading-screen system** — a
persistent/root map that streams the actual gameplay sublevel in asynchronously (common with
marketplace loading-screen assets). The integration's GameState component attaches to the **root**
world, so its `BeginPlay` fires before the gameplay sublevel, its actors, and (often) the real player
pawn exist. The loading-screen system may even possess a **placeholder loading pawn** before the game
pawn.

If the gameplay map is a single flat level loaded by `ServerTravel` (no streaming), this doesn't apply —
`BeginPlay` already runs in the loaded gameplay world.

## The trap

The obvious readiness gate is `PlayerController->GetPawn() != nullptr`. On a streamed map this is **false
ready**: the pawn is possessed by the root/loading-screen flow before the gameplay sublevel finishes
streaming. Restoring then puts entities into an empty world (no floor/nav, none of the level's own
actors), and async assets (weapon meshes) have nothing to load into.

**Worse:** if Player Flow then pauses (to open the Ludeo room) while the stream is still in flight,
`UGameplayStatics::SetGamePaused(true)` stops the tick that drives streaming — the sublevel **never
finishes loading** and the game is stuck on the loading screen. (See `dont-pause-during-async-load-waits`.)

## Why it can hide in Creator Flow

The same early-fire gate can *appear* to work in Creator Flow purely by timing luck. Creator Flow usually
also waits on SDK session activation (auth/config HTTP), which can take several seconds — long enough that
the sublevel streams in before the gate passes. Player Flow re-uses an already-activated session, so the
gate passes in ~170 ms — before the stream. The bug only surfaces in Player Flow. Don't conclude "the gate
is fine" from Creator Flow alone.

## The fix

Add a **streamed-gameplay-level-loaded** condition to the readiness gate, polled UNPAUSED. Two robust
signals:

1. **A known gameplay-level actor is present.** Iterate `TActorIterator<AActor>` for a class that only
   exists in the gameplay sublevel (e.g. the wave spawner / a level manager). Concrete, and it doubles as
   the handle you need for that actor anyway.
2. **The streaming level is loaded + visible.** Iterate `World->GetStreamingLevels()`, match the gameplay
   sublevel by package name, require `IsLevelLoaded() && IsLevelVisible()`.

Combine with the other readiness checks: the possessed pawn is the **game** pawn class (not the
loading-screen pawn), its mesh `GetAnimInstance()` is valid, and any game "is-loading" flags are false.

```cpp
// In CheckGameReady(), polled unpaused in TickComponent:
bool bGameplayLevelLoaded = false;
for (TActorIterator<AActor> It(World); It; ++It)
{
    if (It->GetClass()->GetName().StartsWith(TEXT("<gameplay-sublevel actor class>")))
    {
        bGameplayLevelLoaded = true; break;
    }
}
if (!bGameplayLevelLoaded) return false;

APawn* Pawn = PC->GetPawn();
if (!Pawn || !Pawn->GetClass()->GetName().StartsWith(TEXT("<game pawn class>"))) return false; // not the loading pawn
if (const ACharacter* C = Cast<ACharacter>(Pawn))
    if (!C->GetMesh() || !C->GetMesh()->GetAnimInstance()) return false;
```

Only after this gate passes: lock input, restore, settle, **then** pause + OpenRoom. The pause now
happens after the stream is complete, so it can't stall it.

## How to apply

During Stage 3 Player Flow on any streamed/loading-screen map: never gate on pawn-possessed alone. Gate on
the gameplay sublevel being loaded (a level-only actor present, or the streaming level loaded+visible),
keep the wait unpaused, and verify the pawn is the real game pawn. Test in **Player Flow** specifically —
Creator Flow timing can mask the bug.

## Related

- `dont-pause-during-async-load-waits` — why the wait must stay unpaused.
- `gate-openroom-on-loadout-ready` — the SDK does nothing until OpenRoom; delaying it on the game side is
  free, so gate it on real readiness.
- `pause-before-player-flow-room` — restore before opening the room.
