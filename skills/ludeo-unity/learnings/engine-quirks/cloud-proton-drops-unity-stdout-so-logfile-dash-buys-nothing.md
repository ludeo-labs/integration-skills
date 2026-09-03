---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: 7
question: "Is the build going to the Ludeo cloud (Proton/umu runner)? Then check whether the game's own Unity log actually reaches the collected artifacts before relying on `-logFile -`."
sanitized: true
---

# The cloud drops Unity's stdout: `-logFile -` collects nothing, and the SDK's lines are not stdout either

Phase 7 tells you to launch from `run.bat` with `-logFile -` so Unity's `Debug.Log` reaches
the cloud runner's stdout collection, and explicitly says no game-side code is needed —
"don't add a `Debug.Log`→`OutputDebugString` forwarder". On the Proton/umu cast runner that
is wrong, and it costs you exactly the logs you need most.

Measured on one cast session (a Unity Mono player, `run.bat` with `-logFile -`):

- `steam-game.log`: 668 lines, **all** from the Ludeo SDK, every one arriving as
  `warn:seh:OutputDebugStringA/W`.
- Unity markers in that file — `Mono path`, `Initialize engine`, `GfxDevice`, `UnityEngine`,
  `<Game>_Data` — **zero hits**.
- `find /home/ubuntu -iname 'Player*.log'` → nothing. (`-logFile -` means Unity writes no
  `Player.log` at all, so you lose that fallback too.)
- The session's own `<session>.txt` is umu-launcher/protonfixes output only.

**Why the SDK's lines survive and yours don't:** the SDK does not rely on stdout either. Its
native logger writes to the Windows debug channel *and* opens its own websocket —
`wss://log-collector.ludeo.com?...` — which is what actually feeds Coralogix. The game is
launched as `explorer.exe /desktop=... cmd /c run_command_wrapper.bat .../run.bat`, and the
Unity process's stdout does not survive that chain into any collected artifact.

**Consequence:** the cloud is the one environment you cannot observe — and cloud-only bugs
are precisely the ones that need observing. You end up guessing at a restore you have no
trace of.

## The fix: mirror your own lines onto the debug channel

One small runtime class, Windows-player only, hooked to `Application.logMessageReceived`:

```csharp
[DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
static extern void OutputDebugStringW(string message);

// mirror our own prefixed lines + every Error/Exception/Assert from anywhere in the game
if (message.StartsWith("[Ludeo]") || type is LogType.Error or LogType.Exception or LogType.Assert)
    OutputDebugStringW(message + "\n");
```

Filter it. Under Proton each call lands **four times** in the log (A and W variants × the
`OutputDebugString` and `dispatch_exception` channels), so mirroring ordinary game
`Debug.Log` buys volume and nothing else. Prefixed integration lines plus errors is the
useful set.

## Also worth doing: don't let your restore-verification be compile-gated

If the restore self-check is `[Conditional("DEVELOPMENT_BUILD")]`, the release build the
cloud runs has neither the calls nor the delegates — so at the exact moment a cloud-only
bug appears, the instrument built to explain it is absent. Put it behind a **runtime flag**
(`-ludeo-verify`, passed by the `run.bat` that ships in the build) instead: still off for
real players, available on the artifact that is already uploaded.

Keep `-logFile -` anyway — it is correct on any runner that does collect stdout, and it
costs nothing. Just do not believe it is giving you a log until you have grepped the
collected file for a line only your game could have printed.
