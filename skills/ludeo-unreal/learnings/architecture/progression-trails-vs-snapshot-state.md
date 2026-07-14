---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: 2
question: "Does this game have progression-trail state (scripted milestones, completed objectives, mission-prop usage, level-blueprint event history) and not just snapshot state? If so, capture the time-ordered event sequence and replay it via the game's own notifiers before applying snapshot state."
sanitized: true
---

# Progression Trails vs Snapshot State

## The Distinction

There are **two kinds of state** in a game integration. The skill previously treated everything as one kind. That's wrong.

| Kind | Examples | How to restore |
|------|----------|----------------|
| **Snapshot state** | Player position, health, weapon equipped, enemy AI positions, current phase enum, ability on/off, inventory | Capture current values per-tick. Apply directly on restore. Standard Stage 3 pattern. |
| **Progression trail** | Milestones passed, objectives completed, mission props used (devices placed, cameras disabled, extraction zones activated), level-blueprint event history, tutorial flags | Capture the **sequence of events** as a time-ordered array. On restore, replay the trail by calling the game's own notifier functions before applying snapshot state. |

## Why Snapshot Restoration Fails on Trail State

Scripted systems respond to *what has happened*, not to *a scalar value of "current objective."*

If you capture `CurrentMilestone = 5` at capture time and restore it at playback time 0:
- The level blueprint doesn't know milestones 1-4 have passed — it runs its scripted logic starting from milestone 1
- Briefing voiceover, setup-phase NPC spawns, tutorial prompts all fire in order from the beginning
- The player sees "press X to move" at mid-mission
- Extraction zones re-activate, deployables reset, cameras re-fire alarms

You cannot hack around this with suppress windows (they race), late-sweep destruction (fragile), or one-time metadata writes (scripted systems don't read them).

## The Diagnostic: "What Breaks on Restore?"

For every subsystem discovered in Stage 1, ask:

> *If I capture this subsystem's current values at time T and restore them at time 0 (ignoring everything that happened between), what breaks?*

- **Nothing breaks** → snapshot state, standard Stage 3 pattern
- **Scripted logic re-executes, stale VO, early-phase spawns, tutorial prompts** → trail state, needs capture + replay

## The Rule: Trails Are Stage 3, Not Stage 6

If a subsystem is classified as `trail + loadBearing` (required for the curated slice's demo to feel correct), it is Stage 3 work. Full stop.

**Stage 6 is for BROADER coverage** — more entities, more actions, more maps. It is NOT for backfilling load-bearing state missed in Stage 3. If Stage 6 discovery surfaces a trail subsystem that's required for the curated slice demo, Stage 3 isn't actually done — go back.

## Trail Capture Pattern

**Creator Flow — accumulate events:**
```cpp
void OnMilestonePassed(FGameplayTag Tag, float Time)
{
    if (bIsPlayerFlow) return;  // Creator Flow only
    MilestoneTrail.Add({Tag.ToString(), Time});
    GameMetadataWritableObj.WriteData("MilestoneTrail", MilestoneTrail);
}
```

**Player Flow — replay in order, BEFORE snapshot:**
```cpp
for (const auto& Entry : CapturedTrail)
{
    UMissionDirector::NotifyClientPassedMilestone(Entry.Tag);
}
// THEN apply snapshot state — positions, health, etc.
```

Order matters: replay trail first so scripted systems advance to the captured moment. Apply snapshot state on top.

## ActionGame Evidence

- Stage 3 initially deferred milestone/objective tracking as "Stage 6 enrichment"
- Demo broke: level BP re-executed early-phase logic on restore, queued briefing VO, spawned early NPCs
- Agent tried suppress windows: "sometimes we win, sometimes not"
- Agent tried late-sweep NPC destruction: fragile, didn't fix root cause
- Eventually pulled Stage 6a/6b work back into Stage 3 to capture milestone trail + level BP state
- **Had the agent classified milestone/objective as `trail + loadBearing` in Stage 1 and planned capture in Stage 3, this week of rework would not have happened.**

## Red Flags (stop and reclassify if you think these)

- "We'll add mission progression tracking in Stage 6"
- "The level blueprint will figure it out on restore"
- "We can suppress the briefing VO in Player Flow" (for a load-bearing scripted system)
- "Enrichment will handle objectives later"
- "This state is too game-specific for the MVP"

Each one is a signal that a trail subsystem has been misclassified as snapshot, or misclassified as enrichment. Re-run the diagnostic.
