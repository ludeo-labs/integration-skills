# Open-World / Streaming-World Pattern (Unity)

> **Applies to:** Open-world RPGs (Daggerfall Unity, Skyrim/Fallout-likes, Witcher-likes), open-world
> action (GTA/Red Dead-likes), sandbox/survival (Minecraft, Valheim, 7 Days to Die), MMOs, and any
> Unity game with a continuous streaming world rather than discrete per-level `.unity` scenes.
>
> **Load when:** the project has **no per-level gameplay scenes**, the world streams in/out (terrain,
> cells, chunks, Addressables), and session boundaries are driven by a **state machine or event
> dispatcher** — *not* by `SceneManager.LoadScene` / `StartMatch` / `LoadLevel`.
>
> **This is a structural pattern, not a genre pattern.** Unlike `shooter.md` / `rts.md` / `racing.md`
> (which catalog actions and trackable objects), this file is about **session lifecycle**: where a
> Gameplay Session begins and ends when there is no scene load to bracket it.

> **Legend:** `[SDK]` = Ludeo package API (signatures in
> [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)) · `[Layer]` = prescribed façade
> ([`../unity/REFERENCE-ARCHITECTURE.md`](../unity/REFERENCE-ARCHITECTURE.md)) · `[Unity]` = engine API.

---

## 1. The Boundary Rule

**One continuous live run = one Gameplay Session.** Length is irrelevant. A 100-hour Daggerfall
play-through is one `LudeoGameplaySession`, same as a 90-second deathmatch round.

This is **not** a redefinition. The Ludeo Session / Gameplay Session model
([`00-CRITICAL-REQUIREMENTS.md` → KEY CONCEPT](../00-CRITICAL-REQUIREMENTS.md),
[`05-LIFECYCLE-MANAGEMENT.md` → Two lifetimes](../05-LIFECYCLE-MANAGEMENT.md)) defines a Gameplay
Session as *one playable moment* — the `(level, match, run)` examples are illustrative, not
constraining. For a streaming world, the **playable moment is the live run itself**.

```
Ludeo Session  ── InitLudeoSession + Activate at launch, released at quit ──────┐
                                                                                │
   Gameplay Session 1  ── new-game ────────────── death ──────┐                 │
   Gameplay Session 2  ── load save ───────── back-to-menu ───┤                 │
   Gameplay Session N  ── load save ─────────── quit ─────────┘                 │
                                  app quit ───────────────────────────────────► ┘
```

## 2. Is / Isn't a Boundary

| Event | Boundary? | Why |
|---|---|---|
| New game started | ✅ Start | First live frame of a fresh run → `OpenRoom` |
| Load save (from menu) | ✅ Start | First live frame of a resumed run → `OpenRoom` |
| Player death (permadeath) | ✅ End | Run is over → `End` |
| Return to main menu | ✅ End | Player exited the run → `Abort` |
| Quit to desktop | ✅ End | Process is leaving → `End`/`Abort` on `OnApplicationQuit` |
| Load a *different* save while in-game | ✅ End-then-start | `Abort` current run, then `OpenRoom` for the new run |
| Dungeon / interior / building enter / exit | ❌ | Same run, different cell |
| Fast travel | ❌ | Same run, teleport |
| World streaming (chunk/cell/Addressables in/out) | ❌ | The SDK doesn't see streaming |
| Sleep / wait / time-skip | ❌ | Same run, time advanced |
| Day / night transition | ❌ | Same run |
| Pause menu / inventory / map | ❌ | Local pause overlay, not a boundary (see §5) |
| Dialogue / conversation / cutscene | ❌ | Same run, modal UI / scripted segment |
| Ludeo overlay opened mid-play | ❌ for the boundary | Pause via [CR-011](../00-CRITICAL-REQUIREMENTS.md) (`Time.timeScale = 0f`), **not** `End` |

The principle: **only end the Gameplay Session when the live run itself ends.** Everything else is
"inside one run."

## 3. Where to Bind `OpenRoom`

[`05-LIFECYCLE-MANAGEMENT.md`](../05-LIFECYCLE-MANAGEMENT.md) calls `OpenRoom` `[SDK]` "when the
match **starts loading**" so SDK async latency hides under the load. For streaming-world games there
are three valid bind points, trading latency-hiding for proximity to actual gameplay:

