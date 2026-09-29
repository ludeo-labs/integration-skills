---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 4,5
question: "Your restore covers the player, enemies, companions and pickups, and the levels also have doors, keys, switches, chests, puzzles, power-ups or moving platforms? Walk this checklist per level before QA does — each item below reached QA as a separate bug in one real integration."
sanitized: true
---

# Level mechanics that slip past a player + enemies + pickups restore

A first restore wave that covers the player, enemies, companions and collectables feels complete — the
moment *looks* right at a glance. In one 3D platformer/adventure integration, QA then found the mechanics
below **one per report, each in a different level**. None was exotic; all were on the census, parked in a
"later" wave. Use this as a checklist when you scope the census and again before you declare the restore done.
For the process that finds them systematically, see
[[audit-every-level-against-the-games-own-save-list-before-calling-restore-done]].

Each row: what the viewer sees → what state is actually involved → how it was restored → the trap.

## Found by QA

**1. A floor button that opens a door.** Door shut on replay although the creator had stepped on the button.
- State: one "pressed" flag per button. Some buttons latch (the door stays open after you step off); others
  are weight-driven and let the door close again when the object is lifted — record them **two-way**.
- Restore: the game's own button-restore method, which re-fires the button's "pressed" event with the sound
  suppressed. **Trap:** the door opens by animation on scaled time, so under the restore freeze it parks
  half-open and finishes in front of the viewer — step its Animator to the end.

**2. Keys and key-locked doors — three separate pieces of state, not one.** Reported as "the key is not
restored" even though the "holding key" flag *was* restored.
- The **HUD slot** that shows a held key is drawn only by the pickup code path. Restoring the flag leaves the
  slot empty, so the viewer believes they have no key. Redraw it (silently) from the restored flag.
- The **picked-up key object** was still lying in the world. Hide it like any collected pickup.
- A door already **unlocked** comes back locked — and the key was *consumed* by unlocking it, so the viewer is
  stuck. The door's open state and the key's consumed state must be restored together.

**3. A one-shot power-up.** A pickup armed the next attack as a special one; the replay fired the normal attack.
- State: a single public bool on a player-owned component, set by a **respawning** pickup and cleared on use.
  The HUD indicator repaints from it every frame, so restoring the bool fixes both.
- **Trap:** it is not in the game's save system at all — the game never saves mid-power-up — so a save-list
  audit alone misses it. Sweep player-owned components for fields that pickups and triggers write.

## Found by the level audit (same family, not yet reported)

**4. Loot containers (chests).** Open chests come back closed and can be **looted twice**.
- The game's own load for a chest may also **add its reward to the score total**. Apply the game's load
  *before* your recorded score so the recorded total wins; let per-pass counters be re-derived from a baseline
  reset rather than accumulating across your restore's repeated passes.

**5. "Activate N switches" to open something** (shrines, totems, levers feeding a gate). Activated switches
come back off; the gate's own counter and open flag are separate state from the switches.

**6. Multi-part puzzles**, including "hit all the targets" with a projectile. A half-solved puzzle starts
over. State is usually per-part "solved" flags plus a list of the parts still outstanding on the parent.

**7. Tutorial / hint characters.** Their "already played" flag resets, so the hint shows again — and a hint
that runs a short scripted scene **takes control away at the start of the replay**.

**8. Burnable / destructible obstacles** that open a path. They grow back and re-block it. Often **not** in the
save system, and frequently paired with #3 (the power-up is what burns them).

**9. Moving platforms, dollies, rafts, rides.** They restart from their authored spot, so a moment that starts
*while riding one* drops the player. The state is a phase or a position along a path, not a flag.

**10. Collapsing platforms and carried objects.** Collapsed platforms come back; a carried object returns to
its start spot and a player who was carrying it starts empty-handed (the "carrying" reference is often
private — an accessor may be needed).

**11. Low priority:** timed hazards (spikes, falling or rolling objects) restart their cycle; a moment that
starts mid-slide or mid-climb; the player's map marker; hidden easter-egg counters.

## What made the fixes cheap

- Most of these (#1, #2, #4–#7) had a **per-object save/load already built into the game**. Handing each
  object's recorded save data back to its own load method restored them with **zero game-source edits** and
  with the game's own side effects (sound skipped, animation to its end state).
- New object kinds went into **existing** id ledgers where the meaning fit (a pressed button = an open door; a
  picked-up key = a collected pickup), and genuinely new values were read as **optional** — so previously
  recorded moments kept loading. They lack the new information, though: ask QA for **fresh** recordings.
