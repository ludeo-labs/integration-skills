---
category: common-mistakes
tier: universal
sourceGame: PlatformerSample
phase: 6
question: "Are you logging 'action sent' from your own wrapper, using an SDK overload that returns void or discards its LudeoResult? Then your log says 'we called it', never 'the SDK accepted it' — switch to the overload that returns the result and log anything that is not Success."
sanitized: true
---

# An SDK overload that discards its result code makes a rejected call indistinguishable from a working one

An action was emitting, its trigger was configured, and the effect never happened. Comparing against
a known-good integration ruled out every candidate: the action names were registered (activation
returned a key id for it), both send overloads bottom out in the same writer call, the play-flow
room does set its data-writer handle.

What was left was a blind spot in our own instrumentation: the convenience overload we used
**discards the `LudeoResult`**. A rejected action is therefore completely invisible — our own
`Debug.Log` prints, the SDK logs nothing, the backend never sees it. Every `action: X` line in
hundreds of log lines meant *"we called it"*, not *"it was accepted"*.

## The rule

Prefer the overload that **returns** the result, and log anything that is not `Success` along with
the identifiers you passed:

```csharp
LudeoResult r = room.Writer.SendAction(playerId, action);
if (r != LudeoResult.Success) Debug.LogError($"[Ludeo] action '{action}' REJECTED: {r} (player '{playerId}')");
```

Then the next run produces one of two outcomes, and **both are progress**: either a `REJECTED` line
names the real cause, or none appears and the client side is provably complete — which is a far
stronger thing to hand a platform team than "we call it and nothing happens".

Apply the same audit to every SDK call the layer makes. Anywhere the result is dropped, a failure
mode exists that no amount of reading the C# will ever reveal.

## The sibling habit: log the drop, not just the send

Wrappers that gate calls need to log the *gate* too. A facade that silently returns when no session
is active hides its own call sites — adding a `DROPPED — no gameplay session active` line
immediately explained two separate bugs (a span opened before the room existed, and a span closed in
the same frame it opened) that had each read as "the call site never runs". Related:
[[a-guard-that-cannot-fire-is-not-evidence]].