| Bind point | Pro | Con |
|---|---|---|
| **Earliest** — the dispatcher that initiates a new/load run (e.g. Daggerfall's `StartGameBehaviour.InvokeStartMethod` for `NewCharacter` / `LoadDaggerfallUnitySave`) | Maximum latency hiding | The chain may complete long before the player is in control |
| **Canonical** *(recommended)* — the game's own "gameplay began" event (e.g. `OnStartGame`/`OnNewGame`, or a state-machine transition into the in-game state) | One canonical, well-subscribed signal; matches how the game already thinks about "the run started" | Slightly less latency hiding |
| **Latest** — the moment the player has control (state machine reaches `Game`, input unlocked) | `Begin` lands right at gameplay start; no gap | Gives up the loading window entirely |

**Default to the canonical event.** Bind the `[Layer]` creator-flow `InitRoom` (→ `OpenRoom` `[SDK]`)
to it. Use the earliest bind point only if the canonical event fires too late to hide visible startup
time.

## 4. The Existing `RoomReady + AddGamePlayer` Gate Is Sufficient

You may worry: "if `OpenRoom` fires at loading start but the state machine doesn't reach `Game` for
several seconds, won't `Begin` fire before the world is live?"

**No third gate is needed.** The `[Layer]` flow already gates `Begin` `[SDK]` on **`AddGamePlayer`
success + the `RoomReady` notification** — both SDK-side signals (see
[`05-LIFECYCLE-MANAGEMENT.md`](../05-LIFECYCLE-MANAGEMENT.md) and `unity/REFERENCE-ARCHITECTURE.md`:
`HandleRoomReady` → `onRoomReady` → `BeginGameplay`). Why this is safe even before the world is live:

- **Sampling is gated by your own in-gameplay flag.** Per [CR-005](../00-CRITICAL-REQUIREMENTS.md),
  `UpdateStateObjects()` `[Layer]` only runs while `m_gameplayActive` / your "in gameplay" state is
  true. Between `Begin` and the world becoming live, the sampler is dormant — nothing is captured.
- **Actions only fire on real gameplay events.** `SendAction` `[SDK]` is hooked to kills / pickups /
  quest completions and is itself gated on `isGameplayActive` (`LudeoController.SendAction`). The
  loading sequence generates no action calls.
- **The first captured frame is the real first gameplay frame.** The gap between `Begin` and "world
  live" is dead time on the SDK side — invisible in the captured Ludeo.

So: keep the two-signal gate (`AddGamePlayer` done **and** `RoomReady`). Do **not** add a third
condition. The safety net is the sampler gate inside `Update` `[Unity]`, not a third callback.

## 5. Pause Coverage

Per [CR-011](../00-CRITICAL-REQUIREMENTS.md), the Ludeo overlay opening mid-play must **freeze the
simulation** — not just input. In a streaming world:

- **Use the game's existing pause primitive** if it freezes the sim (e.g. Daggerfall's
  `GameManager.PauseGame()` / `StateManager.Paused`); the `AddNotifyPauseGame` `[SDK]` handler drives
  it (or sets `Time.timeScale = 0f` `[Unity]`). If the game's pause only stops input, build a sim
  freeze.
- **Streaming jobs / coroutines** (terrain Jobs, asset loading, AI ticks) must also be paused if they
  **advance world state**. Background asset *I/O* that doesn't mutate gameplay state can keep running.
- Track the overlay pause (CR-011) and the post-Ludeo-load restore freeze
  ([CR-010](../00-CRITICAL-REQUIREMENTS.md)) as **two independent flags** — the engine is paused iff
  *either* is set. One shared boolean lets `ResumeGame` unfreeze a mid-restoration pause, or
  `RoomReady` cancel a player-opened overlay.

## 6. Restoration: Tearing Down the Live Run

When `LudeoSelected` `[SDK]` fires mid-run, the player wants to play *the captured moment*, not their
current save. The teardown is the same shape as end-of-run, but **the `LudeoSession` itself
survives**:

1. Tear down the current Gameplay Session + Room: `[Layer]` `EndGameplay`/`AbortGameplay`
   (→ `End`/`Abort` `[SDK]` → `CloseRoom` `[SDK]`).
2. **Do not** dispose the `LudeoSession` or quit. It stays alive for the play flow.
3. Reconstruct the world to the Ludeo's captured state — your existing **load-save plumbing** is the
   natural fit (the Ludeo is a "save file from elsewhere").
4. Open a fresh Room **for the Ludeo**: `[Layer]` play-flow `InitRoom` → `OpenRoom` `[SDK]` with the
   `ludeoId` (`CreateOpenRoomDataForLudeo()` `[Layer]`) → `AddGamePlayer` → `RoomReady` → `Begin`.
5. The `RoomReady` handler doubles as the **post-Ludeo-load resume**: `Time.timeScale = 1f` `[Unity]`
   → apply restored state (two-pass) → `Begin` `[SDK]` ([CR-010](../00-CRITICAL-REQUIREMENTS.md);
   detail in `07-RESTORATION-PATTERNS.md` once authored).

