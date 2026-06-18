---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# Restore timing fundamentally changes what can be restored — pre-BeginPlay sidesteps cascade firing

## The architectural choice

UE world initialization has distinct phases with very different restore semantics:

| Phase | Hook | What state can be restored | Cascade firing needed? |
|---|---|---|---|
| **Pre-BeginPlay** | `FWorldDelegates::OnWorldInitializedActors` | Level-placed actors, BP properties read by `BeginPlay` | **Often no** — BP's natural `BeginPlay` initializes from restored values |
| **Post-BeginPlay** | Custom action-phase hook | Same actors, but with their state machines already running | **Often yes** — BP has already initialized; changing values may not trigger animations / OnReps |

This timing difference is the root reason SaveGame-style restoration "just works" while runtime restoration requires per-class trial-and-error. SaveGame writes data **before** `BeginPlay` runs. The BP's initialization code reads the restored state as "this is how the world is right now" and configures itself accordingly. Animation state machines initialize directly into the correct pose; no transition events are needed.

When restoring at action-phase-start (post-BeginPlay), the BP has already:
- Set its animation state machine into the default pose
- Computed BP-internal "current state" tracking variables based on the default
- Subscribed to state-change events

A reflection-write into a UPROPERTY at this point updates memory but doesn't trigger the BP's change-detection events. The animation state machine never sees a "transition" — it just has a property value that no longer matches its current pose. To compensate, the integration ends up calling specific setter functions per class, found via trial and error, that fire the cascade.

## What pre-BeginPlay restore solves cleanly

Validated on ActionGame's container Blueprint:
- Captured `currentState` ('Lockdown' vs 'Closed') and `bHasLockdown` via reflection on capture.
- At `OnWorldInitializedActors`, before any BeginPlay fired, reflection-wrote the captured values via `FProperty::ImportText`.
- On replay: 5/5 cases that had been unlocked at capture were visibly unlocked from world start. No cascade firing required.

This pattern applies to any BP whose `BeginPlay` reads its UPROPERTYs and configures itself from them — which is the majority of BP authoring conventions.

## What pre-BeginPlay restore does NOT solve

Validated on ActionGame's aerial-vehicle Blueprint:
- Pre-BeginPlay reflection-wrote `DoorState` from `'0'` → `'3'` (captured "both doors open" value).
- Post-BeginPlay diagnostic confirmed `DoorState` was still `'3'` — the BP did NOT overwrite our write.
- Yet: door was visually closed and the vehicle would not accept payload.

The aerial vehicle is an **event-driven state machine**. The "arrived, doors open, accepting payload" mode is a runtime state reached via events (level BP fires arrival → vehicle plays flight sequence → on landing, BP transitions to ready state → opens doors, activates effects, gates payload acceptance). `DoorState` is a *symptom* of being in that state, not the *cause*. Restoring DoorState alone doesn't put the vehicle into the "arrived" mode.

## The two patterns this distinguishes

Every BP-driven actor falls into one of two patterns:

1. **Property-driven init**: `BeginPlay` reads UPROPERTYs and initializes derivative state from them. Most level-placed scripting BPs and configuration-style actors.
2. **Event-driven state machine**: state lives in runtime events and transitions. UPROPERTYs are written by these transitions but don't *drive* them. Typically multi-stage actors (vehicles arriving, NPCs with scripted sequences, animated environment props).

**Pre-BeginPlay reflection restore handles pattern 1 cleanly. Pattern 2 needs additional handling** — either capture the full property + component tree (transform, mesh state, component active flags) and hope the BP doesn't re-init on BeginPlay, or replay the triggering events, or accept partial restoration.

## How to apply

When designing capture/restore architecture:

1. Default to pre-BeginPlay reflection restore for level-placed actors. Hook `FWorldDelegates::OnWorldInitializedActors`. Gate on Player Flow + captured-map match.
2. Identify event-driven-state-machine actors specifically. They're the minority but their bugs are visible. The dump-and-diff workflow (see `architecture/dump-and-diff-workflow-for-state-discovery.md`) reveals them — actors whose state diff is dominated by component activation flags + position changes rather than simple property changes.
3. Use post-BeginPlay restore for truly transient state (player pawn, AI characters, runtime-spawned actors that don't exist at world init).
4. When a "X doesn't restore correctly" bug surfaces, the diagnostic question is: **does this state live in a UPROPERTY the BP reads at init, or in a runtime state machine?** The answer determines which restore tier handles it.

## Why this is universal

`OnWorldInitializedActors` is a stable UE engine delegate available since UE4. The split between BPs that init from properties versus BPs with runtime state machines isn't specific to ActionGame — it's a universal BP authoring choice. Every UE game has both patterns. The proportion varies by game, but the categories are universal.

Piecewise per-class "find the right setter to fire" is what you end up doing when the only available restore window is post-BeginPlay. It works but doesn't scale. Pre-BeginPlay restore eliminates most of the per-class work by construction.
