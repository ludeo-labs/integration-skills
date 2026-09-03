---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: 3
question: "About to report pause/resume by subscribing to the game's pause EVENT? Read the pause method's signature first - if it takes a 'show the menu' / 'notify' style bool, some callers pass false and freeze the game without ever raising the event."
sanitized: true
---

# An optional-notify flag makes the pause event lie — hook the method, not the event

A game's pause handling looked ideal for wiring the SDK's pause reporting: one
pause method on the central controller, one paired unpause, and a matching
`OnPaused(bool)` event that UI already subscribed to. Subscribing to the event
would have covered every pause — except the signature had a second job:

```csharp
// Neutral illustration of the shape - not client source
public void PauseGame(bool showPauseMenu = true)
{
    if (!isPaused)
    {
        SetFixedUpdateControl(false);
        Time.timeScale = 0;
        isPaused = true;
        if (showPauseMenu)          // <-- the event is OPTIONAL
            FirePaused(true);
    }
    else { /* ...the inverse... */ }
}
```

Screens that pause the world but draw their own UI — a journal, an upgrade
picker — call it as `PauseGame(false)`. Those calls **zero `Time.timeScale`
without ever raising `OnPaused`**. An integration subscribed to the event would
have reported some pauses and silently missed others, leaving the objective timer
running through exactly the screens a player lingers on longest.

## Three traps in one method

Reading the body rather than the signature surfaced two more:

1. **It is a toggle, not a setter.** There is no idempotent "pause" entry point —
   calling it to pause while already paused *unpauses*. An SDK-requested pause
   that calls it blind can resume a game the player deliberately stopped. Check
   the state first, or drive the two halves explicitly.
2. **The paused flag clears on a delay.** Unpausing restored `timeScale`
   immediately but scheduled the flag clear through a delayed invoke a fraction
   of a second later. So the flag reads "paused" for a beat *after* play resumed —
   any readiness or restore gate that polls it sees a stale answer.

## The rule

**Hook the pause METHOD (and its unpause partner), not the pause event.** The
method is the choke point every path funnels through; the event is a
presentation concern the method may or may not choose to raise.

When mapping the pause primitive:

- Read the **full signature** — a `bool` parameter named for UI ("showMenu",
  "notify", "silent") is a strong tell that notification is optional.
- Enumerate the callers and note **which argument each passes**. If any caller
  suppresses the notification, the event is disqualified as the signal.
- Check whether the method is a **toggle** and whether its state flag is written
  **synchronously**.
- Confirm the SDK-requested pause will route through the same primitive as the
  player-initiated one, so the pause is reported exactly once.

Record all of this in the map next to the primitive. The next phase reads the
artifact, not the conversation — "the pause event exists" is a trap if left
unqualified.

Related: [[verify-the-world-not-the-flag-you-just-wrote]] — a state flag is only
as good as the moment it is written.
