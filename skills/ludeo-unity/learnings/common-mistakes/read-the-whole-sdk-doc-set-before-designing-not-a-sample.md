---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 1,3
question: "About to design the lifecycle, pause handling, triggers or the replay flow after reading only a few SDK doc pages? Read every page of the engine's doc set (and the core counterparts) first — in one integration each skipped page turned into a defect found later."
sanitized: true
---

# Read the whole SDK doc set before designing — not a sample

In one integration the agent read a **sample** of the SDK documentation, relied on the skill's references
and learnings for the rest, and started designing. The integrator later asked for a full read of every
page. That read found, in one pass, things the sampled design had missed or got wrong:

| Missed in the sample | Cost |
|---|---|
| Player Flow **must pause** the game while the replay waits for the viewer (stated in four places) | the pause had been dropped on the strength of a learning whose precondition did not hold for the installed plugin |
| A **moment is not a Ludeo**: the creator sets the start point in Creator Lab and publishes | test instructions assumed the replay starts where the capture key was pressed |
| The clip length is a **Studio Lab setting** (it was 3 minutes, not the 60 s assumed) | wrong expectations about which part of a run a moment contains |
| The two trigger types split **by flow** (see [[pause-and-non-ludeoable-triggers-split-by-flow-a-real-pause-needs-both]]) | the pause menu stayed usable as a start point |
| Read ordering and launch-path requirements for the Player Flow | caught only at the audit, before they became cloud bugs |

## The rule

- Before designing any phase that touches the SDK surface, **read every page** of the engine's doc set
  plus the core counterparts it links to. It is a few dozen pages; the defects it prevents each cost a
  build-test-report cycle.
- Treat the skill's references and learnings as **context on top of** the docs, not a substitute. Where
  a learning and the docs disagree, check the learning's precondition against the installed plugin
  before following it (see [[verify-the-timescale-pump-claim-against-the-installed-plugin]]).
- When an audit agent checks the design against the docs, **give it the runtime logs** too: in the same
  integration two of three "blockers" an audit reported from the docs alone were disproved by one log.
- Tell the integrator plainly how much of the documentation was read. "Briefly checked" is not a basis for
  a design, and they will ask.
