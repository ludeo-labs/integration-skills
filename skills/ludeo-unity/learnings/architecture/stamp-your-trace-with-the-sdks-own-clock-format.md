---
category: architecture
tier: universal
sourceGame: TPSSample
phase: "3,5"
question: null
sanitized: true
---

# Stamp every integration log line with the SDK's own clock format

The Ludeo SDK writes its native log into the same Unity log your integration writes to, and **every
SDK line carries a UTC clock** in a fixed shape:

```
15:49:47:766:VideoEncoding:Log VideoEncoderManager: onCaptureVideoRequest. gameplayId=…
15:35:52:901:Http:Error Session3:BinWS:onRead: ec='stream truncated', transferred=0
```

`Debug.Log` adds no timestamp. So by default your integration's lines land in that same file
**naked**, and the two halves of the story cannot be put on one timeline:

```
[Ludeo] Reported 'BossKill'.            <- when? only "somewhere after the line above it"
```

Build the clock into the integration's trace helper on day one, in the **SDK's exact format**, and
send every level through it:

```csharp
static string Stamp() => System.DateTime.UtcNow.ToString("HH:mm:ss:fff");

public static void Step(string m)  => Debug.Log($"[Ludeo] {Stamp()} {m}");
public static void Warn(string m)  => Debug.LogWarning($"[Ludeo] {Stamp()} {m}");
public static void Error(string m) => Debug.LogError($"[Ludeo] {Stamp()} {m}");
```

UTC, not local — the SDK logs UTC, and a trace that mixes the two is worse than one with no clock at
all, because it looks comparable and isn't.

## Why this is worth doing before you need it

You will not feel the absence until you are asked a timing question, and by then the log that would
have answered it has already been written. In one engagement the same gap blocked **two separate
investigations in a single day**: when a recorder froze, and whether a piece of state was restored
before or after a game system overwrote it. Both were "read the log and see which came first", and
both were unanswerable.

The fallback is real but poor. You can date an unstamped line by its **position** between two SDK
lines and interpolate. That works — it is how one of those investigations eventually got its bracket
— but it is slow, it needs the whole log in a buffer, and its resolution collapses exactly where you
need it most: a burst of a hundred integration lines between two SDK lines all resolve to the same
instant, so the ordering *within* the burst is lost. Which is, of course, the ordering you were
asking about.

## Route every level through it, including the ones you add later

A single `Debug.LogWarning` left in a restore-checkpoint bypasses the helper and produces an unstamped
line in the middle of an otherwise clean trace — and warnings are disproportionately the lines you
come back to read. Give the helper `Warn` and `Error` from the start, not just `Log`, so there is
never a reason for integration code to call `Debug.*` directly.

Same reasoning for the prefix: keep one marker (`[Ludeo]`) on every line so the integration's trace
can be separated from both the SDK's and the game's with one grep.

## Snapshot the log while it still exists

The editor log is **overwritten when the editor restarts**, so the log covering an interesting session
exists in exactly one place until someone copies it. When a session produces something worth
investigating, copy the log out before doing anything that might restart the editor — including
asking the integrator to try again. Compressed, a session log is a couple of megabytes; it is the
cheapest evidence you will ever collect and the easiest to lose.
