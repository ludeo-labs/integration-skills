# Game Patterns Index (Unreal)

> **Purpose:** Genre- and structure-specific knowledge for Ludeo Unreal Engine integration.
> **For:** AI agents — load only the pattern file(s) matching the game.
> **How to use:** Read this index, classify the game, load the relevant file(s).

All catalogs here are game-design knowledge (WHAT to capture); the **how** — Unreal search idioms,
`SendAction` wiring — lives in `references/phase-05-actions.md`. Action names map to the
Ludeo subsystem / DataWriter `SendAction` call (see `references/phase-05-actions.md`
and `references/sdk-reference/`).

---

## Pattern Files Come in Two Shapes

- **Genre patterns** (shooter, rts, racing) describe *what* a Gameplay Session captures — actions,
  search keywords, tracking checklists.
- **Structural patterns** (open-world) describe *how* a streaming-world Gameplay Session is bounded
  (`open-world.md`) and *what* it captures (`open-world-tracking.md`) when the genre catalog isn't
  enough — typically because the game has no per-map gameplay levels.

A streaming-world RPG loads **both shapes**: `open-world.md` + `open-world-tracking.md` for the
structural session boundary and tracking delta, plus the relevant genre file(s) for actions/tracking.

## Available Patterns

| File | Shape | Applies to | Load when |
|------|-------|------------|-----------|
| [common.md](references/game-patterns/common.md) | Baseline | All games | Universal per-entity capture (transform, look/aim rotation, camera POV+FOV, health, alive, score). Load ALONGSIDE the genre file. |
| [shooter.md](references/game-patterns/shooter.md) | Genre | FPS / TPS / Arena / Battle Royale / Tactical shooters | Guns, projectiles, health/damage combat, PvE or PvP |
| [rts.md](references/game-patterns/rts.md) | Genre | Real-Time Strategy | Unit production, base building, resources |
| [racing.md](references/game-patterns/racing.md) | Genre | Racing / Kart / Sim Racing | Laps, race finish, overtakes |
| [rpg.md](references/game-patterns/rpg.md) | Genre | Action RPG / open-world RPG / JRPG / MMORPG / looter | Character stats/leveling, quests, inventory/equipment, dialogue, factions |
| [survival-sandbox.md](references/game-patterns/survival-sandbox.md) | Genre | Survival / crafting / sandbox / base-builder | Gathering, crafting/building, hunger/thirst meters, placing/destroying world structures |
| [turn-based.md](references/game-patterns/turn-based.md) | Genre (provisional) | Turn-based tactics / SRPG / grid + initiative combat (XCOM-likes) | Discrete turns, action points, grid movement, unit-by-unit actions. NOTE: also carries turn-based capture-cadence (§4) and restore-timing/limbo (§5) sections. |
| [open-world.md](references/game-patterns/open-world.md) | Structural (boundaries) | Open-world RPG / sandbox / MMO / streaming world | No per-map gameplay levels; boundaries are state-machine or event-driven, not `UGameplayStatics::OpenLevel` / `ServerTravel` / World Partition per map |
| [open-world-tracking.md](references/game-patterns/open-world-tracking.md) | Structural (tracking) | Same — when mapping/implementing object tracking | The world streams in/out; you need the streaming-world tracking delta over the curated-slice object tracking in `references/phase-03-map-objects.md` |

## How the Agent Should Use These Files

0. **Always load `references/game-patterns/common.md` alongside the matching genre file(s).** It
   carries the universal capture baseline (player transform, look/aim rotation, camera POV+FOV,
   health, alive, score) so genre files only add genre-specific items on top.
1. **Check the structural axis first.** If the game has no per-map gameplay levels (open-world RPG,
   sandbox, MMO, streaming world — boundaries are state-machine or event-driven, not
   `UGameplayStatics::OpenLevel` / `ServerTravel` per map → load
   [open-world.md](references/game-patterns/open-world.md) before any genre file — it answers
   "where does a Gameplay Session begin and end" for these games. When you reach object tracking
   (full-game expansion), also load
   [open-world-tracking.md](references/game-patterns/open-world-tracking.md) for the
   streaming-world tracking delta (presence ≠ existence, world/cell state, identity across
   streaming).
2. **Determine genre** — web search the game name, or ask the user if not findable. Genre
   classification and file loading happens in `references/phase-01-mapping.md` (Phase 0
   intake feeds Phase 1).
3. **Load 1–2 matching genre files** — hybrid games may need multiple. Common mappings: open-world RPG
   (Daggerfall/Skyrim) → `rpg.md`; survival/sandbox (Valheim/Minecraft) → `survival-sandbox.md`;
   open-world action (GTA/Red Dead) → `shooter.md` + `racing.md` (driving) + `rpg.md` (progression);
   MMORPG → `rpg.md`. Always pair these with the structural files from step 1 when the game streams.
   If the game is turn-based (initiative order / AP / grid), load
   [turn-based.md](references/game-patterns/turn-based.md) — it also covers the
   turn-boundary-vs-per-tick capture-cadence decision (§4) and turn-start restore timing /
   "don't land in limbo" (§5), which are turn-based-specific structural concerns.
4. **Use the action catalog** as a shopping list — search the codebase for each.
5. **Use the search keywords** to grep for relevant code patterns.
6. **Use the tracking checklist** to validate completeness after object tracking is implemented
   (curated-slice baseline in `references/phase-03-map-objects.md`; enrichment pass in
   `references/phase-07-expansion.md`).

> **MVP scope (curated-first):** In Phases 3–5, scope catalog use to your **curated slice**
> (`integration.json → curatedSlice`); the full catalog applies at expansion (Phase 7).

## File Structure (Genre Files)

Genre files (`shooter.md`, `rts.md`, `racing.md`, `rpg.md`, `survival-sandbox.md`,
`turn-based.md`) follow a three-section structure:

### Section 1: Actions Catalog
- Action names, descriptions, Ludeo objective/scoring potential, grouped by category.

### Section 2: Search Keywords
- Function/variable name fragments to grep for, grouped by category. Include Unreal idioms
  (`UFUNCTION`, `On*`/`Handle*` handlers, `AActor`, `UActorComponent`, Blueprint callable hooks).
  These are starting points — discover game-specific patterns too.

### Section 3: Tracking Checklist (Scaffolding)
- What objects and properties typically matter for this genre. Types map to the Unreal DataWriter
  set-attribute calls; see `references/phase-04-tracking-restore.md` and
  `references/phase-05-actions.md`. Used as a validation checklist, not a search guide.

**Structural files** (`open-world.md`, `open-world-tracking.md`) have a different shape —
`open-world.md` is session-boundary doctrine (`OpenRoom` bind-point trade-offs, pause/restoration
interactions); `open-world-tracking.md` is the streaming-world tracking delta over the curated-slice
baseline (presence ≠ existence, world/cell objectTypes, identity across stream cycles). They are
loaded *in addition to* a genre file, not instead of one.

## Adding a New Genre or Structural Pattern

For a new **genre**, create a `.md` file following the three-section genre structure above. For a new
**structural pattern** (e.g. arcade "1 life = 1 session", roguelike "1 run = 1 session"), follow the
shape of `open-world.md`. Add it to the table with the correct shape tag. No other changes needed.

## Important Notes

- Genre files describe WHAT to look for, not HOW to find it (that's the phase's job).
- Keywords are hints, not exhaustive — every codebase names things differently.
- Games often blend genres — load multiple files and merge the action catalogs.
- When in doubt about genre, start with the closest match and adjust.
