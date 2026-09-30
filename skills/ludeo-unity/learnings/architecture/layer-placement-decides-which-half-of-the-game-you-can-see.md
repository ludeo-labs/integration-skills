---
category: architecture
tier: generalizable
sourceGame: SurvivalSample
phase: 3,5
question: "Does the game split its own gameplay code across more than one assembly definition? Then the assembly you put the Ludeo layer in decides which game types the layer can EVER reference - and if the dependency runs from that half toward yours, the other half is permanently unreachable, not merely un-referenced."
sanitized: true
---

# Where the layer lives decides which half of the game it can ever see

[[auto-referenced-does-not-reach-asmdef-game-code]] covers the outbound direction: an `.asmdef`
references exactly what it lists, so the SDK is not visible to game code that does not name it. This is
the inbound direction, it bites much later, and it cannot be fixed by editing a references list.

A long-lived project usually has more than one gameplay assembly. On the integration this came from:

```
Game.Gameplay.asmdef   references -> Game.Core   (+ engine/3rd-party)
```

The Ludeo layer had been placed in `Core`, which is the right instinct — it is where the actor,
registry and map types live, and the whole capture side compiled against it for weeks. The problem only
appears when a restore needs to touch something in the *other* assembly:

```
error CS0246: The type or namespace name 'MapMarker' could not be found
```

Adding `Game.Gameplay` to `Core`'s references is **not** an option: `Gameplay` already references
`Core`, so that is a cycle and Unity refuses it. The type is not un-referenced, it is unreachable.

## Why this surfaces late, and on the restore side specifically

Capture reads broad, stable things — actors, health, transforms, manager state — and those tend to live
in the lower assembly. Restore is where you start needing the *specific* component that owns a piece of
presentation: the map marker, the objective prop's script, the object that starts a global effect. Those
are gameplay-flavoured and cluster in the upper assembly. So an integration can be most of the way done
before it discovers the boundary.

It is also easy to miss while reading: a folder-scoped search for the class finds nothing and you
conclude the behaviour lives somewhere else, when in fact it lives in a directory you never searched.
Check where each assembly's sources actually are before scoping anything — they are often not where the
folder names suggest.

## What to do

1. **Map the assemblies before placing the layer**, and place it in the assembly that can see the most
   of what the *restore* will need — not what capture needs. If one assembly sits at the top of the
   dependency graph and is not referenced by the others, that is usually the right home.
2. **When you are already stuck**, the escape hatches, cheapest first:
   - **Go through a shared base type.** If the unreachable class derives from something in your
     assembly, you can hold it, and virtual calls dispatch correctly. Filter by
     `GetType().Name == "..."` when you must single one out. Fragile to renames, so make it **fail
     safe** — the worst outcome should be the fix silently not applying, never a wrong call on a
     sibling type. Comment why the type name is being matched, or the next reader will "fix" it.
   - **Ask the game to expose it.** A one-line accessor in the *upper* assembly, in the integration's
     own region, which hands you the value or performs the action. Costs a game-file edit.
   - **Move the layer.** Correct, and expensive once there is a lot of it.
3. **Never call a virtual through the base type without checking what the other implementations do.**
   In the case above, the base's `OnInteract` was cosmetic on the marker and load-bearing on five other
   components — finishing objectives, dropping loot, starting map-wide effects. Calling them all would
   have been far worse than the bug being fixed.
