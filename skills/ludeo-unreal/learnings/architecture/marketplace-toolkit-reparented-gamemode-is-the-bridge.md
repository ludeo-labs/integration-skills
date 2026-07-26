---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: 2
question: "Is the core gameplay implemented by a marketplace Blueprint toolkit (ATBTT, a shooter kit, etc.)? If yes: check the BP inspection report's parentClass column for toolkit game-mode/state BPs reparented onto the studio's C++ classes — that reparent point is the C++ integration surface."
sanitized: true
---

# Marketplace-toolkit games: the reparented GameMode is the C++↔BP bridge

## Precondition

The game's moment-to-moment gameplay (units, turns, combat) is implemented by a
marketplace Blueprint toolkit (here: Advanced Turn Based Tile Toolkit, ATBTT), while the
studio's own C++ module owns the meta layer (campaign, economy, save system).

## The Pattern

Studios integrating a BP toolkit almost always **reparent the toolkit's GameMode BP onto
their C++ GameMode base**. In the BP inspection report this shows up as:

```
/Game/<Toolkit>/Core/BP_<ToolkitGameMode>   parentClass: <GameCppGameMode>
```

That reparent point is the entire C++ lifecycle surface:

- **Session-unit boundaries land in C++.** The C++ GameMode base had: a
  "finished spawning units" callback (toolkit calls it when the battle is ready — your
  room-open hook) and mission-complete success/fail/surrender BlueprintCallable methods
  with EMPTY C++ bodies, invoked from BP at battle end (your room-close hook — add a
  multicast broadcast in the shared private mission-end method they funnel into).
- **Per-entity / per-turn events stay BP-side.** Unit damage, death, turn changes live in
  toolkit BPs (turn manager, unit actors + their components) — plan a BP→C++ bridge or
  reflection-based polling for those in Stages 3-4; do NOT expect C++ delegates.
- **A second customization layer exists.** Look for a studio-owned Content folder with
  child BPs of the toolkit classes + DataTables (level lists, quick-play modes). The
  child game-mode BP there (not the toolkit's own) is the slice's actual game mode.

## Meta→battle handoff is the restore path

The meta layer passed battle setup (units to spawn, loadout, objectives) through a C++
transfer-handler subsystem: meta code writes a transfer struct before travel; the GameMode
reads it on arrival and feeds the toolkit's spawner. **Player Flow must drive this same
handoff** — a raw `open <map>` loads the level without spawn data. Restoring = populate
the transfer handler from captured data, travel, let the game spawn naturally, then apply
per-unit captured state.

## How to find all this fast

1. BP inspect report → scan `parentClass` for toolkit BPs parented to game C++ classes.
2. Read the C++ GameMode base fully (it is usually small — the studio kept it thin).
3. Grep the meta module for "transfer"/"spawn data" structs flowing into the GameMode.
4. The toolkit's own classes are publicly documented — read the marketplace docs for its
   turn/spawn/event model instead of reverse-engineering BPs from scratch.
