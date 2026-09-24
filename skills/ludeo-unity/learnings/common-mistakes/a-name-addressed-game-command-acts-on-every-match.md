---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "5"
question: "Is the game's own state-changing call you plan to reuse in the restore addressed by NAME (EnableActor(name), GetActor(name), a command that looks an actor up in a registry) rather than by reference? Read its body: if it resolves through a multimap and LOOPS the matches, a duplicate name makes it act on several objects - and a restore that calls it a few hundred times is where duplicates surface."
sanitized: true
---

# A game command addressed by name acts on every object with that name

The rule [[pair-a-teleport-with-the-games-state-updates]] says: never call the lowest-level
primitive, mirror the game's own composite path. Correct — but check *how the composite path finds
its target* before routing a few hundred restore calls through it.

The game's enable-an-actor path was a command taking a name:

```csharp
// synthetic illustration of the shape
public static void EnableActor(Actor actor, bool enable)
    => Commands.Invoke(new SetEnabledCommand(actor.uniqueName, enable));
```

It is handed an `Actor` and immediately throws the reference away in favour of its name. The
command's body then looks the name up in a registry that is a **multimap** and `foreach`es the
result — so if two of the generated cast share a name, one call enables both. With a procedurally
generated cast of several hundred actors and names minted by the generator, that is not a
hypothetical.

## What to do instead

Mirror the command's **body** against the reference you already hold. It was twelve lines, and every
sibling update in it was public:

```csharp
// synthetic illustration of the shape — the command's body, against the held reference
actor.cullingOverride = !active;
if (actor.gameObject.activeSelf != active) actor.gameObject.SetActive(active);
else if (!active)                          actor.RunDisableHook();   // the already-disabled branch
if (ai != null) ai.enabled = true;
if (active) targeting.Register(actor); else targeting.Unregister(actor);
```

Same writes, same order, no name lookup. This is **not** a violation of "mirror the composite path" —
it *is* the composite path, addressed differently. What you must not do is skip the siblings and call
`SetActive` alone.

## Why the restore is where this surfaces

Live gameplay calls these paths a handful of times per encounter, on hand-authored actors with
hand-authored names. A restore calls them once per captured entity, on generated actors, in one
frame. A name collision that has never mattered in the shipped game matters immediately here — and
its symptom is "some enemies are on the field that the clip says were parked", which reads as a
capture bug.

Two more things worth reading before you route restore traffic through a game command:

- **Is the dispatch synchronous?** Here `Invoke` called `Execute()` directly, so it was safe under a
  zero timescale. A command system that queues would silently do nothing inside a frozen apply.
- **Does it early-return in a mode you are in?** The same system returned immediately while the
  game's *own* replay recorder was running — unrelated to the Ludeo replay, but exactly the kind of
  guard that turns a restore call into a no-op with no log line.

Keep the name comparison as a **tripwire** rather than a write: a mismatch between the captured name
and the live one is worth reporting, and renaming to match would be actively harmful, since it is the
handle every other name-addressed command in the game resolves through.
