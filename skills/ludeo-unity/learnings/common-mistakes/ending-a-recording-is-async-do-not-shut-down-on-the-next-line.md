---
category: common-mistakes
tier: universal
sourceGame: TPSSample
phase: 3
question: null
sanitized: true
---

# Ending a gameplay session is a network round-trip — disposing on the next line cancels it

The obvious shape for the quit path is also wrong:

```csharp
public void HandleApplicationQuit()
{
    CloseSegment(keepCapture: false);   // issues EndGameplay/AbortGameplay
    Shutdown();                          // disposes the session
}
```

`EndGameplay` / `AbortGameplay` are **asynchronous**: they post to the Ludeo backend and call
back on completion. `Shutdown()` runs synchronously on the next line, disposes the session, and
the SDK cancels every request still in flight.

Observed timeline, from a real run:

```
:928  Async function ludeo_GameplaySession_End (callbackId 4)
:929  HTTP Req11_0: POST .../api/v3/gameplays/end
:931  Async function ludeo_Session_Release            ← our Shutdown(), 3 ms later
:934  Core:Warning 4 Interfaces still alive at shutdown: Session, Room, DataWriter, GameplaySession
:935  Core:Error   Client still holding a handle to a Room instance
:935  Core:Error   ludeo_GameplaySession_End failed with LudeoResult::Canceled
```

For scale: the other calls to that API in the same session took **190–620 ms**. Three
milliseconds was never going to be enough.

**It fails silently at the level that matters.** The call *is* issued, the code *looks* like it
satisfies "every gameplay exit path reports End/Abort", and nothing throws. Only the SDK's own
log says `Canceled`. Reviewing the C# alone will not catch this — you have to read the log.

## The fix has two parts, and the first alone is not enough

1. **Chain the teardown to the completion callback**, never the next statement:
   ```csharp
   CloseSegment(keepCapture: false, () => { Shutdown(); onComplete?.Invoke(); });
   ```
2. **Hold the quit until it lands.** Return `false` from `Application.wantsToQuit`, then call
   `Application.Quit()` yourself from the completion callback **or** from a bounded timeout,
   whichever fires first (guard with a flag so it only runs once). Without this, Unity proceeds
   to quit and the process dies with the request still in flight — part 1 changes nothing.

## Two engine constraints worth knowing before you design this

- **In the editor, a deferred quit is not supported.** Returning `false` from `wantsToQuit` does
  not stop play mode ending. The plugin's own handler documents this and takes the same branch
  (`Application.isEditor` → tear down immediately, return `true`). So **stopping play mode will
  always leave the run un-ended** — that is an editor limitation, not a bug in the integration,
  and it must be stated plainly rather than chased.
- **The plugin subscribes `wantsToQuit` too**, from `LudeoUnityManager.Awake`, and its handler
  calls `DeInit()` → `LudeoManager.Shutdown()`. Subscribing before `Initialize()` makes your
  handler run first, but the plugin's still runs on the same pass, and in a build it allows only
  ~60 ms before quitting. **Do not rely on the quit path as the primary place to close a
  recording** — hook the game's own "player chose to quit" site as well, which fires before
  `Application.Quit()` and has real time to work with.

## Guard the quit flag against surviving editor statics

The "already handled" flag is static, so with domain reload disabled it survives into the next
play session and the second run silently skips its cleanup. Reset it in the bootstrap alongside
the controller. See [[verify-the-define-fence-before-citing-a-hook]] for the general habit of
re-checking what survives between play sessions.

## How this was found

The headless compile gate was clean; the C# reads correctly; the game played fine. It surfaced
only from the SDK's own log during the human run gate. **Grep the run log for
`Canceled`, `still alive at shutdown`, and `still holding a handle` after any session-teardown
work** — those three strings are the signature.
