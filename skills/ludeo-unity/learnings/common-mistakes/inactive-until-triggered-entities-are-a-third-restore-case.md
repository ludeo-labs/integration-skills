---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 5
question: "Is your restore's reconciliation a two-way choice between MATCH (a live scene instance) and SPAWN (a clone) — and does the 'live scene instance' side enumerate the game's own runtime registry rather than the scene?"
sanitized: true
---

# Inactive-until-triggered entities are a THIRD restore case — and the baseline reset can be what deactivates them

Pre-existing-object reconciliation is normally taught as a two-way sort: **match** the instance the
reloaded scene already placed, or **spawn** the one the captured run created. That sort is complete only
if "the scene placed it" implies "the scene has it live." For a boss — or any entity that is authored into
the scene but **disabled until a trigger arms it** — it does not, and the entity falls through *both*
branches.

The mechanism is short:

- The reconciler enumerates candidates from the game's own live registry (`Level.GetEnemies()`,
  `SpawnedActors`, an `IResettable` list) because that registry is convenient and already correct for
  everything else.
- Every entity joins that registry from its own `Start()`.
- **An inactive `GameObject` never runs `Start()`.** So the entity is not in the registry, is not a match
  candidate, and — being scene-placed — is not a spawn candidate either.
- The restore reports "bucket entry with no scene instance", the entity is absent from the replay, and the
  viewer has to walk back into the trigger, replaying the intro and restarting the encounter from its
  beginning. Which is precisely the moment the Ludeo existed to skip.

**The tell in a census:** the phase-4 count of that archetype is `0` at session start and only becomes `1`
once the player physically reaches it. If a census recorded that and it was read as "the entity spawns at
runtime", re-read it — it may not spawn at all, it may just switch on.

## The baseline reset is on the *other* side of this

Worse, the restore's own **matched-instance baseline reset** (`07 §4`/`§9` — reset before applying,
because a matched instance was never re-instantiated) often *performs the deactivation itself*. In the
observed project all three boss archetypes ended their `RestartLevel(...)` override with
`gameObject.SetActive(false)` plus a re-arm of the intro trigger and a clear of the "dialogue done" latch —
i.e. the reset returns the encounter to its **pre-fight** configuration, which is exactly right for a
level restart and exactly wrong as a starting point for "restore mid-fight" unless every one of those
fields is then written back.

**Do not skip the reset to dodge this.** The reset is load-bearing; the fix is to restore *over* it. Order:
activate → reset → apply, and let the captured values win. Concretely, the captured `introTriggerActive =
false` / `dialogueEnded = true` / `arenaLocked = true` must be applied *after* the reset re-armed them, or
the viewer can walk back through a re-armed trigger and replay the intro mid-fight.

## Finding the instance: the key is probably not unique

Resolving the entity means sweeping the scene *including inactive objects* — `FindObjectsByType<T>(
FindObjectsInactive.Include, FindObjectsSortMode.None)`, filtered to the active scene. Prefer that over
`Resources.FindObjectsOfTypeAll`, which also returns prefab **assets** and prefab-stage objects and would
happily hand a prefab into a scene-instance role.

⚠ **Then expect the key to be ambiguous.** A `{scenePath}/{objectName}` key — the natural one, because the
game's own progression persistence usually already builds it — is not guaranteed unique. In the observed
scene, **four** instances of the same boss prefab carried the same name: the real one plus three cinematic
doubles parented under disabled timeline containers (intro / mid / outro cutscene stand-ins). A sweep that
took the first hit could have activated a cutscene prop and restored the fight onto it.

Two **structural** conditions separate them, and neither is a heuristic:

1. **`activeSelf == false`** — the object is off by *its own* switch, which is the switch the suppressed
   trigger would have flipped.
2. **every ancestor is already active** — so `SetActive(true)` genuinely makes it live.

A cutscene double fails both: its own `activeSelf` is `true` and its *parent* is off, so activating it
would change nothing anyway. Report those as "inert look-alikes, not activated" — "the key matched
nothing" and "the key matched three things I refused to touch" are different findings. If two candidates
pass both conditions, **fail loud and activate neither**: restoring an encounter onto the wrong instance is
worse than not restoring it.

## Activation defers `Start()` — the same late-`Start` hazard as a spawn

