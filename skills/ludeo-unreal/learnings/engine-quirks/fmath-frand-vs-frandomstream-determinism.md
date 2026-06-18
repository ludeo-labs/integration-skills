---
category: engine-quirks
tier: generalizable
sourceGame: ActionGame
phase: 3
question: "For each gameplay decision that needs to replay deterministically (vehicle spawn rolls, drop rolls, AI behavior rolls), check whether the code uses FMath::FRand (system C-runtime rand) or FRandomStream(MissionState->GetMixedRandomSeed(N)). If FMath::FRand, replays will diverge from live regardless of seed restoration."
sanitized: true
---

# FMath::FRand is NOT controlled by the mission seed

## The two RNG streams in UE4

UE4 has two distinct RNG paths that are easy to confuse:

| API | Backed by | Affected by |
|---|---|---|
| `FMath::FRand()` | C-runtime `rand()` (libc LCG, system entropy) | NOT controlled by `FMath::SRandInit` or `MissionState->SetDebugRandomSeed`. Independent system stream. |
| `FMath::SRand()` | `GSRandSeed` (engine-managed LCG) | `FMath::SRandInit(seed)` resets it; `FMath::GetRandSeed()` returns current state |
| `FRandomStream::FRand()` | `mutable uint32 Seed` per-instance | Constructor / `Initialize(seed)` set it; `GetCurrentSeed()` returns current state |

For deterministic snapshot-replay, you need either `FMath::SRand` (capture/restore `GetRandSeed`/`SRandInit` of the global stream) or per-system `FRandomStream` (capture/restore `GetCurrentSeed`/`Initialize`). `FMath::FRand` is uncapturable from the game side and breaks replay determinism.

## What MissionState->SetDebugRandomSeed actually does

`SetDebugRandomSeed(int32)` on `AMissionState` is a plain field setter — it sets a `RandomSeed` member. Other systems that need determinism call `MissionState->GetMixedRandomSeed(N)` (XOR or hash of mission seed with system salt N) and use that to seed their own `FRandomStream`. The mission seed itself does NOT seed `FMath::FRand` or `FMath::SRand`.

So restoring `RandomSeed` only fixes determinism for systems that explicitly use `GetMixedRandomSeed` + per-system `FRandomStream`. It doesn't fix systems that use `FMath::FRand` directly.

## Symptom

Replay rolls diverge from live's post-capture rolls. Vehicle pump rolls fail at different rates. Squad selection picks different orders. Etc.

## Fix pattern

Refactor the gameplay code to use a per-system `FRandomStream` seeded from the mission seed. ActionGame already used this pattern for many systems (traffic management, deployable-device burn timing, moving security cameras, pawn-spawn group selection, random level-event distribution, spawn-location selection); just apply it to whichever decision path is currently on `FMath::FRand`.

```cpp
// Header (private): one stream per logical-decision system
#if LUDEO_OFFLINE_MODE
mutable FRandomStream VehicleRandomStream;
#endif

// Header (public): replay accessors
int32 Ludeo_GetVehicleRNGState() const { return VehicleRandomStream.GetCurrentSeed(); }
void  Ludeo_SetVehicleRNGState(int32 InState) { VehicleRandomStream.Initialize(InState); }

// .cpp BeginPlay: seed once from mission seed, distinct salt per system
VehicleRandomStream.Initialize(MatchGS->GetMixedRandomSeed(/*salt*/ kVehicleSalt));

// .cpp call site: gate-aware helper
float Roll = Ludeo_VehicleFRand();
// where Ludeo_VehicleFRand is:
//   #if LUDEO_OFFLINE_MODE return VehicleRandomStream.FRand();
//   #else                  return FMath::FRand();
//   #endif
```

Capture mid-stream state via `GetCurrentSeed()` each tick; restore via `Initialize` AFTER all other restoration (so any FRand calls during restore don't shift the position before sync).

## How to find these

`grep -rn "FMath::FRand\|FMath::FRandRange\|FMath::RandRange\|FMath::RandHelper"` across the gameplay-decision path you care about. Each call site is a determinism break.

## How to apply

When a user reports "the same captured Ludeo produces different replay outcomes" or "vehicles/drops/spawns roll differently each replay":

1. Grep the relevant gameplay code path for `FMath::FRand`-family calls.
2. Verify whether the project already has a per-system `FRandomStream` pattern elsewhere (ActionGame does; many UE games do).
3. Refactor the call sites to a new mission-seed-derived stream, gated by the project's offline-mode define.
4. Capture/restore the stream's mid-state.

## Salt selection

Pick a salt distinct from existing systems to avoid stream collisions. ActionGame assigns a distinct, non-overlapping integer salt to each decision system (one per wave-spawn roll, vehicle-spawn roll, etc.); choose any unused integer for the new stream.
