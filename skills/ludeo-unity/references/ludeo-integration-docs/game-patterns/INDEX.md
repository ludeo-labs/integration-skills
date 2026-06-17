# Game Patterns Index (Unity)

> **Purpose:** Genre- and structure-specific knowledge for Ludeo Unity integration.
> **For:** AI agents — load only the pattern file(s) matching the game.
> **How to use:** Read this index, classify the game, load the relevant file(s).

All catalogs here are game-design knowledge (WHAT to capture); the **how** — Unity search idioms,
`SendAction` wiring — lives in phases 6/7. Action names map to `[SDK]`
`LudeoGameplaySession.SendAction(string)` (via the `[Layer]` `LudeoController.SendAction`).

---

## Pattern Files Come in Two Shapes

- **Genre patterns** (shooter, rts, racing) describe *what* a Gameplay Session captures — actions,
  search keywords, tracking checklists.
- **Structural patterns** (open-world, procedural) describe *how* the world is bounded and identified
  when the genre catalog isn't enough — because the game has no per-level scenes (`open-world.md` +
  `open-world-tracking.md`), or because its scenes are **containers whose content is assembled at load
  from data + RNG** (`procedural-world.md`).

A streaming-world RPG loads **both** open-world shapes plus the relevant genre file(s). A roguelike
loads `procedural-world.md` plus its combat genre file(s). The structural axes are **orthogonal** — a
game can be procedural *and* level-based, or procedural *and* streaming; load whatever applies.

## Available Patterns

| File | Shape | Applies to | Load when |
|------|-------|------------|-----------|
| [shooter.md](./shooter.md) | Genre | FPS / TPS / Arena Shooter | Guns, projectiles, health/damage combat, PvE or PvP |
| [rts.md](./rts.md) | Genre | Real-Time Strategy | Unit production, base building, resources |
| [racing.md](./racing.md) | Genre | Racing / Kart / Sim Racing | Laps, race finish, overtakes |
| [rpg.md](./rpg.md) | Genre | Action RPG / open-world RPG / JRPG / MMORPG / looter | Character stats/leveling, quests, inventory/equipment, dialogue, factions |
| [survival-sandbox.md](./survival-sandbox.md) | Genre | Survival / crafting / sandbox / base-builder | Gathering, crafting/building, hunger/thirst meters, placing/destroying world structures |
| [open-world.md](./open-world.md) | Structural (boundaries) | Open-world RPG / sandbox / MMO / streaming world | No per-level scenes; boundaries are state-machine or event-driven, not `SceneManager.LoadScene` / `StartMatch` |
| [open-world-tracking.md](./open-world-tracking.md) | Structural (tracking) | Same — when mapping/implementing object tracking | The world streams in/out; you're in phase 8–9 and need the streaming-world tracking delta over `06` |
| [procedural-world.md](./procedural-world.md) | Structural (assembly + identity) | Roguelike / roguelite / procedural dungeon / wave-survival / daily-seed | The scene is a **container**; run content is assembled at load from data + RNG, so capturing "which scene" can't relocate the moment and reload **re-rolls** content. Load when a run/level *builder* or *pool* + `Random`/seed drives level content |

## How the Agent Should Use These Files

