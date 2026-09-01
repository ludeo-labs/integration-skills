---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 5
question: "Does your OnStateDataUpdate writer read a MonoBehaviour/Transform/GameObject it captured at registration — and is the per-tick sampler a plain for-loop over every tracked handler with no per-handler isolation?"
sanitized: true
---

# One throwing writer silently drops every object AFTER it in the sample loop — a stale "never destroyed" claim becomes arbitrary partial capture

The layer's per-tick sampler is the canonical one-liner:

```csharp
public void UpdateStateObjects()
{
    for (int i = 0; i < m_tracked.Count; ++i) m_tracked[i].UpdateLudeoState();
}
```

Each `UpdateLudeoState` opens the object's write scope and invokes the game-supplied
`OnStateDataUpdate` lambda. Those lambdas close over components resolved at registration —
`transform`, a health component, the anchor MonoBehaviour. In Unity, reading a member of a **destroyed**
`UnityEngine.Object` throws `MissingReferenceException`. There is no `try` anywhere on this path, so the
exception unwinds out of the loop.

**The loop does not resume.** Every handler at an index *after* the thrower is never sampled — not this
frame, and not any later frame, because the same object throws again at the same index next tick. One
destroyed entity converts capture into "the first N objects only", permanently.

## Why this is worse than a normal crash

- **It is not a crash.** Gameplay continues, the room stays open, the Ludeo finalizes and is playable.
- **The loss is arbitrary.** Which objects survive is decided by *registration order*, which is the order
  a scene enumerator happened to return. The player usually registers early (singletons first), so the
  restore's most conspicuous state is exactly the state that still works — and the missing half is a
  hundred pickups or a population of enemies that simply have no bucket entries.
- **It reads as an under-scoped plan, not a defect.** At the restore gate the symptom is "a lot of things
  weren't captured", which is indistinguishable from "the wave didn't cover them". The Unity console does
  print the exception, but it prints it once per frame from inside a loop nobody suspects, next to the
  game's own log noise.

## What actually triggers it: a liveness claim that went stale

The precondition is not a bug in the writer. It is a **census claim**: "this type is never destroyed —
its terminal state is `SetActive(false)`." That claim is often true, verifiable, and the reason the plan
correctly chose a terminal-state flag over an unregister (`06 §3.4`). But it is a claim about the game as
it is *today*, made by reading destroy sites — and a later content change, a variant prefab, or a cleanup
routine nobody greps can falsify it. The plan's own correctness is what removes the null guard: *if it is
never destroyed, why check?*

So the failure mode is: **a documented, gate-approved liveness assumption degrades an entire capture
schema to a prefix of itself, silently.**

## The fix, and why it is not a `try/catch`

Do **not** wrap the loop or the lambda in `try/catch`. That is symptom-masking: it converts a wrong
liveness model into a swallowed exception per frame and teaches you nothing.

Guard the reads in the writer, keep the attribute count constant, and **report the violated assumption
loudly, once per key**:

```csharp
bool alive = anchor != null;                       // Unity's overloaded == : destroyed reads as null
if (!alive) ReportVanished(OBJECT_TYPE, key);      // logs ERROR once per key, never per frame

obj.WriteData(Keys.Key, key);                      // cached at registration — always writable
obj.WriteData(Keys.Position, alive ? tr.position : Vector3.zero);
obj.WriteData(Keys.Active,   alive && go.activeSelf);
```

Three properties make this a fix rather than a patch:

1. **The identity attribute comes from a value cached at registration**, not from the component. A
   destroyed object must still write its key, or its bucket entry becomes anonymous.
2. **The attribute count per object does not change** when the object vanishes. A first-tick
   attribute-count diagnostic is only trustworthy if the writers are count-stable; a writer that emits
   fewer attributes on the sad path makes the number un-auditable.
3. **The error names the assumption, not the exception.** "Tracked `<type>` `<key>` was destroyed, but
   the plan classifies this type as never-destroyed" sends the reader to the census row. A raw
   `MissingReferenceException` sends them to the layer.

The `alive == false` state is also genuinely meaningful for a type whose plan says "never destroyed":
`Active = false` is the honest terminal representation, so the replay degrades to "it's gone" instead of
to "it never existed."

## Where else the same shape hides

Any centralized per-item loop with no per-item isolation and a closed-over engine object: an actions
dispatcher iterating subscribers, a restore's per-entity apply loop (same hazard, and there the thrower
aborts the *rest of the restore*), a heartbeat diagnostic sampling a roster. The tell is the same in all
of them — **the work is a `for` loop, the items came from a scene enumerator, and the failure of one item
is not contained.**

> **A per-tick loop over N game-owned objects is only as long-lived as its most stale liveness
> assumption. Contain the failure at the item, and make the containment print the assumption it just
> caught.**
