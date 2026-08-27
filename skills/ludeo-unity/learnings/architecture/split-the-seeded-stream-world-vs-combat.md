---
category: architecture
tier: generalizable
sourceGame: RoguelikeSample
phase: 4
question: "Converting a game to seeded randomness for replay? Check WHAT ELSE draws from that stream. If any draw fires at player frequency - enemy AI decisions, drop rolls, chest contents - a single shared stream cannot reproduce the world, and one shared helper class is usually how they got there."
sanitized: true
---

# One seeded stream is not enough — split world from combat

A run-based procedural game was converted to seeded randomness so replays would rebuild the same
world. The conversion was done well: a single `Unity.Mathematics.Random`, whose whole state is one
`uint`, captured and restored as a single attribute. The plan even reasoned explicitly that loot and
cosmetics must stay on the *engine* RNG *"so ordinary play cannot advance this stream and change the
map."*

That reasoning was right. The implementation then broke it, through a step that looked like pure
profit.

## How the contention got in

The game funnelled most of its randomness through one shared static helper — three primitives
(`Rnd`, `RndRange`, `Sample`) that every other draw built on. Repointing those three method bodies at
the seeded stream fixed **69 call sites at once** without touching a single caller.

It also swept in every caller nobody had classified. Chief among them: **enemy AI decisions**. The
enemy state machine picked move-vs-attack, and then which attack, through that same helper — once per
enemy, per decision cycle, for every live enemy, for the whole fight.

The conversion notes recorded this as *"a side effect, not a goal… harmless."* It is the opposite of
harmless: it is exactly the contention the plan's own rationale forbade, and enemy AI draws far more
often than loot ever would.

## The part that makes it structural, not a tuning problem

The decision *cadence* came from the unseeded engine RNG:

```csharp
// Neutral illustration of the shape - not client source
void Rest() {
    restTimer = Random.Range(restTime, restTimeMax);   // ENGINE rng (unseeded)
}
void Think() {
    if (TimerHitZero(ref restTimer))
        ChooseAction();                                 // -> SharedHelper.Rnd()  == SEEDED stream
}
```

So the engine RNG decides **how many** draws are taken off the seeded stream. Which means:

> Even with byte-identical player input, the seeded stream's position after any fight is
> nondeterministic.

Every world decision made *after* combat — the next room's contents, which enemies are special, the
reward offered, the shop stock — therefore lands at an unpredictable position.

## What it costs you

- **The verification becomes unable to pass.** "Replay the clip twice and diff the world" reports a
  mismatch whenever an enemy was alive and thinking, with no defect present. Teams burn real time
  chasing this before finding the cause.
- **Room-to-room continuity breaks.** A moment that finishes one area and continues into the next
  gets different content than the recording — often the very first slice anyone tries.
- **The restored moment itself still looks fine**, which is what makes it slow to spot. Geometry and
  the entities present at the restore instant come back from captured entity state, not from
  regeneration. Divergence starts at the first world draw *after* the restore point.

## The fix

Two streams, each captured as its own `uint`:

| Stream | Draws | Property |
|---|---|---|
| **World** | map/area selection, which content fills a slot, rewards, offered upgrades, shop stock | low frequency, advanced only by progression |
| **Combat** | AI decisions, summons, drop rolls, container contents, jitter | player-frequency, free to diverge |

Nothing in combat may touch World. That restores the guarantee the original plan intended.

## Make the split un-missable

Getting the routing right once is easy; keeping it right as the game grows is the real problem. Two
choices did that work:

1. **No un-suffixed draw API on the stream holder.** Expose only `Rng.World.*` and `Rng.Combat.*`.
   A draw added later by someone who never read this note **fails to compile** instead of silently
   choosing. The original bug was a silent wrong-stream landing; this converts that class of bug into
   a build error.
2. **Point the shared helper's existing names at Combat**, and give World explicit `*World` variants.
   This is the fail-safe direction: an unclassified draw lands on the stream that is *allowed* to
   diverge. The reverse default would silently corrupt world reproduction — the exact failure being
   fixed.

A useful side effect of (2): the combat-side files needed **no edits at all**, so the change stayed
small and reviewable.

## Watch for a half-honoured deferral

Check any "we deliberately left this random" list against what the shared helper actually does. In
this game two files were listed as deliberately-random *loot* — but only their **amounts** and
physics scatter were still on the engine RNG. Their **chance rolls** went through the shared
percentage helper and had been seeded along with everything else. A deferral is only real if every
draw in it actually bypasses the seeded stream.

Related: [[seed-replay-only-reproduces-what-the-seeded-stream-draws]] — the mirror failure, where the
stream is *incomplete*. This one is the stream being *over-subscribed*, and it is the more
dangerous of the two because it presents as a verification that mysteriously will not pass.
Also [[persisted-progression-can-be-a-generation-input]].
