---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: 6
question: "Does the game already expose Blueprint event dispatchers (BP 'Event Dispatcher' = dynamic multicast delegate) for the gameplay moments you want as actions (pickup, mine placed, spotted, died), and do you only need to know the event happened (attribution is the single local player or otherwise known)? If yes, bind a ZERO-ARG UFUNCTION to each dispatcher via reflection — you don't need the delegate's parameter signature."
sanitized: true
---

# Bind a zero-arg UFUNCTION to a BP event dispatcher via reflection — no signature matching

## Precondition

The game already has **Blueprint event dispatchers** (a BP "Event Dispatcher" is a
`DECLARE_DYNAMIC_MULTICAST_DELEGATE`) for the moments you want to emit as Ludeo actions —
e.g. on a per-entity manager actor reachable from the GameState. You want to hook them from
the plugin, but:

- The delegate's **parameter signature is unknown / unverified** (the BP inspector lists the
  dispatcher as an `mcdelegate` with no param types), and
- You only need to know **that the event fired** — attribution is the single local player (or
  otherwise already known), so you don't actually need the delegate's payload.

## The technique

`Bind*` on a single-cast delegate would replace an existing binding, and matching a dynamic
multicast signature from C++ normally means declaring a `DECLARE_DYNAMIC_MULTICAST_DELEGATE`
of the exact shape. Both are avoidable. **Bind a zero-parameter `UFUNCTION()` to the
dispatcher via reflection.** When the dispatcher broadcasts, `FMulticastScriptDelegate`
calls `Object->ProcessEvent(BoundFunction, Params)` using the **bound function's own**
parameter layout — a zero-arg function reads nothing from the broadcast buffer and safely
ignores it. No signature matching, no BP edits.

```cpp
// Reflection helper (engine-generic):
bool BindMulticastDelegate(UObject* Owner, const TCHAR* DelegatePropName,
                           UObject* Handler, FName HandlerFuncName)
{
    FMulticastDelegateProperty* Prop =
        CastField<FMulticastDelegateProperty>(Owner->GetClass()->FindPropertyByName(DelegatePropName));
    if (!Prop || !Handler->FindFunction(HandlerFuncName)) return false;

    void* ValuePtr = Prop->ContainerPtrToValuePtr<void>(Owner);
    FScriptDelegate D; D.BindUFunction(Handler, HandlerFuncName);   // zero-arg target is fine
    Prop->AddDelegate(MoveTemp(D), Owner, ValuePtr);
    return true;
}

// Handler — declared UFUNCTION(), takes NO params even though the dispatcher has some:
UFUNCTION() void OnSomethingHappened();              // header
void UMyComp::OnSomethingHappened() { ReportAction(TEXT("SomethingHappened")); }   // cpp
```

`FMulticastDelegateProperty` covers both inline and sparse dynamic multicast. Pass the
explicit value pointer to `AddDelegate`/`RemoveDelegate` rather than relying on it to resolve
from the parent. Unbind symmetrically with `RemoveDelegate(SameScriptDelegate, Owner, ValuePtr)`.

## Why this beats the alternatives

| Alternative | Cost |
|---|---|
| Declare a matching `DECLARE_DYNAMIC_MULTICAST_DELEGATE` and `AddDynamic` | Needs the exact param signature; brittle if it drifts; more boilerplate per dispatcher. |
| Poll for the event from state | Some discrete events (mine placed, spotted) have no clean pollable signal. |
| **Zero-arg UFUNCTION + reflection bind** | No signature needed; one tiny handler per event; binds/unbinds cleanly; works for any dispatcher whose payload you don't need. |

## Caveats / verify at runtime

- This gives you "it happened", not the payload. If you DO need a param (e.g. which entity, to
  pick a per-class action name), either declare the matching delegate type, or derive the fact
  from polled state instead (a destroy event's unit class came from the polled tracked-unit, not the
  dispatcher).
- **Confirm each dispatcher actually broadcasts** in a run (log a one-shot "bound: A=%d B=%d"
  and a per-fire line, then grep). A correctly-bound dispatcher that never fires usually means
  the in-game event simply didn't occur (e.g. a "spotted" dispatcher won't fire in a battle
  with no fog/stealth) — not a binding bug. Drop the diag logs once confirmed.
- Bind in BOTH Creator and Player Flow (actions must fire on replay for SDK scoring), and
  unbind in the teardown path.

## Cross-reference

- `architecture/parallel-multicast-when-single-cast-already-bound.md` — when the existing hook
  is SINGLE-cast and already taken (different problem: add a parallel multicast).
- `common-mistakes/actions-must-fire-in-player-flow-too.md` — bind in both flows.
