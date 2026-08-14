---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "3,5"
question: "Are you planning to boot the replay directly into the gameplay level (set a target scene, start the session, load) rather than going through the game's normal front-end flow? Test that shortcut early — it probably skips setup the player depends on."
sanitized: true
---

# Jumping straight into a level skips setup — and that is a fact about your restore, not just a dev shortcut

To iterate faster, a `-level N` argument was added that reproduced what the studio's own repro
tool does: set the target scene and host command on the game's auto-host object, then load the
session-creation scene. Every API in that chain is ordinary shipping code.

The result: **the player fell through the world.** Before that, a null platform layer and a wall
of `TargetRpc ... null connection` errors, because the sequence raced ahead of startup.

The integrator's call was the right one:

> *"let's not try to hack our way into a dungeon, that just breaks more things. It is okay to
> start in the main menu."*

## Why this is not just about the dev shortcut

**The replay flow was designed to boot exactly the same way** — that is what the reference plan
said, because the studio's own snapshot/repro tool does it and evidently works. The shortcut
failing says that reasoning was unsound:

The studio's tool works because it runs **from inside an already-established session** — the
player has been through the front end, their loadout is resolved, the platform layer is
initialised, the network host exists. It restores *into* a live session. It does not create one.

So a replay must **go through the game's real flow** to the point where a session exists, and only
then apply the captured state. "Load the level scene directly" is not a shortcut you can take on
the cloud either — the cloud runs the same build, with the same startup requirements.

## The general shape

1. **Do not build a jump-straight-to-gameplay dev tool.** It looks like it saves time and it
   spends it instead, on failures that belong to the shortcut rather than to the integration.
   Play through the menus like a player; it costs seconds.
2. **When restore needs a level loaded, drive the game's own path to gameplay** — the same one a
   player takes — and treat "the session is up and the player exists" as a precondition of
   applying state, not something to arrange yourself.
3. **If you must gate on readiness, use the game's own finished-starting-up flag**, not the
   presence of a couple of singletons. Singletons exist before they are initialised. In the
   observed project the startup object had an `IsLoaded` flag set only *after* the platform layer
   was chosen; gating on singleton existence alone jumped the queue and hosted with a null
   platform.

## The cheap check

Before designing a restore around a boot sequence, test the sequence on its own: launch, drive it,
and see whether the player can stand on the floor and move. If it needs a session that only the
front end creates, you have learned that for the price of one run rather than one phase.
