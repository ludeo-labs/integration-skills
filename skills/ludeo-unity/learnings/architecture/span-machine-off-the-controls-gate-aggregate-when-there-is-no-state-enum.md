---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: 3
question: "Is the game's only agency lever a controls-gate interface rather than a central GameState enum - and are you about to place StartNoneLudeable/StopNoneLudeable at each non-interactive segment's enter and exit sites?"
sanitized: true
---

# With no state enum, run the non-ludeoable spans as a POLLED 3-state machine over the controls-gate aggregate

[[non-ludeoable-spans-as-a-state-machine-not-paired-calls]] gets the shape right — spans as
transitions, not paired calls — but its lever is a `SetState` notification you can subscribe to.
[[controls-gate-interface-is-the-non-ludeoable-census-and-a-zero-edit-suppression-seam]] identifies the
alternative lever (a one-property `IControlsGate` interface ANDed by the player controller) but stops at
"the layer either polls the aggregate itself or derives spans from each gate's own state change".

This is the concrete machine for that case. It keeps the state-machine guarantee ("no dangling
non-ludeoable on `End`" holds *by construction*) with **zero game-file edits**, because the aggregating
controller usually exposes its collected list as a public field.

```csharp
enum Span { None, NonLudeoable, Paused }

Span Want()
{
    // (1) SELF-DRIVEN GUARD, freeze layer: our own restore freeze / overlay pause must never be read
    //     as the game's pause. Without it the integration emits PauseLudeo at its own restore.
    if (m_arbiter.IsLayerDrivenFreeze) return m_span;

    // (2) The freeze primitive is the Paused discriminator (per
    //     classify-non-ludeoable-by-whether-the-sim-actually-freezes).
    if (Time.timeScale == 0f) return Span.Paused;

    // (3) Anything else that removed player agency is a non-ludeoable window: the sim keeps running,
    //     tracking keeps running, the backend excludes it.
    return AnyForeignGateClosed() ? Span.NonLudeoable : Span.None;
}

void Tick()   // once per frame, only while the gameplay session is active
{
    Span want = Want();
    if (want == m_span) return;
    Close(m_span); Open(want); m_span = want;    // non-None -> non-None closes one, opens the other
}
```

## The exclusion list is the whole difficulty — expect exactly three kinds

`AnyForeignGateClosed()` walks the controller's public implementor list and skips:

1. **Our own gate** — the self-driven guard, one layer up from the freeze guard. The same layer object
   that suppresses input during the readiness gate and the restore *is* an implementor, so without this
   the integration opens a non-ludeoable span around its own restore.
2. **An implementor whose only `false` write is the death/game-over case.** In the source integration
   the HUD manager implemented the interface purely to lock input once the player was dead. Death is an
   `End`, not a span — and the emission is gated on "gameplay session active" anyway, so including it
   would only ever produce a spurious span in the frames between the death write and `End` landing.
3. **Implementors whose spans you deliberately DECLINED.** A short, frequent in-gameplay recovery beat
   (a water/pit respawn teleport, a knockback rebound) removes agency for well under a second and fires
   many times a minute. Bracketing those fragments every Ludeo into unusable pieces, so the decision was
   "no span" — which has to be enforced *here*, in the derivation, not just written in the plan.

**Watch for the indirect writer.** One respawn variant did not implement the interface at all — it wrote
into *another* implementor's `ControlsAllowed` property. So one exclusion covered two features, and a
by-name search for implementors would have concluded the second feature was unreachable. Grep for
**writes to the property**, not just for the implementor list.

## Two preconditions

- **Re-acquire the aggregator on every level load.** The list is rebuilt per level (a one-shot
  `FindObjectsOfType` in the player's `Start`) and nothing persists it, so cache the controller
  reference per level — not once at bootstrap — and `Reset()` the machine there.
- **Some implementors have ONE toggle site, not a paired enter/exit.** A screen doing
  `panel.SetActive(!panel.activeSelf); ControlsAllowed = !panel.activeSelf;` opens and closes from the
  same line. That is precisely why the value-derived machine wins: there is no exit call site to hook.

## Why the polling cost is acceptable

The tick is one list walk of ~10 entries per frame, only while a gameplay session is live, and it runs
from the same layer `Update` that already drives `UpdateStateObjects()`. What it buys is that the
phase-3 gate item "no dangling non-ludeoable on `End`" needs no auditing: every exit path calls
`CloseOpenSpan()` unconditionally, and a leaked span is unreachable.

**One cosmetic side effect to expect at the compile+run gate:** aggregators of this shape often
`Debug.Log` the restricting implementor **every frame** while a gate is closed. The layer's own readiness
hold and restore suppression will therefore spam the Console for as long as they hold. It is pre-existing
game behaviour, not a new bug — but it is a per-frame allocation in a player, so keep held windows short
and say so in the plan before someone files it as a regression.
