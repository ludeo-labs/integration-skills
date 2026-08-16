---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Are you passing a callback into the game's own loading-screen/transition API (open/show/fade), with anything load-bearing inside it? Read that API's guard clauses first: many such methods silently return WITHOUT invoking the callback when the screen is already open or a fade coroutine is still running."
sanitized: true
---

# A loading screen's open call may silently drop your callback

The game's scene-change helper ran its entire transition inside the loading screen's
`Open(callback)` — the server's wait-for-clients arm AND the client's "ready" message both lived in
that callback. The loading screen's open method, however, begins with a guard:

```csharp
if (!force && (isAlreadyOpen || fadeCoroutineRunning))
    return;              // callback never invoked, no error, no log
```

The replay boot fired the transition just after a previous load's screen had closed — its fade-in
coroutine was still running — so the guard ate the call. No scene change, no error, nothing in the
log: the game simply stayed where it was until a human gave up and backed out.

Three lessons, in order of generality:

1. **Read the guard clauses of any API you hand a callback to.** "Open the loading screen, then do
   X in the callback" is only as reliable as the open call's promise to invoke it. A UI nicety
   (don't reopen while fading) becomes a dropped state transition when callers ride the callback.
2. **Don't put critical handshakes exclusively inside cosmetic-UI callbacks** — if you must call
   such a path, first wait for the screen to be genuinely idle. The idle state (including the fade)
   may be private; a one-line read-only accessor on the game class is a legitimate mechanical edit.
3. **This compounds with holding the screen open yourself.** If the integration force-holds the
   game's loading screen as a restore cover, every later game-initiated `Open(callback)` gets
   eaten. Give the integration its OWN full-screen cover (a layer-owned canvas) and leave the
   game's loading screen machinery untouched.

Symptom signature: a transition that works when triggered from calm UI states but silently stalls
when triggered programmatically right after another scene change — with absolutely nothing in the
log at the moment of the stall.
