---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# "N silent SDK errors then access violation" — suspect a local stack-indexing bug, not SDK state

## The signature

When a tight loop calling `Obj.ReadData(name, value)` produces:
- exactly N (small, deterministic) `[Ludeo] Data: Error: ludeo_DataReader_Get* failed because of invalid parameters` log lines, then
- an access violation inside the SDK function (typically `ludeo_DataReader_GetFloat` / `GetInt32`) reading some pointer like `0xffffffffffffffff`,

**the first hypothesis should be: your bindings/array indexing is reading garbage stack memory, not "the SDK state is corrupted" / "EnterObject was lost" / "SetLoadout interfered."**

## Reference incident (ActionGame, 2026-05-04)

A helper used by the runtime-attribute capture and apply paths owned a static array of `(const char* name, FGameplayAttribute attr)` bindings. The signature was:

```cpp
// WRONG — returns the FIRST element by VALUE
static FRuntimeAttrBinding GetRuntimeBindings(int32& OutCount)
{
    static const FRuntimeAttrBinding Bindings[] = { /* 24 entries */ };
    OutCount = UE_ARRAY_COUNT(Bindings);
    return Bindings[0];   // <-- copy of one struct, not the array
}
```

Caller:

```cpp
const FRuntimeAttrBinding& First = GetRuntimeBindings(Count);  // local stack copy
const FRuntimeAttrBinding* Bindings = &First;                  // pointer to that copy
for (int32 i = 0; i < Count; ++i)
{
    Obj.ReadData(Bindings[i].Name, Value);   // i==0: valid; i>=1: garbage
}
```

The first iteration read the valid local copy and worked. Iterations 1-5 read **garbage stack memory beyond the local copy** — `Bindings[i].Name` was a random pointer the SDK rejected with "invalid parameters" (5 errors). Iteration 6 hit memory that dereferenced as `0xffffffffffffffff` → access violation.

It cost three reactive patches before the local bug was identified — each patch (defer the read, swap order around `SetLoadout`, change Phase 2 to value-only capture) reasoned about SDK state and engine cascades that weren't actually involved.

## Diagnostic value of the exact-N pattern

- N is small (≤10) and deterministic across runs.
- N+1 reads = N error log lines + 1 crash. Counting the errors tells you which iteration failed cleanly vs which dereferenced bad memory.
- The first N pointers happen to be plausible enough for the SDK's parameter validation to reject as "invalid" rather than crash; the (N+1)th points to genuinely unmapped memory.

If your call site is in a fixed loop (`for (i = 0; i < Count; ++i)`) and the failure count is constant, **check the indexing first**, not the SDK.

## Fix

Return a pointer to the static array, not a copy of one element:

```cpp
// RIGHT
static const FRuntimeAttrBinding* GetRuntimeBindings(int32& OutCount)
{
    static const FRuntimeAttrBinding Bindings[] = { /* 24 entries */ };
    OutCount = UE_ARRAY_COUNT(Bindings);
    return Bindings;   // array decays to pointer to first valid element
}
```

Or use `TArrayView<const T>` for explicit array semantics.

## When this learning applies

Whenever you see SDK error log spam followed by a crash inside the SDK, **before** investigating SDK state / context-stack / EnterObject scope:

1. Locate the call site in your code.
2. Check the array/pointer feeding the loop. Confirm it's a real array head, not a stack-local copy.
3. Confirm any helper that produces the array returns by pointer or `TArrayView`, not by value.
4. Check `ARRAY_COUNT` / `Num()` matches the actual valid range.

If those check out, then move on to SDK theories. The 80%-case for the "exact-N + access violation" pattern is local indexing, not SDK behavior.

## Anti-pattern

**Don't patch reactively when symptoms don't match theory.** After two failed patches based on SDK-state theories that didn't change behavior, stop and re-read your own helper code. See `feedback_analyze_dont_patch_reactively.md` (per-project memory) and the broader debugging discipline.
