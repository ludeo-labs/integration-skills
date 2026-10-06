---
category: common-mistakes
tier: generalizable
sourceGame: IdleSample
phase: "3,7"
question: "Does your layer hold the application quit (Application.wantsToQuit returns false) so the gameplay session can End/CloseRoom first, and then call Application.Quit() from the teardown's completion callback? Check what happens when there is NOTHING to end (no room open, e.g. Activate failed, or the player sits in a menu), because then the completion runs synchronously, inside the wantsToQuit callback."
sanitized: true
---

# A quit hold that finishes synchronously cancels the quit

The usual quit hold: `wantsToQuit` returns `false`, the layer ends the gameplay session and closes the
room, and the completion callback calls `Application.Quit()` for real. That is correct while a run is
live, because the End/CloseRoom callbacks arrive on later frames, so the second `Quit()` comes from
outside the callback.

It broke in the first release player build. Locally that build could not sign in, so Activate failed
and no room ever opened. Closing the window then:

1. `wantsToQuit` engaged the hold and asked to "end the run" with nothing to end, so the completion ran
   **immediately**;
2. the completion called `Application.Quit()` **still inside `wantsToQuit`**, where Unity ignores it;
3. the handler then returned `false`, cancelling the only quit there was.

The log read like success (quit held, session disposed, quit released), the process stayed up, and the
window ignored every further close. The Editor never showed it: an Editor quit cannot be held, so the
layer lets it through there.

## Fix

- If nothing is live (no room, no teardown in flight), shut the session down and **return `true`**.
- Guard the general case too: set a flag around the teardown call inside `wantsToQuit`; if the
  completion ran synchronously, skip the nested `Application.Quit()` and return `true` instead.

```csharp
// synthetic illustration of the shape
if (!controller.HasLiveRoom && !data.teardownInProgress) { controller.Shutdown(); quitReady = true; return true; }
inWantsToQuit = true;
try { EndRun(onDone: FinishQuit); } finally { inWantsToQuit = false; }
return quitReady;                       // completed synchronously -> let this quit through
// FinishQuit: ... quitReady = true; if (!inWantsToQuit) Application.Quit();
```

Verify in a **player** build by closing the window (`CloseMainWindow`) and timing the exit (seconds,
exit code 0), both with a live room and without one.

Related: [[ending-a-recording-is-async-do-not-shut-down-on-the-next-line]],
[[hiding-the-window-during-a-held-quit-needs-run-in-background]],
[[re-asking-a-held-quit-starts-the-plugins-deinit-anyway]].
