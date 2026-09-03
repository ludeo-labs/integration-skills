---
category: engine-quirks
tier: generalizable
sourceGame: RoguelikeSample
phase: "7,8"
question: "Does the game ship any VideoPlayer with m_PlayOnAwake: 1 — especially one nested in an always-loaded UI canvas prefab? On a Ludeo cloud machine that runs under Wine, whose Media Foundation implementation is far less forgiving than Windows', and it can crash the build."
sanitized: true
---

# A looping `playOnAwake` video crashes the cloud build, and never the local one

The cloud build died mid-playback, reproducibly, on every machine. The dump was identical every time:

```
EXCEPTION_INVALID_HANDLE (0xc0000008)  at ntdll +0x66fe8
frames:  ntdll ×3 → rtworkq.dll +0x4dc6 → ntdll ×2 → kernel32 → ntdll
```

`rtworkq.dll` is the **Media Foundation real-time work queue**. The whole MF stack was resident in the
crashed process — `mfplat`, `mfreadwrite`, `Mf`, `mfmp4srcsnk`, `msmpeg2vdec`, `msauddecmft`, `msvproc`.

The cause was a tutorial-video popup nested inside the gameplay **UI canvas prefab**, carrying
`m_PlayOnAwake: 1` **and** `m_Looping: 1`, with **nothing in the codebase ever calling `Play()` on it**.
Autoplay was the only start mechanism, so the clip began on `Awake` at every gameplay-scene load and
looped forever behind a popup that was never shown — keeping MF in permanent seek-and-restart churn.
Setting `m_PlayOnAwake: 0` was the whole fix: five consecutive cloud replays clean, where the previous
build crashed every time.

## Why this is invisible until it isn't

- **It never reproduces locally.** Windows ships the real Media Foundation and tolerates the handle
  churn. Wine's implementation raises `EXCEPTION_INVALID_HANDLE`. Replaying successfully on a Windows
  machine is *not* evidence the path is sound — it is the expected result either way.
- **Nothing references it.** Grepping for `.Play()` call sites finds nothing to guard. The behaviour
  lives entirely in a serialized bool on a prefab.
- **Grepping the gameplay SCENE finds nothing either.** The VideoPlayer arrives at runtime through a
  UI canvas prefab, so `grep VideoPlayer <gameplay>.unity` returns zero and is misleading. Enumerate
  `m_PlayOnAwake` across **prefabs** as well as scenes.

## Do this

Audit before the first cloud build, not after a crash:

```bash
grep -rl "^VideoPlayer:" Assets --include=*.prefab --include=*.unity
# then for each hit, check the pairing that matters:
grep -A32 "^VideoPlayer:" <file> | grep -E "m_PlayOnAwake|m_Looping|m_VideoClip"
```

`m_PlayOnAwake: 1` together with `m_Looping: 1` on anything reachable from an always-loaded scene is
the shape to kill.

**A runtime guard that stops VideoPlayers is not sufficient**, and it is worth understanding why: by
the time you can call `Stop()`, Media Foundation is already initialised and its work-queue threads
live for the process lifetime. Stopping playback does not tear them down. Only never starting the
video avoids MF entirely. A guard is still worth shipping as an instrument — ours is what *found* this,
by logging the object it stopped within a second of each scene load — but do not mistake it for a fix.

## Trade-off to hand back, not decide

If `playOnAwake` was the only thing starting the video, turning it off means the popup shows a static
first frame when legitimately displayed. Something must call `Play()` on open. Flag it to whoever owns
that UI rather than silently changing what players see.
