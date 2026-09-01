---
category: engine-quirks
tier: generalizable
sourceGame: PlatformerSample
phase: 4
question: "Are you counting a script's guid occurrences in a .unity file to census how many instances of a type a level has — and are you filtering out the entries whose m_GameObject is fileID 0?"
sanitized: true
---

# Counting a script guid in a scene OVERCOUNTS: prefab instances leave stripped component entries behind

Grepping a `.unity` file for a MonoBehaviour's script guid is the standard way to census a level without
opening the Editor. It has two opposite failure modes, and the well-known one is only half the story.

- **Undercount** (documented separately): a prefab instance does *not* serialize its components into the
  scene, so a manager living inside a prefab returns **zero** hits. See
  [[prefab-composed-levels-hide-their-managers-from-scene-greps]].
- **Overcount** (this learning): a prefab instance sometimes *does* leave a `MonoBehaviour` block in the
  scene carrying the script guid — a **stripped component entry**, emitted for components involved in
  cross-reference bookkeeping. It has no fields and, decisively:

```yaml
--- !u!114 &1234567890 stripped
MonoBehaviour:
  m_GameObject: {fileID: 0}          # <-- the tell
  m_Script: {fileID: 11500000, guid: <the script guid>, type: 3}
```

`m_GameObject: {fileID: 0}` means the entry points at no GameObject in this scene. It is bookkeeping, not an
instance. Counting it inflates the census.

## The filter

Count a hit only when the nearest preceding `m_GameObject:` resolves to a **non-zero** fileID. In the
observed project this single filter changed three census rows at once:

| Raw guid count | After filter | What it actually was |
|---|---|---|
| 1 gate controller | **0 real / 1 stripped** | one gate, and it is the prefab instance already counted separately — *not* a second scene-authored gate |
| 1 scene-transition manager | **0 real / 1 stripped** | the manager lives in a prefab; the scene has none of its own |
| 5 hazard volumes | **5 real / 0 stripped** | genuinely scene-authored, and the prefab for them has **zero** instances anywhere |

Two of those three would have been wrong, in opposite directions, without the filter.

## Why it matters more than a cosmetic count

A census row of "2 gates" when there is one sends Part B looking for a second instance, and can turn into a
restore that reports an unmatched bucket entry forever. The reverse — believing a type is prefab-only when
the level actually authored five of them inline — means the deep scope reads the prefab YAML for
configuration that the scene overrides.

The same filter also separates **real scene-authored (unpacked) instances** from prefab instances, which is
its own census-relevant distinction: an unpacked instance carries its components *and its serialized field
values* directly in the scene, so its configuration is read from the scene, while a prefab instance's is
read from the prefab plus the instance's `m_Modifications`.

## Practical recipe

For each type, report **three** numbers per level, not one:

1. `m_SourcePrefab: {fileID: 100100000, guid: <prefabGuid>}` occurrences → **prefab instances**
2. script-guid hits with `m_GameObject != 0` → **scene-authored (unpacked) instances**
3. script-guid hits with `m_GameObject == 0` → **stripped entries, discard**

Total instances = (1) + (2). Publish the split, because a type that is prefab-driven in three levels and
unpacked in the fourth is a real finding — one handler covers both, but discovery differs per level.

> **The tell that you are hitting this:** a script-guid count that disagrees with the prefab-instance count
> by a small number, in a project whose levels are composed from prefabs. Do not reconcile it by picking the
> larger number.
