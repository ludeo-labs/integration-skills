---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: "1,3,5,6"
question: "Are you writing tooling (or any .NET/PowerShell code) that reads Editor.log while the Unity editor is still running? The default file-open path throws 'used by another process' — you must open it with FileShare.ReadWrite, even though you are only reading."
sanitized: true
---

# Reading Editor.log while Unity is running needs FileShare.ReadWrite

Unity keeps `Editor.log` open for writing for the whole life of the editor process. Any .NET read
path that does not explicitly share the handle fails:

```powershell
[System.IO.File]::ReadLines($EditorLog)
# Exception calling "ReadLines" with "1" argument(s):
# "The process cannot access the file '…\Editor.log' because it is being used by another process."
```

`File.ReadLines`, `File.ReadAllText`, `Get-Content` and friends default to `FileShare.Read`, which
means *"I will tolerate other readers"* — not other **writers**. Unity is a writer. Open it with
`FileShare.ReadWrite` and it works fine:

```powershell
$stream = [System.IO.FileStream]::new(
    $EditorLog, [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$reader = [System.IO.StreamReader]::new($stream)
try   { while ($null -ne ($line = $reader.ReadLine())) { <# … #> } }
finally { $reader.Dispose(); $stream.Dispose() }
```

## Why it bites specifically here

The failure lands at the worst possible moment. **The live editor session is exactly when you want to
read the log** — the integrator has just played, the trace is fresh, and asking them to close Unity so
your tool can read a file is both absurd and destructive (the log is overwritten on restart, so
closing the editor to read the log can destroy the thing you were reading it for).

It is also easy to miss in testing, because every *casual* way of reading the file works. `grep`,
`cat`, `tail`, `Select-String` and most Unix-lineage tools open with full sharing, so a log-parsing
routine prototyped at the shell reads the live log without complaint — and then throws the moment the
same logic is moved into a script using the .NET API. The bug appears at the point where you stop
experimenting and start automating.

## Applies to more than one file

Same rule for `Player.log` while a build is running, and for any log you tail during a gate. If your
tooling reads an engine-owned log at all, make shared access the default in the helper you write once,
rather than something you remember per call site.

## Sanity check when the read comes back empty

A shared read of a live log is a snapshot of a moving file: it ends wherever the writer had got to.
That is normally what you want, but if you are looking for a line the integrator *just* triggered and
it is missing, the write may not have been flushed yet — re-read rather than concluding the line was
never emitted.
