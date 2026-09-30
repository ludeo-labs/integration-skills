---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 4
question: "Are you about to record that some value (a seed, a phase, a counter) is 'stored nowhere' and therefore needs an edit to the game's own code before it can be captured? Walk the public accessor chain from whatever CONSUMED it first — a value passed into a constructor is usually still readable through the object it was passed to."
sanitized: true
---

# "Passed as an argument and never assigned to a field" does not mean "unrecoverable"

A census pass found a fight's spawn seed drawn inline and handed straight to a factory call:

```csharp
// synthetic illustration of the shape
RegisterFight(fightName, waves, Random.Range(0, 100000), options);
```

Nothing assigns that `int` to a field, and grepping the declaring file for `seed` returns only the
parameter and the call. The natural conclusion — recorded, and wrong — was that the value is
unrecoverable and that capturing it needs an edit to the game's code.

**Walk one step further, into the thing that consumed it.** Here the chain was public the whole way:

```
FightManager.GetFight(name)        // public          -> the fight object
  .RandomGenerator                 // public get/set  -> seeded in the constructor
  .seed                            // public get/set  -> the original value, retained
```

No edit required. The cost of not checking is not just an inaccurate document: a phantom game-code
edit inflates the estimate, and — worse — it gets used as an argument to drop a feature from scope.

## The check

Before writing "stored nowhere", for each value:

1. Identify what **consumed** it — constructor, factory, registration call, event payload.
2. Read that type's **public surface**, not the caller's file. Values are routinely kept as a public
   auto-property on the consumer while the caller keeps no copy at all.
3. Confirm the consumer itself is **reachable** from the integration layer (a public static
   `GetX(...)` accessor, a singleton, a registry). Reachability and retention are separate questions
   and both must hold.
4. Only if the chain breaks at a `private` with no accessor is a game-code edit genuinely in scope.

## State the residual limitation precisely

The correction is rarely "there is no problem" — it is usually "the problem is narrower than stated".
For a seed, the retained value is the generator's **initial** seed, not its **current position** in
the sequence. So:

- replay **from the start** of the seeded activity → reproducible with what is already readable;
- resume **from the middle** → additionally needs the number of draws consumed, which a typical
  `RandomGenerator` wrapper does not expose.

Write that distinction down. "Unrecoverable" and "recoverable only from the start" lead to completely
different scoping decisions, and only the second one is true.

## Why this shows up in census work specifically

A census enumerates types by reading declarations, which biases toward *where a value is written*
rather than *where it ends up living*. That is the same bias behind
[[an-iserializable-implementation-is-not-proof-the-save-writes-it]] — reading the declaration instead
of following the data. Treat "needs a game-code edit" as a claim requiring the same evidence standard
as any other, per [[investigate-before-asking]].
