---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: 3
question: "Does the integration OPEN the Creator room at level load (component BeginPlay), or does it delay OpenRoom until a 'gameplay start' phase/state? Open at level load (matches the reference sample); gate only BeginGameplay on the phase. NOTE: this is a cleanliness/consistency rule, NOT a fix for 'OnRoomReady never fires'."
sanitized: true
---

# Open the Creator room at level load; gate only BeginGameplay on the gameplay phase

> ⚠️ **CORRECTION (read first).** An earlier version of this learning claimed that a *late-opened*
> Creator room "never receives OnRoomReady." **That was a misdiagnosis.** In the Lyra incident,
> opening the room early vs. late made **no difference** to `OnRoomReady` — both got
> `unknown event_name "ludeo-play-ready"` and no `RoomReady`. The real cause of the missing
> `RoomReady` was a **stale C SDK build** (see
> [[sdk-build-version-must-match-current-backend]]). Keep that distinction: room-open timing is a
> consistency/best-practice rule below — it is NOT the lever for a missing `OnRoomReady`.

## The rule (still valid as best practice — matches the reference sample)

Open the Creator room in the component's `BeginPlay` (skip only non-ludeoable/frontend maps), decoupled
from any warmup/"Playing"/combat phase. Gate **`BeginGameplay`** (not `OpenRoom`) on the gameplay
phase via the N-way gate (RoomReady + PlayerAdded + gameplay-phase-active). This matches
`ludeosdk-lyra-sample`, FPSGameStarterKit, and VoyagerV2, and keeps room-open decoupled from
round-start so the player is added as soon as the world is ready.

```cpp
void U...Component::BeginPlay()
{
    Super::BeginPlay();
    if (IsFrontendMap()) return;
    GameState->OnPlayerStateAddedEvent.AddUObject(this, &ThisClass::OnPlayerStateAdded);
    for (APlayerState* PS : GameState->PlayerArray) OnPlayerStateAdded(PS); // catch-up
    BindGamePhaseDelegates();   // Playing -> gate; PostGame -> teardown
    TryOpenRoom();              // open at level load
}
void OnGamePhaseStarted(...) { bGamePhaseActive = true; TryBeginGameplay(); } // phase gates BEGIN only
```

Because the room can open before the player joins, drive `AddPlayer` off a player-added delegate +
pending-players queue (flush in `OnRoomOpened`); don't synchronously resolve "the local player" at
room-open time.

## What this rule does and does NOT fix

- **Does:** keeps room-open consistent with the reference samples; ensures the player is added
  promptly; avoids tying room lifecycle to a game phase unnecessarily.
- **Does NOT:** make `OnRoomReady` fire. If `OnRoomReady` never broadcasts (especially with an
  `unknown event_name` warning after AddPlayer), the cause is almost certainly the **C SDK build
  version**, not room timing — go to [[sdk-build-version-must-match-current-backend]] first. Also do
  not force-begin ([[never-force-begin-without-onroomready]]).
