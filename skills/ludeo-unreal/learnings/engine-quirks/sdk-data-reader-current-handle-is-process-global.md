---
category: engine-quirks
tier: universal
sourceGame: FTPS_Online
phase: 5
question: null
sanitized: true
---

# The LudeoUESDK data-reader "current handle" is a process-global cache — query calls between Enter and ReadData can desync it

## Precondition

Applies to **every** UE Ludeo integration that calls into `FLudeoReadableObject` — i.e., any Player Flow read path. There is no project-specific precondition; this is how the LudeoUESDK wrapper is implemented.

## What the SDK does

`FLudeoReadableObject` operations (`EnterObject`, `LeaveObject`, `EnterComponent`, `ReadData`, `ExistAttribute`, `GetAttributeDataType`, `Iterate`, …) all begin with the macro `CHECK_DATA_READER_SET_CURRENT(LudeoHandle, …)`, which calls:

```cpp
// LudeoReadableObject.cpp
FLudeoResult ConditionalDataReaderSetCurrent(const FLudeoHandle& LudeoHandle)
{
    static FLudeoHandle CurrentLudeoHandle = nullptr;   // function-local static
    if (CurrentLudeoHandle != LudeoHandle)
    {
        Result = ludeo_DataReader_SetCurrent(LudeoHandle);
        if (Result.IsSuccessful()) CurrentLudeoHandle = LudeoHandle;
    }
    return Result;
}
```

Two consequences that bite:

1. **`CurrentLudeoHandle` is a *process-global* cache, not per-instance, not per-thread, not per-session.** Anything in the runtime (other game systems, debug overlays, another integration plugin, the SDK itself) that calls into a different Ludeo handle silently flips the active reader.
2. The wrapper's "context stack" (what `EnterObject` / `EnterComponent` push onto) is owned by *whichever* DataReader is currently active in the C SDK. If the cache is stale (the C SDK's actual current reader differs from `CurrentLudeoHandle`), the Enter we did earlier may not be on the stack the next call sees.

## Failure mode

Inserting any of `ExistAttribute` / `GetAttributeDataType` / `Iterate` / similar query calls **between** `EnterObject(...)` and a struct-typed `ReadData(FVector/FRotator/FTransform/...)` has been observed to crash later with:

```
Assertion failed: bHasEnteredComponent
[File:.../LudeoUESDK/Public/LudeoUESDK/LudeoScopedGuard.h] [Line: 84]
```

The struct `ReadData` overload internally constructs `FScopedLudeoDataReadWriteEnterComponentGuard`, whose constructor `check(bHasEnteredComponent)` is fatal — there is no graceful path. The added query call left the SDK's data-reader stack in a state where the subsequent `EnterComponent("Location")` returned false, and the assert killed the process.

The plain scope-guard pattern (no intervening query calls) does **not** trip this:

```cpp
FScopedLudeoDataReadWriteEnterObjectGuard<FLudeoReadableObject> Guard(ReadObj);
if (!Guard.HasEnteredObject()) continue;
ReadObj.ReadData("Location", Out);   // works
ReadObj.ReadData("Rotation", Out);   // works
// Guard destructor calls LeaveObject
```

This is **not** a flaw in `ExistAttribute` itself — the call is documented as a query. It's a real footgun in the SDK's caching layer that surfaces only when callers interleave query and read paths.

## How to apply

1. **Inside an `EnterObject` scope, do nothing except `ReadData(name, …)` calls.** Do not call `ExistAttribute`, `GetAttributeDataType`, `Iterate`, or any other `FLudeoReadableObject` query method between Enter and ReadData. If you need the type, deduce it from the schema you wrote, not by querying.
2. **Defensive missing-attribute handling cannot be done with `ExistAttribute` pre-checks** for the same reason. If a recorded Ludeo is missing a required FString or struct attribute, the SDK will hard-assert inside `ReadData` and there is no in-process recovery. The defenses that work:
   - Version your schema in `GameMetadata` (write a `SchemaVersion` int, gate reads on it).
   - Treat schema changes as a hard break — re-record QA Ludeos.
   - Communicate to QA when the recorded shape changes.
3. **Always use `FScopedLudeoDataReadWriteEnterObjectGuard`** for the Enter/Leave pair (its `check()` on Enter failure is a known nuisance — `HasEnteredObject()` is dead code — but the Leave-on-destruct correctness is worth more than what you lose). The same applies to `FScopedLudeoDataReadWriteEnterComponentGuard` and `FScopedWritableObjectBindPlayerGuard`.
4. **Keep one `FLudeoReadableObject` operation chain at a time.** Don't interleave reads from two different `FLudeo` instances — the cache will thrash and you'll be debugging similar symptoms.

## Provenance

Discovered in FTPS_Online during Stage 3 Player Flow restoration. Adding `ExistAttribute` guards before struct reads (a defensive pattern against missing-attribute crashes) introduced a `bHasEnteredComponent` assert at `LudeoScopedGuard.h:84` that was not present with the plain scope-guard pattern. Reverting to the bare `EnterObject → ReadData` sequence eliminated the crash. The user (Ronen) confirmed the global-cache behavior is a known SDK issue; this learning makes it discoverable for future integrations.

## Related

- Skill section "Common Mistakes 8.11" (ReadData asserts on missing attributes, version incompatibility) — that is the *symptom* this caching behavior produces when combined with ill-fitting defensive code.
