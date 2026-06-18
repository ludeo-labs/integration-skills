---
category: common-mistakes
tier: generalizable
sourceGame: EndlessFPS
phase: 5
question: "Does this game have more than one enemy family (e.g. regular mobs, bosses, special creatures), often from different marketplace packs? If so, do they all expose the same health/death property by the same name and type, and is that property declared on the leaf class or inherited from a BP base? Verify the death signal is reachable per family before relying on it for Kill detection."
sanitized: true
---

# Don't assume a uniform Health property for poll-based Kill detection

## Precondition

A Blueprint-only game with **multiple enemy families** whose Kills you detect by polling state
(see `common-mistakes/ondestroyed-not-for-bp-death` for why polling, not `OnDestroyed`). The families
typically come from different marketplace AI packs, so their death representation is not consistent.

## The mistake

Writing the Kill poll to read one property — `Health` — on every enemy and fire when it crosses `<= 0`.
This silently misses whole families:

- Regular mobs and the generic AI-toolkit base expose a numeric `Health` (stored as **double** in UE5 BP —
  `bp-health-is-double-not-float`) plus a boolean dead flag.
- A **boss** may have **no plain `Health` property at all** — its HP is tracked through phase logic
  (a "change phase after N hits" counter) and it only exposes a boolean dead flag and an `OnDeath` delegate.
- Leaf subclasses (a specific creature, a miniboss) often declare only behaviour/escort variables and
  **inherit** `Health`/dead-flag from a BP base.

A `Health`-only poll fires for the mobs and never for the boss → "the boss kill action never shows up."

## The fix

Read a **death signal**, not a specific property, with a fallback chain — boolean dead flag first, numeric
health second:

```cpp
bool ReadEnemyDead(const AActor* Enemy, bool& bOutDead)
{
    bool bFlag = false;
    // Families name the flag differently — try the common variants.
    if (GetBool(Enemy, TEXT("IsDead?"), bFlag) || GetBool(Enemy, TEXT("IsDead"), bFlag))
    {
        bOutDead = bFlag; return true;
    }
    double Health = 0.0;            // double, not float, on UE5 BP
    if (GetNumeric(Enemy, TEXT("Health"), Health))
    {
        bOutDead = (Health <= 0.0); return true;
    }
    return false;                   // no reachable signal -> can't detect (fail safe, see below)
}
```

Fire the Kill on a `false -> true` transition of `bOutDead` for a still-present actor. A family with **no
reachable signal simply never fires** — there is no false positive — so it is safe to run the poll over all
families and confirm empirically (runtime test) which fire.

## Critical: a leaf variable dump hides inherited properties

A per-Blueprint variable listing shows only the properties declared **on that class** plus the **native**
parent (e.g. `parent = Character`). It does **not** show properties inherited from a **BP base class**, and
it does not show the BP parent chain. So a boss leaf showing "no Health" may still inherit one, and a
creature leaf showing neither Health nor a dead-flag may inherit both.

Do **not** conclude "this family has no death signal" from a leaf dump. Confirm reachability by either:

- resolving the full `UClass` property chain (walk `SuperStruct`), or
- reading the **BP call-graph** to see where the death flag / health is set, or
- simply relying on runtime reflection (a missing property yields no detection, never a crash).

## Cross-reference

- `common-mistakes/ondestroyed-not-for-bp-death.md` — why detection is poll-based for ragdoll deaths.
- `common-mistakes/bp-health-is-double-not-float.md` — read BP "float" health as `FDoubleProperty`.
- `architecture/additive-action-emission-for-composable-goals.md` — once death is detected, emit the broad
  Kill + per-family + weapon axes additively.
