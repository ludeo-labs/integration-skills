---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# Don't leave "we're skipping this for now" comments — file the work, or implement it

## The mistake

In-code comments that explain *why we chose not to implement something* become invisible technical debt the moment they're written. Examples that are common in integration work:

```cpp
// ARMOR NOTE: do NOT SetNumericAttributeBase on Armor here. The game's armor is
// chunk-based ... the ensure fires in APlayerStateBase. Armor replenishes
// to full naturally within seconds, so skipping the restore has negligible
// visual impact on a 60 s replay.
(void)Armor; // captured for logging below; not applied
```

The author *knew* this was wrong-ish ("captured for logging below; not applied"). The author *justified* the skip ("negligible visual impact on a 60s replay"). The author *did not* file it as a known issue, did not add a TODO with a tracked owner, did not surface it in any way that would resurface during normal work.

## Why this is uniquely bad on integration projects

1. **The justification rots.** "Negligible on a 60s replay" was true while QA was running 60s clips. As soon as a 5-minute clip is captured (player takes armor damage early, replays mid-fight), the skip is a visible wrong-state bug. The comment doesn't update to say "this is now wrong."

2. **Humans can't remember every such comment.** A complex integration has dozens of these scattered through tens of thousands of lines. After a few weeks the author can't recall which skips were tactical and which became real bugs. New contributors never knew about them.

3. **AI assistants won't proactively flag them.** When asked to extend the surrounding code, an AI assistant respects the comment as a decided design choice and reasons around it. The comment is treated as documentation of an immutable constraint, not a deferred task. Without explicit instruction to revisit, the assistant won't.

4. **The "file an issue" reflex doesn't fire** because the work is "small" — you're already deep in the file, the fix is one or two lines once you find the right API, and writing an issue feels like overhead vs. just leaving the comment.

5. **Comments are not searchable as work items.** No project tracker, no priority field, no assignee, no rediscovery cadence. They surface only when the next person reading that exact function happens to question the comment.

## What to do instead

When you find yourself writing a "skipping for now" comment, **stop** and pick one of:

1. **Implement it now.** Most "skip" comments turn out to be 30 minutes of extra work once you commit to the right API. ActionGame's armor case was 4 lines (`InitArmor` instead of `SetNumericAttributeBase`); the difficulty was finding the right setter, not implementing it.

2. **File it as a tracked known issue.** In this skill's flow, that means adding an entry to `.ludeo/integration.json` → `stages.<n>.knownIssues` with `priority`, `raisedAt`, and `description`. Then the comment can be terse: `// See integration.json knownIssues 2026-05-04 'Armor not applied'`.

3. **Open an issue / TODO with an owner and a re-evaluation date.** Better than a freestanding comment because it has somewhere it'll resurface (PR review, sprint planning, scheduled review).

If you can't do any of those three, the comment isn't documenting a decision — it's documenting a gap. Either pay for it now or make it a real work item.

## What an AI assistant should do

When you encounter such a comment in code you're modifying:

1. **Flag it explicitly to the human.** Don't silently respect the comment. Surface it: "I notice this code skips applying X with this rationale. Is that still a valid trade-off, or is this the right time to address it?"

2. **Re-investigate the rationale before respecting it.** The justification was written at a point in time with assumptions that may no longer hold. ActionGame's armor comment claimed "no chunk-aware setter exists" implicitly; a 5-minute exploration found `InitArmor` (UE built-in via the `GAMEPLAYATTRIBUTE_VALUE_INITTER` macro chain) which sidesteps the ensure entirely.

3. **When writing your own such comment**, follow the rules above. Don't model the bad pattern.

## Reference incident (ActionGame, 2026-05-04)

The armor-skip comment in `ActionGameLudeoComponent` survived from Stage 3 (April 2026) through Phase B's full loadout/cosmetics/ammo coverage work (May 2026). During Phase B I (the agent) extended the surrounding restore code multiple times without flagging the comment — I treated it as a settled design choice. The user only noticed when they happened to look at that exact function and asked "can we address this?" The skip was 1.5 months old; the user did not remember writing or accepting it.

The fix was 4 lines (`InitArmor` instead of skip + log-only). Cost of having left the comment: a real player-visible state divergence on every replay where the captured player had taken armor damage, undetected for ~6 weeks.

## How to apply

Whenever you (agent or human) are about to write `// not applied for now` / `// TODO: this should ...` / `(void)X; // skipped`:

- Write the work item somewhere trackable first.
- Then either implement, or write the comment as a short pointer to that tracked item.

When you (agent) encounter such a comment in code you're modifying:

- Surface it to the human at the start of the work.
- Spend 5-10 minutes investigating whether the justification still holds before reasoning around it.

## Cross-reference

- Skill section "Stage 3 Hard Gate: Player Flow Before Stage 4" — same anti-pattern at the stage level (the agent stubs Player Flow and rationalizes that the next stage will catch it; the stub persists). This learning is the more general statement.
- `do-not-stub-deliverables.md` — adjacent: don't ship stubs masquerading as implementations. This learning extends it: even when the skip is *deliberate*, file it.
