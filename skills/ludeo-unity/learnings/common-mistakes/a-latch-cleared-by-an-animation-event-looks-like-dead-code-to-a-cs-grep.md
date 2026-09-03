---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 5
question: "Are you deciding whether a captured 'was hit / staggered / interrupted' latch can be restored verbatim — and did you grep only .cs files for the method that clears it?"
sanitized: true
---

# A latch whose only clearer is an ANIMATION EVENT reads as dead code to a `.cs` grep — and is never safe to restore verbatim

`07 §1.5` tells you to normalize transient action-phase flags instead of mirroring them, and the test it
gives is: *find the code that sets the flag `false`, and ask whether the restore runs it.* That test is
correct. The failure is in how you **find** the clearer.

The shape, from a damage-reaction latch on an enemy family:

```csharp
// the health component
public bool Hit { get { return _hit; } }
private bool _hit;

public void TakeDamage(float dmg) { _hit = true; /* … */ }
public void SetHitFalse()         { _hit = false; }   // ← who calls this?

// the AI's tick, one level up
void Update()
{
    if (health.Dead) { /* … */ return; }
    else if (health.Hit) { SetState(State.Hit); return; }   // ← early return: no chase, no attack
    // … pursue / attack …
}
```

A project-wide grep for `SetHitFalse` over `**/*.cs` returned **three hits: the declaration, the getter's
neighbour, and nothing else.** Read literally, that says *the flag is never cleared* — which reads as a
shipping bug so severe (every enemy freezes permanently the first time you hit it) that the natural
conclusion is "this must be dead code, the field is vestigial, restore it verbatim, it can't matter."

**Both conclusions are wrong.** Widening the grep to *all* files found the callers immediately:

```
Art/.../Enemy_GetHitFromFront.anim
Art/.../Enemy_Damage.anim
```

Unity **animation events** invoke a method **by name string, stored in the `.anim` asset**. They are
invisible to any source-only search, to "find usages" in most IDEs, and to a compiler warning. The game
works fine; the clear happens when the hit animation reaches its event frame.

## Why this specific clearer is the worst case for a restore

A coroutine or a timer at least *runs* once the sim unfreezes. An animation event only fires if the animator
**enters and advances through the state that owns it** — and a restore is precisely the situation where you
cannot promise that:

- the animator is restored (if at all) to a *pose*, not to a queued transition;
- the driver that would re-enter the state is often the very thing the latch gates (here: the state machine
  sets `State.Hit` **because** `Hit` is true, and the presentation layer re-fires the animator trigger
  **every frame** while the state holds — a loop that is stable in live play, started from a hit, but has no
  guaranteed entry point when started from a frozen snapshot);
- the restore's freeze means nothing advances at all until control is granted, so any reasoning about "it
  clears itself in a few frames" is untestable in the window you would inspect.

So the honest verdict is: **`false` is the safe direction, and the fidelity you give up is one flinch
animation.** Drop the captured value, record the reason, and note that the classification **does not
expire** — an animation event will never become restore-drivable by a later wave. (Contrast the
liveness-dependent entries in
[[a-transient-state-classification-expires-when-a-later-wave-restores-its-driver]], which do expire.)

## The check, and where else it applies

**Grep the whole project, not just the source, for the clearer's method name.** One command, and it changes
the verdict:

```
# not: grep -r "SetHitFalse" --include=*.cs
grep -rl "SetHitFalse" .          # .anim, .controller, .prefab, .unity all count
```

Three invocation mechanisms hide from a `.cs` grep, and all three are string-keyed:

| Mechanism | Lives in | Restore can drive it? |
|---|---|---|
| **Animation event** | `.anim` (method name string) | **No** — needs the clip to enter *and* advance to the event frame |
| **`UnityEvent` wired in the inspector** | `.prefab` / `.unity` (persistent call list) | Yes, if you fire the event — but you must know the listener exists |
| **`SendMessage` / `Invoke("Name", t)`** | `.cs`, but as a **string literal** | Sometimes — and a rename silently breaks it |

The second row cuts the other way and is worth checking in the same pass: a handler wired as a *serialized*
event listener is **live from deserialization** — no registration call, no `Start()` — so "the subscription
hasn't happened yet during the apply" is a false premise for those. Same asset grep answers both questions.

## The tell that you are in this trap

> **A public setter/clearer with zero callers, guarding behaviour whose absence would be an obvious,
> ship-blocking bug.** When "nothing calls this" and "the game demonstrably works" are both true, the caller
> is in an asset, not in the source. Do not conclude "dead code" — and *especially* do not conclude
> "harmless to restore verbatim."

## The generalization

> **"Who clears this flag?" is a question about the whole project, not about the C# in it.** A restore plan's
> normalize-vs-mirror decision rests entirely on the answer, so a source-only search does not just miss a
> caller — it inverts the verdict, from "normalize, the clearer is undrivable" to "mirror, the field is
> vestigial." Widen the grep before you write the row.
