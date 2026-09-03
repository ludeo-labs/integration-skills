---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: "6"
question: "Before mapping a Kill (or any 'entity destroyed') action in phase 6: does the phase-5 restore put recorded-dead entities back through the game's own death method? If it does, every replay fires one Kill per corpse at boot and completes its own goal before the player moves."
sanitized: true
---

# Check that your restore cannot fire your own kill action

Phase 6 maps `Kill` onto the game's death path. Phase 5 puts recorded-dead entities back into the
restored room. Those two facts are only compatible if the restore's death path does **not** raise the
event the action is mapped to - and nothing in either phase's brief makes you check.

A moment recorded mid-fight typically opens with several corpses already on the floor. If the restore
places them by calling the game's ordinary "die" method, the replay emits one `Kill` per corpse
during boot. The moment's goal - derived from the creator's run, "kill twelve" - is then partly or
wholly satisfied before the player has pressed anything, and nothing anywhere errors.

In one integration this was safe, but only by luck of an earlier decision: the restore used a
separate `SetArtificialDeath` primitive that sets the dead flag, plays the death animation, drops the
colliders and freezes physics - and raises nothing - while the kill event lived solely in the full
`Die()` path. That was chosen in phase 5 for an unrelated reason (the wave manager counts artificial
deaths as cleared), and it happened to make phase 6 correct.

**Verify it rather than inheriting the luck.** Grep the restore's death call and confirm whether it
reaches the event your action is mapped to. If it does, you need one of:

- a restore-side death primitive that does not raise the event (preferred - it also keeps kill
  counters, achievements and loot drops out of the boot), or
- a "we are placing recorded dead, not killing" flag the emit checks.

## The symmetric check worth doing at the same time

While you are in that code, establish where the kill event actually sits, because it decides whether
your action needs a player-guard:

- **On the victim's own death path** (what this game had) - every death reaches it, including hazards,
  damage-over-time ticks and kill planes. Do NOT add a player-guard: a replay whose goal counts only
  player-dealt kills becomes unreachable the moment the environment finishes an enemy.
- **On a damage-attribution path** - only player-dealt deaths reach it, and the replay's goal can be
  starved by environment kills. That is the case the "every death credited" learning covers.

Both questions are answered by reading the same twenty lines, and the answers pull in opposite
directions, so read them before writing either the action map or the restore's death handling.
