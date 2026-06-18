---
category: engine-quirks
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# `FProperty::ImportText` / direct memory writes do NOT fire `OnRep_*` cascades

## What happens

UE's replication system fires `OnRep_X` callbacks on **clients receiving replicated value changes from the server**. The trigger is the network code's value-comparison-on-receive, not the property write itself. When you write to a UPROPERTY directly — via `FProperty::ImportText`, `FProperty::SetPropertyValue_InContainer`, or a raw memory write through `ContainerPtrToValuePtr` — the network code path is bypassed entirely.

This is a routine source of restore-mechanism bugs. The reflection write succeeds: the property's memory contains the new value, `ExportText` confirms it post-write. But no `OnRep_X` fires, no BP graph downstream of the OnRep runs, no animation transitions, no derived state updates.

## How this fails in restore code

Pattern that doesn't work:

```cpp
// Restore via reflection
FProperty* DoorProp = Actor->GetClass()->FindPropertyByName(TEXT("DoorState"));
void* Addr = DoorProp->ContainerPtrToValuePtr<void>(Actor);
DoorProp->ImportText(*CapturedValue, Addr, PPF_None, Actor); // ← memory updated

// Property is now '3', but OnRep_DoorState never fires.
// Animation graph still showing door-closed pose.
```

Pattern that often DOESN'T work either (validated on an aerial-vehicle Blueprint):

```cpp
// Find and invoke OnRep_X manually
UFunction* OnRep = Actor->GetClass()->FindFunctionByName(TEXT("OnRep_DoorState"));
TArray<uint8> ParamBuf;
ParamBuf.SetNumZeroed(OnRep->ParmsSize); // zeroed old-value param
Actor->ProcessEvent(OnRep, ParamBuf.GetData());

// OnRep fires but the BP graph reads the old-value parameter
// and may treat "new == old" as no-op. Or the BP graph guards on
// "did the value actually change relative to my internal state",
// and our zeroed old value gives the wrong answer.
```

## Workarounds, in order of preference

1. **Restore at pre-BeginPlay** instead of post-BeginPlay (`FWorldDelegates::OnWorldInitializedActors` hook). BPs that read state from properties at init do so naturally — no OnRep needed because nothing "changed", the value was that way from the start. See `architecture/pre-vs-post-beginplay-restore-timing.md`.
2. **Call the BP-author's intended setter via reflection**. Most stateful BPs expose a `SetX(...)` function whose graph does both the property write AND any associated event broadcast / animation kick. Find it via `Class->FindFunctionByName(TEXT("SetX"))` + parse params via `FProperty::ImportText` + invoke via `ProcessEvent`. This is "trial and error per class" but it's the working invocation pattern when restore must happen post-BeginPlay.
3. **Capture and restore ALL downstream state too**, so no cascade firing is necessary. If you restore both `DoorState` and every property/component that the OnRep cascade would have updated, the BP doesn't need to recompute anything — the world is already in the post-cascade state.

## Pitfalls related to this

- **Multicast UFUNCTIONs called via ProcessEvent do not run their `_Implementation` body** — they're meant to route through UE's RPC dispatcher. Calling `ProcessEvent(MulticastFunc, ...)` is NOT the same as the BP graph calling `Multicast_X(...)`. See `engine-quirks/multicast-via-processevent-bypasses-rpc.md`.
- **OnRep with old-value parameter requires the *actual* old value to be passed** if the BP graph guards on a real diff. Zeroed params produce subtle no-ops.
- **Server-side OnRep behavior differs from client-side**. Server's `RepNotify_OnChanged` setting controls whether OnRep fires on the writing side. In offline solo (where we're both "server" and "client" but no replication happens), OnRep typically doesn't fire on direct writes regardless.

## How to apply

When designing a restore mechanism, do not assume that "writing a property restores its visual / behavioral state." Verify per-class whether:
- The visible state is driven by the property read (direct write works) OR
- The visible state is driven by an OnRep / setter cascade (need different invocation OR pre-BeginPlay restore OR capture downstream state too)

The dump-and-diff workflow (see `architecture/dump-and-diff-workflow-for-state-discovery.md`) helps identify which fields are sources vs symptoms — if a single field changes between dumps, it's likely the source; if a cluster of fields changes, the source is upstream and the others are symptoms.
