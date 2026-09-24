---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "5"
question: "Does your restore run a settle - a few real frames between the apply and the re-freeze - and then check every restored value against what it wrote? Then some of those checks will fire on correct game behaviour: an active fight sends its next enemy in, a spawn counter ticks, a parked entity is placed. Decide per value whether the RESTORE or the RUNNING GAME owns it during the settle, and check only the first kind."
sanitized: true
---

# The settle is live - exempt what the running game legitimately changes during it

The restore's self-check ([[make-the-restore-verify-every-value-it-writes]]) says: check what the
restore writes, never what the game derives. The first real replay found the boundary is finer than
that, because of the settle.

The settle deliberately runs half a second of real frames between the apply and the re-freeze, so
teleports land and pooled objects finish arriving ([[settle-the-rebuilt-moment-before-the-wait]]).
Half a second is enough for an active fight to act. Here it sent one enemy in: a spider the clip had
*parked* at the origin was pulled from the recycle queue and placed 90 m away on the field, and the
wave's spawned-count went from 29 to 30. Both are exactly what a fight at that clock is meant to do.

The checks reported both as faults:

```
wave 1 of 'main_fight' spawned count should be 29, is 30
spider on slot 662 being on the field should be False, is True
spider on slot 662 moved 90.43m from where the restore put it
```

None of that is wrong game behaviour, and none of it is a restore fault. It is the restore having
written a value the running game owns from the first live frame onward.

## The rule, refined

For every value the restore writes, ask **who owns it during the settle**:

| Value | Owner during the settle | Check? |
|---|---|---|
| a parked enemy's position and presence | the fight - it may send the enemy in | **no** - check only that the actor still exists |
| an on-field enemy's position | the enemy itself, within footstep tolerance | yes, with a tolerance that allows walking |
| a wave's spawned count | the fight - it increments as it spawns | **no** |
| a wave's started / finished flags | the restore - nothing flips these in half a second | yes, exact |
| the run clock | the game - it advances | yes, as a clock: forward-only, bounded advance |
| the objective / event cursors | the restore - a live start method is the only other writer, and that is the fault you want to catch | yes, exact |

The distinguishing question is not "does the game ever change this" - it changes everything
eventually - but "can the game *legitimately* change this in the few hundred milliseconds between
the apply and the re-freeze". If yes, checking it reports the game working.

## The two false results this avoids

A check that fires on correct behaviour does two kinds of damage. It buries the real findings - the
first run's genuine fault (a re-offered objective) shared a report with two spurious ones. And it
trains whoever reads the report to expect noise, which is how the next real fault gets ignored.

Conversely, do not "fix" it by widening tolerances until the noise stops. A 90 m tolerance on enemy
placement would silence this and also silence a wholesale re-placement. Exempt the *class* of value
instead, and keep the tolerance tight on the values that remain.
