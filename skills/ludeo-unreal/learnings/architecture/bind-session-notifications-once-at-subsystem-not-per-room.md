---
category: architecture
tier: generalizable
sourceGame: multiple
phase: 5
question: "Are the session-level notification delegates (OnRoomReady, OnLudeoSelected, pause/resume, back-to-menu) bound ONCE at session setup on a persistent owner, or rebound per-room on a transient component?"
sanitized: true
---
# Bind session-level notifications once at the subsystem; never per-room on a transient component

## Precondition
Applies to the standard UE architecture where a **persistent** `ULudeoSessionSubsystem` owns
the `FLudeoSession` for the whole game-instance lifetime, and a **transient**
`ULudeoGameStateComponent` is created/destroyed per world (i.e. it dies on every `ServerTravel`
between Ludeos). If your integration has no per-world component, this is moot.

## The pattern (SDK-prescribed, reference-confirmed)
Register the session-level notification delegates **once, at session setup, on the persistent
subsystem**, and forward them to whichever component is currently active. The SDK docs say to
*"register for the OnRoomReady notification when setting up your session callbacks"* and, for
`OnLudeoSelected`, *"Do not unbind … Keep the delegate bound for the entire lifetime of the
session."* The same lifetime logic applies to all the session-level notifications.

All three reference samples do exactly this:
- **Lyra**, **FPSGameStarterKit**, **VoyagerV2** each call
  `Session->GetOnRoomReadyDelegate().AddUObject(this, …)` **once in the subsystem's
  `Initialize()`**, alongside `OnLudeoSelected`, pause/resume, etc., and then route the
  callback to the live component via a `FindActiveGameStateComponent()` lookup
  (`World->GetGameState()->FindComponentByClass<…>()` at callback time).
- None of them re-bind or unbind `OnRoomReady` per room open.

## The anti-pattern that bites on re-entry
Binding `OnRoomReady` on the **component** inside its `OpenRoom()` and removing it on the
component's `EndPlay`/teardown. This is fragile because:
- The component is destroyed by `ServerTravel`. When switching Ludeos (teardown → travel →
  fresh world → new component), the bind/unbind dance straddles the session's most delicate
  window, and the second room's notification can be delivered to no live binding.
- It splits ownership of session-lifetime state across an object whose lifetime is *shorter*
  than the session — exactly the lifecycle mismatch that breaks SDK callbacks (see
  [[dont-bypass-sdk-when-your-lifecycle-is-broken]]).

Symptom: the begin gate works on a fresh first room but the notification "fails to re-fire"
on a later room — which is then often (mis)patched with a force-begin timer instead of fixing
the binding (see [[never-force-begin-without-onroomready]] and
[[onroomready-is-the-viewer-connected-gate]]).

## Rule
Session-level notifications have session lifetime → bind them on the session-lifetime owner
(the subsystem), once, and forward to the active component. Reset per-room *state*
(`bRoomReady`, `PlayerHandle`) on the new component; do not re-own the *delegate*.