For an open-world game this is closer to "load-while-in-game" than "return-to-menu." If the game has
a clean "load this save now, abort the current run" path, route Ludeo restoration through it.

## 7. The Sandbox Edge Case (Minecraft / Valheim / 7 Days)

If the game is genuinely indefinite — no death, no permadeath, no narrative end — the run is bounded
by **load → play → save-and-exit**. That's still one Gameplay Session:

- **Start** — world load complete (single-player) or server-join complete.
- **End** — save-and-exit, or disconnect from the world.

Long sessions are fine. What matters is that the boundaries map to clean **points of perfect world
state** — the moments the game itself considers safe to persist or close.

## 8. Worked Mapping — Daggerfall Unity

| Lifecycle event | Game signal `[Unity]`/game | SDK / layer call |
|---|---|---|
| Game launch | `DaggerfallUnityApplication.SubsystemInit` → `GameManager.Awake` | `LudeoManager.InitLudeoSession` `[SDK]` → `LudeoSession.Activate` `[SDK]` |
| New run begins | `StartGameBehaviour.OnNewGame` / `OnStartGame` *(recommended bind point)* | `[Layer]` creator `InitRoom` → `LudeoSession.OpenRoom` `[SDK]` |
| World streamed in, player in control | `StateManager.ChangeState(Game)` | *(no SDK call — the `m_gameplayActive` sampler gate opens, CR-005)* |
| Player dies (permadeath) | `PlayerDeath` → `TitleMenuFromDeath` | `[Layer]` `EndGameplay` → `LudeoGameplaySession.End` `[SDK]` |
| Return to menu | `StartMethods.TitleMenu` | `[Layer]` `AbortGameplay` → `LudeoGameplaySession.Abort` `[SDK]` |
| Load different save while in-game | `LoadDaggerfallUnitySave` while in `Game` | `Abort` `[SDK]` then `OpenRoom` `[SDK]` for the new run |
| Pause menu / inventory open | `StateManager.Paused` / `UI` | *(local pause only — not a boundary)* |
| Ludeo overlay opened | `AddNotifyPauseGame` `[SDK]` | `GameManager.PauseGame()` / `Time.timeScale = 0f` `[Unity]` (CR-011) |
| Application quit | `Application.Quit` `[Unity]` | `End`/`Abort` `[SDK]` if mid-run, then **`Dispose()` the owned `LudeoSession`** in `Shutdown()` (the plugin does **not** dispose it — required for Editor re-init; see `05` "Shutdown") |

The `CODE_MAP.session_boundaries` block produced in [`phase 2`](../../1-map-game-code.md) §6 is the
input for this mapping.

## 9. After This File

This file decides *when* a Gameplay Session lives. For *what* a streaming world captures — presence ≠
existence, world/cell objectTypes, identity across stream cycles, scope-to-the-moment — read its
tracking companion [`open-world-tracking.md`](./open-world-tracking.md) alongside
[`06-TRACKING-PATTERNS.md`](../06-TRACKING-PATTERNS.md). You also still need the **action catalog** and
genre **tracking checklist** for whichever genre(s) the game blends, produced in
[`phase 6`](../../6-map-game-actions.md) (actions) and [`phase 4`](../../8-map-game-objects.md)
(objects) with the genre files in [`INDEX.md`](./INDEX.md).

---

## Calls used in this doc

**`[SDK]`** (verbatim — authority: [`../12-SDK-API-REFERENCE.md`](../12-SDK-API-REFERENCE.md)):
`LudeoManager.InitLudeoSession` · `LudeoSession.Activate` · `LudeoSession.OpenRoom` ·
`LudeoSession.AddNotify{LudeoSelected, RoomReady, PauseGame}` · `LudeoRoom.AddGamePlayer` ·
`LudeoRoom.CloseRoom` · `LudeoGameplaySession.Begin/End/Abort` · `LudeoGameplaySession.SendAction`.

**`[Layer]`** (from [`../unity/REFERENCE-ARCHITECTURE.md`](../unity/REFERENCE-ARCHITECTURE.md) —
rename freely): `LudeoController.{BeginGameplay, EndGameplay, AbortGameplay, UpdateStateObjects,
SendAction}` · `ILudeoFlow.InitRoom` · `LudeoIntegrationData.CreateOpenRoomDataForLudeo`.

**`[Unity]`:** `Time.timeScale` · MonoBehaviour `Update`/`Awake`/`OnApplicationQuit` ·
`Application.Quit` · game-specific state machine / pause primitives.
