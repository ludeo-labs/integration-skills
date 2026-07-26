---
category: architecture
tier: universal
sourceGame: TacticsGame
phase: 3
question: null
sanitized: true
---

# Room teardown must survive the component — hand the chain to the subsystem on game-initiated travel

## The bug class (now seen in two integrations)

The standard scaffold puts the async teardown chain (EndGameplay → RemovePlayer →
CloseRoom, each step completing via an SDK callback) on the per-world GameState
component, with an `EndPlay` "safety net" for map exits. That safety net is a trap:
on a **game-initiated** exit (ESC → main menu, level change, PIE stop) the engine
destroys the component in the same frame. The first chain step posts its HTTP request
fine, but its completion delegate is bound to the now-dead component —
`CreateUObject` self-cancels — and the chain stops. RemovePlayer and CloseRoom never
run.

Consequences (TacticsGame, log-verified):
- SDK shutdown reports leaked interfaces ("N Interfaces still alive": the Room, its
  DataWriter, its GameplaySession).
- The **next** room opened on the session never receives `OnRoomReady` — the zombie
  room breaks the SDK's notification routing. Replays freeze at the begin gate.
- ActionGame hit the same class via in-place reset (`DestroyComponent` mid-chain →
  pause notifications routed to the zombie room) — see
  [[dont-bypass-sdk-when-your-lifecycle-is-broken]].

## The fix pattern

Ownership rule (same logic as [[bind-session-notifications-once-at-subsystem-not-per-room]]):
**work whose lifetime exceeds the world must be owned by an object whose lifetime
exceeds the world.** The GameInstance-subsystem owns the session; let it own the
EndPlay-path teardown too:

```cpp
// Component::EndPlay — do NOT run the chain from a dying component:
if (RoomActiveInAnyForm && Subsystem && RoomHandle.IsSet())
{
    WritableObjectMap.Empty(); // room close releases room-owned objects; no per-object destroys
    Subsystem->FinishRoomTeardownDetached(RoomHandle.GetValue(), PlayerHandle, CurrentPlayerID, bGameplayStarted);
    // clear local state; the subsystem completes the chain with ITS OWN delegates
}
```

`FinishRoomTeardownDetached` mirrors the chain (EndGameplay if gameplay started →
RemovePlayer if a player ID exists → CloseRoom) with subsystem-bound
`CreateUObject(this, ...)` delegates that survive the travel.

Keep the component-owned `TeardownRoom` for in-flow teardowns (integration-initiated
PlayLudeo/BackToMenu, game-over detection) — those complete while the world is alive
and need their completion callback (e.g. to travel afterwards).

## Verification signature

After quit-to-menu mid-battle, the log must show the FULL chain completing
(EndGameplay → removing player → room closed), and a subsequent replay must receive
`OnRoomReady` normally. TacticsGame verified both after the fix; before it, the chain
stopped after the first step every time.

## Cross-references

- [[dont-bypass-sdk-when-your-lifecycle-is-broken]] — the diagnosis rule: an SDK
  notification missing on a LATER room means YOUR lifecycle broke, fix it, never
  bypass/timeout.
- [[onroomready-is-the-viewer-connected-gate]] — includes the local-run diagnosis
  order for missing OnRoomReady.
