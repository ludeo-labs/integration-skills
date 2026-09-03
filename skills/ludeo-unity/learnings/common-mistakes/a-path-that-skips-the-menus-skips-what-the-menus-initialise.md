---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "3,5"
question: "Does your restore or boot-straight path reach gameplay without going through the game's front end? Enumerate what the menus initialise — HUD, input-device binding, per-player widget lists, difficulty/mode state — because your path performs none of it, and in a Production build the menus are the ONLY caller."
sanitized: true
---

# A path that skips the menus skips the setup only the menus perform — five times on one integration

Every replay and every direct-boot path reaches gameplay without the front end. On one integration
the same root cause produced five separately-reported bugs, and by the third it was faster to ask
"what does a menu normally initialise here?" than to debug the symptom:

| reported as | actually |
|---|---|
| "the HUD is opaque white boxes" | HUD init runs from the map screen's level button; nothing else calls it |
| "the game freezes, I can't move" | no input device was bound to the player — the menus bind them |
| "the leaf counter always shows 3" | the HUD sync iterated an empty per-player widget list |
| "the boss does not move or attack" | the level-entry branch that starts a boss was bypassed |
| replay opened on the wrong screen state | menu-owned mode/language state never applied |

Note the second and third: **input dead and a stale counter do not look like the same bug**, and
neither looks like "missing menu setup". That is why the pattern is worth holding as a first
hypothesis rather than a conclusion.

## The Production/Development trap that hides it

Look for setup guarded on the game's own mode enum:

```csharp
void Start() { if (game_mode == GameMode.Development) InitGUI(); }   // plus a menu caller
```

In a development build the `Start()` fallback covers everything, so the integration works. Flip the
build to Production — which the phase-7 build must be — and the menus become the **only** caller.
Every one of these bugs was latent until that flip, and then arrived all at once. **Test the direct
path in a Production-configured build, early.**

Mirror the game's own development branch exactly rather than reimplementing it: here that meant
calling the HUD init, both input-assignment calls, and a subsystem init the HUD expects to have run
first — in that order.

## Restoring a value is not refreshing the UI that shows it

Two of the five were display-only, and each cost a round trip to diagnose:

1. **Sync order.** The game's "force sync the HUD" call ran at scene-loaded, which is *before* the
   restore applies at RoomReady, so every counter showed pre-restore values while the data
   underneath was already correct. Move the sync into the post-apply deferred queue.
2. **The sync can be a no-op.** After moving it, the counter still lied: the sync iterates a
   per-player widget list built only by the full HUD init, which this path never ran. So the sync
   had been iterating an empty list. **A "refresh everything" call is only as good as the
   registration it walks** — check what populates its collection.

Diagnose these two with one log line reading the value *back* after the write
([[make-the-restore-verify-every-value-it-writes]]). Data-correct-but-display-stale and
write-did-not-stick are indistinguishable from the outside and cost several sessions of reasoning
from absence of evidence here.

Related: [[your-replay-branch-bypasses-the-rest-of-the-entry-switch]] for the level-entry variant,
and [[boot-the-replay-through-the-games-own-entry-flow]] for why the flow matters at all.
