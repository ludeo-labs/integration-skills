---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "3,5"
question: "Are you forcing a game setting for a replay or a boot path (player count, language, screen mode, difficulty) by calling the game's own setter? Check whether that setter WRITES THE SAVE — if it does, one replay silently overwrites a preference the player chose."
sanitized: true
---

# Forcing a setting through the game's own setter can overwrite the player's saved preference

A replay must run in a known configuration — single player, a chosen language, a window mode — and
the right instinct is to use the game's own setter rather than poking engine state. That instinct is
correct about *behaviour* and dangerous about *persistence*: a settings setter in a game with save
slots usually writes the slot.

Two instances on one integration:

- the player-count setter **saves**, so forcing single player for a replay would permanently
  overwrite a player's chosen two-player preference. The game had a
  a *temporary* variant of the same setter alongside the persisting one; that is the one to call.
- the screen-mode setter **persists to the save slot**, so a single direct-boot launch made the
  forced window mode the player's stored preference from then on — a side effect of using the game's
  setter instead of the engine property.

**Look for the temporary/non-persisting variant first.** If none exists, set the engine state
directly and restore it, or accept and *state* the persistence as a known side effect — never
discover it later from a confused player.

## Force, do not refuse

Related decision worth copying: when a replay arrives in a configuration the integration does not
support, **force the supported configuration rather than refusing the replay**. The platform can
select a Ludeo at any moment, including preselected at launch, so refusing strands the player on a
dead screen. Every Ludeo here is single-player by construction (the session and player state are
singletons), so single player is the only coherent state to replay one in.

## Use the game's own predicate, not your own reading of it

The same commit found the existing guard already leaked. It gated capture on a "player 2 is on"
helper that tests one multiplayer enum value and **misses a second one** (a dual mode that is also
two players), so two-player sessions had been captured for weeks.

The game's own input manager already checked both values, for exactly this reason. **When you need a
predicate the game also needs — "is this multiplayer", "is this a boss level", "is this playable" —
find the game's existing one and reuse it** rather than composing your own from the enum. Then put it
in one place in the layer and call it everywhere (capture gate, gallery button, restore), so the
three cannot drift apart.
