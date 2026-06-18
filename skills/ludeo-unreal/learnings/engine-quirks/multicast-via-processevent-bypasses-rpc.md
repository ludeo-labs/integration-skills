---
category: engine-quirks
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# `NetMulticast` UFUNCTIONs invoked via `ProcessEvent` do NOT execute their `_Implementation` body

## What happens

UE generates two functions for any UFUNCTION marked `NetMulticast`:

- `Multicast_X(args)` — the **stub** that triggers the RPC dispatcher
- `Multicast_X_Implementation(args)` — the **body** that actually runs on each receiving side

When BP or C++ code calls `Multicast_X(args)` normally, UE's RPC system:
1. Marks the call for replication to all connected clients
2. Invokes `Multicast_X_Implementation` locally on the server (if reliable + bAuthority)
3. Receives the call on each client and invokes their `_Implementation`

When you invoke the UFUNCTION via `Actor->ProcessEvent(MulticastFunc, &Args)` directly, you skip the RPC dispatcher. The result varies by UE version and configuration, but commonly:
- The Multicast stub function body (auto-generated, contains only the RPC dispatch call) runs
- The `_Implementation` body **does not run**
- No animation cascade, no replication to clients, no visible effect

Validated on an aerial-vehicle Blueprint's `Multicast_SetDoorState(uint8)`:
- `ListFunctions` confirmed the function exists with `[Net Multicast Reliable]` flags
- Invoking via reflection + `ProcessEvent` succeeded (no crash, log line fired)
- Verified the captured value was written to the parameter buffer correctly
- Door visibly stayed in its previous state — `_Implementation` body never fired

## Why this matters for restore code

A common mental model is "to restore a state change, call the engine's setter for that state." For Multicast functions, calling via ProcessEvent does NOT reproduce the natural call path. The setter LOOKS callable but is effectively a no-op.

Symptom: the call appears to succeed (no errors, log lines fire if you instrumented them), but the visual / behavioral state doesn't change.

## What to do instead

When a class exposes both `Set_X` AND `Multicast_Set_X`, the BP graph typically routes:
- `Set_X` checks authority, calls `Multicast_Set_X`
- `Multicast_Set_X` (the natural call) fires the RPC + `_Implementation`
- `_Implementation` writes the property + broadcasts cascade events

**Call `Set_X` instead of `Multicast_Set_X`** via ProcessEvent. The setter routes through the BP graph's intended path. In offline / solo, no actual replication happens, but the local `_Implementation` runs.

If only the Multicast variant exists (no separate `Set_X` wrapper), look for the BP `Receive_OnX` event in the function list. The animation graph subscribes to that event. You may need to fire `Receive_OnX` directly via ProcessEvent, but again, the parameter shape matters and trial-and-error per class may be required.

## How to discover the right invocation pattern

1. Use a `Ludeo.ListFunctions <ClassSubstring> <NameSubstring>` cheat command (or equivalent) to dump every UFUNCTION matching the state name, with full signature + flags:
   ```
   [BPCallable AuthOnly]   void SetDoorOpen(EAerialVehicleDoor Door, bool bOpen)
   [BPCallable AuthOnly]   void SetDoorState(uint8 NewState)
   [Net Multicast Reliable] void Multicast_SetDoorState(uint8 NewState)
   [BPEvent]               void Receive_OnDoorStateChanged(EAerialVehicleDoor Door, bool bIsDoorOpen)
   ```
2. Try the `[BPCallable]` candidates first — those are the intended public API.
3. Verify visually + via gameplay test that the call actually moves state.

## Related

- `engine-quirks/reflection-write-doesnt-fire-onrep.md` — sibling problem: direct property writes also bypass cascades.
- `architecture/pre-vs-post-beginplay-restore-timing.md` — the architectural workaround that often sidesteps the need to call setters at all.
