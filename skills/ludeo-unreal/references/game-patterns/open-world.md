# Open-World / Streaming-World Pattern (Unreal)

> **Applies to:** Open-world RPGs (Skyrim/Fallout-likes, Witcher-likes), open-world action
> (GTA/Red Dead-likes), sandbox/survival (Minecraft-likes, Valheim-likes, 7 Days to Die-likes),
> MMOs, and any Unreal game with a continuous streaming world rather than discrete per-level maps.
>
> **Load when:** the project has **no per-map gameplay levels**, the world streams in/out (terrain,
> cells, chunks, World Partition cells, `ULevelStreaming` sub-levels), and session boundaries are
> driven by a **state machine or event dispatcher** — *not* by `UGameplayStatics::OpenLevel` /
> `ServerTravel` per map.
>
> **This is a structural pattern, not a genre pattern.** Unlike `shooter.md` / `rts.md` /
> `racing.md` (which catalog actions and trackable objects), this file is about **session
> lifecycle**: where a Gameplay Session begins and ends when there is no level load to bracket it.

---

## 1. The Boundary Rule

**One continuous live run = one Gameplay Session.** Length is irrelevant. A 100-hour open-world
play-through is one Gameplay Session, same as a 90-second deathmatch round.

This is **not** a redefinition. The Ludeo Session / Gameplay Session model
(`references/phase-01-mapping.md` → Key Concepts, `references/phase-02-lifecycle.md` →
§5.5 N-Way Gate Template) defines a Gameplay Session as *one playable moment* — the `(level, match, run)`
examples are illustrative, not constraining. For a streaming world, the **playable moment is the
live run itself**.

```
Ludeo Session  ── subsystem init + Activate at launch, released at quit ──────┐
                                                                               │
   Gameplay Session 1  ── new-game ────────────── death ──────┐               │
   Gameplay Session 2  ── load save ───────── back-to-menu ───┤               │
   Gameplay Session N  ── load save ─────────── quit ─────────┘               │
                                  app quit ──────────────────────────────────► ┘
```

## 2. Is / Isn't a Boundary

| Event | Boundary? | Why |
|---|---|---|
| New game started | ✅ Start | First live frame of a fresh run → subsystem opens Room |
| Load save (from menu) | ✅ Start | First live frame of a resumed run → subsystem opens Room |
| Player death (permadeath) | ✅ End | Run is over → end gameplay session |
| Return to main menu | ✅ End | Player exited the run → abort gameplay session |
| Quit to desktop | ✅ End | Process is leaving → `End`/`Abort` on `FCoreDelegates::OnExit` / `UGameInstance::Shutdown` |
| Load a *different* save while in-game | ✅ End-then-start | `Abort` current run, then open Room for the new run |
| Dungeon / interior / building enter / exit | ❌ | Same run, different cell / sub-level |
| Fast travel | ❌ | Same run, teleport |
| World Partition cell / `ULevelStreaming` in/out | ❌ | The SDK doesn't see streaming |
| Sleep / wait / time-skip | ❌ | Same run, time advanced |
| Day / night transition | ❌ | Same run |
| Pause menu / inventory / map | ❌ | Local pause overlay, not a boundary (see §5) |
| Dialogue / conversation / cutscene | ❌ | Same run, modal UI / scripted segment |
| Ludeo overlay opened mid-play | ❌ for the boundary | Pause via `UGameplayStatics::SetGamePaused` (or the game's own pause primitive), **not** `End` — see `references/phase-02-lifecycle.md` |

The principle: **only end the Gameplay Session when the live run itself ends.** Everything else is
"inside one run."

## 3. Where to Bind `OpenRoom`

`references/phase-02-lifecycle.md` describes calling `OpenRoom` "when the match starts loading"
so SDK async latency hides under the load. For streaming-world games there are three valid bind
points, trading latency-hiding for proximity to actual gameplay:

| Bind point | Pro | Con |
|---|---|---|
| **Earliest** — the dispatcher that initiates a new/load run (e.g. a `NewGame` / `LoadSave` call that kicks off async world hydration) | Maximum latency hiding | The chain may complete long before the player is in control |
| **Canonical** *(recommended)* — the game's own "gameplay began" event (e.g. `OnNewGame`/`OnStartGame`, or a state-machine transition into the in-game state, typically a GameState phase enum → `InProgress`) | One canonical, well-subscribed signal; matches how the game already thinks about "the run started" | Slightly less latency hiding |
| **Latest** — the moment the player has control (state machine reaches active gameplay, input unlocked; often detectable via `ACharacter::BeginPlay` on the player pawn + input enabled) | `BeginGameplay` lands right at gameplay start; no gap | Gives up the loading window entirely |

**Default to the canonical event.** Bind the subsystem creator-flow room-open to it. Use the
earliest bind point only if the canonical event fires too late to hide visible startup time.

## 4. The Existing `RoomReady + AddGamePlayer` Gate Is Sufficient

You may worry: "if `OpenRoom` fires at loading start but the state machine doesn't reach active
gameplay for several seconds, won't `BeginGameplay` fire before the world is live?"

**No third gate is needed.** The subsystem flow already gates `BeginGameplay` on **`AddPlayer`
success + the `RoomReady` notification** — both SDK-side signals (see
`references/phase-02-lifecycle.md` → N-Way Gate). Why this is safe even before the world is live:

- **Sampling is gated by your own in-gameplay flag.** `UpdateWritableObjects` only runs while
  the component's "in gameplay" state is true (the `bGameplayActive` / `bGameplayStarted` guard
  documented in `references/phase-02-lifecycle.md`). Between `BeginGameplay` and the world
  becoming live, the sampler is dormant — nothing is captured.
