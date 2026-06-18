---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: 1
question: "Is the game turn-based (initiative order, action points, grid movement)? If yes: agree with the team whether captures are constrained to turn boundaries — it removes whole categories of restore work."
sanitized: true
---

# Turn-based games: anchor captures at turn boundaries

## Precondition

The game is turn-based (initiative/round structure, discrete unit actions). Confirmed via
the team during intake — and corroborated by config (a turn-based toolkit GameMode as
`GlobalDefaultGameMode`).

## The Lessons

1. **Ask the team whether captures snap to turn starts.** Ours answered: "assume capture
   always starts at the beginning of a turn." That single design decision removed unit
   velocity/heading, mid-animation poses, and projectiles-in-flight from the P0 first-frame
   list. Record it prominently — if the team later wants mid-turn captures, those all come
   back. (Surfaced by intake Group 1's "what must the first frame show" question.)
2. **Turn-based state is unusually manual-restore friendly.** P0 state is discrete at the
   boundary: grid positions, health, faction, action points, initiative order, ability
   cooldowns, objective flags. No physics settle, no mid-motion restore, no staggered
   spawn timing. Group 3 + manual DataWriter/DataReader is tractable even for a 48h MVP.
3. **Turn system state is per-tick GameMetadata and MUST restore.** Round number,
   initiative order (capture the runtime-ORDERED list, not the per-unit initiative stat it
   was derived from), and active-unit index drive music/UI/AI pressure and whose move it
   is. Restoring units without restoring whose turn it is breaks the first frame.
4. **Ability/cooldown state is P0, not enrichment.** The team promoted "current states of
   all abilities" into P0 unprompted — in a tactics game, a restored battle where
   cooldowns are reset changes every decision. Ask explicitly during entity tiering.
5. **Action design needs a turn-based heartbeat.** The FPS "per-shot damage heartbeat"
   maps to per-attack/per-hit + turn-ended actions; per-enemy-class kill identity maps to
   per-unit-class destroy actions (the team chose per-class identity for richer
   highlights).
6. **Room = whole battle.** One battle (map load → victory/defeat) is the recording
   session; turns are NOT rooms or highlights.

## Watch out

- Custom pause/wait states are common in turn-based UX (enemy-turn waits, camera pans);
  verify how the game pauses before wiring overlay/non-ludeoable detection
  (see custom-pause-via-timedilation-not-engine-pause).
- Combat RNG (BP Random nodes / FMath::FRand in toolkit code) is non-deterministic, but
  for snapshot-restore that is usually ACCEPTABLE — the player plays forward from the
  restored turn; rolls after restore are new rolls. Only chase seed capture if
  restore-time spawn layout or scripted outcomes depend on it.
