---
category: engine-quirks
tier: universal
sourceGame: ActionGame
phase: 1
question: null
sanitized: true
---
# BP Inspector commandlet must silence LogSlate — `-nullrhi` alone is not enough

## What happened
Running the BP Inspector commandlet on ActionGame (UE 4.x source-built engine) generated `Saved/Logs/ActionGame.log` at ~17,000 lines/second. Log reached ~1.93 GB in minutes and broke the IDE (VS Code / file-watcher choked on a growing multi-gig file).

100% of the spam was:
```
LogSlate: Warning: Slate: Had to block on waiting for a draw buffer
```

## Why `-nullrhi` alone doesn't prevent this
`-nullrhi` substitutes a null RHI (Renderer Hardware Interface) so no real GPU work runs. But Slate (UE's UI framework) still attempts its own drawing pipeline in commandlet mode. When it can't get a draw buffer, it logs a Warning — every tick, 17k times per second. The warning is harmless (no actual rendering is happening) but the log spam is catastrophic.

## The fix
Add `-LogCmds="LogSlate off"` to the commandlet invocation. This disables the entire LogSlate category.

Full invocation pattern:
```
UE4Editor-Cmd.exe Project.uproject -ExecutePythonScript=... -stdout -unattended -nopause -nullrhi -LogCmds="LogSlate off"
```

## Applies to
Any UE editor commandlet invocation, not just the BP Inspector. If you add other Python / commandlet tools, apply the same flags.

## How to detect
Look at log growth rate during commandlet runs. Anything more than ~1 MB/sec sustained indicates spam — usually a single Warning category looping at tick rate. `awk` / `grep` the log by message to identify the offender, then add `-LogCmds="<Category> off"` to silence it.
