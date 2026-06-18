---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 3
question: null
sanitized: true
---

# Dump-and-diff against actual world state reveals which UPROPERTYs drive observed behavior

## When this applies

You're investigating "what state needs to be captured to restore behavior X" and you don't already know which UPROPERTY field(s) drive X. Common situations:
- A BP visual state isn't restoring correctly and you don't know which field is the source
- Multiple BP variables exist on an actor; only some matter for replay
- The state lives in a BP class with no readable name hint (e.g., a level-scripting actor instance)
- Cross-system state where the visible effect involves multiple actors

The instinct "open the BP in editor and look at variables" works but is slow, requires editor access, and misses derived state on components. The dump-and-diff workflow gives objective answers from runtime data.

## The workflow

1. **Set up a baseline** — get the world into a state where behavior X is in its DEFAULT condition (e.g., doors closed, cases locked, no escape selected).
2. **Dump baseline**: `Ludeo.DumpWorld baseline` writes every actor's reflected UPROPERTY tree (actor + components) as JSON to `Saved/LudeoWorldDump_baseline.json`. ~10-15 MB for a mission-sized world.
3. **Trigger behavior X** — flip the switch, walk into the extraction zone, whatever causes X to occur in normal play.
4. **Dump altered state**: `Ludeo.DumpWorld with_X` writes the new state to `Saved/LudeoWorldDump_with_X.json`.
5. **Diff**: `python diff_dumps.py baseline.json with_X.json delta.json` — produces a much smaller JSON with only the actors and fields that changed.
6. **Summarize**: `python summarize_diff.py delta.json` groups changes by actor class, showing which fields change across instances.
7. **Focus**: `python focus_diff.py delta.json <ClassSubstring>` shows before/after values for specific classes.

The fields that consistently appear in the diff between baseline and with-X are the candidate state sources for X.

## Why this works better than reading BP graphs

- **Catches derived component state** that BP graph inspection misses (e.g., `UInteractableComponent::bInteractionEnabled` flipping on lock unlock, `StaticMeshComponent::customDepthStencilValue` changing for highlight).
- **Reveals all instances** of changed fields, not just the one BP variable you'd notice in the editor. Many bugs are cross-instance (50 cases all change, only 3 different fields involved).
- **No editor dependency** — works against a packaged build or a session you can't easily open the editor on.
- **Self-documenting** — the JSON file IS the diagnostic record. Future bug investigations can re-run the same dump pairs.

## Pitfalls to expect

- **Dump output is huge** — 400+ MB per dump in UTF-16 with pretty-printing. The diff result is small (1-3 MB) so you only need the dumps long enough to diff them. Default UE `FFileHelper::SaveStringToFile` is UTF-16; consider UTF-8 if you control the dumper.
- **Movement noise dominates** — AI characters, vehicles, replicated movement state all change continuously. The summary script ranks by change-count per class; the top entries are usually noise. Look for the smaller-change-count classes — those tend to be the signal.
- **Capture timing matters** — if the two dumps are 30 seconds apart, you'll see a lot of incidental drift (AI moved, timers advanced). Aim for dumps as close together as possible, ideally only the action that triggers behavior X separating them.
- **Some state is in `CPF_Transient` fields that re-derive every frame** — render bounds, last-pose-tick, replicated-movement. Filter these out of the diff or accept they'll be noise.

## Real example from ActionGame

Investigating "why do containers re-lock on replay":
1. Dump 1: mission start, containers locked (lockdown timeline at lowered position).
2. Player flipped the power switch off.
3. Dump 2: containers visibly unlocked (lockdown timeline at raised position).

`diff_dumps` + `summarize_diff` revealed:
- a door control-panel Blueprint's `bState`: `False` → `True` (the source — the switch state)
- a container Blueprint's `currentState`: `'Lockdown'` → `'Closed'` (derived — container lock state)
- a container Blueprint's `bHasLockdown`: `True` → `False` (derived)
- a container Blueprint's `UInteractableComponent::bInteractionEnabled`: `False` → `True` (derived)
- Lockdown timeline component progress (derived — animation pose)

Without the diff, the natural first guess would have been "capture `bIsLocked` on each case" (a guess at a field name that doesn't exist). The diff revealed the actual fields and showed the cross-actor chain.

## Tools to build

If your skill / integration doesn't have these yet, add:

1. **`Ludeo.DumpWorld <name>` console command** — walks `TActorIterator<AActor>` with `FJsonObjectConverter::UStructToJsonObject` per actor + each owned component. Pretty-printed JSON.
2. **`diff_dumps.py`** — stream-parses two JSON files, emits a smaller JSON with only changed actors/fields. Use `encoding='utf-16'` for UE's default output, or switch the dumper to UTF-8.
3. **`summarize_diff.py`** — tallies changes by actor class for noise ranking.
4. **`focus_diff.py <ClassSubstring>`** — shows full before/after for specific actor classes, paginated.

Roughly ~300 lines of plugin code + ~150 lines of Python total. The investment pays back on the first hard bug.