`SetActive(true)` runs `Awake`/`OnEnable` synchronously but defers `Start()` until before the next
`Update`. So everything the apply writes afterwards is exposed to that `Start()` — the identical hazard a
runtime-spawned clone has. **Reuse the spawn path's post-`Start` re-assert queue; do not invent a second
mechanism.**

### ⛔ Re-assert the WHOLE apply, never a hand-picked subset — this is the part that bites twice

The obvious move is to list what `Start()` clobbers and re-write those fields. **Do not.** The first
attempt at this fix re-asserted exactly two things — the state controller and the phase field — because
those were the two clobbers found by reading the entity's own class. It shipped, the entity appeared
correctly in its restored phase, and it was still **wrong**: HP came back full.

The reason is structural. **Activating a `GameObject` defers `Start()` on the entire hierarchy, not on the
one class you reasoned about.** The clobber was a *sibling component*:

```csharp
public class HealthComponent : MonoBehaviour
{
    void Start() { SetHealth(m_MaxHealth); }   // resets to FULL, one frame after the apply
}
```

Nothing about the entity's own class hints at it. Several other siblings had their own `Start()` too. Any
audit-then-curate approach is a race between your reading of the hierarchy and the next component someone
adds — and it **silently drifts from the capture schema** the moment a later wave adds an attribute,
because nothing fails when the curated list falls behind.

**So: re-run the same apply the restore already performs for that entity, in the same order.** If the
per-entity apply is idempotent — and a well-built restore's apply is, by contract, because a family's own
`Start()` can always run after it — then re-running it is free and total. It also **preserves every
ordering constraint by construction** instead of by a second set of rules you now have to keep in sync
(engagement-flag-before-state-activation, death-progress-after-activation, deactivate-before-the-terminal-
state, and so on).

Three practical notes:

- **Give the re-run a throwaway report object.** The apply increments counters; folding a re-assert into
  the real restore report double-counts what happened. Discard the scratch and let the re-assert's own log
  line be the evidence.
- **Probe the read before trusting the pass.** A read that happens outside the SDK's object scope — or
  through a handle that did not survive the frame — returns `false` *silently*, so every row no-ops and
  the entity keeps whatever `Start()` left. That is indistinguishable from success unless you check. Do
  one read whose result you know, and escalate loudly if it fails.
- **De-duplicate the registry.** The baseline reset's registration and the late `Start()`'s registration
  both append to a list with no duplicate guard, so the entity ends up in the live roster **twice** — the
  aggregate drift `07 §9` warns about. Count and trim through the game's own public remove. (Watch for the
  *guarded* version of the same collision too: a registry that refuses duplicates but logs an error will
  now emit a red line on this path. Confirm it is harmless and say so, rather than de-registering to
  silence it — that can drop a real registration on the path where `Start()` never runs.)

### The specific trap worth naming: an Editor-only debug seed

A boss base class commonly seeds its phase from an inspector *debug* field:

```csharp
protected override void Start()
{
    base.Start();
#if UNITY_EDITOR
    m_Phase = m_DebugPhase;                       // silently overwrites the restored phase
    if (m_Phase != Phase.First) AdvancePhase();   // …and can fire a cutscene
#endif
}
```

Because that `Start()` now runs *after* the apply, a stage-2 Ludeo and a stage-1 Ludeo restore
**identically** — and only in the Editor, which is exactly where the acceptance test gets run. A full
re-apply covers it; a curated list covers it only if you happened to read that file.

## Restore latches and mode state BEFORE the values their thresholds guard

The one that survives longest, because it produces a **correct end state**. A phase/stage transition is
normally guarded by a threshold test evaluated inside a change notification:

```csharp
void OnHealthChanged(HealthComponent h)
{
    if (m_phase != Phase.Second && h.Current <= m_secondPhaseThreshold)
        AdvancePhase();          // cutscene, animation, add-summon, mode switch…
}
```

`SetHealth` invokes that notification **synchronously**. So if the restore writes health *before* phase —
the natural order, because health is a plain "wave 1" scalar and phase is a "boss row" — then the moment
you write the captured `68 / 280`, the entity looks at a world where `phase == First` and the threshold has
just been crossed, and it **correctly does its job**: it plays the transition you were restoring *past*.
Your `SetPhase(Second)` then lands one instruction too late. The player watches a cutscene, then the fight
continues perfectly.

