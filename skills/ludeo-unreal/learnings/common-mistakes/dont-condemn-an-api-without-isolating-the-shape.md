---
name: dont-condemn-an-api-without-isolating-the-shape
description: When a previously-working SDK call appears to break something after a code change, isolate the specific shape of usage that's new — not the API itself. Handoff docs that recommend "avoid API X" should be cross-checked against existing call sites before you adopt them.
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: 4
question: "Before adopting a handoff doc's 'avoid API X' recommendation: how many call sites of X already exist and work in this integration? If many, the issue is the specific usage shape, not the API."
sanitized: true
---

# Don't condemn an API without isolating the shape

## Precondition

This learning applies when:

1. A handoff doc or prior-agent notes recommend avoiding a particular SDK API.
2. The same SDK API is already used elsewhere in the integration and was working before the change.
3. The breakage was introduced by a specific code change that *added* a new usage of that API.

If all three hold, the handoff's recommendation is almost certainly an overgeneralization — and adopting it costs the integration architectural ground for the wrong reason.

## The pattern

A coder makes a change that includes a new use of API X. Something breaks downstream. They notice X was the new ingredient, conclude "X is fragile, avoid mid-mission/mid-session/mid-pipeline use of X." Handoff doc says "don't use X this way." Next agent reads the doc, scopes their work around the prohibition, ships a worse architecture or stalls indefinitely.

What was actually wrong was a **specific shape** of how X was used — not X itself. Other call sites of X with a different shape work fine and ship in the binary every day.

The pattern surfaces especially around APIs with:

- **Silent failure modes downstream of the call.** The API call itself returns success. Some unrelated capability (action stream, goal templates, state coherence) silently degrades. The agent doesn't see a direct error from X, so they pattern-match on "what's new" — which is X.
- **Binary-DLL boundaries.** Open-source code reveals no error path. The agent can't grep their way to the cause, so the heuristic "it must be X being fragile" is hard to falsify.
- **High-level surface concepts.** "Mid-mission spawns", "mid-session writes", "dynamic creation". Easy phrases to handwave with.

## How to apply

Before adopting any handoff "avoid API X" or "X is fragile" recommendation:

1. **Count existing call sites of X.** Grep the integration. If X is used in N places and shipped working, condemnation of X-in-general is wrong; the issue is a specific *shape* in one of those places.
2. **Diff the abandoned attempt against the existing call sites.** What's structurally different about the new usage? Different argument type? Different identity key? Different ordering? Different lifecycle? The difference is your real bug.
3. **Reject the recommendation if the precondition fails.** Don't write code around a prohibition you can't justify against existing evidence. Tell the human you're rejecting the prior agent's framing and explain why.

## Concrete example (ActionGame Phase 5)

The 2026-05-13 handoff doc said:
> "**Drop the per-entity-objects DeadBody approach until the SDK behavior is understood.** Either: consult Ludeo SDK team about whether mid-mission `CreateObject`/`DestroyObject`… is supported, and whether it has documented effects on the action stream."

Existing mid-mission `CreateObject` call sites in the same plugin at that time:

- `OnActorSpawned` → `RegisterEntity` for every spawned EnemyAI (~50/mission)
- ...for every spawned Bystander (~30/mission)
- ...for every spawned Vehicle, Helicopter, Drone, Deployable

These had been shipping for weeks without breaking the action stream. The handoff's "mid-mission `CreateObject` is fragile" framing didn't survive a 30-second grep.

The actual bug was a **specific shape**: the new DeadBody `CreateObject` passed `Params.Object = liveAI` while liveAI was already registered as Bystander/EnemyAI. **Two writables on one `UObject*` key**. The integration's existing `CreateObject` calls all pass a unique UObject per writable; the new shape violated that invariant. See `one-writable-per-uobject-key.md`.

Fix took one new transient `UObject` per corpse, ~15 lines of code. The wasted scope from the misframing: a 200-line handoff doc, an abandoned implementation, and a recommendation that would have permanently restricted the architecture to inferior blob-attr shapes.

## Anti-rule

This learning is NOT permission to ignore handoff docs. Prior agents often capture real, hard-won knowledge. Read the handoff carefully. **Then** verify its claims against current code before adopting. The bar is: "Does the precondition this advice assumes still hold in the codebase I'm looking at?" If not, the advice doesn't apply and you should flag it explicitly to the human.

Cross-reference: `do-not-trust-learning-without-verifying-precondition.md` for the parallel rule on the skill's own learnings library.
