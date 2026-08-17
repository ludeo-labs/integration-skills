---
category: common-mistakes
tier: universal
sourceGame: TPSSample
phase: 5
question: null
sanitized: true
---

# Never discover state by scanning from a per-tick capture writer — take the signal

Capture writers run on **every tick**. Restore code runs **once**. They look alike and read alike,
and it is very easy to write one in the shape of the other. Doing so is not a mild inefficiency: a
scene-wide search per tick is felt immediately as a frame-rate collapse, and the integrator will
report it as "the editor got slow" long before anyone connects it to the integration.

The concrete failure: a new tracked family needed "which destructible scenery is currently broken".
The obvious implementation asked the engine — `FindObjectsOfType<T>(true)` — inside the writer. That
call walks every object in every loaded scene, including inactive ones, and there were several
hundred of them. It shipped, and the next session opened with "performance is really bad now, could
it be something you did?" It was.

## The rule

**Before writing any per-tick capture code, ask what already announces this change.** Almost nothing
worth capturing happens silently. Objects are spawned, despawned, damaged, opened, broken, equipped —
and engines and gameplay code overwhelmingly emit *something* at that instant, because their own
systems need to react too. If you are searching for a state change, you are almost certainly
duplicating work someone already did and throwing away the notification.

Look, in order:

1. **An existing event or delegate on the component.** Often already there and already fired at
   exactly the right moment (a `UnityEvent` invoked at the point of the state change is a common
   shape). Watch for one trap: a per-*instance* event still requires enumerating every instance to
   subscribe, which reintroduces the scan you were trying to remove.
2. **A single hook call added at the source.** One line in the game's own state-change method,
   calling the integration's hook façade — the same shape the integration already uses to learn about
   object spawn and despawn. This is the cheapest and most exact option, and it is the one that
   removes searching entirely.
3. **Caching with a rescan interval.** Only when neither of the above is reachable. It is a
   mitigation, not a design: it trades a frame-rate cost for a staleness window, and you must be able
   to say precisely what that window can miss.

## Why this keeps happening

Polling feels safer. A scan is stateless, cannot miss anything, and needs no cooperation from game
code, so it reads as the conservative choice — while the per-tick cost is invisible on the machine
writing it and only shows up in someone else's session. Adding a hook feels riskier because it edits
a game file. It isn't: a single façade call at the point of a state change is the smallest, most
reviewable, most trivially removable edit available, and the integration is expected to make exactly
those.

## Shape that works

Keep a small collection in the capture layer, appended by the hook the instant the change happens.
The writer then serialises what it already holds and searches for nothing:

- record the **value you need** at signal time (a position, an id), not an object reference — nothing
  can then dangle, go null, or keep a destroyed object alive;
- record it **whether or not a capture segment is open**, because state that changed before recording
  started is still true inside the recorded moment;
- clear it when the world is rebuilt, so a previous level's state never bleeds into the next.

## The generalisation worth keeping

This is not really about one API. **Any time integration code searches for something, ask whether the
thing could have told you instead.** Scanning is how you find state you were not informed about;
being informed is nearly always available, and is nearly always both cheaper and more precise — a
signal carries the exact moment of the change, while a poll only ever tells you what was true the
last time you happened to look.
