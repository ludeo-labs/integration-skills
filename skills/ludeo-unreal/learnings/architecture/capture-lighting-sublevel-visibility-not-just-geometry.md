---
category: architecture
tier: generalizable
sourceGame: StoryPuzzleGame
phase: 4
question: "When the player enters a sub-area, does the game swap LIGHTING by hiding the host map's lighting sublevel and showing the sub-area's lighting sublevel (separate from the geometry sublevel)? If so, restoring geometry alone leaves the sub-area lit by the wrong lighting — capture which lighting sublevel is visible too."
sanitized: true
---

# Capture lighting-sublevel visibility, not just geometry — lighting is often a separate streamed level

## Precondition

The game organizes lighting into its **own streaming sublevels**, separate from geometry, and swaps
them on area transitions: entering a sub-area hides the host/persistent map's lighting sublevel and
shows the sub-area's lighting sublevel. (Common in projects that author baked/area-specific lighting
per scene.) This is in addition to re-streaming the geometry sublevel
([[restream-capture-time-sublevels-before-restore]], [[stream-unregistered-sublevel-with-levelstreamingdynamic]]).

## The trap

Capture/restore designed around "re-stream the sub-area geometry, restore the player transform" will
get the **geometry** right and the **lighting** wrong. The entry actor's swap looks like:

```cpp
// game-authored on sub-area entry
TargetAreaLighting->SetShouldBeVisible(true);
HostMapLighting->SetShouldBeVisible(false);   // <-- the part restore forgets
```

If restore re-streams the area's geometry but never reproduces the lighting swap, the host map's
lighting sublevel stays visible — so the restored sub-area is **lit by the host (e.g. office)
lighting**: wrong ambiance from frame one, often glaringly so for a dark/outdoor scene restored
under bright interior light. The restore log is the giveaway: the host lighting sublevel reads
visible (`1 1 0`) while the sub-area's `*_Lights` reads loaded-but-hidden.

## Fix

Treat lighting-sublevel visibility as a captured attribute on your GameMetadata/world object:

1. **Capture** a boolean for the host lighting sublevel's visibility (e.g. `HostLightOn =
   HostMapLighting->GetShouldBeVisibleFlag()`), written per-tick like other dynamic metadata
   ([[gamemetadata-must-be-per-tick-for-dynamic-state]]).
2. **On restore** (version-gate the read so older captures default to "host lighting on" and behave
   unchanged — [[capture-schema-lifecycle-management]]): if the capture was taken inside a sub-area
   (`HostLightOn == false`), hide the host lighting sublevel; and after the sub-area's geometry +
   `*_Lights` sublevels finish streaming, set those visible. This reproduces the entry actor's swap.

## Why it's easy to miss

Lighting sublevels are filtered out of most entity scans (they hold no gameplay actors), and a
geometry-only restore *looks* complete — the player is in the right room. The lighting mismatch only
shows up visually, which is exactly the kind of thing a non-runtime "compiles + restores position"
sign-off misses ([[post-restore-self-validation-phased-checks]]). When you find a per-area lighting
swap on the entry path, add it to the capture set in the same pass as the geometry restream.
