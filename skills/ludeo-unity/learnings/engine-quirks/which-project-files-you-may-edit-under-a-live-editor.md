---
category: engine-quirks
tier: generalizable
sourceGame: PlatformerSample
phase: 4
question: "Are you about to edit a scene, prefab or ProjectSettings asset from outside Unity — and is the Editor open on that project right now?"
sanitized: true
---

# Editing project files under a live Editor: which are safe, and the PID check that lies to you

Phases 4–5 routinely edit serialized project data from outside Unity — minting identity fields into scene
YAML, restoring a build-list asset, fixing a serialized flag. With `ForceText` this is exact and fast, and
it beats driving the GUI. But **the Editor is a second writer**, and the three file classes behave
differently:

| File | Safe to edit while the Editor is open? | Why |
|---|---|---|
| A scene the Editor does **not** have open | **Yes** | No in-memory copy exists. The asset watcher reimports it on focus — the same thing that happens after a version-control checkout. |
| The scene the Editor **does** have open | **No** | The in-memory copy wins. Saving overwrites your edit; the human may also lose unsaved work to a reload prompt. |
| `ProjectSettings/*.asset` | **No** | Held in memory for the session and rewritten on *Save Project* and often on exit. The Editor never notices your change, then silently reverts it. |

So "is Unity running?" is the wrong question. **"Does Unity currently own this particular file?"** is the
right one, and for a closed scene the answer is no. That distinction let a nine-entry insert into two
*unopened* scenes proceed safely while the Editor sat on a third.

## The trap: `kill -0 <windows-pid>` from Git Bash always reports "gone"

The natural way to sequence the unsafe edits is "wait for the Editor to exit, then write." On Windows that
guard is easy to get wrong in a way that **fails open**:

```bash
while kill -0 "$PID" 2>/dev/null; do sleep 5; done    # $PID from a Windows process list
echo "Editor exited"                                   # ...prints immediately. It never exited.
```

Git Bash / MSYS keeps **its own PID namespace**. A Windows PID from `Get-Process`/`tasklist` is not an MSYS
PID, so `kill -0` returns non-zero on the first iteration and the wait falls straight through. The guard
reports success, the writes run against a live Editor, and nothing warns you. In the observed case the
process had been running ~46 hours while the script announced it had exited.

**Check a Windows PID with a Windows tool:**

```powershell
while (Get-Process -Id $PID -ErrorAction SilentlyContinue) { Start-Sleep 5 }
```

Also verify identity, not just existence — Windows reuses PIDs. `Get-Process -Id N | Select StartTime`
distinguishes "the same long-lived process" from "a new process that inherited the number", and a start
time far in the past is the tell that your wait never really waited.

## Recover the right way: verify the disk, then say what is exposed

If it happens anyway, the write may well have landed — a background writer and the Editor are not
contending for a lock most of the time. Don't guess:

1. **Re-verify the artifact on disk** (content check, not mtime alone) — it is probably still correct.
2. **State the exposure precisely.** The edit is *unprotected*, not lost: a *Save Project* re-blanks the
   settings asset, a scene save re-clobbers the open scene. Give the one-line redo.
3. **Correct the earlier claim.** "Applied after the Editor was closed" becomes a false provenance note in
   the progress doc, and the next agent will trust it. Fix the document, not just the file.

## Two smaller things that bite in the same pass

- **Never write a backup inside `Assets/`.** A `Foo.unity.bak` next to the scene gets imported on the next
  focus, generating a `.meta` and an asset the team then has to delete. Back up to a temp directory outside
  the project.
- **Prefer a targeted YAML edit to the game's own "regenerate everything" helper.** An in-editor
  *GenerateIds*-style button re-mints **every** matching component in the scene; a script that fixes only
  the broken entries keeps the diff at the size of the actual defect and leaves every already-good id
  alone. Verify the edit is as small as you claim — for a same-width replacement, byte size and line count
  should be *identical* before and after; for an insert, the diff should be pure addition with a line count
  equal to `entries × lines-per-entry`.

Related: [[scene-script-guid-counts-overcount-via-stripped-prefab-components]] and
[[serialized-id-keys-collapse-where-the-id-minter-never-ran]] — the other two halves of reading and writing
scene YAML directly.
