# Ludeo SDK - Unreal Engine Integration Specification

**Version:** 1.0
**SDK:** LudeoUESDK v4.0.14+
**Engine:** Unreal Engine 5.x
**Date:** 2026-02-12

This document provides a complete specification for integrating the Ludeo SDK into an Unreal Engine game. It is derived from the official Ludeo SDK documentation (Unreal + Core) and validated against the FPSGameStarterKit reference integration.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Plugin Installation](#3-plugin-installation)
4. [SDK Initialization & Shutdown](#4-sdk-initialization--shutdown)
5. [Session Activation](#5-session-activation)
6. [Notification Callbacks](#6-notification-callbacks)
7. [Gameplay Session Management](#7-gameplay-session-management)
8. [State Tracking (Creator Flow)](#8-state-tracking-creator-flow)
9. [State Restoration (Player Flow)](#9-state-restoration-player-flow)
10. [Player Action Reporting](#10-player-action-reporting)
11. [Non-Ludeoable Areas](#11-non-ludeoable-areas)
12. [Multiplayer Support](#12-multiplayer-support)
13. [Authentication](#13-authentication)
14. [Additional Features](#14-additional-features)
15. [UI & Overlay Considerations](#15-ui--overlay-considerations)
16. [Blueprint Integration](#16-blueprint-integration)
17. [Testing & Debugging](#17-testing--debugging)
18. [Integration Checklist](#18-integration-checklist)
19. [Mapping to Your Game (Lyra Example)](#19-mapping-to-your-game-lyra-example)

---

## 1. Overview

### What is Ludeo?

Ludeo captures gameplay moments and delivers them as **playable experiences** on any platform. The SDK:
- **Creator Flow**: Captures game state + video during gameplay. Creators configure moments via Creator Lab.
- **Player Flow**: Restores game state from a captured Ludeo, allowing users to play the same moment.

### Integration Lifecycle

```
Initialization Phase
├── Initialize SDK (FLudeoManager::Initialize)
├── Start Ticking (FLudeoManager::Tick every frame)
├── Create Session (FLudeoSessionManager::CreateSession)
├── Register Notification Callbacks
└── Activate Session (FLudeoSession::Activate)

Gameplay Phase (per match/level)
├── Open Room (FLudeoSession::OpenRoom)
├── Add Player(s) (FLudeoRoom::AddPlayer)
├── Wait for RoomReady notification
├── Begin Gameplay (FLudeoPlayer::BeginGameplay)
├── [Creator Flow] Track state + Report actions
├── [Player Flow] Report actions only
├── End Gameplay (FLudeoPlayer::EndGameplay)
├── Remove Player(s) (FLudeoRoom::RemovePlayer)
└── Close Room (FLudeoSession::CloseRoom)

Shutdown Phase
├── Destroy Session (FLudeoSessionManager::DestroySession)
├── Finalize SDK (FLudeoManager::Finalize)
```

### Recommended Integration Strategy

Start with **Curated Ludeos** -- focus on 1-2 specific gameplay scenarios:
- A level entry point or checkpoint
- A specific encounter or objective
- A moment tied to a marketing event

Only sync the game state objects relevant to that moment. Expand gradually after proving the base integration.

---

## 2. Prerequisites

### Studio Labs Setup
- [ ] Create studio account at https://studio.ludeo.com/
- [ ] Create game entry in Studio Labs
- [ ] Obtain API Key (per game, shared across environments)
- [ ] Configure environments (Production, Playtest, Sandbox)
- [ ] Assign beta versions to environments

### Development Environment
- [ ] Unreal Engine 4.26+ (recommended: 5.x)
- [ ] Steam client installed and running
- [ ] Steam account connected to the game project
- [ ] C++ project (not Blueprint-only)

### Configuration Values Needed
| Value | Source | Used In |
|-------|--------|---------|
| API Key | Studio Labs > Environments | Session Activation |
| Game Version | Your build system | Session Activation |
| Steam Beta Branch Name | Studio Labs > Environments | Explicit Authentication |
| Steam User ID(s) | Steam | Explicit Authentication (dev/testing) |

---

## 3. Plugin Installation

### Step 1: Copy Plugin

Copy the `LudeoUESDK` plugin folder into your project's `Plugins/` directory:

```
<ProjectRoot>/
├── Plugins/
│   └── LudeoUESDK/           # <-- Copy here
│       ├── LudeoUESDK.uplugin
│       └── Source/
│           ├── LudeoSDK/      # Native SDK wrapper
│           ├── LudeoUESDK/    # Runtime module
│           └── LudeoUESDKEditor/  # Editor module
```

### Step 2: Enable Plugin in .uproject

```json
{
    "Plugins": [
        {
            "Name": "LudeoUESDK",
            "Enabled": true
        }
    ]
}
```

### Step 3: Add Module Dependency

In your game module's `.Build.cs`:

```csharp
PrivateDependencyModuleNames.AddRange(new string[] {
    "LudeoUESDK"
});
```

### Step 4: Regenerate Project Files

Regenerate Unreal project files, then build.

---

## 4. SDK Initialization & Shutdown

### Where to Initialize

Initialize in your **Game Instance** class (`UGameInstance::Init`). The SDK must remain active for the entire game session.

### Key Rules

- **Single-threaded**: All SDK calls must be on the game thread
- **Initialize once**: Use a ref-counted guard if PIE creates multiple game instances
- **Tick every frame**: Without ticking, no callbacks are processed

### Implementation

```cpp
// === Header (YourGameInstance.h) ===
UCLASS(config=Game)
class UYourGameInstance : public UGameInstance
{
    GENERATED_BODY()

public:
    virtual void Init() override;
    virtual void Shutdown() override;

private:
    TWeakPtr<FLudeoManager> WeakLudeoManager;
    bool NativeTick(float DeltaSeconds);
};
```

```cpp
// === Implementation (YourGameInstance.cpp) ===
void UYourGameInstance::Init()
{
    Super::Init();

    WeakLudeoManager = FLudeoManager::GetInstance();
    if (const TSharedPtr<FLudeoManager> LudeoManager = WeakLudeoManager.Pin())
    {
        // Initialize the SDK
        const FLudeoResult Result = LudeoManager->Initialize();
        check(Result.IsSuccessful());

        // Configure logging
        LudeoManager->SetLogLevel(LudeoLogCategory::All, ELogVerbosity::Verbose);
        LudeoManager->SetLogLevel(LudeoLogCategory::Http, ELogVerbosity::Log);
    }

    // Register ticker for SDK processing
    FTSTicker::GetCoreTicker().AddTicker(
        FTickerDelegate::CreateUObject(this, &UYourGameInstance::NativeTick)
    );
}

bool UYourGameInstance::NativeTick(float DeltaSeconds)
{
    if (const TSharedPtr<FLudeoManager> LudeoManager = WeakLudeoManager.Pin())
    {
        LudeoManager->Tick();  // CRITICAL: Must be called every frame
    }
    return true;
}

void UYourGameInstance::Shutdown()
{
    // 1. Destroy active session first (see Section 5)
    DestroyActiveLudeoSession({});

    // 2. Then finalize the SDK
    if (const TSharedPtr<FLudeoManager> LudeoManager = WeakLudeoManager.Pin())
    {
        LudeoManager->Finalize();
    }

    Super::Shutdown();
}
```

### PIE Support (Optional)

If running multiple instances in Play-In-Editor, use a ref-counted initialization guard:

```cpp
struct FLudeoInitGuard
{
    static FLudeoInitGuard& Get()
    {
        static FLudeoInitGuard Instance;
        return Instance;
    }

    int32 Initialize(FLudeoManager& Manager)
    {
        if (Count++ == 0)
            Manager.Initialize();
        return Count;
    }

    void Finalize(FLudeoManager& Manager)
    {
        if (--Count == 0)
            Manager.Finalize();
    }

private:
    uint32 Count = 0;
};
```

---

## 5. Session Activation

### When to Activate

Activate the session **after all essential assets are loaded** (shaders compiled, main menu ready). Activating as late as possible ensures the game is ready to respond to notifications immediately.

### Flow

1. Create session
2. Register ALL notification callbacks
3. Activate with API key and authentication

### Implementation

```cpp
FLudeoSessionHandle UYourGameInstance::SetupLudeoSession(
    const FLudeoSessionOnActivatedDelegate& OnActivatedDelegate)
{
    const TSharedPtr<FLudeoManager> LudeoManager = WeakLudeoManager.Pin();
    check(LudeoManager != nullptr);

    FLudeoSessionManager& SessionManager = LudeoManager->GetSessionManager();

    if (FLudeoSession* Session = SessionManager.CreateSession())
    {
        // --- Register ALL notification callbacks (see Section 6) ---
        Session->GetOnLudeoSelectedDelegate().AddUObject(
            this, &UYourGameInstance::OnLudeoSelected);
        Session->GetOnPauseGameRequestedDelegate().AddUObject(
            this, &UYourGameInstance::OnPauseGameRequested);
        Session->GetOnResumeGameRequestedDelegate().AddUObject(
            this, &UYourGameInstance::OnResumeGameRequested);
        Session->GetOnGameBackToMenuRequestedDelegate().AddUObject(
            this, &UYourGameInstance::OnGameBackToMainMenuRequested);
        Session->GetOnPlayerConsentUpdatedDelegate().AddUObject(
            this, &UYourGameInstance::OnPlayerConsentUpdated);
        Session->GetOnMuteGameRequestedDelegate().AddUObject(
            this, &UYourGameInstance::OnMuteGameRequested);
        Session->GetOnSDKOutOfBandDelegate().AddUObject(
            this, &UYourGameInstance::OnSDKOutOfBand);

        // --- Configure activation parameters ---
        FLudeoSessionActivateSessionParameters Params;
        Params.GameWindowHandle = FLudeoGameWindowHandle::GetGameWindowHandleFromWorld(this);
        Params.ApiKey = TEXT("your-api-key");     // From config, NOT hardcoded
        Params.GameVersion = TEXT("1.0.0");        // From config
        Params.Localization.PreferredLangauge = TEXT("en");
        Params.Localization.SupportedLanguageCollection.Emplace(TEXT("en"));

        // Authentication (see Section 13)
        // Leave empty for implicit Steam auth, or set explicit auth:
        // Params.AuthenticationDetails = SteamAuthData;

        Session->Activate(Params, OnActivatedDelegate);
        return *Session;
    }
    return nullptr;
}
```

### Destroy Session

```cpp
void UYourGameInstance::DestroyActiveLudeoSession(
    const FOnLudeoSessionDestroyedDelegate& Delegate)
{
    if (ActiveSessionHandle != nullptr)
    {
        if (FLudeoSessionManager* SM = FLudeoSessionManager::GetInstance())
        {
            FDestroyLudeoSessionParameters Params;
            Params.SessionHandle = ActiveSessionHandle;
            SM->DestroySession(Params, Delegate);
        }
        ActiveSessionHandle = nullptr;
    }
}
```

---

## 6. Notification Callbacks

### Required Callbacks

You **MUST** register all of these before calling `Session->Activate()`:

| Callback | Purpose | Implementation |
|----------|---------|----------------|
| `OnLudeoSelected` | Player clicked a Ludeo to play | Retrieve Ludeo data, load level, restore state |
| `OnPauseGameRequested` | Platform requests game pause | `UGameplayStatics::SetGamePaused(World, true)` |
| `OnResumeGameRequested` | Platform requests game resume | `UGameplayStatics::SetGamePaused(World, false)` |
| `OnGameBackToMenuRequested` | Platform requests return to menu | Navigate to main menu |
| `OnPlayerConsentUpdated` | Player consent changed | Store consent, update UI visibility |
| `OnMuteGameRequested` | Platform requests audio mute/unmute | Mute/unmute game audio |
| `OnSDKOutOfBand` | Fatal SDK error (unrecoverable) | Shut down the SDK immediately |
| `OnRoomReady` | Room ready for gameplay | Begin gameplay (registered per-room, see Section 7) |

### Implementation Examples

```cpp
// IMPORTANT: Use explicit set, NOT toggle
void UYourGameInstance::OnPauseGameRequested(const FLudeoSessionHandle&)
{
    UGameplayStatics::SetGamePaused(GetWorld(), true);
}

void UYourGameInstance::OnResumeGameRequested(const FLudeoSessionHandle&)
{
    UGameplayStatics::SetGamePaused(GetWorld(), false);
}

void UYourGameInstance::OnSDKOutOfBand(const FLudeoSessionHandle&)
{
    // Fatal error - shut down SDK
    UE_LOG(LogLudeo, Error, TEXT("SDK Out of Band - fatal error, shutting down"));
    DestroyActiveLudeoSession({});
}

void UYourGameInstance::OnPlayerConsentUpdated(
    const FLudeoSessionHandle&,
    const FLudeoSessionPlayerConsentData& ConsentData)
{
    bCanCreateLudeo = ConsentData.bCanCreateLudeo;
    bCanPlayLudeo = ConsentData.bCanPlayLudeo;
    // Update UI accordingly
}

void UYourGameInstance::OnLudeoSelected(
    const FLudeoSessionHandle& SessionHandle,
    const FString& LudeoID)
{
    // Retrieve the Ludeo data
    FLudeoSession* Session = FLudeoSession::GetSessionBySessionHandle(SessionHandle);
    FLudeoSessionGetLudeoParameters Params;
    Params.LudeoID = LudeoID;
    Session->GetLudeo(Params,
        FLudeoSessionOnGetLudeoDelegate::CreateUObject(this, &ThisClass::OnGetLudeo));
}
```

---

## 7. Gameplay Session Management

### Lifecycle per Match/Level

```
Match Start
├── OpenRoom()
├── AddPlayer()
├── [Wait for OnRoomReady callback]
├── BeginGameplay()
│
├── ... active gameplay ...
│
Match End
├── EndGameplay(bIsAbort=false)  // false for normal end, true for abort
├── RemovePlayer()
└── CloseRoom()
```

### Where to Implement

The recommended class is your **Game State** (`AGameState`), as it:
- Exists during gameplay
- Has authority awareness (`HasAuthority()`)
- Participates in replication (for multiplayer)
- Has `Tick()` for state tracking

### Open Room

```cpp
void AYourGameState::OpenRoom(const FString& RoomID, const FString& LudeoID)
{
    FLudeoSession* Session = FLudeoSession::GetSessionBySessionHandle(SessionHandle);
    if (!Session) { /* error */ return; }

    // Register RoomReady callback
    Session->GetOnRoomReadyDelegate().AddUObject(this, &ThisClass::OnLudeoRoomReady);

    FLudeoSessionOpenRoomParameters Params;
    Params.RoomID = RoomID;       // Use FGuid::NewGuid().ToString() for server
    Params.LudeoID = LudeoID;    // Empty for Creator Flow, set for Player Flow

    Session->OpenRoom(Params,
        FLudeoSessionOnOpenRoomDelegate::CreateUObject(this, &ThisClass::OnRoomOpened));
}
```

### Add Player

```cpp
void AYourGameState::OnRoomOpened(
    const FLudeoResult& Result,
    const FLudeoSessionHandle&,
    const FLudeoRoomHandle& RoomHandle)
{
    if (!Result.IsSuccessful()) { /* error */ return; }

    LudeoRoomHandle = RoomHandle;

    // Add local player (skip for dedicated server)
    if (!GetGameInstance()->IsDedicatedServerInstance())
    {
        FLudeoRoom* Room = FLudeoRoom::GetRoomByRoomHandle(RoomHandle);
        FLudeoRoomAddPlayerParameters Params;
        Params.PlayerID = FString::FromInt(GetLocalPlayerState()->GetPlayerId());
        Room->AddPlayer(Params,
            FLudeoRoomOnAddPlayerDelegate::CreateUObject(this, &ThisClass::OnPlayerAdded));
    }
}
```

### Wait for Both Conditions

Gameplay can only begin when **BOTH** conditions are met:
1. `AddPlayer` callback succeeded
2. `OnRoomReady` notification received

These can arrive in either order, so track both:

```cpp
void AYourGameState::OnPlayerAdded(const FLudeoResult& Result, const FLudeoRoomHandle&,
    const FLudeoPlayerHandle& PlayerHandle)
{
    if (Result.IsSuccessful())
    {
        LudeoPlayerHandle = PlayerHandle;
        if (bRoomReady) OnSessionReady(FLudeoResult::Success());
    }
}

void AYourGameState::OnLudeoRoomReady(const FLudeoSessionHandle&, const FLudeoRoomHandle&)
{
    bRoomReady = true;
    if (LudeoPlayerHandle != nullptr) OnSessionReady(FLudeoResult::Success());
}
```

### Begin Gameplay

```cpp
void AYourGameState::BeginGamePlay()
{
    if (FLudeoPlayer* Player = FLudeoPlayer::GetPlayerByPlayerHandle(LudeoPlayerHandle))
    {
        FLudeoPlayerBeginGameplayParameters Params;
        Player->BeginGameplay(Params,
            FLudeoPlayerOnBeginGameplayDelegate::CreateUObject(
                this, &ThisClass::OnBeginGameplay));
    }
}
```

### End Gameplay

```cpp
void AYourGameState::EndGamePlay(bool bIsAbort)
{
    if (FLudeoPlayer* Player = FLudeoPlayer::GetPlayerByPlayerHandle(LudeoPlayerHandle))
    {
        FLudeoPlayerEndGameplayParameters Params;
        Params.bIsAbort = bIsAbort;  // false = normal end, true = abnormal exit
        Player->EndGameplay(Params);
    }
}
```

### Remove Player + Close Room

```cpp
void AYourGameState::CleanupLudeoSession()
{
    // 1. End gameplay
    EndGamePlay(/*bIsAbort=*/ false);

    // 2. Remove local player
    if (FLudeoRoom* Room = FLudeoRoom::GetRoomByRoomHandle(LudeoRoomHandle))
    {
        FLudeoRoomRemovePlayerParameters Params;
        Params.PlayerID = FString::FromInt(GetLocalPlayerState()->GetPlayerId());
        Room->RemovePlayer(Params);
    }

    // 3. Close room (only the authority/server that opened it)
    if (HasAuthority() && LudeoRoomHandle != nullptr)
    {
        FLudeoSession* Session = FLudeoSession::GetSessionBySessionHandle(SessionHandle);
        FLudeoSessionCloseRoomParameters Params;
        Params.RoomHandle = LudeoRoomHandle;
        Session->CloseRoom(Params,
            FLudeoSessionOnCloseRoomDelegate::CreateUObject(
                this, &ThisClass::OnRoomClosed));
    }
}
```

---

## 8. State Tracking (Creator Flow)

State tracking captures the game world so it can be restored during Player Flow. **Only track state in Creator Flow** -- never in Player Flow.

### Option A: Auto State Update (Recommended)

Uses `FLudeoObjectStateManager::SaveWorld()` with `FLudeoSaveGameSpecification`.

#### Step 1: Define SaveGameSpecification

In your Game State constructor:

```cpp
AYourGameState::AYourGameState()
{
    PrimaryActorTick.bCanEverTick = true;

    // Track the level script actor (required for level identification)
    {
        FLudeoSaveGameActorData& Data = SaveGameSpecification.SaveGameActorDataCollection.AddDefaulted_GetRef();
        Data.ActorFilter.MatchingActorClass = ALevelScriptActor::StaticClass();
        Data.Strategy = ELudeoSaveGameStrategy::Reconcile;
    }

    // Track player controllers
    {
        FLudeoSaveGameActorData& Data = SaveGameSpecification.SaveGameActorDataCollection.AddDefaulted_GetRef();
        Data.ActorFilter.MatchingActorClass = APlayerController::StaticClass();
        Data.ActorFilter.ActorPropertyFilter.MatchingPropertyNameFilter
            .PropertyNameCollection.Add(TEXT("PlayerState"));
        Data.Strategy = ELudeoSaveGameStrategy::Reconcile;
    }

    // Track player states
    {
        FLudeoSaveGameActorData& Data = SaveGameSpecification.SaveGameActorDataCollection.AddDefaulted_GetRef();
        Data.ActorFilter.MatchingActorClass = APlayerState::StaticClass();
        Data.ActorFilter.ActorPropertyFilter.MatchingPropertyNameFilter
            .PropertyNameCollection.Add(TEXT("PlayerId"));
        Data.Strategy = ELudeoSaveGameStrategy::Reconcile;
    }

    // Add your game-specific actors (characters, weapons, AI, etc.)
    // ...
}
```

#### Step 2: Mark Properties with SaveGame

In C++:
```cpp
UPROPERTY(SaveGame)
float Health;

UPROPERTY(SaveGame)
FVector Position;
```

In Blueprint: Check the "SaveGame" checkbox in variable details.

#### Step 3: Tick State Updates (Creator Flow Only)

```cpp
void AYourGameState::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    // IMPORTANT: Only track state in Creator Flow, never Player Flow
    if (HasAuthority() && !IsPlayerFlow())
    {
        TickSaveObjectState();
    }
}

bool AYourGameState::IsPlayerFlow() const
{
    // Player Flow = a LudeoID is set (playing a Ludeo)
    return !ReplicatedLudeoRoomInfo.RoomInfo.LudeoID.IsEmpty();
}

void AYourGameState::TickSaveObjectState()
{
    if (const FLudeoRoom* Room = FLudeoRoom::GetRoomByRoomHandle(LudeoRoomHandle))
    {
        FLudeoObjectStateManager::SaveWorld(
            this, *Room, SaveGameSpecification,
            SaveGameActorCollection, ObjectMap);
    }
}
```

### Option B: USaveGame-based

For games with existing save systems:

```cpp
bool AYourGameState::SaveGameState(const FString& StateID, const FString& PlayerID)
{
    UYourSaveGame* SaveGame = /* create and populate */;
    return FLudeoObjectStateManager::SaveGameToSlot(
        SaveGame, StateID, PlayerID, LudeoRoomHandle);
}
```

### Option C: Manual Writable Objects

For fine-grained control:

```cpp
// Create writable object for a game entity
FLudeoDataWriterCreateObjectParameters Params;
Params.Object = MyActor;
auto OptWritable = Room->GetRoomWriter().CreateObject(Params);

// Write attributes
const FScopedLudeoDataReadWriteEnterObjectGuard<FLudeoWritableObject> Guard(WritableObj);
WritableObj.WriteData(TEXT("Health"), Health);
WritableObj.WriteData(TEXT("Position"), GetActorLocation());
```

---

## 9. State Restoration (Player Flow)

### Flow

1. `OnLudeoSelected` notification received
2. Call `FLudeoSession::GetLudeo()` with the Ludeo ID
3. Extract map name and object data from `FLudeo`
4. Load the correct level
5. Restore world state using `FLudeoObjectStateManager::RestoreWorld()`
6. Open room, add player, begin gameplay

### Implementation

```cpp
void AYourGameState::LoadLudeo(const FLudeo& Ludeo)
{
    const TArray<FLudeoReadableObject>& Objects = Ludeo.GetLudeoObjectInformationCollection();

    // Build class collection
    TArray<TSubclassOf<UObject>> ClassCollection;
    for (const FLudeoReadableObject& Obj : Objects)
    {
        TSubclassOf<UObject> Class = LoadClass<UObject>(nullptr, *Obj.GetObjectType());
        ClassCollection.Emplace(Class);
    }

    // Restore world
    FLudeoReadableObject::ReadableObjectMapType RestoreMap;
    const bool bSuccess = FLudeoObjectStateManager::RestoreWorld(
        GetWorld(), Objects, ClassCollection, SaveGameSpecification, RestoreMap);
    check(bSuccess);
}
```

### Release Ludeo Data

Always release the Ludeo data when done:

```cpp
FLudeoSession* Session = FLudeoSession::GetSessionBySessionHandle(SessionHandle);
Session->ReleaseLudeo(LudeoHandle);
```

---

## 10. Player Action Reporting

Player actions drive Ludeo **goals, constraints, and scoring**. Report them in **both** Creator and Player flows.

### Define Actions

```cpp
UENUM(BlueprintType)
enum class EYourPlayerAction : uint8
{
    Kill,
    Death,
    Headshot,
    ObjectiveComplete,
    ItemPickup,
    AbilityUsed,
    // Add game-specific actions
};
```

### Report Actions

```cpp
void AYourGameState::ReportPlayerAction(
    const APlayerState* PlayerState,
    EYourPlayerAction Action)
{
    if (const FLudeoRoom* Room = FLudeoRoom::GetRoomByRoomHandle(LudeoRoomHandle))
    {
        static UEnum* Enum = StaticEnum<EYourPlayerAction>();

        FLudeoRoomWriterSendActionParameters Params;
        Params.PlayerID = FString::FromInt(PlayerState->GetPlayerId());
        Params.ActionName = *Enum->GetNameStringByValue(static_cast<int64>(Action));

        Room->GetRoomWriter().SendAction(Params);
    }
}
```

### What Actions to Track

Focus on **engagement and skill-demonstrating** events:

| Category | Examples |
|----------|----------|
| Combat | Kill, Death, Headshot, Melee Kill, Explosive Kill |
| Objectives | Objective Complete, Checkpoint Reached, Quest Complete |
| Resources | Item Pickup, Ammo Pickup, Health Pickup |
| Abilities | Ability Used, Ultimate Used, Charged Shot |
| Movement | (optional) Ledge Grab, Wall Run |

---

## 11. Non-Ludeoable Areas

Certain gameplay periods should block Ludeo creation or pause tracking.

### Pause/Resume Trigger

For **non-interactive/idle** gameplay (pause menus, cutscenes, loading screens):

- Pauses all Ludeo processing (timers, event tracking)
- Prevents Ludeo creation from this period
- Configure in Studio Labs under Ludeo Settings > Triggers

### Non-Ludeoable Area Trigger

For gameplay sections that **cannot be reconstructed**:

- Prevents Ludeo creation but keeps tracking running
- Use for procedural content, network-dependent states, etc.

---

## 12. Multiplayer Support

### Architecture

- **Server** opens the room, generates Room ID, replicates to clients
- **Clients** join by opening the room with the same Room ID
- **Server** reports game state (Creator Flow)
- **Each player** adds themselves to the room
- **Dedicated server** skips `AddPlayer` (it's not playing)

### Replication

```cpp
UPROPERTY(ReplicatedUsing=OnRep_LudeoRoomInfo)
FReplicatedLudeoRoomInfo ReplicatedRoomInfo;

void AYourGameState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const
{
    Super::GetLifetimeReplicatedProps(Out);
    DOREPLIFETIME(AYourGameState, ReplicatedRoomInfo);
}
```

### Client Joining

Clients wait for replicated room info, then open the same room:

```cpp
void AYourGameState::OnRep_LudeoRoomInfo()
{
    if (ReplicatedRoomInfo.bIsReady && SessionHandle != nullptr)
    {
        OpenRoom(ReplicatedRoomInfo.RoomID, ReplicatedRoomInfo.LudeoID);
    }
}
```

### Player Leave

Handle player disconnection by removing them from the room:

```cpp
void AYourGameState::OnPlayerLeft(AController* Controller)
{
    if (FLudeoRoom* Room = FLudeoRoom::GetRoomByRoomHandle(LudeoRoomHandle))
    {
        if (APlayerState* PS = Controller->GetPlayerState<APlayerState>())
        {
            FLudeoRoomRemovePlayerParameters Params;
            Params.PlayerID = FString::FromInt(PS->GetPlayerId());
            Room->RemovePlayer(Params);
        }
    }
}
```

### Ludeo Selection from Client

If a client selects a Ludeo, forward to server via RPC:

```cpp
UFUNCTION(Reliable, Server)
void RPCServerOnLudeoSelected(const FString& LudeoID);
```

---

## 13. Authentication

### Implicit Authentication (Production)

- SDK auto-detects Steam credentials
- Steam must be running and initialized by the game
- Ensure Steam beta branch matches target environment
- Leave `AuthenticationDetails` empty in activation params

### Explicit Authentication (Development/Testing)

Required when:
- Running from Unreal Editor (UE doesn't init Steamworks)
- Testing without Steam running
- Need to control environment/user

```cpp
FLudeoSessionSteamAuthenticationData SteamAuth;
SteamAuth.AuthenticationID = TEXT("76561198012345678");  // Steam user ID
SteamAuth.BetaBranchName = TEXT("development");          // From Studio Labs

FLudeoSessionActivateSessionParameters Params;
Params.AuthenticationDetails = SteamAuth;
```

### Configuration

Store in `DefaultEditor.ini` (not shipped with builds):

```ini
[Ludeo.SessionActivate]
AuthenticationType=Steam
SteamBetaBranchName=development
SteamAuthenticationID_1=76561198012345678
```

Store in `DefaultGame.ini` (shipped):

```ini
[Ludeo.SessionActivate]
GameVersion=1.0.0
APIKeyUE5="your-api-key-here"
```

---

## 14. Additional Features

### Ludeo Gallery

Open the playable moments gallery overlay:

```cpp
if (FLudeoSession* Session = FLudeoSession::GetSessionBySessionHandle(Handle))
{
    Session->OpenGallery();
}
```

### Ludeo Command (Debug)

Execute SDK debug commands:

```cpp
FLudeoManager::ExecuteLudeoCommand(TEXT("activation-ludeoid"), TEXT("your-ludeo-id"));
```

### Gradual Rollout

Configured in Studio Labs (no code changes):
- Set rollout percentage (0-100%) for Production
- Override for specific users via User Management

---

## 15. UI & Overlay Considerations

### SDK Overlay

Ludeo provides its own overlay system -- the game does **not** need to build custom UI for:
- Video capture indicators
- Playback controls
- Consent forms
- Highlight notifications
- Gallery browsing (if enabled)

The only requirement is providing the `GameWindowHandle` during session activation so the overlay can attach to the game window.

### Gallery Button (Optional)

If the game wants to provide in-game access to the Playable Moments gallery, add a button that calls:

```cpp
// C++
if (FLudeoSession* Session = FLudeoSession::GetSessionBySessionHandle(Handle))
{
    Session->OpenGallery();
}
```

Or use the Blueprint node `OpenGallery` from `ULudeoSessionBlueprintFunctionLibrary`.

This is an **additional feature**, not required for core SDK integration. If implemented, hide the button when both `bCanCreateLudeo` and `bCanPlayLudeo` are false (from `OnPlayerConsentUpdated`).

### Player Flow Visual Feedback

When a Ludeo is selected for playback, the game should:

1. **Show loading state** while retrieving Ludeo data after `OnLudeoSelected`
2. **Skip splash screens/cutscenes** when `bIsLudeoSelected` is true in the activation callback
3. **Pause visually** after state reconstruction, then resume on `OnRoomReady`

### Required Callback Handlers (UI Impact)

These callbacks from the SDK require the game to update its visual/audio state:

| Callback | Game Response |
|----------|---------------|
| `OnPauseGameRequested` | Pause the game: `UGameplayStatics::SetGamePaused(World, true)` |
| `OnResumeGameRequested` | Resume the game: `UGameplayStatics::SetGamePaused(World, false)` |
| `OnMuteGameRequested` | Mute or unmute game audio based on the `bMute` parameter |
| `OnGameBackToMenuRequested` | Navigate back to the main menu |
| `OnPlayerConsentUpdated` | Store consent state (`bCanCreateLudeo`, `bCanPlayLudeo`); optionally show/hide Ludeo-related UI elements |

---

## 16. Blueprint Integration

### Plugin-Provided Blueprint API

The LudeoUESDK plugin exposes a full Blueprint API -- no C++ wrappers needed for basic integration:

| Library | Key Functions |
|---------|---------------|
| `ULudeoManagerBlueprintFunctionLibrary` | `InitializeLudeoSDK`, `FinalizeLudeoSDK`, `TickLudeoSDK` |
| `ULudeoSessionBlueprintFunctionLibrary` | `CreateLudeoSession`, `OpenGallery`, `ReleaseLudeo`, `SetLocalization` |
| `ULudeoRoomBlueprintFunctionLibrary` | `IsValidLudeoRoomHandle` |
| `ULudeoPlayerBlueprintFunctionLibrary` | `IsValidLudeoPlayerHandle` |
| `ULudeoObjectBlueprintFunctionLibrary` | `LudeoSaveGameToSlot`, `LudeoLoadGameFromSlot` |
| `ULudeoBlueprintFunctionLibrary` | `GetLudeoID`, `GetCreatorPlayerID`, `GetGameWindowHandle` |
| `ULudeoUESDKBlueprintFunctionLibrary` | `IsSuccessfulLudeoResult`, `LudeoResultToString` |

### Blueprint Async Action Nodes

All major SDK operations have latent Blueprint nodes with Success/Fail output pins:

**Session:**
- `ActivateSession`, `DestroyLudeoSession`, `GetLudeo`, `OpenRoom`, `CloseRoom`

**Room:**
- `AddPlayer`, `RemovePlayer`

**Player:**
- `BeginGameplay`, `EndGameplay`

**Notification Subscriptions:**
- `SubscribeOnLudeoSelectedNotification`
- `SubscribeOnPauseGameRequestedNotification`
- `SubscribeOnResumeGameRequestedNotification`
- `SubscribeOnGameBackToMainMenuRequestedNotification`
- `SubscribeOnRoomReadyNotification`
- `SubscribeOnPlayerConsentUpdatedNotification`
- `SubscribeOnLocalizationUpdatedNotification`
- `SubscribeOnMuteGameRequestedNotification`

### Blueprint SaveGame Properties

Properties tracked by the Ludeo state system must be marked with the SaveGame flag:

- **C++**: `UPROPERTY(SaveGame)`
- **Blueprint**: Check the **SaveGame** checkbox in the variable's Advanced details panel

All `SaveGame`-flagged properties are automatically tracked by `FLudeoObjectStateManager` when their owning actor is included in the `SaveGameSpecification`.

### Recommended Blueprint Architecture

Pattern from the FPS sample project:

1. Create **C++ base classes** with Ludeo integration logic (GameInstance, GameState, PlayerController)
2. Create **Blueprint subclasses** in `Content/Ludeo/` for per-project configuration
3. Use `UPROPERTY(EditDefaultsOnly)` for Blueprint-configurable settings (e.g., `SaveGameSpecification`)
4. Use `UFUNCTION(BlueprintCallable)` for actions called from Blueprint (e.g., `ReportPlayerAction`, `OpenLudeoGallery`)
5. Use `UFUNCTION(BlueprintImplementableEvent)` for events handled in Blueprint (e.g., `OnMuteGameRequested`)

### Blueprint-Only Integration Path

For simpler games or rapid prototyping, the async Blueprint nodes can drive the entire Ludeo lifecycle without any C++:

1. Initialize via `InitializeLudeoSDK` node
2. Subscribe to notifications via Subscribe async nodes
3. Manage sessions and rooms via async action nodes
4. Track state via `LudeoSaveGameToSlot` / `LudeoLoadGameFromSlot`

### Blueprint Asset Structure

Recommended directory layout (based on FPS sample):

```
Content/Ludeo/
├── GameInstance_BP.uasset              # Blueprint subclass of Ludeo game instance
├── MainMenuGameMode_BP.uasset          # Main menu mode
├── SinglePlayer/
│   ├── GameMode_BP.uasset
│   ├── GameState_BP.uasset             # SaveGameSpecification configured here
│   ├── PlayerController_BP.uasset
│   ├── CharacterBase_BP.uasset
│   └── PlayerCharacter_BP.uasset
└── Multiplayer/
    ├── ReplicatedGameMode_BP.uasset
    ├── ReplicatedGameState_BP.uasset
    ├── ReplicatedPlayerController_BP.uasset
    ├── ReplicatedPlayerCharacter_BP.uasset
    └── ReplicatedPlayerState_BP.uasset
```

---

## 17. Testing & Debugging

### Local Testing

1. **Simulate Ludeo Selection**: Before `Session->Activate()`, call:
   ```cpp
   FLudeoManager::ExecuteLudeoCommand(TEXT("activation-ludeoid"), TEXT("your-ludeo-id"));
   ```

2. **Verify Callback Flow**: Check logs for:
   - SDK initialization success
   - Session activation success
   - `LudeoSelected` callback triggered
   - Room opened/closed
   - Player added/removed
   - BeginGameplay/EndGameplay

### Cloud Testing

1. Request cloud machine via Studio Labs
2. Upload build via Build Management
3. Test in target environment (Sandbox/Playtest)

### Debugging Tools

- **Highlight Inspector**: View captured highlights in Studio Labs
- **Cloud Session Logs**: Retrieve logs after cloud session ends
- **Performance Profiling**: Tracy Profiler support in dev builds
- **Logging**: Configure verbosity at runtime per category

---

## 18. Integration Checklist

### Phase 1: Foundation
- [ ] Plugin installed and building
- [ ] SDK initialized in Game Instance
- [ ] SDK Tick running every frame
- [ ] SDK Finalize on shutdown

### Phase 2: Session
- [ ] Session created on game start
- [ ] All 7 notification callbacks registered (including `OnSDKOutOfBand`)
- [ ] Session activated with correct API key
- [ ] Session destroyed on shutdown
- [ ] Pause/Resume handlers use explicit set (not toggle)
- [ ] Consent handler stores state

### Phase 3: Gameplay (Creator Flow)
- [ ] Room opened when match/level starts
- [ ] Player added to room
- [ ] RoomReady + AddPlayer both awaited before BeginGameplay
- [ ] State tracking active (SaveWorld or manual)
- [ ] State tracking SKIPPED in Player Flow
- [ ] Player actions reported (SendAction)
- [ ] EndGameplay called with correct bIsAbort
- [ ] Player removed before CloseRoom
- [ ] Room closed with callback

### Phase 4: Gameplay (Player Flow)
- [ ] LudeoSelected -> GetLudeo flow working
- [ ] Level loaded from Ludeo data
- [ ] World restored via RestoreWorld
- [ ] ReleaseLudeo called after restore
- [ ] Room opened with LudeoID
- [ ] BeginGameplay after RoomReady
- [ ] Only player actions tracked (no state)

### Phase 5: Polish
- [ ] Non-Ludeoable Areas configured for menus/cutscenes
- [ ] Authentication tested (implicit + explicit)
- [ ] Multiplayer flow tested (if applicable)
- [ ] Shutdown sequence verified (EndGameplay -> RemovePlayer -> CloseRoom -> DestroySession -> Finalize)

### Phase 6: UI & Blueprint
- [ ] Mute/unmute handler implemented for `OnMuteGameRequested`
- [ ] Consent state stored from `OnPlayerConsentUpdated`
- [ ] Loading feedback shown during Ludeo restoration (Player Flow)
- [ ] Splash screens/cutscenes skipped when `bIsLudeoSelected` is true
- [ ] Blueprint subclasses created in `Content/Ludeo/` directory
- [ ] SaveGame properties marked on tracked Blueprint variables
- [ ] (Optional) Gallery button added to main menu calling `OpenGallery()`

---

## 19. Mapping to Your Game (Lyra Example)

When integrating into a new UE game like Lyra, map SDK concepts to existing game classes:

| SDK Concept | Map To | Lyra Equivalent |
|-------------|--------|-----------------|
| Game Instance (Init/Shutdown/Tick) | `UGameInstance` subclass | `ULyraGameInstance` |
| Session Setup (Main Menu) | Main menu game mode | `ULyraFrontendStateComponent` or menu experience |
| Room Lifecycle | Game State | `ALyraGameState` |
| Player Add/Remove | Player State reference | `ALyraPlayerState` |
| Player Readiness | Player Controller | `ALyraPlayerController` |
| Match Start/End | Game Mode | `ALyraGameMode` / Experience system |
| State Tracking | Actors with SaveGame | Character, weapons, abilities, world actors |
| Player Actions | Gameplay events | `ULyraAbilitySystemComponent` events, damage events |
| Multiplayer | Replication | Lyra's existing replication system |
| Non-Ludeoable | Menu/loading states | Lyra frontend experiences, loading phases |
| Overlay / Gallery (Optional) | Main menu widget | Lyra's CommonUI frontend widget |
| Blueprint Subclasses | `Content/Ludeo/` | `Content/Ludeo/` mirroring Lyra class hierarchy |

### Key Lyra Considerations

1. **Experience System**: Lyra uses modular "experiences" -- session setup should happen at the experience level, not globally
2. **Gameplay Ability System (GAS)**: Player actions map naturally to GAS events (damage dealt, ability activated, elimination)
3. **Modular Gameplay**: Lyra's component architecture means `SaveGameSpecification` needs to track relevant components, not just actors
4. **Dedicated Server**: Lyra supports dedicated servers -- ensure AddPlayer is skipped for the server instance
5. **Phase System**: Lyra's match phase system (Warmup -> Playing -> PostGame) maps to OpenRoom/BeginGameplay/EndGameplay

### Recommended Curated Start for Lyra

Start with a single Lyra experience (e.g., Elimination mode on one map):
1. Track: Player characters, weapons, health, positions
2. Actions: Elimination, Death, Damage Dealt, Ability Used
3. Restore: Spawn players at correct positions with correct loadouts
4. Verify: Ludeo playback reproduces the gameplay moment accurately
