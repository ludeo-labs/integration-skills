---
category: common-mistakes
tier: universal
sourceGame: PlatformerSample
phase: "3,5"
question: null
sanitized: true
---

# Never issue an SDK call from inside an SDK callback

The natural shape for teardown is to close the room the moment the session end lands:

```csharp
player.AbortGameplay(data =>
{
    Log(data.resultCode);
    CloseRoom(onDone);        // <-- called from INSIDE the SDK's callback dispatch
});
```

It reads correctly, it satisfies "every exit closes its room", and it works most of the time.
Then the process dies with **no managed exception and no Unity crash log**:

```
Faulting module: ucrtbase.dll   Exception: 0xc0000409   Exception data: 0x7
```

`0xc0000409` with data `7` is `FAST_FAIL_FATAL_APP_EXIT` — native `abort()`. Windows Error
Reporting keeps a minidump; Unity's own handler is bypassed entirely, so nothing appears in the
player log except the SDK's last line.

## Why it happens

The SDK reacts to the same session-end event by tearing down its **video encoder**. Issuing the
next SDK call from inside its callback dispatch puts both on the same tick. Two runs of the same
death, in one session, one survived and one did not:

```
SURVIVED   :717  VideoEncoder0: Shutting down          <- encoder finished
           :734  Entering callbackId 4  -> our Room_Close    (17 ms later)

CRASHED    :281  Entering callbackId 9  -> our Room_Close    <- inside the dispatch
           :281  Finished callbackId 9
           :282  VideoEncoder1: Shutting down  -> abort()
```

Same code, same path, 17 ms of daylight versus none.

**Stated limit.** The native cause is never visible from outside — WER keeps a minidump with no
symbols, and the SDK logs nothing after the encoder line. What is established is the *edge*: a call
that entered from inside a callback dispatch, then abort() at encoder shutdown, on every death
observed; and removing the edge removed the crash. Do not claim more than that in a commit message.

## The rule

**Never issue an SDK call from inside an SDK callback.** Yield a frame first:

```csharp
player.AbortGameplay(data => { Log(data.resultCode); CloseRoomNextFrame(onDone); });
```

A `MonoBehaviour` you already own (the DontDestroyOnLoad host that exists for
`OnApplicationQuit`) is the natural place for the one-frame trampoline. Keep a synchronous
fallback for the quitting case — during `OnApplicationQuit` there is no next frame, so a
coroutine would silently drop the close. See
[[ending-a-recording-is-async-do-not-shut-down-on-the-next-line]] for the other half of the
quit-path problem.

## One trampoline is not the rule — audit every edge

The trampoline above was written, shipped, and believed to have closed this out. The same crash
came back later on a *different* edge, in the play flow: selecting a Ludeo while a capture was
recording reached the teardown from inside the `GetLudeo` callback, so `GameplaySession_End` was
issued from that dispatch instead.

```
:145  Entering callbackId 4                        <- the SDK's GetLudeo callback dispatch
:147    our AbortGameplay -> GameplaySession_End    <- issued from INSIDE it
:148  Finished callbackId 4
:412  StopVideoRecording
:414  VideoEncoder0: Shutting down   -> abort()
```

Fixing the edge that crashed is not fixing the rule. Enumerate every place your layer runs inside
an SDK dispatch and issues an SDK call, and defer all of them:

- teardown chained off End/Abort (the one everybody finds)
- the Ludeo-selected notification issuing `GetLudeo`
- the `GetLudeo` callback opening a room, or tearing down a live run first
- the back-to-menu / pause notifications reaching the same teardown
- Activate and consent callbacks opening the creator room
- RoomReady and AddPlayer callbacks reaching `BeginGameplay`

The begin/restore edges in that list are load-bearing for gate ordering, so deferring them is a
separate decision with its own risk — but they belong on the audit list, not out of mind.

## The edge that does not look like an SDK call

The `onDone` continuation you hand out of a callback is an SDK call site. It reads as a completion
signal, so it survives the audit; on the play path it *opens the next room*.

```csharp
room.CloseRoom(data =>
{
    ludeoRoom = null;
    onDone?.Invoke();      // <-- on the play path this is OpenRoom, still inside the dispatch
});
```

Defer the visible call and invoke the continuation inline and you have moved the violation one link
down the chain, not removed it. The trampoline goes on both.

## Defer the SDK call, not the bookkeeping

Teardown entry points usually carry an idempotence guard, because exit hooks double-fire (a scene
loader and the level's own teardown both calling it for one run). Wrap only the SDK calls — latch
the flags synchronously:

```csharp
if (teardownDone) { onDone?.Invoke(); return; }
teardownDone = true;                 // NOW: the second call this frame must see it
ClearRunFlags();
RunNextFrame(() => { StopTrackingAll(); gameplay.AbortGameplay(onDone); });
```

Deferring the whole body instead reopens the double-teardown bug the guard exists to prevent.

## How to catch it

The signature is a run log whose **last line is the SDK's encoder shutdown**, with the managed
completion log missing. Check the Windows Application event log for `Application Error` entries with
`0xc0000409` before assuming the player simply closed the game — a killed process and a crashed
process look identical in a truncated log.

The event log also tells you *which kind* of problem you have. Compare the WER **fault bucket**
across runs:

- **Same bucket every run** — same abort site, and the callback→SDK gap is ~0 ms every time because
  the chain is synchronous. It reproduces on demand, and you can find the edge by reading the code.
- **Intermittent** — a real timing race with occasional daylight. Here "it worked when I tested it"
  is worthless evidence, and the absence of a crash proves nothing about the edge.

Both are the same defect. Only the second one lets you talk yourself out of fixing it.
