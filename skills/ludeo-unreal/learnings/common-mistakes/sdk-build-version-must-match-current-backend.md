---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 3
question: "What C SDK BUILD (the `LudeoSDK vX.Y.Z, GitHash:…, Build <date>` line) does a CURRENTLY-WORKING integration on this machine/account log, and does the SDK you're using match it? An older bundled C SDK can fail against a newer live backend with RoomReady never firing."
sanitized: true
---

# The C SDK BUILD version must match the current backend — a stale bundled SDK breaks RoomReady silently

## What happened (Lyra, log-verified across ~6 runs)

Creator-flow recording never started: activation OK, Creator room opened, `AddPlayer` succeeded, then:
```
[Ludeo] Session: Session0: Received event ludeo-play-ready
[Ludeo] Session: Warning: Session0: unknown event_name "ludeo-play-ready"
```
`RoomReady` **never broadcast** (0 times), so the N-way gate never latched and `BeginGameplay` never
ran. A known-good integration (BattleSail) on the **same machine, same account, same Creator flow**
received `Received event RoomReady` → `Broadcasting RoomReady` → began gameplay.

The ONLY difference was the **C SDK build**:
- Broken: `LudeoSDK v4.1.0.0, GitHash:e7e84549, Build 2026-05-24` (bundled inside the LudeoUESDK
  **4.3.0** release plugin — the `.uplugin VersionName` is the UE-WRAPPER version, NOT the C SDK version).
- Working: `LudeoSDK v4.2.0.0, GitHash:a9c66db9, Build 2026-06-11` (from the known-good project).

The live backend had moved on to an event protocol (`ludeo-play-ready`) that the **older** C SDK build
didn't recognize, so it never translated it into the `RoomReady` notification. Swapping in the newer
C SDK (copy the whole `Plugins/LudeoUESDK` from the working project) fixed it immediately.

## The rule

The C SDK is versioned **independently** of the UE wrapper plugin. A release plugin (e.g. "4.3.0")
can bundle a C SDK build that is already too old for the **current** Ludeo backend. Symptoms of a
stale C SDK against a newer backend: an SDK notification that should fire just doesn't, often with a
`unknown event_name "…"` warning right where the expected event should be.

**Before deep-diving a "notification never fires" bug, compare the C SDK BUILD line against a
currently-working integration:**
1. Grep your run log for `LudeoSDK v` — note version + GitHash + Build date.
2. Grep a KNOWN-GOOD recent integration's log (same backend/account) for the same line.
3. If the build dates/hashes differ and yours is older, **use the working project's
   `Plugins/LudeoUESDK` wholesale** (wrapper + C SDK) before theorizing about backend config, game
   IDs, room timing, or your own lifecycle. This is faster and more decisive than any of those.

## Don't misattribute

The same symptom (RoomReady never fires) invites wrong theories that waste hours: per-game Studio-Labs
config, room-open timing, the overlay `failed to parse gameplays.gameplay-ready` warning (a red
herring — a known-good run shows it too), auth. None were the cause here; the C SDK build was. The
integrator (a platform engineer) explicitly stated nothing was keyed to the event per-game.

## Packaging gotcha

After swapping the SDK, a **clean** repackage is required — delete `PackagedBuild` + `Saved/StagedBuilds`.
Incremental staging silently keeps the OLD C SDK DLL (it compares timestamps and skips "older" source
DLLs), so the package keeps reporting the stale `LudeoSDK vX` even though the wrapper rebuilt. Verify
the package by grepping its log for the expected `LudeoSDK v…` line. (See
[[stale-package-masquerades-as-missing-feature]].)

## Cross-references

- [[diff-against-reference-sample-when-runtime-signal-missing]] — diff the working integration first;
  here the decisive datum was its `LudeoSDK v…` log line.
- The earlier session learning that blamed room-open timing for this exact symptom was a
  misdiagnosis — see [[open-creator-room-at-level-load-not-on-phase]] (corrected).
