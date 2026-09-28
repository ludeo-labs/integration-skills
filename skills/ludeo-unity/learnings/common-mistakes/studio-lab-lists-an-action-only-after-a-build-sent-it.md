---
category: common-mistakes
tier: universal
sourceGame: RoomActionSample
phase: "6,7"
question: null
sanitized: true
---

# Studio Lab lists an action only after a build has sent it — plan the order

Global Triggers, goals, constraints and score parameters are all configured by **picking an event from Studio Lab's
event list**, and that list only contains names the game has already sent at least once (Game Events shows them with
type *Action*). There is no way to type a name in. Right after phase 6 the pickers for `PauseLudeo`, `Kill` and the
rest were empty — the previous build never sent them.

Order that works:
1. Build with the phase-6 actions.
2. One recording run that deliberately fires **every** action at least once (dash, kill, a streak, the special move,
   die once, pause once, clear a room, finish the level). Grep the log for each `action '<name>' sent`.
3. Then configure the triggers, goals, constraints and scoring. An action only a rare level can fire (a boss kill)
   has to wait for a run on that level.

Two platform behaviours seen at the same time, worth checking with the platform team before relying on them:
- A constraint failed the Ludeo on the **first** occurrence of its event even though its formula read "greater than
  the creator's count". A "don't exceed the creator" limit cannot be expressed that way; use a negative score weight
  for "fewer is better", or ask the platform for a constraint threshold.
- The game never receives the creator's counts for the Ludeo window (the reader holds only the start state), so such
  limits cannot be enforced game-side either.
