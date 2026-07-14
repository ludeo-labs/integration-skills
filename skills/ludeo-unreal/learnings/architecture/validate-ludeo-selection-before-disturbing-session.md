---
category: architecture
tier: universal
sourceGame: EndlessFPS
phase: 3
question: null
sanitized: true
---
# Validate a selected Ludeo BEFORE disturbing the live session — a bad selection must be a no-op

## The trap

The naive `NewLudeoSelected` / PlayLudeo handler tears down the current state first and asks
questions later: close the room, reset gameplay, travel — then call `GetLudeo` and try to apply
whatever comes back. When the selection is foreign or incompatible (a Ludeo from another game or
map, a stale/corrupt selection, a selection that fails to load), the teardown has already happened:
the player is dumped into a broken free-mode with no room, no restore, and nothing to resume.

## The pattern

**Validate first, disturb second.** On selection, call `GetLudeo` and check the result against what
this integration can actually play (it loads, and its map/slice matches what the integration
supports) **before** closing the room or touching any live state. Only a validated selection
proceeds to the teardown + travel + restore chain; an invalid one is logged and ignored, leaving
the running session exactly as it was.

`GetLudeo` is read-only — calling it costs nothing and commits you to nothing. The SDK does not
require teardown before you look at a selection.

## Why this matters more on cloud

On a cast VM there is no human to recover a broken state: a teardown-then-fail leaves the stream
stuck in free-mode until the VM recycles. A validate-first handler makes the worst case "selection
ignored, current state continues" — always streamable, always recoverable.

See also [[onroomready-is-the-viewer-connected-gate]] — same principle on the begin side: let the
platform's real signals drive state transitions, and make every failure path land in a safe,
resumable state.
