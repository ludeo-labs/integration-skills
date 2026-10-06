---
category: save-systems
tier: generalizable
sourceGame: SurvivalSample
phase: "4,5"
question: "Have you tested the restore on a profile that has NEVER saved? Every Ludeo cloud session is one — a fresh machine, no store client, saves in the engine's per-user folder — so any game code path that only runs for a brand-new profile runs on every cloud replay and on almost no developer machine. The example: a stats store that seeds inner containers (currencies, collectibles) at creation but reloads with clear-then-refill, so on a never-saved profile they come back absent rather than empty."
sanitized: true
---

# Every cloud replay runs on a never-saved profile — test the restore on one

A streamed cloud machine is a fresh VM with no store client, so saves land in the engine's own
per-user data folder and **every session is a brand-new profile**. Developer machines almost never are.
So any game code path that behaves differently for a profile that has never saved is, on the cloud, not
an edge case — it is every single replay, while the same build and clip pass on every machine the team
tests on. The restore makes this worse, because it reads game state **cold**, before gameplay has
touched anything that would normally initialise it.

**Make "a profile that has never saved" a standing test case for the restore** — and note that it is
harder to produce than it sounds (see the last section).

## The case that taught it: a stats container reloaded from an empty save

A common shape in studio save code:

```csharp
container = exists ? existing : new Container(prepopulated);
if (isNew) EnsureInnerContainersExist(entity);   // seeds the empty dictionaries
else       container.SetData(prepopulated);      // clear() + refill from the save
```

`SetData` clears the dictionary and re-adds only what the saved blob holds. On a profile whose stats
have never been written, that blob is null, so the container is emptied and the seeding is **not**
re-run. Every inner container the game seeded at creation is now missing, not empty.

That matters because the game's own accessors typically do not check:

```csharp
// synthetic illustration of the shape
public int GetCurrency(CurrencyType t, Entity e) {
    var byType = GetStat<Dictionary<CurrencyType,int>>(e, Keys.Currencies);
    byType.TryGetValue(t, out int n);   // NullReferenceException, not zero
    return n;
}
```

Nothing in normal play notices, because by the time a player opens the relevant screen something has
usually written the store. The restore reads it cold, so the restore is where it surfaces — on the
cloud, on every session — and it looks like a restore bug.

## What to do

Two fixes, and they are not alternatives:

1. **In the layer**, read the container once and check it, then skip that family with a warning that
   **names which container was absent**. Do not let the game's unchecked accessor do the reading. Also
   check the entity the game's *write* path uses if it differs from the one you read (a common shape
   is `Get(entity)` but `Add(...)` going through "the first player entity").
2. **In the game**, re-seed after the reload — usually one line in the else branch. Without it the
   replay is missing that state entirely on every cloud session, and the game keeps the latent bug for
   real players on a new profile.

## Reproducing it is harder than it looks

"No save file at all" and "a save that exists but has never written stats" are different states, and
only the second one empties an already-seeded container. Deleting the save folder can therefore
**fail to reproduce** while the cloud fails every time — that happened here. Budget for the guard
landing before the cause is confirmed, and make the guard's log line good enough that the next
occurrence is a one-line diagnosis rather than another archaeology session.
