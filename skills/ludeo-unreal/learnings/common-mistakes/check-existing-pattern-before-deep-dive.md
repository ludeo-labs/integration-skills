---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 3
question: null
sanitized: true
---

# When an actor is "missing on replay," check if you track it AT ALL before theorizing about why it's broken

## The Mistake

User reported: "Captured a Ludeo with the deployable active. On replay, deployable was there, kind of. It was a sphere that says Room Data Missing."

I went deep on theories:
- Maybe the level BP spawns the deployable at a wrong position because state isn't restored
- Maybe sublevel streaming races with the spawn — room volume isn't loaded in time
- Maybe the deployable's transform anchor depends on player position
- Maybe `ARoomActor::ValidateRoom()` debug visualization is hiding the mesh

Wrote a 6-option solution comparison plan. Built a static `.uasset` scanner intending to extract level-BP variable info. Spent ~2 hours.

**The actual answer:** the integration didn't capture `ADeployableDeviceActor` at all. We only hooked `OnActivated` for the `DeviceActivated` action. On replay, no integration code spawned a deployable — the level BP probably tried to spawn one and it landed somewhere broken, but our code did nothing about it. Adding `ADeployableDeviceActor` as a tracked entity (mirror of the Helicopter pattern) — 30 minutes — fixed it.

## The Rule

**When the user reports "actor X is missing/broken on replay," FIRST verify whether the integration captures and restores X at all.** This takes 5 minutes of grep:

```bash
grep "ObjType_<X>" PluginComponent.cpp
grep "TActorIterator<AGame<X>>" PluginComponent.cpp
grep "Cast<AGame<X>>" PluginComponent.cpp
```

If you find nothing, the answer is "we don't track it, so on replay nothing of ours spawns it." Apply your existing transient-actor capture pattern (in ActionGame: `ObjType_Helicopter`, `ObjType_Drone`, `ObjType_Vehicle` are all clones of the same template). Done.

**Only after confirming you DO track X** should you start theorizing about WHY the tracking is producing wrong output (timing, OnRep invariants, capture-vs-restore order, etc.).

## Why It's Easy to Skip

The deep theories feel productive — they engage with engine internals, level BP execution, sublevel streaming. They generate plausible-sounding hypotheses. But they're irrelevant if the more basic check fails first.

The "do we even track it" check is boring and trivial. That's exactly why it's the right first step — it's so cheap to run that it's never wrong to do first.

## Detection before release

In a debugging session, before writing any theory paragraph or code analysis, ask:

1. Is this a tracking issue (we don't capture/restore X)?
2. Is this a tracking-correctness issue (we capture X but the restore is wrong)?
3. Is this an engine-side or game-side issue independent of our integration?

If you can't answer "no" to (1) without grepping, grep first.

## Cross-reference

- `actions-must-fire-in-player-flow-too.md` — same family of "did you forget to wire it?" mistakes
- `non-character-actors-spawn-and-track.md` — the existing pattern that should be the first thing you mirror
