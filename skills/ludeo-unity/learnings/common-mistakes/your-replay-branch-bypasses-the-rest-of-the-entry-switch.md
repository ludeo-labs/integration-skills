---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 5
question: "Did you add an early-return replay branch to the game's level-entry method? List every branch BELOW yours in that method — you have bypassed all of them, including the one that starts the level's antagonist."
sanitized: true
---

# An early-return replay branch silently skips every later case in the entry switch

The replay needs a level to start without the intro walk-in, so a branch goes near the top of the
game's level-entry method:

```csharp
if (MustPlayIntro()) return;

if (IsInLudeoFlow) { RepeatedLevelStart(); return; }   // <-- replay takes the quiet path

if (IsBossLevel()) { ... BossStart(boss); return; }    // <-- never reached on a replay
if (AlreadyVisited())  { RepeatedLevelStart(); return; }
NewLevelStart();
```

The branch is correct about what it wanted: no walk-in, no cutscene, no repositioning the player
off the restored transform. It is silently wrong about everything the *later* branches do.

In this game `BossStart` was the **only** caller of `boss.Init()`. On a replay of a boss level the
boss therefore never initialised, and the symptom was reported as "the boss does not move and
does not attack":

- its fight state (phase counter, velocity, unfrozen flag, life count) was never set, and none of
  its attack coroutines ever started — the log had **zero** lines from the boss;
- `Init()` was also what deactivated the boss's authored-active stand-in doubles. Left active,
  their animation event called into the boss every loop and threw
  `NullReferenceException` **52 times in one replay**, on a field that only a player hit ever
  assigns.

## The check

After adding a replay branch to any dispatcher, **read every branch below it and ask what the
replay now loses**. In practice the ones that bite are per-level-type cases: boss levels, tutorial
levels, timed levels — each initialising something the generic "already visited" path does not.

## Take only the initialisation, not the whole case

Do not call the game's boss-start method wholesale from the replay branch: here it also teleported
every player to the level's authored spawn, which would stomp the restored position. Call the
initialiser alone:

```csharp
if (IsInLudeoFlow)
{
    RepeatedLevelStart();
    if (IsBossLevel()) { var boss = FindObjectOfType<Boss>(); if (boss != null) boss.Init(); }
    return;
}
```

**Ordering makes this safe:** the initialiser resets position and life count to authored values,
but level entry runs at scene load and the restore applies *after* it, so the captured values
still win. Verify that with the restore's own log line rather than assuming it — see
[[make-the-restore-verify-every-value-it-writes]].
