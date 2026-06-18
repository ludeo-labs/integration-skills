---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: 2
question: "Does the integration OPEN the Creator room at level load (component BeginPlay), or does it delay OpenRoom until a 'gameplay start' phase/state? Only BeginGameplay should wait on the phase — the room itself must open at level load, or OnRoomReady never fires in Creator flow."
sanitized: true
---

# Open the Creator room at level load — gate only BeginGameplay on the gameplay phase

## Precondition

The game has a pre-gameplay phase (warmup / countdown / "waiting for players") before the
interactive round starts, AND you are tempted to defer `Session::OpenRoom` until that round-start
phase (because intake said "open the room at match start"). This is the misread.

## The symptom (Creator flow, very confusing)

Everything succeeds and yet nothing records:
- `Session activated`, consent `CanCreate=1`, overlay WS connects, `LudeoTransmitReady` fires.
- `ludeo_Session_OpenRoom` **succeeds**, `ludeo_Room_AddPlayer` **succeeds**.
- …then **`OnRoomReady` never fires** — no `Received event RoomReady`, no `Broadcasting RoomReady`,
  so the N-way begin gate never latches and `Player::BeginGameplay` is never called.
- The overlay also logs `failed to parse gameplays.gameplay-ready payload` — a **red herring**
  (a known-good Creator-flow run shows the *same* warning and still gets RoomReady).

It is NOT the SDK version (reproduced identically across two SDK builds), NOT auth/consent, NOT the
PlayerID, and NOT a Studio-Labs game config. It is **when the room opens.**

## Root cause

In Creator flow the platform delivers `RoomReady` (≈1 ms after `AddPlayer`) **only when the room is
opened in the normal level-load window.** Deferring `OpenRoom` until a later "gameplay phase"
(e.g. ~30 s after activation, after warmup) means the platform never emits the Creator-flow
`RoomReady`, so the begin gate hangs forever.

The mistake is conflating two distinct triggers:
- **Room open** → component `BeginPlay` (level load). Decoupled from any game phase.
- **BeginGameplay** → the N-way gate (RoomReady + PlayerAdded + **gameplay-phase active**).

"Open the room at match start" almost always means "begin *gameplay* at match start," NOT "delay the
room HTTP open." Open the room early; let the gate hold `BeginGameplay` until the phase is live.

## The fix (matches every working reference: Lyra sample, TacticsGame, FPSGameStarterKit)

```cpp
void U...Component::BeginPlay()
{
    Super::BeginPlay();
    if (IsFrontendMap()) return;                 // skip non-ludeoable maps only

    // Add the player whenever they join (before OR after the room opens) — queue + GameState delegate.
    GameState->OnPlayerStateAddedEvent.AddUObject(this, &ThisClass::OnPlayerStateAdded);
    for (APlayerState* PS : GameState->PlayerArray) OnPlayerStateAdded(PS); // catch-up

    BindGamePhaseDelegates();   // Playing -> gate; PostGame -> teardown
    TryOpenRoom();              // <-- OPEN THE ROOM NOW, at level load
}

// Playing phase sets the gate flag ONLY; it does NOT open the room.
void OnGamePhaseStarted(...) { bGamePhaseActive = true; TryBeginGameplay(); }
```

Because the room opens before the player may have joined, AddPlayer must be driven by a player-added
delegate with a pending-players queue flushed in `OnRoomOpened` (don't resolve "the local player"
synchronously at room-open time — they might not exist yet).

## Diagnostic shortcut

A Creator-flow run where `OpenRoom`+`AddPlayer` succeed but `Broadcasting RoomReady` never appears,
and where `OpenRoom` happened many seconds after session activation → suspect a delayed room open
first. Compare the timestamp of `OpenRoom` against session activation; a large gap is the tell.
Do NOT force-begin (see [[never-force-begin-without-onroomready]]); fix the open timing instead.
