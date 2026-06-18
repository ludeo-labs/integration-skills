---
category: common-mistakes
tier: generalizable
sourceGame: EndlessFPS
phase: 2
question: "Is the integration verified in a FRESHLY re-cooked package, or only in editor PIE? A cooked build embeds the plugin/game binaries at cook time — code from later stages is NOT in a package cooked earlier. For packaged/cloud-build targets, re-package (BuildCookRun) after every code stage before the runtime gate."
sanitized: true
---

# A stale package looks exactly like a missing feature — re-cook before debugging

## Precondition

The project produces packaged/cooked builds (`packagingTarget` is `packaged` or `cloud-build`) and a package was cooked at an earlier stage. (Editor-only projects never hit this.)

## What happened

Stage 5 worked perfectly in editor PIE (restore, actions, pause/inventory segment marking all verified). The integrator then ran the **packaged** build and reported the opposite: "Ludeo didn't pause, actions weren't tracked, didn't even restore." It read as a Stage 5 (and Stage 3/4) regression.

It was not a code bug. The package on disk had been cooked back at Stage 2 and never re-cooked. PIE loads the freshly-compiled editor DLLs; the packaged `.exe` embeds the game/plugin binaries **as of the cook**. So the package contained only Stage 2 — the Player Flow stub (no restore), no actions, no segment marking.

## How to diagnose in seconds (before touching code)

1. **Timestamp check.** Compare the packaged game binary mtime against the source:
   `PackagedBuild/.../Binaries/Win64/<Game>.exe` vs `Plugins/.../Source/.../*.cpp`. If the binary predates the code, the package is stale — stop, re-cook.
2. **Grep the packaged log for ghosts.** A stale build prints log strings from old code that no longer exist in source. Grep the package's `Saved/Logs/*.log` for a known old stub message (e.g. an early "…lands in Stage 3" placeholder). If a string that's gone from source still appears in the log, the binaries are stale.
3. Absence of expected new log lines (no `Action: …`, no `StartNoneLudeable`) corroborates it.

## The rule

- Code edits do **not** reach a previously-cooked build. After every code-producing stage, a packaged/cloud-build target must be **re-cooked** (`RunUAT BuildCookRun -build -cook -stage -pak …`) before runtime verification.
- The per-stage human-verification gate (Step 7b) for these targets must explicitly say **"re-package, THEN test the package"** — PIE success is necessary but not sufficient for a packaged target.
- Proactively flag staleness: if the on-disk package predates the current source, say so up front instead of treating the package run as a code result.

## Tooling note

If a wrapper batch script (e.g. `BuildAndPackage.bat`) ends with `pause`, it hangs a non-interactive/background run — invoke `RunUAT.bat BuildCookRun` directly with the same flags when launching it programmatically.
