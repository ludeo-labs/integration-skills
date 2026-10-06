---
category: save-systems
tier: generalizable
sourceGame: SurvivalSample
phase: "1,2,4,5"
question: "Have you classified the game's save as Group 1 (full gameplay state) and started treating its save call as a capture mechanism? Read its AVAILABILITY gate — the condition that decides when a save is allowed — before assuming it can snapshot the moment a Ludeo targets."
sanitized: true
---

# Coverage, format, and *availability* are three questions — the third one bites

Phase 1 asks two things about a save system: how much it covers (the group) and what shape it has
(named fields vs opaque blob). A game can score ideally on both and still be unable to snapshot the
moment the integration exists to capture, because there is a third property nobody asked about:
**when the game permits a save at all.**

Observed on a horde-survival roguelite with an unusually strong save — Group 1, named-field
per-entity contract, gameplay entities themselves participating, and a documented flag covering
"enemies, objects, npcs, minimap, quests". Everything about it said "reuse this". Then its
availability gate:

```csharp
// synthetic illustration of the shape
public static bool CanSave => savingEnabled
    && !inActiveFight                      // ← no saving during an active fight
    && !inDialogue
    && !inCutscene
    && !anyLocalPlayerDead
    && !modalMessageOpen
    && !levelLoading
    && Time.timeSinceLevelLoad > 3.0f
    && isSessionHost;
```

The agreed clip concept was "a built-up character mid-run" — which in that genre means *mid-fight*.
**The one moment worth capturing is the one moment the save refuses to run.**

## The distinction that resolves it

The gate blocks *initiating* a save. It says nothing about whether the format can **represent** that
state — and here it plainly could: the same class wrote the in-fight flag into the save data and read it
back out. So:

- **The data model is reusable.** Its field list, its per-entity breakdown, and especially its
  restore ordering are validated prior art. Port them.
- **The save *call* is not a capture mechanism.** The SDK samples continuously and must not inherit a
  gate that is false exactly when it matters.

Getting this backwards produces an integration that looks elegant — "we just call the game's own
save" — and captures nothing during combat, boss fights, dialogue, or the first three seconds of a
level, with no error to show why.

## The check, and where it belongs

Whenever you record a save system as Group 1, **also find and read its availability gate**, and write
down what it excludes:

- grep for the property the save path tests: `CanSave`, `SavingEnabled`, `IsSaveAllowed`,
  `AllowSave`, `SaveBlocked`, or a `DisableSaveForDuration`-style suppressor
- read every conjunct, and ask of each: *would this be true or false during the moment we intend to
  capture?*
- record the answer next to the group classification, not in a separate note — a bare "Group 1"
  reads as "we can snapshot anything", which is the wrong conclusion to hand the next phase

A save can also carry an explicit *timed* suppressor (a `DisableSaveForDuration(float)`-style call here), which is
a strong hint the studio hits ordering problems around saving that the integration will hit too.

## Related

[[find-the-studio-s-own-repro-tooling-first]] is the same instinct pointed at a different artifact,
and the same caution applies to what it covers versus what a playable moment needs. Note the repro
tool and the save gate can disagree: the tool observed reproduced a run by setting a seed and
changing scene — a path with **no** save-availability gate at all — which is why it, not the save
call, was the right model for the replay boot.
