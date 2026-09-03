---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: 5
question: "Does the level/room run any of its own setup on a SCALED-time coroutine (WaitForSeconds, a spawn delay, a wave warm-up)? Your restore hold parks it mid-flight. It does not die there - it resumes the moment you unfreeze, which is after your apply, and it overwrites what you restored."
sanitized: true
---

# The restore freeze parks the room's own setup, and it resumes on top of your apply

The restore holds the world still so nothing can overwrite the applied state (CR-010). But a hold
built on `Time.timeScale = 0` does not stop the game's setup work — it **suspends** it. Every
`WaitForSeconds` in flight is scaled time, so those coroutines park exactly where they are and wait
for you. They resume when you unfreeze, which is *after* the apply and after the player has pressed
Play.

The observed shape, from a room's wave/encounter scheduler:

```
on room entry -> StartCoroutine:
    WaitForSeconds(0.2)
    <disable every wave enemy>     // SetActive(false) across the whole roster
    WaitForSeconds(spawnDelay)
    <enable the first wave>        // re-enables them, with spawn feedback
```

So the run went: freeze → apply (place the recorded enemy, switch the rest off) → wait for the click
→ unfreeze → **the parked coroutine resumes**, the disable step switches off the enemy that was
just restored, and the first-wave step spawns the room's whole opening wave on top. The integrator's
report was *"the enemies don't spawn until after I start playing"* — which is precisely what a
parked-then-resumed spawn sequence looks like from the outside.

## Why the restore's own verification says everything is fine

This is the part that makes it expensive. A checkpoint that runs after the apply — even one reading
live game state, even one at the player's click — runs *before* the parked coroutine resumes. It
sees the correct world and reports it. Two clean checkpoints and a wrong replay is the signature.

The check is not broken. It is being asked at a moment when the answer is still yes.

## The fix: drain first, apply last

Let the room finish its own setup on a **running** clock, then freeze, then apply:

1. Hold the sim in a mode where **time runs** but input stays suppressed and enemies stay
   behaviour-frozen (the settle mode already needed for teleports serves this exactly).
2. Wait on the game's **own idle signal** — not a guessed duration.
3. Freeze, apply, settle, verify.

The apply must be the last thing that touches the world before gameplay begins. Both the Unity
guidance ("let the level build and all its async setup drain on a running engine clock, gated on the
game's own setup-idle signal") and the Unreal player flow (`SetGamePaused(false)` →
`ApplyPlayerState()` → `BeginGameplay()`) say the same thing from opposite directions.

## Finding the idle signal when the game does not offer you one

The game here already had the right flag — a "still standing enemies up" boolean the wave manager
clears when the last enemy finishes activating. But it was **never raised on the restore path**: the
normal room transition raises it, and the restore boot bypasses that path, while the one other setter
was gated on a flag the restore had already flipped.

Raise it yourself from the restore boot, mirroring what the game's own transition does. That is a
legitimate use of the game's contract rather than an invention, and it usually restores the flag's
original purpose too (here, not dying to something that spawns on top of you).

Bound the wait and log the timeout: a room whose waves are all empty never clears the flag, and an
unbounded wait with no log is as unreadable as the bug it replaced.

## The general rule

**Before freezing for a restore, ask what the game is still in the middle of doing.** Anything on
scaled time is not finished — it is queued behind you, and it will run last. "Last write wins" is
decided by resume order, not by call order.

Related: [[a-game-clock-freeze-still-animates-on-the-engine-clock]] (the same clock split seen from
the presentation side) and [[schedule-clocks-tick-through-the-pre-play-hold]] (its mirror: work on a
clock the hold does *not* freeze, which drifts instead of parking).
