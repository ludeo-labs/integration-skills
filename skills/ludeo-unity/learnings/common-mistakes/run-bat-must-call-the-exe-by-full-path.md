---
category: common-mistakes
tier: universal
sourceGame: RoomActionSample
phase: 7
question: null
sanitized: true
---

# `run.bat` must call the exe by its full path (`"%~dp0Game.exe"`)

The phase-7 `run.bat` did `cd /d "%~dp0"` and then `"Game.exe" -logFile - %*`. Launched from another folder in the
agent's shell it failed with *'"Game.exe"' is not recognized*, although the exe sat next to the `.bat`. The shell had
`NoDefaultCurrentDirectoryInExePath=1` set (a hardening option some sandboxes and machines use): `cmd` then does not
look in the current directory for a bare program name, so the `cd` does not help.

Don't rely on the current directory at all:

```bat
@echo off
cd /d "%~dp0"
"%~dp0Game.exe" -logFile - %*
```

Keep the `cd` (the game may resolve paths relative to its folder) and call the exe directly, not through `start`, so
stdout still reaches the cloud runner. When smoke-testing locally, launch it through a tiny wrapper
(`call "<path>\run.bat" > out.txt 2>&1`) — `cmd /c` with a quoted path plus a redirect can mangle `%~dp0` and give a
false failure.
