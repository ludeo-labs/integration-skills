---
category: engine-quirks
tier: generalizable
sourceGame: RoguelikeSample
phase: "7,8"
question: "Chasing a crash on a Ludeo cast machine and only pulling /home/ubuntu/game-logs/<session>/? Unity's crash dump is not there — it is inside the Docker container, in the Wine prefix, and the container is deleted when the session ends."
sanitized: true
---

# The cloud crash dump lives inside the container, not the session log folder

The three files in `/home/ubuntu/game-logs/<session>/` — `steam-game.log`,
`selkies-gstreamer.log`, `<session>.txt` — contain **no crash dump**. Unity writes its dump into the
Wine prefix, which lives inside the game's Docker container:

```
/home/ubuntu/runner/proton/compatdata/pfx/drive_c/users/steamuser/
    AppData/Local/Temp/<Company>/<Product>/Crashes/Crash_<timestamp>/crash.dmp
```

Pulling only the session folder costs hours: you end up inferring a root cause from a single
`warn:seh` backtrace line in `steam-game.log` instead of reading the exception record. Worse, the
Wine log raises the *same* exception code in benign paths, so "the only exception in the file" is not
evidence of the crash — in one session the game logged happily past an identical raise.

**The container is removed when the session ends**, so this is only recoverable while it is up.
Check `docker ps` first; if the container is gone, the dump is gone with it.

## Getting it out

```powershell
$t='/home/ubuntu/runner/proton/compatdata/pfx/drive_c/users/steamuser/AppData/Local/Temp'
# tar + base64 through ssh: the path has spaces, and base64 survives the shell chain intact
cmd /c "gcloud compute ssh `"ubuntu@$m`" --zone=$zone --project=$proj --internal-ip ``
  --command=`"sudo docker exec $session sh -c 'cd $t && tar czf - <Company>*' | base64 -w0`" > crash.b64"
```

Then decode and untar locally. Quoting notes that cost real attempts: a remote `$(...)` gets expanded
by the *local* PowerShell, and a path containing spaces is split by the nested `sh -c` no matter how
you quote it — use a trailing glob (`<Company>*`) rather than quoting the space.

## Reading it without a debugger

A minidump's exception record and module list parse in ~30 lines of Python: header at offset 0
(`MDMP`, stream count, directory RVA), directory entries of `(type, size, rva)`, stream type **6** is
the exception (`ThreadId`, then `ExceptionCode`, `ExceptionFlags`, `ExceptionRecord`,
`ExceptionAddress`), stream type **4** is the module list (112-byte entries; `ModuleNameRva` at +20
points at a length-prefixed UTF-16 string). Matching `ExceptionAddress` against module ranges names
the faulting module, and the module list alone tells you which subsystems were live — that is what
identified Media Foundation as the culprit here.

## Two things worth doing before the next crash, not after

- **Write a real `Player.log`.** `-logFile -` collects nothing on this runner *and* suppresses
  `Player.log`. Point it at a file inside the container's mapped log dir instead, and it lands in the
  session folder you already fetch — with Unity's own crash output in it.
- **Add the container crash path to your fetch script**, so a dump is captured automatically while the
  machine is still alive.
