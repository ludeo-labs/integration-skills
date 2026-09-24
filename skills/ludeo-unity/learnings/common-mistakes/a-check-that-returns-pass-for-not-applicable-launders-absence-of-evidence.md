---
category: common-mistakes
tier: universal
sourceGame: SurvivalSample
phase: 5
question: null
sanitized: true
---

# A check that returns "pass" for "not applicable" turns absence of evidence into evidence

A restore verification helper usually ends up with a shape like this, because the alternatives are all
worse at the call site:

```csharp
// returns null when fine, else the complaint
private static string LooksDestroyed(Prop p)
{
    if (p.destroyedMesh != null)
    {
        MeshFilter mf = p.GetComponent<MeshFilter>();
        if (mf == null) { return null; }                    // nothing to compare
        return mf.sharedMesh == p.destroyedMesh ? null : "still showing the intact mesh";
    }

    if (p.looksSameWhenBroken) { return null; }               // authored to look the same
    ...
}
```

Three of those `return null`s mean "correct". The rest mean **"I had no way to tell"**. They are the same
value, so the caller counts them the same way, and the gate reports a number that reads like evidence:

> `3 destroyed (3 visibly changed), 0 complaints` — **verdict: passed**

The truth was `0 visibly changed, 3 I could not examine`. Every assertion was green and the screen was
entirely unverified.

## What it cost, and how close it came to shipping

This happened on a world-object restore, in a check **written specifically to stop the known failure of
asserting the model instead of the screen**. The gate's screenshots framed no relevant objects, so the
helper was the only visual evidence there was — and it was reporting three not-applicables as three
confirmations. It passed twice.

Splitting the two outcomes apart turned the same run red and printed the reason:

```
0 VISIBLY changed, 3 unchecked [unchecked-keepIfNull, unchecked-keepIfNull, unchecked-keepIfNull]
```

That line then exposed a **real restore bug** that two green runs had sat on top of. The objects were
landing in the "authored to look the same" branch because they were *still switched on* — and they were
still switched on because the restore re-applied the recorded presence flag **after** calling the game's
destroy method, which for those props removes them from the scene. A prop the recording had smashed out
of existence came back intact. Neither the flag checks nor the screenshots could see it.

## The rule

**Three outcomes, never two: correct, wrong, and could-not-check.** Count them separately and print all
three. Then add the assertion that makes the third one matter:

```csharp
// An all-unchecked run passes every assertion while proving nothing. That is a hole in the
// test, not a result.
if (confirmed == 0 && subjects > 0)
{
    complain("not one subject could actually be CHECKED - every one landed in a branch with "
             + "nothing to compare. The flags passed and the screen is unverified");
}
```

Print *which* branch each subject took, by name, in the step detail. That list is what turns "it passed"
into a debuggable fact — here it was three identical branch names in a row, which is what pointed
straight at the cause.

## Why this is not the same as a degenerate subject

[[a-degenerate-subject-makes-a-passing-restore-test-prove-nothing]] asks whether the *subject* can show
the defect — one element, a world that already satisfies the assertion. This is the *checker* being
unable to look, against a subject that was fine. The subject test passes cleanly here: the objects were
real, intact beforehand, and genuinely changed. Both questions have to be asked, and the second one is
easier to miss because the helper looks like it is doing work.

## Where else this shape hides

Anywhere a verification reduces to a nullable complaint or a bool:

- `TryGet`-style reads where a missing key and a matching value both return "fine". Distinguishing key
  *presence* from key *value* is the same discipline, already standard practice for not failing older
  clips on keys they never carried — this is that habit applied to the check's own ability to look.
- Component lookups: `GetComponent<T>() == null` is not "the value is right".
- Tolerance comparisons where both sides are unset, so the difference is trivially zero.
- Any `switch` with a `default: return null`.

**The test:** for every path through the checker that reports success, ask "did I observe the thing, or
did I fail to find anything to observe?" If it is the second, it is not a success.
