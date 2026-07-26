---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: 6
question: "Is the engine event hook you want to bind to a SINGLE-CAST delegate (DECLARE_DELEGATE_*, not DECLARE_MULTICAST_DELEGATE_*) that another game system has already BindUObject'd? If yes, you cannot bind from the plugin without overwriting the existing handler — add a parallel multicast next to it."
sanitized: true
---

# Parallel multicast when a single-cast delegate is already bound

## Precondition

The integration needs to observe an engine event. Searching the broker / game class turns up an existing delegate at the right site, BUT:

- It's `DECLARE_DELEGATE_OneParam` (or any non-multicast variant), not `DECLARE_DYNAMIC_MULTICAST_DELEGATE_*` / `DECLARE_MULTICAST_DELEGATE_*`.
- Some other engine system (e.g. an event-reactor, analytics manager, level component) has already called `BindUObject` / `BindUFunction` on it.

`Bind*` on a single-cast delegate **replaces** the previous binding. Binding from the plugin would silently break the existing consumer — gameplay reactions, analytics, audio cues that consumer drives all stop working.

The companion learning `expose-hook-via-multicast-not-ufunction.md` covers the case where there is **no existing delegate** at the broadcast site. This learning is the variant for "delegate exists but is single-cast and already taken."

## Detection

For each candidate hook, run two checks:

1. Is the declaration `DECLARE_DELEGATE_*` (not `_MULTICAST_DELEGATE_*`)? → single-cast.
2. Grep for `<DelegateName>.BindUObject\|.BindUFunction\|.BindLambda\|.BindStatic` across the source. → if any hit (other than test code), it's already bound.

ActionGame example: `UGameEventBroker::OnNpcCaptured`, `OnEnemySurrendered`, `OnPlayerRestrained`, `OnPlayerFiredSpecialWeapon`, `OnPlaceablePlacedDelegate`, `OnPlaceableToolPlacedDelegate` — all single-cast `FGameCharacterDelegate` / placed-data variants, all bound by `UPlayerEventReactor`.

## The pattern

Add a parallel native multicast next to each single-cast delegate, gated by `LUDEO_OFFLINE_MODE`. Broadcast both at the same call site:

```cpp
// Engine: GameEventBroker.h (inside class body)
#if LUDEO_OFFLINE_MODE
    DECLARE_MULTICAST_DELEGATE_OneParam(FOnLudeoCharacterEvent, AGameCharacter*);
    FOnLudeoCharacterEvent OnLudeoNpcCaptured;
    FOnLudeoCharacterEvent OnLudeoEnemySurrendered;
    // ... one per hook ...
#endif
```

```cpp
// Engine: GameEventBroker.cpp
void UGameEventBroker::ServerPostOnNpcCaptured(AGameCharacter* Npc)
{
    OnNpcCaptured.ExecuteIfBound(Npc);    // existing — preserved
#if LUDEO_OFFLINE_MODE
    OnLudeoNpcCaptured.Broadcast(Npc);    // new — Ludeo path
#endif
}
```

```cpp
// Plugin: bind via AddUObject (no UFUNCTION needed)
LudeoNpcCapturedHandle = Broker->OnLudeoNpcCaptured.AddUObject(
    this, &UActionGameLudeoComponent::OnLudeoNpcCapturedHandler);
```

A single shared multicast type can serve many hooks if the parameter shape matches (here all six broker hooks use `AGameCharacter*` or a small placed-data struct).

## Why parallel multicast over the alternatives

| Alternative | Cost |
|---|---|
| Convert single-cast → multicast in place | Changes the broker's public API; existing `BindUObject` / `Unbind` calls in `UPlayerEventReactor` no longer compile. |
| Bind from plugin and re-broadcast manually to the original consumer | Plugin now has to know about the original consumer; ordering bugs; ownership inversion. |
| Hook the broadcast site instead of the delegate (e.g. wrap `ServerPostOnNpcCaptured`) | Engine method override is heavier; requires `virtual`; more invasive. |
| **Parallel multicast** | Existing consumer untouched. New observer added cleanly. Gated to vanish in vanilla builds. |

## Caveats

- The 6 broker hooks added in this pattern fire **on the server** (`ServerPostOn*` naming). In single-player / `LUDEO_OFFLINE_MODE` solo runs the local client is also the server, so they fire. In genuine multiplayer the plugin still receives them only on the host — be aware when wiring per-player attribution.
- Both delegates broadcast at the same call site, so any side-effect ordering dependency between them is undefined. Don't rely on the original-consumer-runs-before-Ludeo (or vice versa) ordering.

## Cross-reference

- `architecture/expose-hook-via-multicast-not-ufunction.md` — the no-existing-delegate variant.
- `architecture/engine-ludeo-gates-must-cascade-to-callers.md` — gating discipline for the new multicast and its broadcast.
