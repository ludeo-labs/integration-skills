---
category: architecture
tier: generalizable
sourceGame: ActionAdventureSample
phase: 3
question: "Does the game have a central game-state enum plus a state-change notification that most of its non-interactive segments (menus, shops, dialogue, cutscenes, upgrade screens, map) announce themselves through?"
sanitized: true
---

# Drive `StartNoneLudeable`/`StopNoneLudeable` off a state-change event, as a state machine — not as paired enter/exit call sites

When a game funnels its non-interactive segments through one global state setter, subscribe **once** to
its change notification and derive the span from the **state transition**, instead of editing each
segment's enter and exit sites.

```csharp
// game-side (already exists in games with this shape)
public enum GameState { Playing, Paused, Cinematics }
public void SetState(GameState s) { m_state = s; StateChanged?.Invoke(s); }
```

```csharp
// [Layer] — one subscription, zero game-file edits for the whole non-ludeoable surface
enum Span { None, NonLudeoable, Paused }
Span m_span = Span.None;

void OnStateChanged(GameState s)
{
    if (!m_data.isGameplayActive || m_selfDrivenStateChange) return;
    Span want = s == GameState.Playing ? Span.None
              : s == GameState.Paused  ? Span.Paused
              :                          Span.NonLudeoable;
    if (want == m_span) return;
    Close(m_span);      // SendAction("StopNoneLudeable") or "ResumeLudeo"
    Open(want);         // SendAction("StartNoneLudeable") or "PauseLudeo"
    m_span = want;
}
// EndGameplay/AbortGameplay → Close(m_span); m_span = Span.None;
```

## Why the state machine, not paired calls

- **Dangling spans become structurally impossible.** The phase-3 gate requires "no dangling
  non-ludeoable on `End`". With paired call sites you have to prove every `Start` has a reachable
  `Stop`; with a transition machine the invariant holds by construction, and the unconditional close on
  `End`/`Abort` finishes the job.
- **Real games have unbalanced exits, and they are hard to find.** In the source integration, one UI
  screen deliberately *skipped* its return-to-`Playing` transition on a specific branch (closing the
  screen straight into a teleport), so the game genuinely went `Paused → Cinematics` with no `Playing`
  in between. A paired design would have leaked the span — silently disabling capture for the rest of
  the run. The machine handles a non-`Playing` → non-`Playing` transition as "close one, open the
  other". **Test this case explicitly; it is not hypothetical.**
- **Commented-out state calls are harmless.** Several dead `SetState` lines existed in the codebase; a
  state-driven machine never sees them, whereas a call-site design would have hung waiting on the
  missing exit.
- **It collapses the search.** Segments that *look* unresolvable by name (a shop, dialogue, an altar,
  an upgrade screen) usually turn out to route through the same setter — so the real phase-3 work is
  grepping for `SetState(` **once** and classifying the results, not pinning enter/exit per feature.

## Two preconditions to verify before relying on it

1. **The notification is on a lazily-created singleton.** Subscribe from the first gameplay hook (the
   level-start call), **not** from `[RuntimeInitializeOnLoadMethod(BeforeSceneLoad)]` — touching the
   singleton there force-creates it earlier than the game does, changing startup behavior.
2. **Guard the layer's own `SetState` calls.** If the integration itself sets a non-`Playing` state to
   suppress the sim during restore, that fires the same notification and the layer emits
   `StartNoneLudeable` **at its own restore**. Wrap layer-issued state writes in a
   `m_selfDrivenStateChange` flag.

See also [[classify-non-ludeoable-by-whether-the-sim-actually-freezes]].
