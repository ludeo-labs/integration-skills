---
category: engine-quirks
tier: generalizable
sourceGame: PlatformerSample
phase: 2
question: "With ForceText serialization, did grepping a level .unity for a manager's script guid return zero — even though the game obviously has that manager at runtime?"
sanitized: true
---

# A zero hit-count when grepping a scene for a script guid means "composed from a prefab", not "absent"

Force Text serialization makes scenes and prefabs greppable, which is the phase-2 accelerator the
workflow is after. The trap: a scene that builds itself out of **prefab instances** does not contain
the prefab's components. It stores a `PrefabInstance` block — the prefab's guid plus an
`m_Modifications` list of per-instance overrides — and nothing else. The `MonoBehaviour` blocks, and
therefore the **script guids, live in the `.prefab` file**.

So resolving a manager's `.cs.meta` guid and grepping the level `.unity` for it returns **0** for
every manager in a prefab-composed project. Read that as "not authored directly into the scene",
never as "this level has no game manager" — the wrong reading sends you looking for a bootstrap that
does not exist, or concludes a subsystem is unused.

## The two-step lookup that actually works

```bash
# 1. script guid -> which PREFABS host the component
guid=$(grep '^guid:' path/to/TheManager.cs.meta | awk '{print $2}')
grep -rl "$guid" Assets --include=*.prefab --include=*.unity

# 2. prefab guid -> which SCENES instance that prefab
pguid=$(grep '^guid:' path/to/TheManager.prefab.meta | awk '{print $2}')
grep -c "$pguid" path/to/Level.unity          # >0 => instanced in this scene
```

Step 2's hit count is a reference count, not an instance count (one `PrefabInstance` emits several
lines mentioning the guid), so treat it as a boolean unless you parse the blocks properly.

## The same lookup doubles as a free per-level content census

Running step 2 for every entity prefab across every level scene is a cheap, evidence-backed answer to
"which level should Wave 1 capture in?" — long before opening the Editor. In the source integration it
produced a decisive finding in one pass: the only gameplay level still enabled in Build Settings
contained **zero** instances of any enemy prefab (and no gate, puzzle, or moving platform), while a
level that had been dropped from the build had all of them. Picking the enabled level would have meant
building the entire Wave-1 tracking set against a scene with nothing to track.

Corollary worth stating in the phase-2 map: because composition lives in prefabs, phase 4 reads entity
configuration from the **`.prefab`** yaml and per-level differences from the scene's
`m_Modifications` blocks. Reading only the scene silently returns prefab defaults for every
inspector-set value.

## Caveats

- **A component can be authored directly into a scene as well as living in a prefab** — the two are not
  exclusive. Grep both file types (as step 1 does) rather than assuming one location.
- **Nested prefabs push the component another level down.** If step 1 finds the guid in a prefab that
  step 2 cannot find in any scene, grep the *other prefabs* for that prefab's guid — it is a child of
  one of them.
- **A prefab instanced but disabled** still shows up in step 2. Liveness needs the instance's
  `m_IsActive` override, not the presence of the guid.
