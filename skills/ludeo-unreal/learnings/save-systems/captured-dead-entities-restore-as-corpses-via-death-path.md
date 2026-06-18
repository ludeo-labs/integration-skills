---
category: save-systems
tier: generalizable
sourceGame: EndlessFPS
phase: 4
question: "Does the Creator keep writing tracked AI entities after they die (ragdoll/death-anim actors linger in the world)? If so, the snapshot contains Health<=0 entities — decide explicitly how restore handles them (corpse via the game's death path is usually right). Do NOT silently drop them."
sanitized: true
---
# The snapshot contains dead entities — restore them as corpses via the game's own death path, don't drop or revive them

## Precondition
The Creator's per-tick state write keeps writing a tracked AI entity as long as the actor exists —
and in most games a killed enemy *lingers* (ragdoll, death anim, corpse) for seconds or forever. So a
captured moment taken during/just after combat contains entities at **Health <= 0**: the corpses of
kills made moments before the captured frame, typically clustered exactly where the action was.

## Three wrong ways (all field-tested, all wrong)
1. **Drop them** (`if (Health > 0) Spawn(...)`). In a real capture this discarded 7 of 9 entities —
   the entire in-the-player's-face cluster — leaving the scene empty right where the highlight
   happened. The symptom reads as "entities don't restore where expected" and is easy to misblame on
   transforms or camera; the entities were simply never spawned. The guard's own comment said "only
   alive entities were captured" — the data disproved it.
2. **Spawn them with the captured Health<=0 written reflectively.** Writing the health value does NOT
   make a corpse — BP death logic runs off death *events*, not a health setter — so you get standing,
   "live-looking" enemies with zero health.
3. **Revive them all** (spawn at captured spots with default health). This fabricates a point-blank
   pack fight that never happened — the player killed them one at a time, and on restore gets overrun
   by all of them at once.

## The right way
Spawn the entity at its captured transform, write the captured health, then **drive the game's own
death path** — the same server death event the game uses (it cascades to the multicast that plays the
ragdoll/visual death). Find its exact name/pins via a function-signature dump
([[discover-bp-function-pin-signatures-before-processevent]]); it is typically a parameterless custom
event, callable via `FindFunction` + `ProcessEvent`.

Corpses restored this way are scene dressing with full fidelity: the bodies lie where the player left
them, and the genuinely-alive entities restore alive.

## Action-detection interaction (important, free if ordered right)
Restored corpses must not fire spurious Kill actions. If the action poller seeds its baselines AFTER
the restore (at BeginGameplay), corpses enter the detection cache already dead and only a real
alive→dead transition ever fires. Verify this ordering rather than assuming it.

## Edge case to acknowledge
An entity being killed ON the captured frame (the player's shot landing) also reads Health<=0 and
becomes a corpse — the data cannot distinguish "dying this frame" from "died seconds ago". That is
usually acceptable; fixing it properly is a capture-side change (e.g. stop writing entities at death,
or capture a death timestamp), not a restore-side hack.
