---
category: common-mistakes
tier: universal
sourceGame: FTPS_Online
phase: 5
question: null
sanitized: true
---

# Always read SDK documentation before writing any SDK API call — do not infer from parameter names

## The Pattern of Failure

Across FTPS_Online Stages 2-4, the agent made three errors that would have been prevented by reading the SDK docs first:

1. **Stage 2:** Skipped auth handling entirely (inferred "not a Steam game" → no auth needed). SDK docs say auth is always required for non-Cloud builds.
2. **Stage 3:** Used unique instance names as `ObjectType` (inferred from parameter name "ObjectType" → must be unique type). SDK docs show it's a shared category string.
3. **Stage 4:** Used per-entity PlayerIDs in `SendAction` (inferred from parameter name "PlayerID" → must identify which entity). SDK docs explicitly say it must match the PlayerID from `AddPlayer`.

In all three cases, the agent **inferred the API's semantics from parameter names** instead of reading the documentation. Parameter names are suggestive but not definitive — `ObjectType` doesn't mean "unique type per object", and `PlayerID` in `SendAction` doesn't mean "ID of the entity that performed the action."

## The Fix: Mandatory SDK Doc Check

Before writing ANY code that calls an SDK API method, the agent MUST:

1. **Search the `sdk-docs` MCP** for the method name (e.g., `SendAction`, `CreateObject`, `Activate`)
2. **Read the full documentation page** for that method — not just the signature, but the usage notes, examples, and `important` callouts
3. **If `sdk-docs` MCP is unavailable**, read the bundled `references/sdk-reference/` files
4. **If neither is available**, read the SDK header comments AND a prior integration's usage of the same API (e.g., Lyra reference in `examples/lyra/`)

This check takes 30 seconds and prevents hours of debugging. The agent's pattern of "I know what this parameter means from the name" has failed three times in one integration.

## Where the references already existed

| Error | SDK doc that would have prevented it | Skill reference that would have prevented it |
|---|---|---|
| Missing auth | `TrackGameplay` page → auth section; `phase-03-lifecycle.md` §5.3 | `learnings/common-mistakes/missing-explicit-auth.md` |
| Wrong ObjectType | `State Management` page → `params.objectType = "Player"` | None (new learning) |
| Wrong SendAction PlayerID | `TrackGameplay` page → "use the same playerId when reporting actions" | None (new learning) |

The agent loaded the learnings list in Stage 1 but never read the auth-related ones. It had the `sdk-docs` MCP available but didn't search it before writing `CreateObject` or `SendAction` code. The skill reference for Stage 2 (§5.3) contained the exact auth code but the agent skipped it.

## How to avoid

The root cause is **overconfidence in parameter-name inference**. The fix is procedural:

1. For each SDK method you're about to call, search `sdk-docs` MCP
2. Read the result
3. Write the code
4. Compare your code against the doc example

If you skip step 1-2, you will guess wrong. This has happened 3/3 times in this integration.
