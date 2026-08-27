---
category: common-mistakes
tier: universal
sourceGame: ARPGSample
phase: "5"
question: null
sanitized: true
---

# objectType is the object's identity, not its class name

`CreateObject(objectType, out obj)` reads like a class registration — pass `"Enemy"`, get a
tracked enemy. It is not. **objectType is the SDK's identity for one object.** Two
`CreateObject` calls with the same string address the SAME object: every writer after the
first overwrites the ones before it on every tick, and the recording carries exactly one
instance of that type no matter how many the game registered.

The SDK's own guide builds a unique type per entity — a shared prefix plus a counter
(`Enemy_0`, `Enemy_1`, …) — reads them back with `ObjectType.StartsWith(prefix)`, and keys
its writable-object dictionary by objectType. Read past the first code sample and it is
explicit: *"Create one object per tracked entity by passing an object type name."*

## What it looks like when you get it wrong

Nothing fails. `CreateObject` returns `Success` every time. No error, no warning, no
exception. The capture logs whatever count you compute yourself, the restore reads back
one object, and the gap between the two numbers looks like a stale recording:

```
capture:  9 enemies registered, matching the game's registry
restore:  5 objects in 5 buckets [RunDefinition x1, RunMetadata x1, Player x1, Enemy x1, SessionState x1]
restore:  enemies reconciled - 1 placed, 8 switched off, 0 unmatched
```

Here the `1 placed, 8 switched off` line was read for a whole session as "we replayed an old
clip recorded before the batch sweep existed". It was not. It was every enemy in the room
collapsing into one object. The placement slice was signed off as working against a
recording that carried one ninth of the fight.

Singleton types — player, run metadata, session state — are unaffected, which is what makes
this survive review: the restore genuinely works, on everything there is only one of.

## The check that catches it

Every count in a capture layer is usually **yours or the game's**: handlers registered
versus what the game's registry holds. Both can agree perfectly while the SDK holds one
object. The object id is the only number in the room that comes from the SDK:

```csharp
var ids = new HashSet<uint>();
foreach (var h in trackedHandlers) ids.Add(h.StateObject.ObjectId);
if (ids.Count != trackedHandlers.Count)
    Error($"{trackedHandlers.Count} writers sharing {ids.Count} SDK objects");
```

This is [[verify-the-world-not-the-flag-you-just-wrote]] applied to the capture side: a
count you computed yourself cannot disagree with itself.

## The fix shape

- Give every instance its own type: `baseType + "_" + index`. The index only has to be
  unique **within one recording** — the restore matches on your own key attributes, never on
  the type string — so a simple counter is enough.
- Scope the counter to the **recording**, not to the level or room. A clip can span a room
  change, and resetting per room lets a fresh `Enemy_0` reuse the name of one that already
  existed in the same recording.
- On the read side, strip the trailing `_<digits>` and bucket by base type. Every apply then
  keeps asking for the bucket it always asked for and simply gets all of them.
- Types with genuinely one instance keep their bare name; stripping leaves them untouched.

## Also on that page, also easy to miss

`BindPlayer(playerId)` is listed as **required** — an object must be bound to a player to be
restorable in the player flow and to drive that player's objectives and scoring. Objects
still read back without it, so nothing visibly breaks during restore work and the omission
survives until objectives are wired.
