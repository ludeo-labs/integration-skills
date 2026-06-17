# Ask vs Infer

How to resolve uncertainty during an integration. Default to the row that matches the situation.

| Situation | What to do |
| --- | --- |
| Unsure about an **SDK API** (signatures, parameter types, callback chains) | **Look it up** — query the `sdk-docs` MCP server or read the skill's bundled `references/sdk-reference/`. Never guess SDK behavior. |
| Unsure about **game-specific logic** (which entities matter, what counts as a "significant action", how a phase system works) | **Ask the human** — this is domain knowledge that cannot be inferred from code alone. |
| Unsure about **engine patterns** (how to travel, how a system works, how to compile) | **Infer from the codebase** — grep for existing patterns, read the game's code, cross-reference `learnings/engine-quirks/`. |
| **Multiple valid approaches** exist (write frequency, reconciliation vs manual, dedup strategy) | **Recommend one with reasoning, then ask** — never present options without a recommendation, never decide silently on a game-specific tradeoff. |
| **Code analysis is ambiguous** (is this delegate the right hook? does this class handle respawns?) | **Ask the human** — state what you found, what you think it means, and what you need confirmed. |

**Never claim SDK behavior without checking documentation first.** If `sdk-docs` is unavailable and the
bundled references don't cover it, tell the human exactly what you're unsure about rather than guessing.
