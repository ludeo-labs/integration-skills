---
category: architecture
tier: generalizable
sourceGame: EndlessFPS
phase: 3
question: "Does the game end a run on player death by reloading the level / returning to a load screen / tearing down the gameplay world? If so, that reload ends the Ludeo regardless of its fail-on-death config — is the terminal condition decoupled from the game's own reload?"
sanitized: true
---
# A game-side death→reload ends the Ludeo regardless of its fail-on-death config — decouple them

## Precondition
The game ends a run on player death by **reloading the level**, returning to a load screen, or
otherwise tearing down the gameplay world (common in arcade / roguelike / wave-survival loops).
The Ludeo room lives on that world, and the room-driver component is destroyed with it.

## The problem
When death reloads the world, the GameState component's `EndPlay` fires and the room/session tears
down (the teardown safety net runs). So **death always terminates the Ludeo** — no matter what the
Ludeo's scoring configuration says. A Studio Labs goal of the form *"dying is NOT a failure — keep
playing toward the objective"* is impossible to honor, because the game has already destroyed the
world before any platform decision can apply. Death is hard-wired as terminal by the game's own
reload, **upstream** of the platform's pass/fail logic.

## The principle: separate "what happened" from "is the experience over"
- **Death = just the `Death` action.** Report it and let the platform's scoring decide pass/fail.
- The room / experience should end on a **platform marker** — the back-to-menu request, or the next
  `NewLudeoSelected` — **not** on a game-side world reload.
- If the game's death flow unavoidably reloads (no in-place respawn), treat that as a **structural
  limit to flag**, not something to silently accept: the integration cannot offer non-terminal-death
  goals until the game can survive a death without tearing down the world.

This is benign for a no-respawn mode where death genuinely ends the run — but it is the wrong
*reusable* pattern. It bakes a game-over policy into the capture lifecycle that the platform is
meant to own, so the same integration code silently can't support a respawn/endurance goal on the
next game (or the next mode of this one).

## Cross-reference
- [[onroomready-is-the-viewer-connected-gate]] — the begin side of the same "let the platform own
  the experience lifecycle, not the game" principle.
