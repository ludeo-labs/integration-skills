---
category: architecture
tier: generalizable
sourceGame: ActionAdventureSample
phase: 3
question: "Are you choosing the SDK-readiness gate's 'ready cover', and is the game's existing fade/loading primitive driven by a fixed-length animation clip?"
sanitized: true
---

# The readiness-gate cover: gate the game's own grant-of-control signal; the existing fade usually cannot be held

`LAUNCH-AND-READINESS.md` says to hold the first interactive/recorded frame behind a "ready" cover.
The tempting reuse is the game's existing fade-in or loading screen. **Check whether it can actually be
held before planning around it.**

In the source integration the fade helper was a `MonoBehaviour` playing a fixed-length legacy
`Animation` clip, firing its completion callback when `normalizedTime >= 1.0f`, with an
execute-once latch. There is no pause, no extend, no re-trigger — so it cannot absorb an
indeterminate SDK wait. A video/intro *scene* is worse: loading it disturbs the very flow the cover
exists to hide.

## What to do instead

**Gate the game's own grant-of-control signal.** In games that gate the player and AI on a global
state enum (a very common shape — check `CODE_MAP.input_ai.controllability`), the transition into the
playing state *is* the first interactive frame. Replace that one call with a layer-mediated version:

```csharp
// game, at the grant-of-control site (typically inside the fade-in completion callback)
LudeoGameHooks.EnterPlaying(() => gameState.SetState(GameState.Playing));
```

```csharp
// [Layer] — runs it now if the gate is open, else queues exactly one pending action
public static void EnterPlaying(Action grantControl)
{
    if (Gate.IsOpen) grantControl();
    else             Gate.Pending = grantControl;   // flushed on release
}
```

The level still **loads and fades in exactly as before** — only control is withheld. That is the
doctrine ("don't gate the level load") satisfied with a one-line game edit, and it reuses the game's
own suppression rather than inventing a second one.

Add a **layer-owned cover** for the worst case only: build a `DontDestroyOnLoad` `Canvas`
(`ScreenSpaceOverlay`, a very high `sortingOrder`) with one opaque `Image` in code, show it if the gate
is still held when the fade completes, hide it on release. When the SDK resolves inside the fade window
— the normal case — it is never seen; it exists so a timed-out gate is a clean black hold instead of a
live-looking level the player cannot control.

## Details that bite

- **The gate is a once-per-app-run latch.** Once `Activate` resolves either way it stays open, so only
  the first level entry after boot can ever be held. Say so in the plan — it stops reviewers looking
  for per-level gate logic.
- **Keep intent-recording separate from the gate.** The `wantCapture` flag + re-fire of `OpenRoom` from
  `PlayerConsentUpdated` is what actually fixes the silent-no-op consent race. The cover is UX. Ship
  both, but do not let one imply the other.
- **The play path holds the same deferral for a different reason.** Under `IsInLudeoFlow`, the queued
  grant-of-control is released by the restore's `onRoomReady` (after apply → unfreeze → `Begin`), not by
  the creator gate. **Bound it too** — a restore that never completes must release uncaptured rather
  than hold control forever.
- **Watch for a helpful accident.** If the grant-of-control site already skips when the state is
  "cinematics", and the restore suppression sets exactly that state, the game declines to grant control
  during a restore on its own. Verify it rather than assume it, then rely on it.

## ⚠️ Audit for MULTIPLE grant-of-control sites — the obvious one often guards itself out

The trap, found at a compile+run gate rather than at planning time: the level manager's grant-of-control
is usually **conditional**, and the conditions are exactly the cases that matter.

In the source integration the level manager granted control only when the state was *not* "cinematics"
and no teleport was pending. Both exclusions were live on real paths:

- the **intro controller** set "cinematics" in its own `Start()`, so on a **fresh run** the level
  manager deferred and an intro coroutine handed control over instead — i.e. the boot path, the one
  case the readiness gate exists for, bypassed the gate entirely;
- **teleport arrival** was excluded for the same structural reason, so a warp handed control back from
  the teleport's own coroutine.

Both were one-line fixes once found. Neither broke capture, the session, or exit handling — the failure
mode is quiet: the player simply gets control a beat before `Begin`, so the opening moments go
unrecorded and a held gate does nothing.

**How to audit properly:** grep every site that transitions *into* the playing state, then classify each
one — most are **resumes** (closing a shop, ending dialogue, un-pausing, finishing a mid-run cutscene)
and must **not** be gated. What you are looking for is every site that can be the **first** grant of
control for a run. Expect more than one. Then read the level manager's own grant for `if` conditions:
each condition is a hint that some *other* site owns that path.

**How to detect it if you shipped the wrong assumption:** log inside the gate when it defers. If that
"holding" line never appears in a run where the gate should have been exercised, the gate is not on the
path you think it is. An absent log line is evidence — chase it instead of assuming the timing was
simply favourable.