- **Actions only fire on real gameplay events.** `SendAction` is hooked to kills / pickups /
  quest completions and is itself gated on `bGameplayStarted`. The loading sequence generates no
  action calls.
- **The first captured frame is the real first gameplay frame.** The gap between `BeginGameplay`
  and "world live" is dead time on the SDK side — invisible in the captured Ludeo.

So: keep the two-signal gate (`AddPlayer` done **and** `RoomReady`). Do **not** add a third
condition. The safety net is the sampler gate inside `TickComponent`, not a third callback.

## 5. Pause Coverage

The Ludeo overlay opening mid-play must **freeze the simulation** — not just input. In a
streaming world:

- **Use the game's existing pause primitive** if it freezes the sim (e.g. the game's own
  `PauseGame()` function, or `UGameplayStatics::SetGamePaused`); the `OnPauseGameRequested` SDK
  callback drives it. See `references/phase-02-lifecycle.md` §5.2–§5.4 for full
  implementation patterns and the warning about games that pause via time dilation rather than
  the engine pause system.
- **Async tasks / `FStreamableManager` loads / World Partition streaming** that **advance world
  state** must also be paused. Background asset I/O that doesn't mutate gameplay state can keep
  running.
- Track the overlay pause and the post-Ludeo-load restore freeze as **two independent flags** —
  the engine is paused iff *either* is set. One shared boolean lets resume unfreeze a
  mid-restoration pause, or `RoomReady` cancel a player-opened overlay.

## 6. Restoration: Tearing Down the Live Run

When the `LudeoSelected` SDK callback fires mid-run, the player wants to play *the captured
moment*, not their current save. The teardown is the same shape as end-of-run, but **the Ludeo
Session itself survives**:

1. Tear down the current Gameplay Session and Room: run the standard teardown chain
   (`EndGameplay` → `RemovePlayer` → `CloseRoom` — see `references/phase-02-lifecycle.md`
   §5.6 Teardown Chain).
2. **Do not** dispose the Ludeo Session or quit. It stays alive for the play flow.
3. Reconstruct the world to the Ludeo's captured state — your existing **load-save plumbing** is
   the natural fit (the Ludeo is a "save file from elsewhere").
4. Open a fresh Room **for the Ludeo**: open Room with the `ludeoId` → `AddPlayer` → `RoomReady`
   → `BeginGameplay`.
5. The `RoomReady` handler doubles as the **post-Ludeo-load resume**: unpause → apply restored
   state (two-pass) → `BeginGameplay` (see `references/phase-04-tracking-restore.md` for restoration
   approach; cross-check the Player Flow pause-timing note at the end of
   `references/phase-02-lifecycle.md` §5.7 Player Flow Entry).

For an open-world game this is closer to "load-while-in-game" than "return-to-menu." If the game
has a clean "load this save now, abort the current run" path, route Ludeo restoration through it.

## 7. The Sandbox Edge Case (Minecraft-like / Valheim-like / 7 Days-like)

If the game is genuinely indefinite — no death, no permadeath, no narrative end — the run is
bounded by **load → play → save-and-exit**. That's still one Gameplay Session:

- **Start** — world load complete (single-player) or server-join complete.
- **End** — save-and-exit, or disconnect from the world.

Long sessions are fine. What matters is that the boundaries map to clean **points of perfect world
state** — the moments the game itself considers safe to persist or close.

## 8. Worked Mapping — Illustrative UE Streaming World

*Illustrative mapping for a UE World Partition streaming world — not from a shipped integration.
Class names are representative; map them to the game's actual signals during phase-01.*

| Lifecycle event | UE signal (illustrative) | SDK / subsystem call |
|---|---|---|
| Game launch | `UGameInstance::Init` / `AGameModeBase::InitGame` | Ludeo subsystem init → `ActivateSession` |
| New run begins | GameState phase enum → `InProgress` (custom `OnNewGame` / `HandleMatchHasStarted`) *(recommended bind point)* | creator flow → `OpenRoom` |
| World streamed in, player in control | World Partition cells loaded; `ACharacter::BeginPlay` + input enabled | *(no SDK call — the in-gameplay sampler gate opens)* |
| Player dies (permadeath) | pawn death delegate (health-zero multicast / `OnDestroyed`) | end gameplay session → `End` |
| Return to main menu | `UGameplayStatics::OpenLevel(MainMenu)` / `APlayerController::ClientReturnToMainMenu` | abort gameplay → `Abort` |
| Load different save while in-game | save-load path while in `InProgress` | `Abort`, then `OpenRoom` for the new run |
| Pause menu / inventory open | `UGameplayStatics::SetGamePaused(true)` (local) | *(local pause only — not a boundary)* |
| Ludeo overlay opened | Ludeo pause-request handler | pause primitive / `SetGamePaused(true)` |
| Application quit | `FCoreDelegates::OnExit` / `UGameInstance::Shutdown` | `End`/`Abort` if mid-run → subsystem teardown |

The `lifecycle_hooks` block of the CODE_MAP produced in `references/phase-01-mapping.md` §3b
is the input for this mapping.

## 9. After This File

This file decides *when* a Gameplay Session lives. For *what* a streaming world captures —
presence vs existence, world/cell objectTypes, identity across stream cycles, scope-to-the-moment
— read its tracking companion `references/game-patterns/open-world-tracking.md` alongside
`references/phase-04-tracking-restore.md`. You also still need the **action catalog** and genre
**tracking checklist** for whichever genre(s) the game blends, produced during phase-04 (actions)
and phase-06 (objects) with the genre files in `references/game-patterns/`.

---

For exact SDK call sequences referenced in this file, see `references/phase-02-lifecycle.md`.
