---
category: architecture
tier: generalizable
sourceGame: ActionAdventureSample
phase: 4
question: "Does the game have a level-restart / reset contract — a small interface with a per-level registry that every stateful object self-registers into from its own Start()?"
sanitized: true
---

# A game's level-reset registry solves three separate phase-4/5 problems at once

Many action/adventure games implement a **level-restart contract**: a small interface (one
`ResetForRestart(bool softRestart)`-style method) plus a per-level list that every object with runtime
state self-registers into from its own `Start()`, and that the level manager iterates on restart.

When you find one, **do not treat it as merely "interesting reset code."** It is simultaneously:

1. **The census list (phase 4 Part A).** The set of types implementing the interface *is* the game's own
   answer to "what has runtime state worth resetting" — which is very nearly "what has runtime state
   worth capturing." A single glob for the implementors produced a clean type list in minutes, where a
   directory-by-directory sweep would have taken far longer and still missed types. Use it as the census
   **seed**, then add what it misses (caveats below).

2. **The `06 §6` batch-registration iterator (phase 5 · task 1).** Objects already alive when gameplay
   begins must be registered after `RoomReady`/`Begin`. The registry already *is* that list — already
   populated by the time gameplay starts, already scoped to the current level — so batch registration
   becomes a loop over it (guarded on `!IsInLudeoFlow`) instead of a hand-built enumerator per subsystem.

3. **The CR-006 baseline-reset seam (phase 5 · task 4).** Restoration must reset matched/persistent
   instances to a clean baseline before applying restored attributes. This contract already does exactly
   that, game-wide, including subsystems you would never think to reset by hand (accumulated decals/gore,
   shared AI-coordination state, destructible remains, animator rebinds).

## Why this is worth checking for explicitly

The three problems are documented in three different places (census in phase 4, batch registration in
`06 §6`, reset-before-apply in `07 §9` / CR-006), so it is easy to solve each separately and never notice
they share one pre-existing answer in the codebase. Grep for the reset contract **at the start of phase
4**, before enumerating types by hand.

Search idioms: an interface whose only method takes a "soft/hard" reset flag; a per-level list field whose
name pairs "restart"/"reset" with "elements"/"objects"/"resettables"; a `Register(this)`-shaped call to
that list from inside `Start()`.

## Caveats — it is a floor, not a ceiling

- **Singletons and managers are usually absent from it.** The world/level identity type, the time-base /
  continuity singleton, and combat/AI-arbitration state are typically *the thing that owns the registry*,
  or a sibling manager — not a member of it. Add those from the phase-4 mandatory-type rules.
- **Runtime-spawned short-lived objects are often absent** (projectiles, drops) — they self-destruct
  rather than reset.
- **Registry membership is not liveness.** Check separately whether the game *removes* an object from its
  live lists on death while the GameObject persists as a corpse/wreckage — if so, keying the tracked set
  off list membership silently drops it from the replay (`06 §3.4`: that is a terminal-state flag, not an
  unregister).
- **Verify the soft-vs-hard reset difference before reusing it as the restore reset.** A "soft" restart
  commonly preserves map/minimap reveal state and similar progression — which may be more or less than
  the baseline reset you want.

Related: [[game-own-save-key-builder-is-a-ready-made-stable-key]] — the same "reuse the game's existing
machinery" move, applied to identity instead of reset.
