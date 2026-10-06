---
category: save-systems
tier: generalizable
sourceGame: SurvivalSample
phase: "1,2,4"
question: "Are you about to classify a save as Group 1 because the gameplay classes implement the save interface? Follow the registration path and read the top-level Serialize body before you record the group — an interface implementation can be live, correct, and completely unreachable."
sanitized: true
---

# Coverage is what the save *runs*, not what the classes *declare*

Phase 1 classifies a save by group, format and (per
[[a-strong-save-may-refuse-exactly-the-moment-you-want]]) availability. All three are usually inferred from
the same evidence: a list of gameplay classes implementing the save interface. On a game with a mature
in-house save framework, that list is long and convincing — the player, enemies, world objects, pickups,
traps, the run manager itself. Group 1, obviously.

Two independent things can make that list mean nothing.

## 1. The top-level snapshot can be commented out

The run-level `Serialize(SaveData)` on the game manager had **its entire body commented out**. The
commented block was intact and readable, showing that it used to collect and write the full live-run
state; what shipped was:

```csharp
// synthetic illustration of the shape
public virtual void Serialize(SaveData data)
{
    // ...the whole collect-and-write block, commented out...
    _saveState = SaveState.Available;   // the only surviving statement
}
```

Nothing errors. The method exists, is called, and returns. A grep for the interface, for the method name,
or for the class in a `Serialize` context all report "yes, it's there."

This is not sloppiness — in a roguelite, runs are deliberately not resumable, so the studio disabled the
run snapshot and kept meta progression. But the phase-1 classification recorded "Group 1: full gameplay
state" and phases 4–5 were planned on the assumption that the save's field list was a validated floor for
what a run consists of. It wasn't a floor; it was empty.

## 2. The entity classes may never register

The framework's save pass iterated a **registered set**, not the scene:

```csharp
// synthetic illustration of the shape
private void SerializeRegisteredObjects()
{
    foreach (ISerializable s in _registeredSerializables)   // populated by AddSerializable(this)
        s.Serialize(new SaveData(s));
}
```

Grepping for the registration call found **six** classes in the whole project — none of them an actor.
Every actor's `Serialize` override was live, correct code that nothing ever called from the save path.
They had been reached exclusively through the run-level collector in §1, which is now disabled.

## The check, and where it belongs

When you record a save group, do these three in order and write the answer next to the group:

1. **Read the top-level `Serialize` body.** Not its signature, not its call sites — the body. A
   commented-out or stubbed body is the whole answer.
2. **Follow the registration path.** How does an object get into the set the save iterates — does it
   register itself, is the scene scanned, or is it collected by one central method? Then grep for that
   mechanism and count. If entity classes do not appear, their interface implementation is decorative.
3. **Only then classify.** "Group 1" that reaches the next phase unqualified is read as "we can snapshot
   anything", and every downstream plan is built on it.

## What survives, and is still worth having

The per-entity `Serialize` **method bodies** remain excellent prior art even when unreachable: they are
the studio's own answer to "what is the state of this entity", written by people who know it, and they
name the fields, the types and the ordering. Port the field list. Just do not claim the save produces it.

Related: [[a-strong-save-may-refuse-exactly-the-moment-you-want]] — the availability question. Coverage,
format, availability and *reachability* are four questions, and this is the fourth.
Also [[late-join-code-is-ordering-prior-art-not-a-callable-path]] — where the real inventory turned
out to be hiding in the same codebase.
