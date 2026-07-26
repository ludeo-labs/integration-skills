# Racing Genre Patterns (Unreal)

> **Applies to:** Arcade Racers, Sim Racing, Kart Racers, Time-Trial, Combat Racing
> **Load when:** Game involves vehicles, lap-based or point-to-point tracks, position/ranking against
> opponents, lap/race timing
>
> Action names below map to the Ludeo subsystem / DataWriter `SendAction` call (see
> `references/phase-06-actions.md` and `references/sdk-reference/`).

> **MVP scope (curated-first):** In Phases 4–6, treat this catalog as a menu — implement only the
> actions/objects present in your **curated slice** (`integration.json → curatedSlice`). The full
> catalog applies at **expansion** (Phase 8), when coverage broadens to the whole game.

---

## 1. Actions Catalog

### Race Progression

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `RaceStart` | Race began (lights out) | — | — |
| `LapComplete` | Completed a lap | "Complete 3 laps" | 100 pts |
| `CheckpointPass` | Passed a checkpoint/sector | "Hit every checkpoint" | 10 pts |
| `RaceFinish` | Crossed the finish line | "Finish the race" | 500 pts |
| `Position1st` | Finished/holding 1st place | "Win the race" | 2000 pts |
| `Podium` | Finished in top 3 | "Finish on the podium" | 1000 pts |
| `DNF` | Did not finish (negative) | — | -200 pts |

### Driving Performance

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Overtake` | Passed an opponent | "Overtake 5 cars" | 50 pts |
| `BestLap` | Set the fastest lap | "Set the fastest lap" | +200 bonus |
| `CleanLap` | Lap with no collisions/off-track | "Drive a clean lap" | +50 bonus |
| `Drift` | Performed/held a drift | "Drift for 1000m" | per meter |
| `TopSpeed` | Reached a speed threshold | "Hit 300 km/h" | +25 bonus |
| `PerfectStart` | Optimal launch off the line | "Nail the start" | +50 bonus |
| `Slipstream` | Drafted behind an opponent | — | — |

### Hazards / Penalties

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Collision` | Hit a wall/car/object | "Finish with no crashes" (inverse) | -25 pts |
| `OffTrack` | Left the track surface | — | -10 pts |
| `WrongWay` | Driving against race direction | — | — |
| `Spinout` | Lost control / spun | — | — |
| `Reset` | Vehicle reset to track | — | -50 pts |
| `Penalty` | Received a time/position penalty | — | -100 pts |

### Vehicle / Items

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `UseBoost` | Used nitro/boost | "Use boost 10 times" | — |
| `PickupItem` | Picked up an item/powerup (kart) | "Collect 5 items" | 10 pts |
| `UseItem` | Used an item/powerup | "Use 3 items" | — |
| `HitOpponent` | Hit an opponent with an item | "Hit 3 racers" | 25 pts |
| `PitStop` | Entered the pit / serviced car | — | — |
| `RefuelOrTireChange` | Refueled or changed tires | — | — |

---

## 2. Search Keywords

Grep these in C++/Blueprint method/field names and comments. Group results by category.

### Race Flow / Timing
```
race, grandprix, gp, event, session, heat, qualify, qualifying
lap, laps, lapCount, lapTime, sector, split, checkpoint, waypoint
start, startLine, finish, finishLine, gridPosition, grid, countdown
position, rank, place, standings, leaderboard, order
time, timer, elapsed, bestLap, fastestLap, lapRecord
```

### Driving / Vehicle Dynamics
```
speed, velocity, rpm, gear, throttle, brake, steer, steering, handbrake
drift, slide, traction, grip, downforce, aero
accelerate, decelerate, boost, nitro, turbo, drs
slipstream, draft, tow
distance, lapDistance, trackPosition, splinePosition
```

### Hazards / Collisions / Penalties
```
collision, collide, crash, impact, contact, hit
offTrack, offRoad, surface, cut, shortcut
wrongWay, reverse, reset, respawn, recover, rewind
spin, spinout, rollover, damage, repair
penalty, infraction, drivethrough, stopgo, disqualify, dnf
```

### Vehicle / Items / Pit
```
car, vehicle, kart, bike, racer, driver, opponent, ai, rival
item, powerup, weapon, projectile, shell, banana, mushroom
pickup, collect, box, crate
pit, pitstop, pitlane, fuel, refuel, tire, tyre, wear, setup
engine, chassis, livery, tuning, upgrade
```

### Game Flow / Objectives
```
score, scoring, points, reward, bonus
objective, mission, challenge, goal, championship, career
win, lose, victory, defeat, podium, first, last
mode, timeTrial, circuit, sprint, elimination, endurance
```

> **Unreal idioms** (engine-API hooks to grep in C++/Blueprint):
> - **Checkpoints / laps:** `OnComponentBeginOverlap` on trigger volumes.
> - **Collisions:** `OnComponentHit`, `NotifyHit`, `ReceiveHit`.
> - **Vehicle dynamics:** `UChaosVehicleMovementComponent` /
>   `UChaosWheeledVehicleMovementComponent` (Chaos Vehicles) — throttle/brake/steering inputs.
> - **Events:** multicast delegates, `UFUNCTION` `On*`/`Handle*`.

---

## 3. Tracking Checklist

After object tracking is implemented (phase 4/5), verify these are covered. Types map to the
Unreal DataWriter set-attribute calls; see `references/phase-05-tracking-restore.md` and
`references/phase-06-actions.md` for the exact API.

### Player Vehicle (CRITICAL)
- [ ] Position (`FVector`)
- [ ] Rotation (`FRotator`)
- [ ] Velocity / speed (`FVector` or scalar)
- [ ] Current lap number
- [ ] Current race position / rank
- [ ] Lap / sector times (current + best)
- [ ] Track progress (lap distance / spline position)
- [ ] Boost / nitro charge
- [ ] Vehicle damage / condition
- [ ] Fuel / tire state (sim racers)

### Opponents / AI Racers
- [ ] Position, rotation
- [ ] Velocity / speed
- [ ] Current lap number
- [ ] Race position / rank
- [ ] Track progress
- [ ] Racer / driver ID
- [ ] AI difficulty / behavior state
- [ ] Held item (kart racers)

### Race State
- [ ] Race phase (countdown, racing, finished)
- [ ] Total laps
- [ ] Elapsed race time
- [ ] Full standings / running order
- [ ] Active penalties (per racer)

### Items / Pickups (kart racers)
- [ ] Position
- [ ] Item type
- [ ] Is collected / available
- [ ] Respawn state (if applicable)
- [ ] Active projectiles (type, owner, position, velocity)

### Track / Environment
- [ ] Track / circuit ID
- [ ] Checkpoint states (per racer)
- [ ] Weather / track surface conditions (if affects gameplay)
- [ ] Time of day / lighting
- [ ] Level metadata (track name, race mode, lap count, opponent count)
