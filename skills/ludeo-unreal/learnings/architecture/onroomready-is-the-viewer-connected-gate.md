---
category: architecture
tier: universal
sourceGame: multiple
phase: 4
question: null
sanitized: true
---
# OnRoomReady means "the platform connected a viewer", not "the room HTTP handshake succeeded"

## What OnRoomReady actually signals
Per the Ludeo SDK docs (Gameplay Sessions → Player Flow): *"Wait for OnRoomReady — this is
sent when the Ludeo platform connects a user to the game instance,"* and *"the game instance
is running on the cloud, fully loaded and paused, **waiting for a user to be connected**."*

So `OnRoomReady` is a **remote, viewer-connection** signal. It is **not** any of these
nearer, earlier success points, all of which can complete seconds before a viewer attaches
(or with no viewer at all):

- `Session->OpenRoom(...)` succeeding (its `OnOpenRoom` callback / the `rooms/start` 201).
- `Room->AddPlayer(...)` succeeding (its `OnAddPlayer` callback / the `rooms/join` 201).
- The `gameplays/ready` POST returning 201.

Seeing those three succeed and concluding "the room is ready, begin gameplay" is the classic
mistake. They mean the *server-side* room exists; `OnRoomReady` means a *human* is on the
other end.

## Consequences for the begin gate
- The correct order is: `OpenRoom` → `AddPlayer` → **await `OnRoomReady`** → `BeginGameplay`.
  The SDK explicitly notes `OnRoomReady` can arrive **before or after** the `AddPlayer`
  completion callback, so the gate must handle both — set a `bRoomReady` flag and a
  `PlayerHandle`-set flag, and only `BeginGameplay` when both are true.
- On the cloud, the `OpenRoom`→`OnRoomReady` gap is the viewer's WebRTC connect time — it can
  be several seconds, and on a bad streaming run it may never fire.
- **If `OnRoomReady` never fires, treat it as a viewer/streaming-connectivity signal**, not a
  game bug. The right response is to keep waiting (the platform's *Non Preloaded Ludeo Load*
  timeout bounds it) and, for diagnosis, log the elapsed wait. Never bypass it — see
  [[never-force-begin-without-onroomready]].

## Diagnostic tell
If a cloud session shows `OpenRoom`/`AddPlayer`/`gameplays/ready` all 201, then a multi-second
gap with only SDK ticks, then `gameplays/begin` — and no `OnRoomReady` log line in between —
the begin did **not** come from a real room-ready; something forced it. The fix is on the
integration's begin gate (or the platform's viewer connect), not the game.

## Where to bind it
Bind `OnRoomReady` once at session setup on the persistent owner, not per-room on a transient
component — see [[bind-session-notifications-once-at-subsystem-not-per-room]].

## Local runs: OnRoomReady ALWAYS arrives — do not invent "no local viewer" theories

On a local machine (PIE, packaged dev build, console `Ludeo.Play`, web "play local"),
`OnRoomReady` always fires too — it is delivered via the SDK overlay. There is no "local
replay has no viewer so it can't become ready" case. (Human correction, TacticsGame
2026-06-10, after an agent theorized exactly that: "THAT ALWAYS HAPPENS. We just get it
from the overlay... this just works in other games.")

Diagnosis order when OnRoomReady is missing on a LATER room (first room worked):
1. **Audit the PRIOR room's teardown first** — did EndGameplay → RemovePlayer → CloseRoom
   ALL complete (log lines for each)? A component destroyed mid-chain (e.g. game-initiated
   quit-to-menu kills the world) self-cancels the pending SDK callbacks, leaks the room
   ("Interfaces still alive at shutdown" lists it), and the zombie room breaks notification
   routing for the next room — see [[dont-bypass-sdk-when-your-lifecycle-is-broken]].
2. Only after the lifecycle is proven clean, look at platform/connectivity.
Never respond with a timeout, force-begin, or retry — see
[[never-force-begin-without-onroomready]].
