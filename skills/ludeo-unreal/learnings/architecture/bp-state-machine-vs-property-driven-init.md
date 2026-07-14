---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# BP actors fall into two restoration categories — distinguish them before designing capture/restore

## The two patterns

Almost every UE BP-driven actor falls into one of two patterns:

### Pattern 1 — Property-driven init

BP `BeginPlay` (and/or AnimBP graph init) reads UPROPERTYs and configures
derivative state from them. The properties ARE the source of truth.

Examples:
- A lock that has `bIsLocked: bool` — BeginPlay reads it, sets interactable enabled, configures outline asset, picks visual mesh state.
- A display case with `currentState: enum {Closed, Lockdown, Cut, Broken}` — BeginPlay reads it, plays appropriate idle animation, configures collision.
- A level-scripting actor with a `bRouteVariantSelected: bool` — BeginPlay reads it, configures HUD markers and spawn pools accordingly.

Restoration approach: **reflection-write the relevant UPROPERTYs at pre-BeginPlay** (`FWorldDelegates::OnWorldInitializedActors`). BP's natural BeginPlay reads the restored values and configures everything downstream. No cascade events needed because nothing "changed" from BeginPlay's perspective — the value was that way from the start.

### Pattern 2 — Event-driven state machine

BP's runtime state machine drives behavior via events. Variables get
updated as side effects of state transitions but don't drive the state
machine itself. The current "mode" is reached by event sequences, not
by property reads.

Examples:
- A helicopter with a multi-stage arrival sequence: BeginPlay puts it in a "flight" mode (in sky); a level BP event triggers transition to "landing"; on landing-complete event, doors open and bag acceptance gate flips. Trying to set the final mode's properties directly skips the intermediate state machine and leaves derived runtime state inconsistent.
- An NPC with scripted sequences whose state depends on which event was last fired.
- Animation graphs that use `Sequence Player` / `Montage` with explicit play-from-frame logic — restoring the bool that ENABLES the sequence doesn't restart the sequence at the captured progress.

Restoration approach: pre-BeginPlay reflection-write of single properties is INSUFFICIENT. Options include:
1. Capture and restore the full property + component tree (transform, all component active flags, all derived state) and hope BeginPlay doesn't re-initialize.
2. Replay the trigger events that brought the actor to the captured state.
3. Call specific public setter functions (e.g., `SetDoorOpen(Door, bOpen)` per-door) in the right order to walk through the state machine.
4. Accept partial restoration — derived gameplay state may still recover from natural play.

## How to distinguish them

The dump-and-diff workflow (see `architecture/dump-and-diff-workflow-for-state-discovery.md`) reveals the pattern. For an actor in two state snapshots:

- **Few UPROPERTYs change between snapshots, in a small number of clear "primary" fields** → likely Pattern 1. Restoring those fields pre-BeginPlay should work.
- **Many UPROPERTYs change, spread across components + transform + activation flags + position** → likely Pattern 2. The actor isn't just "in a different value", it's in a different *mode*. The visible state is the sum of many fields working together.

ActionGame examples:
- **Pattern 1**: a container Blueprint — diff between locked and unlocked shows ~6 fields changed (currentState, bHasLockdown, lockdown timeline progress, mesh relative location). Pre-BeginPlay reflection-write of `currentState` + `bHasLockdown` produced visible restoration on replay.
- **Pattern 2**: an aerial-vehicle Blueprint — diff between in-sky and arrived-at-destination showed ~30 fields changed across the actor + its mesh component + multiple Niagara components + audio components + cargo attach points, plus a 25000-unit position change. Pre-BeginPlay reflection-write of just `DoorState` left the vehicle in sky position with bay-receive disabled.

## The hidden cost of Pattern 2

When you find a Pattern 2 actor, your options are all costly:
- **Full-state restoration** is generic but bulky and unverified per-class
- **Event replay** requires understanding the BP graph and finding the right trigger
- **Per-class setter sequencing** is trial-and-error per actor

Most large-game integrations have a small number of Pattern 2 actors (extraction vehicles, scripted-sequence NPCs, mid-mission spawnables) and a large number of Pattern 1 actors. The 80/20 is real — and Pattern 1 is the easy 80%.

When triaging which actor classes to support, sort the candidates by pattern. Knock out the Pattern 1 set first via reflection restore. Treat each Pattern 2 actor as its own design problem.

## How to apply

When a new "X doesn't restore correctly" bug surfaces:

1. Dump-and-diff to identify which fields change.
2. Inspect the diff shape:
   - Single field or small cluster → likely Pattern 1, try reflection-write at pre-BeginPlay
   - Many fields including components + position → likely Pattern 2, design per-class
3. Don't conflate the two — a Pattern 2 actor doesn't "need a better Pattern 1 fix", it needs a different mechanism entirely.

This distinction is universal across UE-based games. The proportion of Pattern 1 vs Pattern 2 actors varies by genre (mission-based shooters skew Pattern 2 for set-pieces, RPGs skew Pattern 1 for ambient state), but both exist in any game with meaningful gameplay state.
