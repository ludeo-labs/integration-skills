---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: 3
question: "Does the game have LIVES and a separate game-over screen (platformers, arcade shooters, roguelites with retries)? Then ask the integrator where the run ends — a death that reloads the level is usually the SAME run continuing, and ending the session on every death is wrong."
sanitized: true
---

# In a lives-based game, the run ends at game over — not at every death

Session boundaries were reasoned about as "the run ends when the player dies", which is right for a
match-based game and wrong for anything with lives. The integrator's correction was one sentence:

> *"every time I'm dying it's closing a room — I want only when it's game over, when I lose all my
> lives."*

Two different events look identical from inside the layer, and only the game can tell them apart:

| event | game does | run |
|---|---|---|
| death, lives remaining | additive death animation, then **reloads the same level** | continues |
| death, last life | additive game-over screen, then **loads the menu** | ends — End, keep the moment |
| level complete | loads the next level | ends — End, keep the moment |
| quit to menu / map | loads the menu | ends — Abort |

**Ask this in phase 3, not after the first playtest.** It changes what a "moment" can contain, and
it is a product decision — a highlight that spans a death and a retry may be exactly what the studio
wants, or exactly what it does not.

## Implementing "the run survives a death"

The scene loader gives you the discriminator for free: the **reload** entry point means *same level,
same run*, while a plain load means *going somewhere else*. Latch it in the reload method and consume
it at the single load choke point ([[put-the-session-teardown-in-the-scene-loader]]).

The keep-the-run path is **not** a no-op, and this is the part that bites:

- **Drop every tracked object and re-arm registration.** All of them die with the scene, and if the
  "already registered" flag stays set, the reloaded level's objects are never registered — the run
  continues while capturing nothing. Stop tracking (destroying the SDK-side objects) *and* clear the
  layer's registration state, so the first playable frame of the reloaded scene re-registers.
- **Do not End or Abort, and do not close the room.** The gameplay session stays open across the
  reload.
- **The death interval is already handled** if the death screen is bracketed non-ludeoable: the
  additive load opens the span, the level's return closes it. Verify both halves appear in the log
  for a death, not just the open.

## Ask about retry too

A "restart level" in the pause menu usually funnels through the same reload path, so it inherits
whatever you decide here. Raise it explicitly rather than letting the implementation decide: a
deliberate restart is arguably a new attempt even when a death is not.

## The genre tell

Look for these three in phase 1/2 and the question answers itself: a **lives counter** distinct from
health, a **game-over screen** distinct from the death animation, and a **reload-the-level** path
after death. All three present means the run boundary is game over.
