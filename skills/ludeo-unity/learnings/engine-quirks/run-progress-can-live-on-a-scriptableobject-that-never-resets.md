---
category: engine-quirks
tier: generalizable
sourceGame: SurvivalSample
phase: "4,5"
question: "Are you about to capture run progress by reading it off the authored data - a ScriptableObject config, or a [Serializable] class inside one, that the game hands out by reference? Check whether the game writes runtime progress BACK into those objects. If it does, the values survive between runs in one process and a sweep of the asset reports the previous run's progress, not this one's."
sanitized: true
---

# Run progress can live on a ScriptableObject that never resets

The census assumption is that authored data is static and run state lives on managers and actors. This
game broke it in a way worth checking for everywhere: the side-objective definitions came from a
`ScriptableObject`, whose array of definition objects was handed out **by reference** through a plain
`=> _field` property, and the manager wrote each objective's live progress straight back onto those
definition objects — how many parts remain, the total, whether it is finished, which choice the player
accepted.

Those progress members were auto-properties with no `[SerializeField]`, so they are not serialized to
disk and they *look* transient. They are not transient within a process. The asset stays loaded, so
the values persist from one run to the next — across a run ending, a scene change and a fresh map.

## Why the live game gets away with it, and you do not

The game reads objective progress almost exclusively through a **per-run registry on the manager** (a
`Dictionary<string, Definition>` of "objectives this run started", rebuilt with the scene). Anything
absent from that registry is treated as never having happened, so leaked flags on the asset are
invisible to normal play. The one place that reads the asset directly — sizing a quest counter at map
load — leaks the previous run's total, which nobody notices.

Capture has no such shield. Sweep the asset and you write out objectives belonging to whatever run
came before, on a clip that never touched them.

**So capture through the per-run registry, and add the accessor that exposes it if there isn't one.**
Here that was one line (`IEnumerable<Definition> LudeoStartedX => _registry.Values;`) and it is the
difference between capturing this run and capturing a mixture of runs.

## What it means for the restore, too

Writing these members back is safe *because* the game does the same thing and gates on the per-run
registry — but two consequences follow:

- **Registering the objective on the manager is the load-bearing half**, not setting the numbers. The
  HUD here chose between "2/8" and a countdown to the next objective purely on whether a quest was
  active, and the quest is activated by the game's accept path, not by the counters. Restoring the
  cursor without the objects it indexes left the HUD with only the countdown branch to show — which
  read as a wrong *value* and was really a wrong *display*.
- **A finished item is worth registering without replaying it.** The "have all objectives completed"
  test walks the registry, so a finished objective that is absent counts as one that never happened
  and the run's progress toward its end-of-map gate comes out short. Register it completed; do not
  spawn it and let it be completed again.

## The neighbouring hazard, same root

The same asset had its *choice pool array* narrowed in place at runtime before being offered to the
player. So an index into that pool is only as stable as the last narrowing — capture the item's own
stable id (this game resolved objectives by a localisation key, and its own completion handler did
exactly that lookup) and keep the index only as a fallback, with a loud warning when the fallback is
what resolved.
