---
category: architecture
tier: generalizable
sourceGame: ActionAdventureSample
phase: 4
question: "Does the game persist any per-object progression flags (permanent deaths, used/consumed elements, triggered events, opened chests) — and if so, how does it build the string key it stores them under?"
sanitized: true
---

# Before inventing a stable key, look for the one the game's own persistence already built

`06 §4` / CR-014 require a **cross-run stable key** per collection entry and forbid `GetInstanceID()` or
object references. The reflex is to add a new key field and assign it at spawn. **Check first whether the
game already computes one** — many games do, for a reason unrelated to Ludeo.

Any game that persists *per-object* progression flags — "this enemy is permanently dead", "this element
was used", "this event already fired", "this chest is opened", "this checkpoint/totem was consumed" — must
identify those objects across runs, and therefore already has a key builder. A very common shape:

```
$"{namespacePrefix}/{scene.path}/{gameObject.name}"
```

That string is a genuine cross-run stable identity for **scene-placed** objects: scene path plus the
authored object name, both fixed at author time, neither derived from a runtime handle. It satisfies
CR-014 as-is. Reusing it beats adding a parallel key because it needs **no game-code edit**, and because
it is already the identity the game's own save/restore logic agrees with — so Ludeo restore and game
persistence can't disagree about which object is which.

Sibling tell: a reset/restart contract whose interface exposes a `GetName()`-style accessor returning
`gameObject.name` (see [[level-reset-registry-is-census-batch-iterator-and-reset-seam]]) — that accessor
exists precisely so the game can key objects by name, and confirms names are unique per scene by
convention.

## The hard boundary — it only covers scene-placed instances

**Runtime-spawned instances are `"Prefab(Clone)"` and are NOT distinguishable this way.** Every
`Instantiate`d object shares one name, so the key collapses. So the honest census answer is usually a
**split identity scheme**:

- **scene-placed** → reuse the game's `{scene}/{name}` key, no edit needed;
- **runtime-spawned** (wave/arena enemies, boss-summoned adds, loot drops, projectiles) → an **assigned
  per-spawn key** (a monotonic `int` handed out at the spawn site), which is real work and a real
  prerequisite for tracking those types.

Record the split explicitly at the census, per objectType. Assuming one scheme covers everything is the
mistake: it looks fine while you test on an authored level and breaks the moment the moment includes
spawned enemies.

## Checks before committing to it

- **Confirm names are actually unique within a scene.** Unity permits duplicate sibling names. Verify on
  the real levels (duplicated authored props are the usual offender) — if the game's own persistence
  relies on the key, uniqueness is *probably* already a working convention, but confirm rather than assume.
- **Take the key's raw ingredients, not the namespaced string.** The persistence key is usually prefixed
  per flag namespace (`permanentDeaths/...`, `usedElements/...`); capture the `{scene}/{name}` part so one
  object has one Ludeo key regardless of which flag namespace the game happened to file it under.
- **Renaming an authored object breaks both** the game's saved flags and your Ludeos. That's a
  pre-existing property of the game's design, not something the integration introduced — but mention it,
  because it means old Ludeos can be invalidated by a level-editing change.
