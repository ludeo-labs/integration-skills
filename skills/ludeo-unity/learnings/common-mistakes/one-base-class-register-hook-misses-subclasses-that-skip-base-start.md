---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 5
question: "Are you putting the collection's register hook in a BASE MonoBehaviour's Start()/Awake() so one site covers every subclass — and have you verified that every subclass actually calls base.Start()?"
sanitized: true
---

# A register hook on a base MonoBehaviour does not cover the subclasses that skip `base.Start()`

The most attractive finding of a phase-4 census is a **single register hook that serves every instance
of a large family**: a base `EntityController.Start()` that all ~35 subclasses inherit, so one
`06 §3.1` call covers scene-placed instances, every spawner site, and boss adds alike. The census
records it as a strength ("⭐ one hook covers both spawn sources").

**Verify the inheritance actually holds before trusting it.** In C#/Unity, `Start()` is not chained
automatically — a subclass that declares `protected override void Start()` and omits `base.Start()`
silently replaces the base body. Games accumulate these: a family whose init order differs, a variant
that reimplements the base body inline with one line changed, a decorative subclass that only
deactivates itself.

Grep before wiring:

```
override void Start()      # then read each hit for a base.Start() call
override void Awake()
```

In the observed project, 4 of ~35 subclasses skipped `base.Start()` — roughly 11% of the family, and
invisible from the base class.

## The two failure classes are different, and only one is closable in the layer

Sort each skipping subclass by whether it still self-registers into the game's **own** live list:

1. **Skips the base hook but still calls the game's `AddEntity(this)`** — recoverable without touching
   it. The game's live list is a second, independent enumerator, so a **throttled add-only sweep** over
   that list in the Ludeo layer picks the instance up within a fraction of a second. Cheaper and far
   more removable than editing N game files, and it needs no new game hook.
2. **Skips the base hook AND never registers into the game's live list** — invisible to *both* paths.
   No layer-side sweep can find it; the only fixes are a per-family hook or a scene scan. Enumerate
   these explicitly and check them against the current wave's scope; report the ones that fall in later
   waves rather than discovering them at a restore gate.

## The sweep must be ADD-ONLY

This is the trap that makes the fix worse than the bug if you miss it. The same live list a kill/death
path **removes the entity from while its corpse GameObject persists** (`06 §3.4`) is the list you are
sweeping. So a sweep that treats "id vanished from the list" as a removal will `StopTracking` every
corpse and drop it from the replay. Removal must stay bound to the real removal signal (`OnDestroy` /
an explicit destroy hook); the sweep only ever **adds** newcomers.

Note this is not `06 §2.6`'s blind per-tick scan of the scene, and it does not replace the precise
register hook — the hook registers on the exact spawn frame (no missed first sample), the sweep is a
bounded backstop for the subclasses the hook structurally cannot reach. Keep both.

Related: [[level-reset-registry-is-census-batch-iterator-and-reset-seam]] — the same "the game's own
registry is your enumerator" move, and the same caveat that registry membership is not liveness.
