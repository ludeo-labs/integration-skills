---
category: architecture
tier: generalizable
sourceGame: TopDownRogueSample
phase: "5"
question: "Is a periodic hazard that can hit the player (falling debris, artillery, sweeping beams) restored by its timer only rather than mid-animation, and could a clip start while an attack is telegraphing or landing?"
sanitized: true
---

# A timer-only hazard restore should open with a quiet window, not a fresh attack

The integrator chose to restore a periodic hazard by its timer only, with no mid-animation rebuild.
The first design restarted an in-progress attack from its beginning at `Begin`. In play that gave the
viewer about half a second to react to something they never saw coming: the telegraph was skipped or
already over before they had their bearings. The integrator rejected it as unfair.

## The rule

- **Never restart an in-progress attack at `Begin`.** Restarting in-flight work is a sensible default
  for spawners and waves, but for an attack aimed at the player it removes the reaction window. This
  is the hazard-side case of [[rest-in-flight-action-state-do-not-restore-it]].
- **Re-arm to the level's own quiet gap.** Whatever the capture held (cooldown, about to fire,
  mid-attack), start nothing and schedule the next attack one normal gap away, then let the rhythm
  resume. Derive the gap from the level's config, never a constant, and read it at `Begin`, not during
  the frozen apply.
- **Ask the integrator early.** State in the restore plan what happens when a clip starts mid-attack,
  and propose quiet as the default for anything that can hit the player.

## How to apply

Re-arm through the game's own hazard loop (entered with a "next attack at now + gap" argument), not a
layer-side timer. Record the target time, flag any hazard that appears before it, and make timer
checks compare against that target rather than the captured remaining time. Replay one Ludeo captured
mid-attack and one captured during the cooldown.
