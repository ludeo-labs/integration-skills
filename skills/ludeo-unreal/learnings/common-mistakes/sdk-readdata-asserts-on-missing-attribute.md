---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# SDK `ReadData(FString)` hard-asserts on missing attribute — always write attributes you plan to read

## The Mistake

Capture-side code only wrote an attribute when there was non-empty content to serialize:

```cpp
// WRONG — attribute is written conditionally
if (MyList.Num() > 0)
{
    TArray<uint8> Bytes;
    FMemoryWriter Writer(Bytes, true);
    Writer << MyList;
    Obj.WriteData(LudeoAttr::MyList, FBase64::Encode(Bytes));
}
```

On Player Flow replay the corresponding read:

```cpp
FString B64;
if (Obj.ReadData(LudeoAttr::MyList, B64) && !B64.IsEmpty()) { ... }
```

**Crash:**

```
Assertion failed: bHasGetSize
[File: Plugins/LudeoUESDK/Source/LudeoUESDK/Private/LudeoUESDK/LudeoObject/LudeoReadableObject.cpp] [Line: 362]
```

## Why It Crashes

The SDK's `FLudeoReadableObject::ReadData(const char*, FString&)` is implemented as:

```cpp
uint32_t StringBufferSize = 0;
const bool bHasGetSize = (ludeo_DataReader_GetSize(AttributeName, &StringBufferSize) == LUDEO_TRUE);
check(bHasGetSize);   // <-- hard assert
```

If the specific Ludeo's per-object data has no such attribute (because the capture-side branch didn't run), the C SDK returns `LUDEO_FALSE` from `ludeo_DataReader_GetSize` and the `check()` fires. Registering the attribute in the session schema at activate time is **not** sufficient — the SDK also requires the attribute to have been **written on the capture side for this specific object**.

## The Rule

**For any attribute you plan to read on replay, always write it on every capture tick — even with an empty payload.** Serialization of an empty `TArray`/`TMap` is fine; the replay-side reader will decode it, the loop runs 0 iterations, no behavior change.

```cpp
// RIGHT — always write, empty is safe
TArray<uint8> Bytes;
FMemoryWriter Writer(Bytes, true);
Writer << MyList;  // empty MyList serializes as a 0-length array
Obj.WriteData(LudeoAttr::MyList, FBase64::Encode(Bytes));
```

## What about primitive types?

Integer / float / bool `ReadData` overloads generally return `false` without asserting when the attribute is missing — they use `ludeo_DataReader_GetInt32` etc. which has a different failure path. So primitive attributes are often tolerant.

**The assert is specific to the `FString` overload (and likely other variable-length types).** Any attribute stored as Base64 / serialized blob goes through the string overload and is affected.

## Detection before release

Grep every `Obj.ReadData(LudeoAttr::X, FString&)` call site. For each, find the matching `Obj.WriteData(LudeoAttr::X, ...)` and check its guard. If the write is conditional, either:
- Remove the guard and always write (preferred — simple, empty-safe), OR
- Guard the read too (add a "has data" flag attribute written unconditionally).

## Alternative: a safe-read helper

Longer-term, wrap `ReadData` with a helper that calls `ludeo_DataReader_GetSize` directly and returns false instead of asserting. Requires including the C SDK header and matching signatures — out of scope for most integrations but worth building if the pattern keeps biting.

## Cross-reference

- `readable-object-assert-on-missing-attributes.md` — earlier learning on a related SDK behavior.
