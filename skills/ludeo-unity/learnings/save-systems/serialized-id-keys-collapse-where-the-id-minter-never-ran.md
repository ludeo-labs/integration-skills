---
category: save-systems
tier: generalizable
sourceGame: PlatformerSample
phase: 4
question: "Are you reusing the game's own per-object save id as the Ludeo stable key — and is that id a [SerializeField] on a PREFAB, minted by an editor utility that someone has to remember to run per scene?"
sanitized: true
---

# A serialized per-object save id is only a stable key where the minter actually ran — measure it, don't assume it

Reusing the game's existing per-object save identity as the Ludeo stable key is the right instinct
(no game-code edit, and the integration agrees with the game's own persistence about which object is
which). The trap is *how* that identity is produced. A very common shape:

```csharp
public class SaveIdentity : MonoBehaviour          // sits on the PREFAB
{
    [SerializeField] private string id;
    public string Id => id;
    [ContextMenu("Generate Id")]
    public void GenerateId() => id = Guid.NewGuid().ToString();
}

public class IdMinter : MonoBehaviour              // an editor-time helper, run by hand
{
    public void GenerateIds()
    {
        foreach (var s in FindObjectsOfType<SaveIdentity>(true))   // live scene instances
            s.GenerateId();
    }
}
```

`FindObjectsOfType` operates on **scene instances**, so a run of the minter writes a distinct id into each
instance as a per-instance prefab override. That is genuinely CR-014-compliant identity — **for the scenes
where a human remembered to press the button.**

Everywhere else, the instances silently inherit the value serialized on the **prefab asset**, which is
usually the empty string the field was authored with. Every instance of that prefab in that level then keys
to `""` and collapses onto one bucket entry. The game's own save has the same bug, so nothing in the game
surfaces it — those objects have simply never round-tripped correctly and nobody noticed, because the
symptom (one of five pickups reappearing after a load) reads as an ordinary bug.

## Measure it from the scene YAML — this is cheap and exact

With `ForceText` serialization you do not need the Editor. Per level, per prefab, compare:

- **instances** — occurrences of `m_SourcePrefab: {fileID: 100100000, guid: <prefabGuid>}`
- **instances carrying their own id** — `- target: {…, guid: <prefabGuid>, type: 3}` immediately followed
  by `propertyPath: id` and its `value:`

A cell where instances > ids means the difference inherit the prefab's baked value. Then check the prefab
asset's own serialized value to learn what they collapse *to* (empty is the common case).

Collect every `value:` across all levels into a multiset while you are there — that is how you catch the
**second** failure mode, which is worse because the ids look present:

> **Duplicate minted ids.** In the observed project four instances of one pickup prefab, in the same level,
> carried the *same* GUID. The minter had run, the overrides existed, and the key still collapsed 4→1. A
> presence check (`ids == instances`) passes; only a uniqueness check catches it.

## What this changes about the census

The honest census output is **a per-level, per-prefab key-coverage table**, not a single line saying "the
game has a stable key." Three practical consequences:

1. **It picks the capture level.** Coverage is usually best in whichever level the team most recently
   worked on. That, combined with content coverage, is a much better argument for the Wave-1 capture target
   than content alone.
2. **The gaps are prerequisites, not caveats.** A type with a collapsed key in the level you are capturing
   in cannot be tracked there. Re-minting is an editor-only action with no code change — cheap, but it must
   happen *before* the wave, and it invalidates nothing because no Ludeos exist yet.
3. **Say plainly that it is pre-existing.** The collapse is a defect in the game's own save system that the
   integration merely *measured*. Report it that way — as a finding for the team with a one-click fix — not
   as integration work, and not as something you introduced.

## The generalization

**"The game already has a stable key" is a claim about the key's _values_, not about the existence of a key
field.** Any identity that lives in a serialized field and is populated by a human-triggered editor pass is
partially populated by default. Verify **presence and uniqueness, per level, per type**, from the serialized
data — and expect the answer to differ per level.

Related: [[game-own-save-key-builder-is-a-ready-made-stable-key]] — the same "reuse the game's identity"
move; its uniqueness caveat is what this learning turns into a measurement. Counting instances in a scene
also has its own overcounting trap: [[scene-script-guid-counts-overcount-via-stripped-prefab-components]].
