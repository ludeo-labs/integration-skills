---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "5"
question: "Does your restore write 'generation inputs' (character choice, a came-from-menu flag, a seed) into statics BEFORE changing scene, and does a replay ever start from INSIDE a level - the platform's 'play again', or picking a second clip mid-run? Then the level you are leaving runs its own teardown after your writes. Read that teardown for anything it resets, and re-assert after it."
sanitized: true
---

# A replay started inside a level runs that level's teardown over your step 0

Step 0 of a restore writes the inputs a new level reads while it builds itself - here the chosen
character (a prefab name plus a "chosen from the menu" flag), the location, the seed - and then
changes scene. From the menu that is the whole story, and it worked first time.

From **inside a level** it is not. The platform's "play again" on the run-over screen re-selects the
clip while the previous replay's map is still loaded, so the restore leaves that map through the
game's own scene change - and a map being left runs its own teardown. This one, reasonably, did:

```csharp
// synthetic illustration of the shape — in the level's end-of-level hook
// leaving this map for anywhere: the next map was not entered from the menu
GameSession.cameFromMenu = false;
```

So the flag step 0 had just set was cleared before the new map read it. The new map's player set-up
then took its other branch - the authored default character - with the captured prefab name sitting
unread beside it. **Everything else was right:** same seed, same world, same position, same clock.
Only the character differed, which made it look like a capture fault rather than an ordering one.

## Why it hides

Every automated run boots fresh, so every automated run takes the from-menu path, and the from-menu
path has no teardown between step 0 and the new level. The only way to reach the fault is the way a
player reaches it: finish a replay and press play again. If the harness cannot re-select a clip from
inside a level, this class of fault is invisible to it - see
[[stand-in-for-the-play-click-so-the-harness-can-replay-alone]] for the hook that makes it reachable
(here: a fenced method that takes the real re-selection path).

## The fix, and where it goes

Re-assert the generation inputs **after** the old level's teardown and **before** the new level's
objects start. The game's own "scene load starting" signal was that window here - it is emitted by the
loader after the cleanup has run and before the target scene exists - so the restore listens for it
and, when a restore is pending and the target is the clip's map, writes the choice again. Flag and
names together, always: the flag alone makes the set-up look the name up and find a stale one.

Two things to check before trusting the window you pick:

1. **It is after the teardown.** Walk the scene-change coroutine: which line runs the level's end
   hook, and which line emits the signal you plan to hook? Here cleanup came first, then the load.
2. **It is before the consumer.** The player set-up ran in the new map's `Start`; the load-start
   signal fires before the scene is even loaded. A `sceneLoaded` callback would also have worked
   (after `Awake`, before `Start`); a load-*finished* signal would not.

## The general rule

Anything a level's teardown resets is not yours to set before that teardown runs. This is the same
shape as [[a-suppressed-trigger-may-still-run-and-re-driving-it-resets-your-restore]] - a game
method that owns some state at a transition, writing over what the restore put there - seen from the
other end of the scene change.

See also [[replaying-from-inside-the-same-level-needs-a-hop-out]] — the neighbouring fault on the same
"play again" path, when the target scene is the one already loaded.