**Write the mode/phase/latch first, and the game's own guard turns the transition down by itself.** No
suppression, no flag, no gate — which matters, because the same trigger must still work for a *real*
threshold crossing later in the same replay. This is `07 §9`'s "gate the trigger, not the primitive" one
level up: don't gate anything, just present a consistent world.

Four things worth checking rather than assuming, each of which changed the fix in the observed project:

- **Which paths write both.** Every path that writes the guarded value needs the ordering, including a
  post-`Start` re-assert. Fixing only the one you can reproduce leaves the other armed.
- **How the handler is subscribed.** A handler wired as a *serialized* event listener in the prefab/scene
  is live from deserialization — no registration call, no `Start()` required. Two of three bosses were
  wired that way, which made the "the subscription hasn't happened yet during the first pass" reasoning
  wrong, and meant both passes fired.
- **Whether the latch actually latches.** One override ran the transition without ever setting the phase
  field (a cutscene-completion callback set it later), so the guard stayed false and the transition could
  re-fire on *every* subsequent change notification. Read the override, not just the base class.
- **What else the transition does.** One boss's `AdvancePhase` re-rolled the very timers the restore had
  just re-armed — so the phantom transition was also silently undoing restored state, not merely showing
  a cutscene.

**Then sweep for the same shape and record the clears**, because "value written before its latch" is a
category, not an incident: entity death thresholds, stagger/poise breaks, shield breaks, low-health modes,
resource-full states. In the observed project all of those turned out to be either derived-and-recomputed
(safe) or driven by a return value rather than an event (safe) — but that is a finding, and it is only a
finding because each was checked.

> **The tell:** a **correct final state preceded by a phantom transition**. If the end state is right and
> something dramatic happened on the way in, look for a threshold handler that ran before its latch was
> restored — not for a bad value.

## Restoring a value through a setter that drives an animated widget fakes an event

Even with every value correct, one artifact is left: the **arrival**. A HUD element that interpolates —
a health bar with a trailing "damage" ghost, a lerped resource meter, an easing score counter — treats a
restore write as a *change*, and a change is the thing it exists to dramatize.

```csharp
public void SetValue(float pct)
{
    SnapMainBar(pct);
    if (m_useTrail) StartTrail();   // trail lerps from its OLD value toward pct
    m_currentPct = pct;
}
```

A restore legitimately writes the same value two or three times in one frozen moment — the baseline reset
puts it at maximum, the apply writes the captured value, the post-`Start` re-assert writes it again — so
the trail ends up parked at 100% and armed.

⚠ **And it waits for the player.** These widgets time themselves off the scaled clock, which does not
advance while the restore holds `timeScale` at `0`. So nothing moves behind the cover — the artifact is
*invisible during the entire window you would have inspected it in* — and the whole delay-plus-slide plays
out **starting the instant control is granted**. The player sees the boss take a large hit on the first
frame of a replay in which nothing hit it.

**Snap the presentation after the last write, and make that the restore's final step.** Two placement
rules follow from the mechanism:

- It must run **after the last write**, and the last write is later than you think: if a UI panel is shown
  during the restore, the show call itself pushes a value through the same setter and re-arms the trail;
  and if you have a post-`Start` re-assert, *that* is the true last write, a frame later. Snap at both
  points — it is idempotent.
- **Do not silence the change event to achieve this.** That event is usually load-bearing for real logic —
  in the observed project the boss's phase-2 transition was a subscriber on the same health-changed event.
  This is `07 §9`'s "gate the trigger, not the primitive" applied to presentation: let the event fire, let
  every subscriber run, and collapse only the *animation* the last one started.

Fix it **at the widget, not at the entity**. Two consumers (a player bar and a boss bar) driven by one
class means one seam covers both and every future consumer for free; a per-entity fix is two paths that
drift. Expect the accessor you need to be private (`m_currentPct`, the trail's start value, the reposition
helper) — a small **additive** public `SnapToCurrent()` on the widget, with no call site in game code, is
the honest price. Do not reach into privates by reflection.

**Then sweep every other interpolated element and record the verdicts**, not just the fixes: sibling bars,
resource/stamina meters, counters. In the observed project the player's *shield* bar was the same class
with its trail flag off, stamina was a direct `fillAmount` write, and the counters were text — all
genuinely clear, but only because they were checked and their prefab flags read.

