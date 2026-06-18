# Turn-Based / Tactics Genre Patterns (Unreal)

> **Applies to:** turn-based tactics, strategy RPGs, SRPGs, grid/initiative combat (XCOM-likes),
> roguelike tactics.
>
> **Load when:** discrete turns / initiative order, action points, grid movement, unit-by-unit
> actions.
>
> ⚠️ **Provisional:** generalized from a single turn-based integration; confirm against the
> specific game before relying on it. Source:
> `learnings/architecture/turn-based-capture-at-turn-boundaries.md`.
>
> Action names below map to the Ludeo subsystem / DataWriter `SendAction` call (see
> `references/phase-05-actions.md` and `references/sdk-reference/`).

> **MVP scope (curated-first):** In Phases 3–5, treat this catalog as a menu — implement only the
> actions/objects present in your **curated slice** (`integration.json → curatedSlice`). The full
> catalog applies at **expansion** (Phase 7), when coverage broadens to the whole game.

---

## 1. Actions Catalog

### Combat

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Attack` / `Hit` | Unit performs an attack and connects | "Land 10 attacks" | 50 pts |
| `Kill` | Unit is destroyed (per-unit-CLASS identity gives richer highlights — e.g. `Kill_HeavyInfantry`) | "Destroy 5 enemy units" | 200 pts |
| `AbilityUse` | Unit activates a special ability | "Use abilities 8 times" | 25 pts |
| `CriticalHit` | Attack deals critical/bonus damage | "Land 3 critical hits" | +75 bonus |
| `Miss` | Attack fails to connect | — | — |
| `Heal` | Unit restores HP to itself or an ally | "Heal 200 total HP" | 30 pts |
| `ApplyBuff` | Positive status effect applied to a unit | — | 10 pts |
| `ApplyDebuff` | Negative status effect applied to an enemy | "Debuff 4 enemies" | 15 pts |

### Turn Flow

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `TurnStarted` | A unit's individual turn begins | — | — |
| `TurnEnded` | A unit's individual turn ends | — | — |
| `RoundStarted` | A full initiative cycle begins | — | — |
| `UnitActivated` | The active unit changes (initiative order advances) | — | — |

### Movement / Positioning

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `UnitMoved` | Unit moves to a new grid cell | "Move 20 total tiles" | 5 pts per tile |
| `Overwatch` / `ReactionSet` | Unit enters overwatch / reaction stance | "Set overwatch 3 times" | 20 pts |

### Objectives

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `ObjectiveComplete` | A battle objective is fulfilled | "Complete all objectives" | 500 pts |
| `PointCaptured` | Unit captures a control point or zone | "Capture 2 points" | 300 pts |
| `UnitExtracted` | Unit reaches an extraction zone | "Extract 3 units" | 250 pts |

### Outcome

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `BattleWon` | The player's side wins the battle | — | 2000 pts |
| `BattleLost` | The player's side is defeated | — | — |

---

## 2. Search Keywords

Grep these in C++/Blueprint method/field names and comments. Group results by category.

### Turn / Round / Initiative
```
turn, round, initiative, phase, order, sequence
beginTurn, endTurn, startTurn, nextTurn, onTurnStart, onTurnEnd
activateUnit, unitActivated, activeUnit, currentUnit
actionPoint, AP, remainingActions, actionsLeft
```

### Grid / Movement / Positioning
```
grid, tile, cell, hex, square, slot
move, moveTo, moveUnit, unitMoved, walkTo
overwatch, reaction, stance, watchZone
range, distance, reach, adjacency
```

### Combat / Abilities / Status
```
attack, strike, hit, miss, damage, takeDamage, applyDamage, dealDamage
ability, skill, activate, cooldown, cast, useAbility
critical, crit, bonus, penetrate
buff, debuff, status, effect, apply, remove
heal, restore, regenerate, revive
```

### Unit Identity / State
```
unit, character, soldier, hero, actor, pawn
faction, team, side, owner, alliance
alive, dead, die, destroy, eliminate, remove
health, hp, hitPoints, maxHealth
class, type, archetype, role
```

### Objectives / Outcome
```
objective, mission, goal, task, condition
capture, extract, escort, defend, survive
win, lose, victory, defeat, gameOver, endBattle, endMission
score, points, reward, rank
```

> **Unreal idioms** (the keyword lists above are generic; these are the engine-API hooks to grep):
> - **Turn / phase gate:** the game's `AGameMode`/`AGameState` phase enum is the capture gate; for
>   marketplace-toolkit games the reparented toolkit GameMode/GameState is the bridge
>   (see `learnings/architecture/marketplace-toolkit-reparented-gamemode-is-the-bridge.md`,
>   `learnings/architecture/toolkit-gamestate-phase-enum-is-the-gate.md`).
> - **Turn events:** multicast delegates `OnTurnStart`/`OnTurnEnd`/`OnRoundStart`, `UFUNCTION`
>   `On*`/`Handle*`.
> - **Units / AI:** `AAIController` for enemy units; level-placed units make restore-matching
>   trivial — match by stable actor `FName`, drive the game's own removal for dead units
>   (see `learnings/architecture/level-placed-units-make-restore-matching-trivial.md`).
> - **Abilities / cooldowns:** GAS `UGameplayAbility` + cooldown `UGameplayEffect` on the
>   `UAbilitySystemComponent`, or a custom ability component with a cooldown float/int per slot.

---

## 3. Tracking Checklist

After object tracking is implemented (phases 3/4), verify these are covered. Types map to the
Unreal DataWriter set-attribute calls; see `references/phase-04-tracking-restore.md` and
`references/phase-05-actions.md` for the exact API.

### Per Unit (CRITICAL)
- [ ] Grid position — cell coordinates (`FIntPoint`) and/or world position (`FVector`)
- [ ] Health / HP (`int`/`float`)
- [ ] Faction / team ID
- [ ] Action points remaining
- [ ] Ability cooldowns — **P0, not enrichment**: a restored battle with reset cooldowns changes
      every decision; ask about this explicitly during entity tiering
- [ ] Alive / dead (`bool`)
- [ ] Unit class / archetype (enables per-class kill identity for richer highlights)

### Turn System — GameMetadata (CRITICAL)
- [ ] Round number
- [ ] Initiative order — capture the **runtime-ordered list**, NOT the per-unit initiative stat
      it was derived from; the stat produces the order at setup, but swaps/modifications happen
      at runtime
- [ ] Active-unit index (whose turn it currently is)
- [ ] Turn-state name (e.g. Setup / TurnBased / GameOver)

> Restoring units without restoring whose turn it is breaks the first frame — this data is
> per-tick GameMetadata and must survive into Player Flow.

### Objectives
- [ ] Objective flags (met / not met)
- [ ] Objective progress / counters
- [ ] Zone / point capture state

### Environment / Session
- [ ] Map / level name
- [ ] Game mode / difficulty
- [ ] Battle outcome flag (for early-restore edge cases)

---

## 4. Session & Capture Cadence (turn-based specific)

### Room = the whole battle

One battle (map load → victory/defeat) is the recording session. Turns are **not** rooms or
highlights — do not open/close a room per turn.

### Quantized write cadence

When the team agrees that captures are assumed to start at the beginning of a turn, quantizing
DataWriter state writes to turn boundaries makes every possible restore land at the most recent
turn start. This enforces the agreed capture semantics by construction — no cloud-side
cooperation needed.

Implementation: the existing poll (e.g. 10 Hz) reads a "turn tuple" from the turn manager —
`(CurrentTurn, ActiveUnitId, TurnStateName)` — and rewrites all tracked state objects when the
tuple changes. Unit deaths are still handled at poll time (final write + DestroyObject), since a
writable's anchor actor may be GC'd before the next boundary.

See `learnings/architecture/turn-boundary-quantized-write-cadence.md` for the full pattern and
counter-evidence.

### Make cadence a swappable policy

Structure the write path with a `ShouldWriteThisPoll()` predicate driven by a config key (e.g.
`[Ludeo] WriteCadence=TurnBoundary|PerTick`). Flipping cadence is then an ini change.

**Key fact to surface to the team:** switching cadence does **not** invalidate previously captured
Ludeos — the attribute schema is identical; only write frequency differs. Re-recording is only
forced when attributes are added or removed.

### ⚠️ Critical — watch the replay early

Turn-boundary cadence can look **broken** when units do not move for whole turns (e.g. ranged
combat): the last-boundary data can equal the battle-start formation while the video shows
mid-turn action. The replay then appears as though the game restarted. Because the integration's
self-checks validate restore-vs-data, every instrument reads green while the scene is wrong.

Rules:
1. **Schedule a watch-the-replay test immediately after the first capture** — the team cannot
   evaluate cadence from a description alone; expect the cadence decision to flip to per-tick.
2. When restore-vs-data validation is green but the scene looks wrong, check
   **data-vs-video** before hunting restore bugs.
3. The swappable-cadence design (config key) is what makes the flip a one-line change — keep it.

See `learnings/architecture/turn-boundary-quantized-write-cadence.md`.

---

## 5. Restore Timing (Player Flow) — turn-based specific

In a turn-based game, **WHEN the restore applies is mechanics, not polish.** Landing a restore in
the middle of the turn choreography — mid-animation, mid-action-queue, or by directly overwriting
the turn system — produces demo-breaking **limbo**: an intermittent empty ability bar, **wedged
input**, or **turns that will not advance** — none of which correct DATA can fix. Treat restore
timing as **Phase 4** work (core playability of the restored moment), not Phase 8 polish. Defer to
Phase 8 only genuinely cosmetic timing (animation blending, camera easing, late-loading visuals).
See `learnings/architecture/restore-timing-can-be-core-not-polish.md`.

Three rules, all driven by the **game's own signals** — never wall-clock guesses:

1. **Restore only into a settled engine.** After the gameplay-active gate, also wait until the
   game's "something is animating" signals (e.g. the turn/action manager's ongoing- and
   blocking-action sets) have been continuously empty for a short window (~0.5s). The startup
   choreography finishes playing; the restore then lands on a quiescent state machine. This is what
   kills the intermittent (≈1-in-3) empty-ability-bar / un-advanceable-turn races that data-side
   fixes can never touch.
2. **Move through the game's own flow, not around it.** To start the replay on the captured unit,
   advance to its turn via the game's **own end-turn / next-turn function** (guarded: only across
   player-controlled units, never crossing a round boundary) — each transition rebuilds the
   UI/animation layers natively. Direct overwrites of the turn system desync the controller/UI
   layers and are the usual cause of the limbo.
3. **Capture only from actionable moments** (the write-side dual of rule 1): gate writes on "a
   player unit is active AND nothing is animating," so every frame a viewer can trim to restores to
   a player-actionable choice moment by construction. The cloud's restore point follows the
   viewer's **trim**, not the capture press, so per-frame validity is mandatory.
