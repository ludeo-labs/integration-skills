---
category: architecture
tier: generalizable
sourceGame: SurvivalSample
phase: "5"
question: "Does the game persist player-profile state — currencies, items, unlocks, progression — on its own, for example when a run ends? Then a replay writes the clip's state into whoever replayed it, unless the game's save is refused for the whole time a Ludeo is playing."
sanitized: true
---

# Block the game's save while a Ludeo is replaying

A restore rebuilds the recorded character by writing the clip's run state — currencies, items,
resources, skill points — into the game's player-stats store. In many games that is the same store the
profile persists, and the game saves it by itself at the end of a run. Without a guard, every replay
writes the clip's account state into the save of whoever played it.

**Reads can write too.** In one game, asking whether a piece of content was unlocked unlocked it as a
side effect, into the same store. Measured: a replay session that never even reached a level wrote a
full unlocked-content list into the player's save.

## Where to put the guard

- At the **single funnel** every save passes through — not beside the restore, and not on the public
  save overloads. Deferred and retried saves reach the funnel by their own path; guarding the overloads
  lets them slip past.
- Keyed on **"this session is replaying a Ludeo"**, not "the restore is running". The damaging save
  happens at run end, long after the rebuild has finished, when the narrower flag is already false.
- Report the refused save as **success**, with one log line. Nothing in a replay depends on the save,
  and an error would surface storage failures to a viewer who never asked to save. The cost — settings
  changed during a replay are not kept — is moot on a cloud machine, where every session starts from a
  fresh profile.

## Clear replay overrides when the player leaves the Ludeo

Any override the replay installs to answer game questions from the clip — unlocked content, for
example, which in some games decides which choices a run even offers (see
[[persisted-progression-can-be-a-generation-input]]) — must be cleared when the
player **leaves the Ludeo**, not when the process shuts down. One integration cleared it on shutdown.
The whole main menu in between answered from the clip, showing the recording's account as the
player's, and a normal run started from that menu would have been seeded with the clip's unlocks.

## Proving it

The guard's log line firing is not proof. On the first test the clip carried none of the currency in
question, so there was nothing to write — a pass for the wrong reason (see
[[a-degenerate-subject-makes-a-passing-restore-test-prove-nothing]]). Test with a clip whose character
carries the state being guarded, decode the save file afterwards, and don't trust what the game's own
menus show.

Related: [[forcing-a-setting-for-a-replay-must-not-persist-it]] — the same leak through a settings setter
that writes the save slot.
