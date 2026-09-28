---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "6"
question: "Does the 'boss' flag or class that drives a boss-kill action apply to many instances in one level (a gauntlet of mini-bosses) as well as to a single final boss?"
sanitized: true
---

# Split the boss action by boss type when a level has many of them

A single `BossKill` action was bound to every enemy of the game's boss classes. One level turned out to hold eleven
instances of a mini-boss class, and one recording run sent `BossKill` 19 times (respawns re-arm them). A "defeat the
boss" goal and a 2000-point score would have made that level worth ten times the final boss.

Fix: one action per boss type (here a per-instance action for the mini-boss class, scored 500, and `BossKill` for
the final boss only, scored 2000), chosen in the same death handler. Count each candidate action in the phase-6
recording run before the integrator assigns scores, and ask about any action that fires far more often than its
name suggests.
