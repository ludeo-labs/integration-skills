---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 5
question: "Before trusting any gate: can it actually FAIL? Name the defect it exists to catch and describe concretely what a failing run would look like. If you cannot - the subject has one element, the world already satisfies the assertions, or an earlier step already did the work - the gate is decorative and a pass from it is worth nothing. This bites in two disguises, a degenerate test SUBJECT and an unasserted starting PRECONDITION, which is why reading it once does not stop you writing it again."
sanitized: true
---

# A harness that picks the first available subject will eventually pick one that cannot exhibit the fault

A restore test that synthesises state and asserts the consequences has to run against *something* in
the rebuilt world, and the obvious way to choose is "the first candidate that is not already in use".
That choice is invisible until the day it lands on a degenerate subject, and then it fails in two
directions at once — neither of which is the code under test.

## What happened

The scenario drove a collect-N-things objective: synthesise "N total, M already collected", apply,
then assert the count, the hidden parts, the HUD and — newly — that each still-to-collect part had
been moved to the position the clip recorded.

It picked **the first objective slot the rebuilt map offered that the replay had not already
claimed.** On earlier runs that was an eight-part objective and everything worked. On this map the
replay's own restore had claimed both multi-part objectives, so the pick fell through to a slot with
**exactly one part**, and:

1. **Every progress assertion failed on correct behaviour.** The implementation caps its trim one
   below the total on purpose — hiding *every* part leaves a count nothing can ever decrement,
   because completion is only ever declared from inside a part's own completion handler. Against a
   single part the correct number to hide is zero. The harness expected "M", got 0, and reported a
   defect.
2. **The new assertion passed while proving almost nothing.** "1 of 1 parts on its recorded place" is
   true of a correct implementation *and* of one that writes every part to the same position, or
   ignores order entirely. With one element there is no information to distinguish them.

The verdict was `failed` for reasons unrelated to the change, and the one line that mattered was a
pass that did not mean what it looked like. **Both halves are the subject, not the code.**

## What to do

- **Rank candidates, do not take the first.** Prefer the subject with the most elements — the one
  that can actually exhibit ordering and per-element faults. The authored count is usually readable
  before the elements exist, which is exactly when the pick happens.
- **Encode the implementation's deliberate clamps in the harness's expectation**, in one shared
  helper, with the reason written down. An expectation derived independently from the same inputs
  will diverge from the implementation at every edge the implementation deliberately handles, and
  every divergence reads as a defect in the code rather than in the test.
- **Report the subject's size in the step detail**, e.g. `N of M checkable`. This is what makes a
  weak pass legible as a weak pass rather than a green tick — without it, "1 of 1" and "8 of 8" look
  identical in a results file.
- **When the world cannot offer a non-degenerate subject at all, say so and stop.** Here the map had
  three slots and the replay legitimately owned two; no change to the pick could conjure a
  multi-element candidate. That is a real limit of the instrument and belongs in the handoff as an
  unproven half, not papered over by a passing verdict.

## The same defect in different clothing — and why this learning failed to prevent it

Both halves of a two-session afternoon hit this, hours apart, in shapes that look unrelated:

| | what the gate ran against | why it proved nothing |
|---|---|---|
| objectives | an objective with **one** part | one element cannot distinguish "right places, right order" from "everything moved to one spot", and the implementation's deliberate clamp made every progress assertion unsatisfiable |
| bosses | a clip **already inside** a boss fight | the real restore had closed the arena before the gate ran, so every assertion was satisfied by that earlier apply and the gate reported `passed` without testing anything |

The second agent **had read this learning about ninety minutes earlier**, at the start of its own
session, then wrote the identical defect into two gates, and only a reviewer caught it. Ninety
minutes, not a day — the lesson was still in context, and it still did not fire. That is the part
worth recording, because it says the learning as first written does not work when it matters:

> At write time it reads as a statement about **test subjects** — how many elements, which row got
> picked. The boss case did not look like a subject question at all; it looked like a **precondition**
> question, about what state the world happens to be in when the gate starts. Same root, different
> vocabulary, so the loaded lesson sat inert.

**So do not check "did I pick a good subject".** Check the thing underneath, which survives the
change of clothes:

> **Can this gate fail?** Name the specific defect it exists to catch, then say concretely what the
> run would look like if that defect were present. If you cannot describe a failing run — because the
> subject has one element, because the world already satisfies the assertions, because something
> earlier in the pipeline already did the work — the gate is decorative and a `passed` from it is
> worth nothing.

Then make it answerable at runtime: assert the precondition the gate needs (`assert-no-boss-yet`),
rank candidates so the subject can exhibit the fault, and print the subject's size in the step detail
so a weak pass is legible as a weak pass rather than a green tick.

## The wider point

This is the "read the evidence lines, not the verdict" rule applied to the *subject and the starting
state* rather than the result. A harness that chooses its own subject, or that inherits a world
somebody else has already changed, has a hidden input — and a green run says nothing until you know
what it ran against.

## Also seen: guards and holds proven on a world that could not fail them (TopDownRogueSample)

- **A suppression guard with no subject.** A first-time popup that arms only after N attempts cannot
  fire on a fresh test profile, so "no popup appeared" is true with or without the guard. Arm the
  condition in the test, log each guard's refusals (site + count), and assert the count is > 0 in the
  run meant to prove it.
- **"Nothing progressed under the hold" on an idle world** passes trivially. Seed work in flight first
  (items queued or mid-production), then compare counters across the hold.
- **Rate-based proofs on a maxed-progression profile** are indistinguishable from noise: items finish in
  a fraction of a second. Use a low-progression capture for timing proofs.
