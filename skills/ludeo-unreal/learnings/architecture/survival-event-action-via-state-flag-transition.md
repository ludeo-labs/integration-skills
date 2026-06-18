---
category: architecture
tier: generalizable
sourceGame: EndlessFPS
phase: 5
question: "Does the game have a 'player survives a scripted hazard' moment worth capturing as an action — a grab-and-press-key struggle, a QTE, a downed-then-revived state, a finisher you can break out of? If so, find the boolean flag set when the hazard begins and cleared when it ends, and gate the success emission on the player being alive so you don't confuse escape with death."
sanitized: true
---

# Emit a "survived a hazard" action by polling a state-flag transition, gated on player-alive

## Precondition

The game has a **scripted hazard the player can either survive or die to** — an enemy grab with a
press-a-key struggle, a QTE, a finisher the player can break out of, a downed/revive state. You want a
positive action (e.g. `EscapeGrab`) when the player gets out of it, and this is detected the same
poll-based way as Kills (`common-mistakes/ondestroyed-not-for-bp-death`).

## The pattern

The hazard owns a **boolean state flag** that is set when the struggle starts and cleared when it ends.
Do NOT try to hook the player's input (the "press Y" key) — poll the flag instead:

1. The hazard actor sets the flag **true** in the function that begins the struggle (it usually also kicks
   off the player-side animation / camera — e.g. a "trigger finisher" function that calls "start finisher"
   on the player).
2. The flag is cleared **false** in the struggle-ended handler.

The catch: **the flag clears on BOTH outcomes** — a successful escape AND the player dying to the hazard.
A bare `true -> false` transition therefore can't tell escape from death. Disambiguate with the player's
**alive** state read in the same poll:

```cpp
// Per hazard actor, tracked across polls:
if (Prev->bInStruggle && !Now.bInStruggle && bPlayerAlive)   // cleared while still alive
{
    SendAction(TEXT("EscapeGrab"));   // the player broke free
}
// If the player's health hit zero this poll, the hazard killed them: the Death action already covers it,
// and bPlayerAlive == false suppresses the false "escape".
```

Read the player's `Health` (and fire `Death` on its `>0 -> <=0` transition) **before** the hazard loop in
the same poll, so `bPlayerAlive` is current.

## Confirm the set/clear sites — don't guess

Read the **BP call-graph** to verify which function sets the flag true and which clears it (and on which
side — hazard vs. player). Guessing the semantics produces a silent miss (escape never fires) or a false
positive. The graph makes it concrete: the set-true is in the hazard-trigger function; the set-false is in
the struggle-ended handler.

## Watch the revive edge

If the game can **revive** the player after a death-to-hazard, the flag may be cleared *after* health is
restored (player alive again) → a stray survival action. If you observe this, add a "did-not-just-die"
guard (e.g. require the player was alive on the previous poll too, or suppress for a short window after a
`Death`). Not always present — only add it if it fires.

## Why poll, not a delegate

Same reasons as Kill detection: heterogeneous hazard sources may expose different/absent "succeeded"
delegates, the flag is uniform across them, it needs zero Blueprint edits, and the transition naturally
fires once. The action must be sent in **both** Creator and Player flow (the cloud scores actions on
replay too) — a single poll loop in the gameplay component covers both.

## Cross-reference

- `common-mistakes/ondestroyed-not-for-bp-death.md` — the poll-based detection model this builds on.
- `common-mistakes/design-actions-for-goals-and-constraints.md` — name survival/objective actions for how
  the cloud will use them as goals/constraints.
