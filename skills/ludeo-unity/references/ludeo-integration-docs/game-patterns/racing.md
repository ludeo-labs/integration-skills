# Racing Genre Patterns (Unity)

> **Applies to:** Arcade Racers, Sim Racing, Kart Racers, Time-Trial, Combat Racing
> **Load when:** Game involves vehicles, lap-based or point-to-point tracks, position/ranking against
> opponents, lap/race timing
>
> Action names below map to `[SDK]` `LudeoGameplaySession.SendAction(string)` via the `[Layer]`
> `LudeoController.SendAction` (see `phase 7`).

---

## 1. Actions Catalog

> **Candidates, not a capture list.** The **Tier** column ranks capture priority for *this* genre;
> still apply phase 6's keep test before sending any action.
> - **T1 — Capture:** signature scored milestones / one-shot highlights that define the genre.
> - **T2 — Capture if scored or a notable beat in *this* game;** otherwise drop.
> - **T3 — Usually drop:** tracked **state** or high-frequency noise — capturing bloats the Ludeo.
>   Keep only if exceptionally scored. (Rows with both Objective and Scoring empty are almost always T3.)
>
> **Genre T3 traps:** `Drift`/`Slipstream`/`OffTrack`/`WrongWay`/`Spinout`/`TopSpeed` are **continuous
> states** — track speed / on-track / drift-angle as attributes and send an action only where it's a
> *scored* mechanic (e.g. `Drift` in a drift-scoring kart racer). `CheckpointPass` is high-frequency —
> keep only if checkpoints are scored; otherwise rely on lap/progress tracking.
>
> **Scope (phase 6) — orthogonal to tier:** player-scoped — `LapComplete`, `RaceFinish`, `Overtake`,
> `BestLap`, `Position1st`, `Collision` (the player's car); **global** (no guard, fire once) —
> `RaceStart` and other race-wide lifecycle events.

### Race Progression

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `RaceStart` | T1 | Race began (lights out) | — | — |
| `LapComplete` | T1 | Completed a lap | "Complete 3 laps" | 100 pts |
| `RaceFinish` | T1 | Crossed the finish line | "Finish the race" | 500 pts |
| `Position1st` | T1 | Finished/holding 1st place | "Win the race" | 2000 pts |
| `Podium` | T2 | Finished in top 3 | "Finish on the podium" | 1000 pts |
| `DNF` | T2 | Did not finish (negative) | — | -200 pts |
| `CheckpointPass` | T3 | Passed a checkpoint/sector | "Hit every checkpoint" | 10 pts |

### Driving Performance

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `Overtake` | T1 | Passed an opponent | "Overtake 5 cars" | 50 pts |
| `BestLap` | T2 | Set the fastest lap | "Set the fastest lap" | +200 bonus |
| `CleanLap` | T2 | Lap with no collisions/off-track | "Drive a clean lap" | +50 bonus |
| `PerfectStart` | T2 | Optimal launch off the line | "Nail the start" | +50 bonus |
| `Drift` | T3 | Performed/held a drift (T1/T2 if drift-scoring) | "Drift for 1000m" | per meter |
| `TopSpeed` | T3 | Reached a speed threshold | "Hit 300 km/h" | +25 bonus |
| `Slipstream` | T3 | Drafted behind an opponent | — | — |

### Hazards / Penalties

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `Collision` | T2 | Hit a wall/car/object | "Finish with no crashes" (inverse) | -25 pts |
| `Reset` | T2 | Vehicle reset to track | — | -50 pts |
| `Penalty` | T2 | Received a time/position penalty | — | -100 pts |
| `OffTrack` | T3 | Left the track surface | — | -10 pts |
| `WrongWay` | T3 | Driving against race direction | — | — |
| `Spinout` | T3 | Lost control / spun | — | — |

### Vehicle / Items

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `PickupItem` | T2 | Picked up an item/powerup (kart) | "Collect 5 items" | 10 pts |
| `HitOpponent` | T2 | Hit an opponent with an item | "Hit 3 racers" | 25 pts |
| `UseBoost` | T3 | Used nitro/boost | "Use boost 10 times" | — |
| `UseItem` | T3 | Used an item/powerup | "Use 3 items" | — |
| `PitStop` | T3 | Entered the pit / serviced car | — | — |
| `RefuelOrTireChange` | T3 | Refueled or changed tires | — | — |

---

## 2. Search Keywords

Grep these in C# method/field names and comments. In Unity, lap/checkpoint detection usually routes
through trigger volumes (`OnTriggerEnter` on checkpoint colliders), collisions through
`OnCollisionEnter`, and vehicle dynamics through `Rigidbody`/`WheelCollider` — search those too.

### Race Flow / Timing
```
race, grandprix, gp, event, session, heat, qualify, qualifying
lap, laps, lapCount, lapTime, sector, split, checkpoint, waypoint, OnTriggerEnter
start, startLine, finish, finishLine, gridPosition, grid, countdown
position, rank, place, standings, leaderboard, order
time, timer, elapsed, bestLap, fastestLap, lapRecord
```

### Driving / Vehicle Dynamics
```
speed, velocity, rpm, gear, throttle, brake, steer, steering, handbrake
Rigidbody, WheelCollider, motorTorque, brakeTorque, sidewaysFriction
drift, slide, traction, grip, downforce, aero
accelerate, decelerate, boost, nitro, turbo, drs
slipstream, draft, tow
distance, lapDistance, trackPosition, splinePosition
```

### Hazards / Collisions / Penalties
```
collision, collide, crash, impact, contact, hit, OnCollisionEnter
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

---

## 3. Tracking Checklist

After object tracking is implemented (phase 9), verify these are covered. Types map to `[SDK]`
`SetAttribute` overloads (see `12-SDK-API-REFERENCE.md`). Sections are tiered by restoration priority:
- **CRITICAL** — restore or the replayed moment is visibly wrong.
- **IMPORTANT** — restore for fidelity; recognizable without it but degraded.
- **OPTIONAL** — situational/cosmetic; capture only if it affects the specific captured moment.

### Player Vehicle — CRITICAL
- [ ] Position (`Vector3`)
- [ ] Rotation (`Quaternion`)
- [ ] Velocity / speed (`Vector3` or scalar)
- [ ] Current lap number
- [ ] Current race position / rank
- [ ] Lap / sector times (current + best)
- [ ] Track progress (lap distance / spline position)
- [ ] Boost / nitro charge
- [ ] Vehicle damage / condition
- [ ] Fuel / tire state (sim racers)
- [ ] Appearance (vehicle livery/skin, driver/character cosmetics — by content id). Constant through the clip but **visible**; the `06 §9.3` step-1 carve-out — a default-livery replay is visibly wrong

### Race State — CRITICAL
- [ ] Race phase (countdown, racing, finished)
- [ ] Total laps
- [ ] Elapsed race time
- [ ] Full standings / running order
- [ ] Active penalties (per racer)

### Opponents / AI Racers — IMPORTANT
- [ ] Position, rotation
- [ ] Velocity / speed
- [ ] Current lap number
- [ ] Race position / rank
- [ ] Track progress
- [ ] Racer / driver ID
- [ ] AI difficulty / behavior state
- [ ] Held item (kart racers)

### Items / Pickups (kart racers) — OPTIONAL
- [ ] Position
- [ ] Item type
- [ ] Is collected / available
- [ ] Respawn state (if applicable)
- [ ] Active projectiles (type, owner, position, velocity)

### Track / Environment — OPTIONAL
- [ ] Track / circuit ID
- [ ] Checkpoint states (per racer)
- [ ] Weather / track surface conditions (if affects gameplay)
- [ ] Time of day / lighting
- [ ] Level metadata (track name, race mode, lap count, opponent count)
