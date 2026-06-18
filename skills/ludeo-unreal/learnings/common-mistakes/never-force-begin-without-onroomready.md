---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: 4
question: null
sanitized: true
---
# Never force-call BeginGameplay on a timeout when OnRoomReady has not fired

## The anti-pattern
An integration added a wall-clock "grace timer" to the component tick: if the room is
open and the player is added but `OnRoomReady` has not arrived within N seconds (e.g. 4s),
it sets `bRoomReady = true` itself and force-calls `TryBeginGameplay()` / `BeginGameplay`
"to avoid a permanent freeze on replay re-entry." A second tier force-resumed the game.

This is wrong, and it produces a **"death/failure on start"** symptom that is very easy to
misattribute to gameplay difficulty, restore position, or "the stream is laggy":

- **`OnRoomReady` is the SDK's signal that the platform has connected a *viewer/user* to the
  cloud instance** (see [[onroomready-is-the-viewer-connected-gate]]). Until it fires, *nobody
  is watching or controlling*. Force-beginning starts the simulation unattended — enemies/AI/
  timers run with no human input — so the player is dead (or the Ludeo is failed) by the time
  a viewer actually connects. In the logs this looks like: gameplay began, the player survived
  a few seconds, took **zero effective actions**, then died.
- It **masks a real connectivity problem**. If `OnRoomReady` never comes, that is a
  viewer/streaming-connect failure to surface and escalate — not a freeze to paper over.
- It **diverges from the canonical pattern**. The reference samples (Lyra, FPSGameStarterKit,
  VoyagerV2) all gate `BeginGameplay` on a strict `if (!bRoomReady) return;` with **no
  timeout, no grace, no force-begin** of any kind. They simply wait.

## Why it hides locally and only bites on the cloud
Locally (PIE / packaged on the dev's machine) there is effectively an immediate "user", so
`OnRoomReady` fires within milliseconds and the timer never elapses — the integration looks
correct. On the cloud the viewer connects over WebRTC and `OnRoomReady` can lag the
`OpenRoom`/`AddPlayer` by **seconds**, or never arrive on a bad run. So the grace timer fires
*first* on exactly the runs where it does the most damage. A bug that only appears on the
cloud, never locally, is a strong tell that you are racing an async platform signal with a
local wall-clock timer.

## What to do instead
- **Gate `BeginGameplay` strictly on `OnRoomReady`. Wait. Do not invent a deadline.**
- The platform already bounds the wait: the Studio Lab **"Non Preloaded Ludeo Load (ms)"**
  timeout (default 120000 ms) governs how long the backend waits for the client after
  `OnLudeoSelected`. If no viewer ever connects, let that timeout handle it — the game should
  sit paused, not begin blind.
- If you genuinely need an anti-permanent-freeze backstop, it must (a) use a timeout far
  longer than any plausible viewer-connect latency, and (b) **never start gameplay** — at most
  return the instance to a safe pre-play state. Beginning gameplay with no viewer is never the
  right recovery.

## The rule
A missing `OnRoomReady` is information, not an obstacle. If it doesn't fire, find out *why*
(viewer never connected? you broke the SDK's room lifecycle? — see
[[dont-bypass-sdk-when-your-lifecycle-is-broken]]). Forcing `BeginGameplay` past it converts a
diagnosable streaming/lifecycle problem into a silent "the player always dies instantly" bug.