1. **Check the structural axes first (there are two, and they're orthogonal).**
   - *No per-level scenes?* (open-world RPG, sandbox, MMO, streaming world — `CODE_MAP.session_boundaries`
     has the `{ model, start_sites[], exit_sites[], pause_overlay[] }` sub-structure) → load
     [open-world.md](./open-world.md) before any genre file (it answers "where does a Gameplay Session
     begin and end"), and when you reach object tracking (phases 8–9) also load
     [open-world-tracking.md](./open-world-tracking.md) (presence ≠ existence, world/cell state, identity
     across streaming).
   - *Scenes are containers whose content is assembled at load from data + RNG?* (roguelike, procedural
     dungeon, wave-survival — a level/run *builder* or *pool* + `Random`/seed drives content;
     `CODE_MAP.session_boundaries.assembly` is `"procedural"`) → load
     [procedural-world.md](./procedural-world.md). Capturing "which scene" can't relocate the moment and
     reload re-rolls content, so you capture the **generation inputs** instead.
   - A game can hit **both** (a streaming procedural world) or **neither** (a plain level-based game).
     Load whatever applies, *in addition to* the genre file(s).
2. **Determine genre** — web search the game name, or ask the user if not findable.
3. **Load 1–2 matching genre files** — hybrid games may need multiple. Common mappings: open-world RPG
   (Daggerfall/Skyrim) → `rpg.md`; survival/sandbox (Valheim/Minecraft) → `survival-sandbox.md`;
   open-world action (GTA/Red Dead) → `shooter.md` + `racing.md` (driving) + `rpg.md` (progression);
   MMORPG → `rpg.md`. Always pair these with the structural files from step 1 when the game streams.
4. **Use the action catalog as _candidates_, not a checklist — read the Tier column.** Capture **T1**
   by default; capture **T2** only if it's scored or a notable one-shot beat in *this* game; treat **T3**
   (movement, reloads, orders, pickups of tracked state — high-frequency noise or state) as drop unless
   exceptionally scored. Search the codebase for each surviving candidate, then apply **phase 6's keep
   test** before capturing it. Capturing T3 rows bloats the Ludeo and buries real highlights.
5. **Use the search keywords** to grep for relevant code patterns (finding ≠ capturing — the keep test
   decides what's actually captured).
6. **Use the tracking checklist** to validate completeness after object tracking is implemented (phase 9).

## File Structure (Genre Files)

Genre files (`shooter.md`, `rts.md`, `racing.md`, `rpg.md`, `survival-sandbox.md`) follow a
three-section structure:

### Section 1: Actions Catalog
- Action names, descriptions, Ludeo objective/scoring potential, grouped by category, each row carrying
  a **Tier** column. **Candidates, not a capture list:** **T1** = capture (signature scored beats),
  **T2** = capture only if scored/notable in *this* game, **T3** = usually drop (tracked state /
  high-frequency noise). Empty objective + scoring is almost always T3. Tier is **orthogonal to scope**
  (player-scoped vs global, phase 6) — a row can be T1 *and* global.

### Section 2: Search Keywords
- Function/variable name fragments to grep for, grouped by category. Include Unity idioms
  (`OnTriggerEnter`/`OnCollisionEnter`, `UnityEvent`, `[SerializeField]`, `On*`/`Handle*` handlers).
  These are starting points — discover game-specific patterns too.

### Section 3: Tracking Checklist (Scaffolding)
- What objects and properties typically matter for this genre, with each section tiered by restoration
  priority: **CRITICAL** (restore or the moment is visibly wrong), **IMPORTANT** (restore for fidelity),
  **OPTIONAL** (situational/cosmetic). Types are Unity (`Vector3`, `Quaternion`, …). Used as a
  validation checklist in phase 9, not a search guide.

**Structural files** (`open-world.md`, `open-world-tracking.md`, `procedural-world.md`) have a different
shape — `open-world.md` is session-boundary doctrine (`OpenRoom` bind-point trade-offs,
pause/restoration interactions); `open-world-tracking.md` is the streaming-world tracking delta over
`06` (presence ≠ existence, world/cell objectTypes, identity across stream cycles); `procedural-world.md`
is the non-deterministic-assembly doctrine (scene ≠ content, capture the generation inputs, re-drive the
generator + suppress the re-roll on restore). They are loaded *in addition to* a genre file, not instead
of one.

## Adding a New Genre or Structural Pattern

For a new **genre**, create a `.md` file following the three-section genre structure above. For a new
**structural pattern** (e.g. arcade "1 life = 1 session", roguelike "1 run = 1 session"), follow the
shape of `open-world.md`. Add it to the table with the correct shape tag. No other changes needed.

## Important Notes

- Genre files describe WHAT to look for, not HOW to find it (that's the phase's job).
- **Most catalog actions are player-scoped** — `Kill` means the *player* killed, `Death` means the
  *player* died; map them only where the player is actor/subject (or, in no-avatar games like RTS, the
  player's owned/issued events) and guard non-player-actor sites in phase 7. **But match/round/race/wave
  lifecycle and shared objectives are global** (`RaceStart`, `MatchWin`, `WaveComplete`,
  `ObjectiveComplete`) — they apply to the whole session, fire once, no guard. See phase 6's
  "Attribute correctly — player-scoped vs. global".
- Keywords are hints, not exhaustive — every codebase names things differently.
- Games often blend genres — load multiple files and merge the action catalogs.
- When in doubt about genre, start with the closest match and adjust.
