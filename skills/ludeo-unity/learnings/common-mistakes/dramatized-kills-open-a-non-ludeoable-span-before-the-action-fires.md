---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 6
question: "Does the game dramatize its most important beats (boss kill, player death, finisher) with a cinematic state change — and does that state write happen BEFORE the kill/death call the action would be emitted from?"
sanitized: true
---

# A dramatized kill sets the cinematic state *first*, so the action lands inside the window the backend excludes

Phase 3 wires `StartNoneLudeable`/`StopNoneLudeable` off the game's state-change notification, and the
platform's one-time global-trigger mapping tells the backend to **exclude** those windows. Phase 6 then
maps actions independently. The two interact in a way neither phase sees on its own:

**Games dramatize their biggest beats by entering a cinematic state, and they do it BEFORE the code that
would emit the action.** A boss-kill sequence typically reads:

```csharp
protected IEnumerator KillCoroutine()          // on the boss base class
{
    PlaySound(deathSound);
    SetState(State.Cinematics);                 // ← non-ludeoable span OPENS here
    killPostProcessing.SetActive(true);
    Time.timeScale = dramaticSlowMo;
    yield return new WaitForSecondsRealtime(effectDuration);
    Time.timeScale = 1.0f;
    Kill(false);                                // ← the obvious emit point, now INSIDE the span
}
```

So `BossKill` — the single highest-value action in the game — is emitted into a window configured to be
thrown away. The same shape appeared on the player's death path (the death method set the cinematic state,
*then* activated the dead-state controller) and on a mid-boss whose kill deferred into an outro cutscene.

**It is silent.** The action emits, the log shows it, the span is correct, the mapping is correct — every
piece is individually right and the beat still doesn't score. Nothing fails.

## The variant you cannot find by reading code — and the one that actually bit

The boss case above was caught by static analysis. A second instance in the same game was **not**, and it
is the more instructive one: a **finisher/execution move** whose entire animation is a scripted cinematic.

The structure was a *wrapper* controller, one indirection away from anything that looked kill-related:

```csharp
// FinisherController.Activate(victim)   ← the span OPENS here
    victim.GetFinisherStateController().Activate(...);   // sets victim life to 0
    SetState(State.Cinematics);                          // ← span opens
    StartCoroutine(StopFinisher(victim));

// StopFinisher(), after WaitForSeconds(timeline.duration)
    victim.GetFinisherStateController().FinishFinisher();  // ← the obvious emit point, INSIDE the span
    SetState(State.Playing);                              // ← span closes
```

The natural emit point is the method literally named "finish the finisher" — and it is inside the window.
Worse, the state-machine class the emit lived in **contains no state write at all**; it also fires
designer-authored `UnityEvent` lists (`m_ExecuteOnActivate` / `m_ExecuteOnFinish`) whose contents live in
the **scene file**, not in code. So grepping the emit site's class for a state write returns nothing, and
the span is invisible from there.

**Only the runtime log revealed it**, as an unmistakable bracket:

```
SendAction("StartNoneLudeable")     ← span opens
  … 28k log lines / several seconds of finisher timeline …
SendAction("EnemyKilled")           ← both emissions land inside
SendAction("EnemyFatality")
SendAction("StopNoneLudeable")      ← span closes
```

**So: verify this at the gate, not only in the map.** Grep the gate log for each action's line number and
check it does not fall between a `StartNoneLudeable` and its `StopNoneLudeable`. It is a two-minute check
that no amount of code reading substitutes for. The fix is the same — emit on the last line before the
state write, in the *wrapper* (the victim's life is already zeroed by then, so the kill is decided).

## What makes it easy to miss

- The **ordinary** kill path is unaffected. Killing a regular enemy by depleting its life touches no state,
  so the action set looks fine at the gate — only the *dramatized* subset is swallowed, and those are the
  rarest captures to test.
- Phase 6's brief tells you not to re-scan non-ludeoable boundaries (read them from the phase-3 artifact) —
  correct advice that also means you never look at the *ordering* between a span and an action.
- The dramatic sequence is usually on a **base class or a coroutine**, one indirection away from the action
  site you picked.

## The check, and the fix

When mapping actions, for every kept action ask: **does anything on the path to this call site write a
non-`PLAYING` game state first?** Grep the enclosing method and its callers for the state setter.

Fix by **emitting before the state write** — at the top of the dramatizing method rather than at the kill
call it eventually reaches. The beat belongs to live gameplay; the cinematic that celebrates it is what
should be excluded. This costs nothing and needs no new machinery.

Do **not** "fix" it by suppressing the non-ludeoable span around kills — the span is correct, and
suppressing it would hand the backend a stretch of cutscene as scoreable gameplay.

## Related

- The span machinery this collides with: [[non-ludeoable-spans-as-a-state-machine-not-paired-calls]] and
  [[classify-non-ludeoable-by-whether-the-sim-actually-freezes]].
- A deferred `base.Kill()` inside the cutscene callback also delays or drops the action outright — the
  same override-doesn't-chain hazard as
  [[one-base-class-register-hook-misses-subclasses-that-skip-base-start]], on the action seam instead of
  the register seam.
