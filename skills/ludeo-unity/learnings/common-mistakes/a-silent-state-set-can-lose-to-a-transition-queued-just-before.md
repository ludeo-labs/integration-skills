---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "5"
question: "Does the game's element or state machine queue transitions (store the request, apply it on the next Update) instead of switching at once, and does the restore set states silently after game code that requests transitions?"
sanitized: true
---

# A silent state set can lose to a transition the game queued a moment before

The restore toggles an enemy's aggro off and on so it re-enters its attack state cleanly, then puts the fight's
progress back: the elements the creator had already destroyed are set to their "resolved" state silently (no
designer events). The check right after passed. One frame later every element had flipped back to "disabled", and the
viewer faced the boss at full strength.

The toggle's attack-state exit called `Deactivate()` on every element, and in this game that does not switch the
state: it stores a pending transition that the next `Update` applies. For elements that were **still** resolved, the
silent set saw "already in the target state" and returned without touching anything, so the pending "disabled"
survived and won on the next frame. The first restore pass had worked because the elements were not resolved yet
at that point, so the silent set really switched them and entering the state cleared the pending request.

## Fix

After a silent state set, also clear whatever transition is queued on that element (here `ResolveState(None)` on the
resolved state), whether or not the set changed anything.

## How to spot it

A check that passes right after the apply and fails at the next check (for example at the Play click), with nothing
logged in between. Run the restore's checks at two moments at least a frame apart; a pass-then-fail flip on state
values points to a queued transition, not to your write.
