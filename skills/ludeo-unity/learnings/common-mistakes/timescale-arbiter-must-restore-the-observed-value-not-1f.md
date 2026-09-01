---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 3
question: "Before planning the CR-010 freeze / CR-011 overlay pause, did you grep every Time.timeScale write in the game — and did any of them write a value that is neither 0 nor 1?"
sanitized: true
---

# A `Time.timeScale` arbiter must save and restore the **observed** value — resuming with `1f` is itself a bug

The reference wiring is `PauseGameRequested → Time.timeScale = 0f` / `ResumeGameRequested →
Time.timeScale = 1f`. That is correct only for a game whose `timeScale` is always 0 or 1. **Grep the
game first.** In the source integration the audit found **22 write sites across 15 files**, and several
wrote *non-binary* values:

- hit-stop / impact freeze on a hit or block (a few frames at a designer-tuned scale),
- boss-kill slow-motion (`Time.timeScale = m_KillTimeScale`),
- tutorial slow-downs (`Time.timeScale = m_TimeScale`),
- a debug time-scale controller.

Resuming with a hard `1f` cancels any of those mid-effect, and also *un*-pauses a game that the player
had legitimately paused through its own menu. The failure is intermittent and cosmetic-looking, so it
survives a smoke test.

## The arbiter

```csharp
bool m_restoreFreeze;   // CR-010
bool m_overlayPause;    // CR-011  — two INDEPENDENT flags, never one boolean
bool Paused => m_restoreFreeze || m_overlayPause;
float m_savedTimeScale;
bool  m_applied;

void Apply()
{
    if (Paused && !m_applied)  { m_savedTimeScale = Time.timeScale; Time.timeScale = 0f; m_applied = true;  }
    else if (!Paused && m_applied) { Time.timeScale = m_savedTimeScale;                   m_applied = false; }
}

// [DefaultExecutionOrder(30000)] on the layer's persistent MonoBehaviour
void LateUpdate() { if (m_applied && Time.timeScale != 0f) Time.timeScale = 0f; }

void ResetForNewRun() { m_restoreFreeze = m_overlayPause = m_applied = false; }
```

Three parts, all load-bearing:

1. **Save/restore the observed value.** The arbiter's contract is "leave `timeScale` as I found it".
2. **Re-assert every frame while paused, from an explicitly-last execution order.** Games routinely
   reset `Time.timeScale = 1.0f` unconditionally on level restart, menu close, game-over, and tutorial
   teardown. Any one of those firing mid-restore silently unfreezes the sim and lets it overwrite
   restored state. A `LateUpdate` at `[DefaultExecutionOrder(30000)]` corrects it on the same frame,
   before the next `FixedUpdate`. Without the explicit order attribute, `LateUpdate` ordering between
   scripts is unspecified and the fix is a coin flip.
3. **`ResetForNewRun()` at bootstrap *and* in the per-restore hook.** A persistent-singleton layer
   carries a stale pause flag across replays; bootstrap does not re-run on a second replay.

## Also plan a non-`timeScale` suppression path

Where the game already gates player input and AI on a global state enum, setting a non-playing state
during the restore apply suppresses both **without new plumbing** — and it keeps working in the frames
where a game writer briefly wins the `timeScale` race. It is also the required fallback when the apply
is async: `Time.timeScale = 0f` around an awaited/coroutine spawn deadlocks (`FixedUpdate` never runs),
so suppression, not the freeze, has to be the overwrite guard there.

See also [[non-ludeoable-spans-as-a-state-machine-not-paired-calls]] — the same state enum is the lever,
so remember the self-driven-state-change guard.