> **The tell that this defect is present and hiding:** the value is right on inspection, the log is right,
> and a human describing it says *"it looks like it got hit"* / *"it looks like it started damaged"* — a
> sentence about a **transition**, not a state. Restore state; never restore the transition into it.

## A diagnostic that prints the live value hides the bug

The first fix's re-assert log printed `life=280/280` — correctly formatted, and wrong. Two reviewers read
past it, because a single formatted value carries no claim: you cannot tell "restored to 280" from
"clobbered to 280" without the other number.

Print **applied-vs-previous for every re-asserted field**, sampled off the live entity either side of the
re-apply:

```
life=191/280 (RE-ASSERTED over 280/280) · pos=(658.63,-92.87,0.00) (unchanged) ·
phase=PHASE_2 (RE-ASSERTED over PHASE_1) · onGuard=True (RE-ASSERTED over False) · state=… (unchanged)
```

Now `(unchanged)` means "the late `Start()` did not touch it" and `(RE-ASSERTED over X)` means "it did,
and X is what the player would have got" — and a field that *should* have changed and shows `(unchanged)`
is equally visible. That asymmetry is why the phase clobber was catchable and the health clobber was not:
the phase line already had this shape, and the health line did not.

**Drain that queue on a LATER frame, not the same one.** If the apply runs from a coroutine continuation
(`yield return null`), it is already past the frame's behaviour-update phase, so the pending `Start()` does
not flush until the *next* frame — after this frame's `LateUpdate`. A same-frame re-assert therefore runs
*before* the clobber and leaves `Start()` with the last word: the log line prints, the counter increments,
and nothing was actually re-asserted. Stamp each queued entry with `Time.frameCount` and refuse to drain it
until the count has moved. The extra frame is free — the restore is still frozen behind its cover.

## And fix the diagnostic that misfiled it

The original message was *"entry has no scene instance — permanent-death divergence? (legitimate save-state
difference, not a bug)"*. It sent the investigation to the progression system for a save whose flag was
`false` the whole time. `07 §10.5` exists so a diagnostic **ends** the guessing; **one that confidently
names the wrong cause is worse than one that says "unknown."**

Make the message emit only a cause it actually checked, and check the cheap ones:

| Observation | Message |
|---|---|
| resolved inactive in the scene and activated | *not* a divergence — say so, and name the entity |
| absent, progression flag **set** in the viewer's save | the genuine divergence |
| absent, progression flag **clear** | **not** a divergence — a real capture/scene mismatch, and an error |
| key present but every instance is under a disabled ancestor | cause **unknown**, and say which |
| several activatable instances share the key | ambiguous — refused, count named |

Note the third row is the one the old message could never produce, and it is the one that catches a renamed
or deleted object. Also note that answering rows 2 and 3 requires reading the progression flag **directly
from the save**, bypassing any restore-time gate the layer installed over that query — otherwise the gate
answers "not dead" by construction and the diagnostic is worthless.

## The generalization

**Existence, liveness, and registration are three different things, and a reconciler that sorts on the
registry conflates all three.** Sort on the question you actually mean:

- present in the live registry → **match**;
- present in the scene but not live → **activate, then match** (this case);
- not in the scene at all → **spawn**, or report a genuine absence.

Any entity that is "authored in, switched on later" — a boss, a scripted ambush, a mini-boss gate, an
elite spawn point, a phase-2 arena hazard — is in the middle bucket. Audit for it with a grep for
`SetActive(true)` on the entity's own `gameObject` inside its own class, and for scene objects whose
authored active flag is `0`; if either hits, the two-way sort is incomplete.

And the second, sharper generalization — the one that cost a second gate:

> **When a restored entity's initialiser runs *after* the apply, the only safe repair is to re-run the
> whole apply. Re-asserting a hand-picked subset silently under-restores everything you did not list — and
> a diagnostic that prints the live value without the captured one hides exactly that.**

This is not specific to activation. It applies to any instance whose `Start()`/`OnEnable()`/`Init()` is
deferred past the restore write: spawned clones, pooled objects fetched during the apply, anything
re-parented into an active hierarchy. **Fix the shared path, not the entity that revealed it** — in the
observed project the same under-restore was sitting on every runtime-spawned clone and had simply never
been exercised, because the test level had no spawner in it.
