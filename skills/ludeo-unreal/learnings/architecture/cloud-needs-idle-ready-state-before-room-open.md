---
category: architecture
tier: generalizable
sourceGame: EndlessFPS
phase: 2
question: "In the cloud, does the game reach an idle, streamable 'ready & waiting' state (no room open, not recording) before any room opens? A game that boots straight into gameplay and opens a room at boot will never let the cloud streamer connect / the machine never reports ready."
sanitized: true
---

# On the cloud, idle to a 'ready & waiting' state before opening a room

## Precondition

`packagingTarget` is `cloud-build` (the game runs on a LudeoCast cloud machine launched with `-cloud`), AND the game boots directly into gameplay (its default map is a gameplay level, not a frontend menu).

## The problem

The cloud machine launches the game; a **streamer/overlay** must attach and the machine must report **ready** before the cloud sends a Ludeo to play (`OnLudeoSelected`). If the integration opens a room and starts a session **at boot** (e.g. Creator room-open the moment the level is game-ready), the machine never presents an idle "ready & waiting" state — the streamer never connects and the machine never reports ready. It works fine locally (no streamer to wait for), so this is a cloud-only failure that local testing won't catch.

A working cloud reference boots to a **main menu**, activates the session, the overlay connects (`LudeoTransmitReady`), the machine **sits idle** while the streamer attaches, and **only then** does `OnLudeoSelected` arrive → travel → restore → gameplay → the backend `gameplays/ready` is posted. The idle menu is the ready surface.

## The pattern

Separate **"session activated / level loaded"** from **"room opened / gameplay started."** At boot, reach an idle, streamable, interactive state and **wait** — do **not** open a room. Open a room only on an explicit trigger:

| Trigger | Flow |
|---|---|
| `OnLudeoSelected` (cloud sends a Ludeo) | Player Flow — travel + restore + open room |
| User starts playing (closes the idle menu / presses start) | Creator Flow — open room + add player + begin |

If the game has a frontend map, idle there (closest to the reference). If it boots straight into a gameplay level (no frontend in the cloud boot path), realize the idle "lobby" as the game's **own pause/in-game menu over the loaded level**: when game-ready, pause + show the in-game menu + suppress any auto-spawner, set an `bAwaitingStart` flag, and open no room. Detect the start trigger (menu closed) and only then open the Creator room; on `OnLudeoSelected`, cancel idle (unpause) and run the normal Player-Flow travel.

## Gotchas

- **Key the "start" trigger on the menu/UI state, not a generic pause flag** — and force-unpause yourself on start, so you don't depend on the menu's own resume to have cleared every pause path.
- **Arm the "menu closed → start" detector only after the menu is confirmed up**, or the first tick (before the menu appears) false-starts.
- **Don't pause during async streaming** — only enter the idle pause after the level is fully loaded/streamed (see `dont-pause-during-async-load-waits.md`).
- Cancel idle (unpause + un-suppress) before the Player-Flow `ServerTravel`, so travel isn't fighting a paused/suppressed world.
- Nothing should leak during idle: keep state-writes / action-polling / segment-marking gated on `bGameplayStarted` (which only flips true after the explicit start), so the idle menu itself never emits actions.

## Related

- `gate-openroom-on-loadout-ready.md` — "the SDK does nothing until OpenRoom; delaying it is free."
- `dont-pause-during-async-load-waits.md`, `gate-player-flow-on-streamed-level-not-pawn.md` — readiness gating.
- `hud-active-screen-enum-as-nongameplay-signal.md` — the HUD signal used to detect the menu open/closed.
