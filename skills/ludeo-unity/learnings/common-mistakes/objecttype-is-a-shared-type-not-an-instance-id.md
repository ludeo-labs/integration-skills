---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: "4,5"
question: null
sanitized: true
---

# objectType is a shared TYPE name, not an instance id — the SDK assigns identity

All 22 players record under `"Player"`. Every pickup records under `"PowerUpPickup"`. Every enemy
records under `"Enemy"`. **Never** `Player_0`…`Player_21`, never `Enemy_<n>`. Which instance is which
travels as an **attribute** you write and read back.

> **This file previously said the opposite** — that two `CreateObject` calls with the same string
> address the same object, and that collections therefore need a minted type per instance. That is
> false. It was corrected in the field after an integrator saw the result in Studio Lab. The Unreal
> corpus already carried the correct version
> ([[objecttype-is-shared-category-not-instance-id]]); if you are reading a cached copy of the old
> Unity text, this file supersedes it.

## What the SDK actually does

From the Unity plugin source (`com.ludeo.sdk@4.3.2.0`,
`Runtime/LudeoDataWriter/Internal/LudeoDataWriter.cs`):

```csharp
uint objectId = 0;                                                 // goes in as zero
LudeoResult result = m_dataWriterWrapper.CreateObject(handle, ref params, ref objectId);
ludeoStateObject = new LudeoWritableObject(objectType, objectId);  // comes back ASSIGNED
```

The type string is an input. **The id is created by the SDK, once per call** — `LudeoWritableObject`
documents `ObjectId` as *"An Id created by LudeoSDK for this object"* — and every write is addressed
by that id, never by the name:

```csharp
public LudeoWriteScope EnterObjectScope()
{
    bool entered = LudeoDataWriter.EnterObject(m_objectId);
}
```

The sibling overload settles it: to address an **existing** object you call
`GetObject(objectType, objectId)`, passing the id, because the id is the identity.

So `CreateObject("Enemy")` called fifty times yields fifty independent objects. Nothing collapses.

## What it costs when you get it wrong

Nothing at runtime. Capture works, restore works, positional drift is zero, every self-check passes.
The damage lands somewhere no agent-side gate looks: **`objectType` becomes a schema entry in Studio
Lab** — a row a human reads, gives a friendly name, and attaches objectives to.

- One `Player` row becomes twenty-two, each repeating the full attribute list.
- A type that spawns over time (pickups, projectiles, enemies) grows **a new row every few seconds of
  play**. A single recorded match produced dozens.
- An objective keyed to that type would have to be defined once per row.

The Unreal engagement that hit this first went from 32 Game Object types to 2 by fixing it.

## The check that actually discriminates — and the one that doesn't

A tempting self-check is to compare the count of distinct SDK `ObjectId`s against the number of
writers registered. **Under per-instance naming that check can never fail**: the ids are distinct
because the SDK always makes them distinct. It tests nothing and reads like evidence. See
[[ask-what-your-check-cannot-see]].

What does discriminate, and takes one minute:

> **Open Studio Lab after the first recorded session and count the Game Object rows.** If you see N
> rows where the game has N instances of one thing, the objectType is wrong. If you see one row per
> type, it is right.

And a static tell, before you ever run: **if you are building an objectType with string concatenation
or a counter, you are probably doing it wrong.** An objectType should be a constant.

## The right shape

- **One `objectType` constant per type**, shared by every instance.
- **Identity travels as an attribute** — a slot key, an index, a minted id. The restore matches on
  attributes; this is what `06-TRACKING-PATTERNS.md` means by *"identity at restore is objectType
  bucket + your own key attribute"* (CR-014), and that guidance was right all along.
- **The read side needs no prefix-stripping and no `StartsWith` regrouping.** The raw type string is
  the bucket. Writing a strip is the smell that you minted per-instance names upstream.

## Also easy to miss on the same docs page

`BindPlayer(playerId)` is listed as **required** — an object must be bound to a player to be
restorable in the player flow and to drive that player's objectives and scoring. Objects still read
back without it, so nothing visibly breaks during restore work and the omission survives until
objectives are wired.

## Why the wrong version survived review

It was inherited rather than tested: a doc sample showing `Enemy_0`/`Enemy_1` was read as prescribing
uniqueness, then hardened by a war story — entities collapsing into one recorded object — whose stated
mechanism the plugin source rules out. Something in that integration was reusing one object or keying
its own dictionary by type. **When a learning's authority rests on an anecdote, check the mechanism in
the vendor's source before propagating it**, and check what the result looks like to the people who
use the platform.
