---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 4
question: "Are you about to state what a scene contains (or does not contain) from parsing the .unity file's script references? Prefab-instance children are NOT in that file — cross-check against the restore's matched counts or an in-editor sweep before reporting coverage."
sanitized: true
---

# Counting `m_Script` references in a .unity file undercounts the scene by everything inside its prefabs

Asked to validate what a level's capture actually covers, the fast move is to parse the scene YAML,
collect the `m_Script: {fileID: 11500000, guid: ...}` references, resolve each guid via the matching
`.cs.meta`, and count. It is quick, it needs no Editor, and it produces a confident table.

It is also wrong in a specific and dangerous way: **a prefab instance stores only its overrides in
the scene file.** Its components live in the prefab asset, so none of them appear in the count. On a
level assembled from prefabs, the parse reported *"13 script types, 73 components, no enemies at
all"* — and a restore of a Ludeo captured in that same level reported:

```
enemies matched=16 applied=16;  world matched=11 applied=11
```

Sixteen enemies and eleven world objects the parse had declared absent. The conclusion drawn from
it — "essentially nothing of this level is captured" — was reported to the integrator before it was
checked, and had to be retracted.

## What the parse is still good for

The scene-native components it *does* find are real, and their base classes are worth reading: they
tell you which level-specific mechanics exist (spawners, movers, trigger boxes) and whether the
tracked-type filter would accept them. That part of the analysis held up — a trigger box that
latches ("activate once and stay", "destroy after first deactivation") was genuinely missed by a
filter keying on a *different* switch base class.

## Cheap cross-checks that would have caught it

- **The restore's own matched counts** for a Ludeo captured in that level — the ground truth, and
  usually already sitting in a log you have.
- **The capture registration line** (`... N enemies + M world objects = K objects`) from a creator
  run in that level.
- Any **runtime sweep** at all, headless included, beats a static file parse for "what is in this
  scene".

State the method with the finding. "Parsed from the scene file, not observed at runtime" would have
flagged the claim as provisional instead of shipping it as fact. Related:
[[a-guard-that-cannot-fire-is-not-evidence]].
