---
category: engine-quirks
tier: generalizable
sourceGame: PlatformerSample
phase: 4
question: "Are you censusing how many instances of a BEHAVIOUR a level has by counting prefab instances of the prefab that hosts it — and have you checked m_RemovedComponents on each instance?"
sanitized: true
---

# Counting prefab instances overcounts a behaviour, because an instance can REMOVE the component

This is the third distinct way a scene-YAML census miscounts, and the only one that **overcounts a
behaviour while the instance count is perfectly correct**. The two already in the corpus are about the
component entries themselves (stripped prefab-instance components inflate a `m_Script` guid count;
prefab-composed levels hide a manager from a scene grep). This one is different: you count the right
number of *objects* and the wrong number of *behaviours*.

## The shape

A level census needed the number of oscillating platforms. The obvious measurement — count
`PrefabInstance` blocks whose `m_SourcePrefab` guid is the platform prefab, since the prefab is the only
host of the oscillator component — returned **11**. It was reported as 11, approved at a human gate, and
a whole tracked type was scoped around it (attributes, a stable-key scheme, an estimated per-tick
attribute budget).

At runtime `FindObjectsOfType<Oscillator>(true)` returned **2**.

Both numbers were right. There really are 11 instances of the prefab. **Nine of them override the prefab
with `m_RemovedComponents`, deleting the oscillator**, and are used as static scenery:

```yaml
--- !u!1001 &430035528
PrefabInstance:
  m_Modification:
    m_RemovedComponents:
    - {fileID: 1651846489290252780}     # <- the behaviour's component anchor in the prefab
    m_Modifications:
    - propertyPath: m_Name
      value: staticplatform (7)
  m_SourcePrefab: {fileID: 100100000, guid: <platform prefab>}
```

Unity's prefab system makes this a one-click designer action, so it is common wherever a prefab has a
useful mesh and an optional behaviour. Nothing in the instance count hints at it.

## The measurement that is actually correct

Parse `PrefabInstance` documents, and for each one **resolve `m_RemovedComponents` against the host
prefab** to see whether the component you care about survived:

1. In the **prefab**, find the `fileID` of the component whose script guid you are censusing — that is
   the component's *anchor*.
2. In the **scene**, for each `PrefabInstance` of that prefab, read `m_RemovedComponents` and check
   whether the anchor's `fileID` appears. If it does, this instance does **not** have the behaviour.

Report the two numbers separately: *instances of the prefab* and *instances that still carry the
behaviour*. They are different facts and the second is the one a tracked type is scoped on.

⚠ **Do not trust the instance's name to tell you which is which.** In the observed scene nine stripped
instances were helpfully renamed `staticplatform*` — but one of them kept the original
`MovingPlatform (3)` name, so a name-based filter would have counted 3 and still been wrong. And the two
*live* ones were named `MovingPlatform` and `MovingPlatform (2)`, i.e. exactly the pattern the stripped
`MovingPlatform (3)` shares. Names are authored by hand; `m_RemovedComponents` is structural.

## Why this is worth a gate, not just a fix

The wrong number was **approved by a human** before any code existed, which is the point of the census
gate — and the gate could not have caught it, because the reviewer was reviewing a plausible number with
no way to see the overrides. What caught it was the **first runtime registration log**: a line printing
`saw N` from the actual enumerator, next to the plan's expected N.

So: **make every batch-registration sweep log what the enumerator actually saw**, and diff it against the
plan's figure at the gate. A census number is a hypothesis until an enumerator confirms it. Two corollaries
from the same log line in the observed project:

- The *primary* sweep saw **more** than planned (166 vs 148) because the phase-4 count came from scene-YAML
  id *overrides* and missed keys **baked inside prefabs** — a prefab-composed collection contributes
  entities that never appear as scene overrides at all. Overcount and undercount in the same log line.
- An `unclassified=N` bucket in that same line is worth printing even when you expect it to be zero. Here
  it was 9, and they turned out to be nine `SaveableEntity`-bearing GameObjects **inside one UI prefab** —
  a type the census had modelled as a single singleton but which is really N entities. That is a later-wave
  census correction that surfaced for free.

**Neither discrepancy was a capture defect.** Resist the urge to "fix" the code when the log disagrees with
the plan — instrument first, then decide which of the two is wrong. In this case the code was right both
times and the plan needed amending.
