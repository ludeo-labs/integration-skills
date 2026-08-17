---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "6"
question: "Does the game have a data-driven progression / quest / achievement system with a generated enum of typed gameplay events (OnEnemyKill, OnPlayerDeath, OnLevelClear...) and a single Trigger/Raise/Dispatch method? Before planning the action map around it, find out WHO CALLS that method."
sanitized: true
---

# A generated event enum is not an event bus — check who raises it

A game with a data-driven progression system often ships something that looks like the perfect action
map: an enum of 30-odd typed gameplay events with exactly the names phase 6 wants (`OnEnemyKill`,
`OnPlayerDeath`, `OnDungeonClear`, `OnRewardClaim`), and one `TriggerEvent(type, target)` method they
all pass through. One `switch`, one game-file edit, whole phase done.

Check the callers before you plan anything around it. In one integration that enum had **no gameplay
callers at all**. Its three call sites were:

- a **dialogue-script command** — the interpreter for a `progress(type, target)` line written inside
  *dialogue content*, not game code;
- an **editor tool**;
- a component that raises it from a scene object, **placed on no prefab and no scene**.

The enum was generated from the rules database, so it enumerates what a *designer* can bind a rule to.
The game itself never raises those events; content does, if a designer happens to write the line. A
condition system fed it from a completely different direction — stats accumulating into a condition
store — so the rules still worked and nothing looked broken.

**The tell** is the enum's provenance: a file named `GENERATED_*`, or a header saying it is generated
from a database/asset. That means its members are *authorable*, which is a much weaker claim than
*raised*. The same reasoning that makes it look like a gift — "these names match my action list
exactly" — is the reasoning that should make you check: they match because a designer wrote them as
content categories, not because the code emits them.

## What to do instead

1. **Grep for callers of the dispatch method, not for the enum members.** Members appear in the enum
   declaration and its own switch statements, which reads like usage and is not.
2. **Separate real callers from content and tooling.** A dialogue/quest script interpreter that
   forwards an authored command is content, not a game event. Editor tools do not ship.
3. **Find the game's own funnels instead.** They exist, they are just not centralized: the single
   hit-application path (which usually already carries a `killed` flag and the victim's boss/elite
   status), the player's death callback, the wave/encounter finish, the level-result method. Each is
   one call site and each knows more than the generic event would have.
4. **Where a design document already committed to the enum, correct the document.** This one had been
   written into the TDD as "a single dispatch point for 32 typed gameplay events" — inferred from the
   enum's coverage without checking who raises it.

## The related trap this one hides

The same enum is a tempting anchor for **non-ludeoable brackets** (`OnDialogStart` / `OnDialogEnd`,
`OnShopEnter`). Those are worse than a missing action: a `StartNoneLudeable` that fires with no
reachable `StopNoneLudeable` suppresses **the rest of the run**. If the enum is inert, every bracket
keyed to it must be re-sited onto a real open/close pair — or deliberately left unwired, which is the
right call when the bracketed thing cannot occur inside a captured session at all.
