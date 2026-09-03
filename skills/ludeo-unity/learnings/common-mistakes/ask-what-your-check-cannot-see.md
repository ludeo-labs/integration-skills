---
category: common-mistakes
tier: universal
phase: "1,2,3,4,5,6,7,8"
question: null
sanitized: true
---

# Ask what your check *cannot* see, not just what it returned

A check that returns "nothing found" is only evidence if it was capable of finding the thing.
Four separate times in one cloud-debugging session, a conclusion was drawn from a check that was
**structurally incapable** of returning anything else — and each one sent the investigation
somewhere wrong:

| The check | What it returned | Why it could not have said otherwise |
|---|---|---|
| `Select-String -Pattern '\[Ludeo\]' -SimpleMatch` | "0 lines" on logs holding 200–300 | `-SimpleMatch` takes the pattern **literally**, so it searched for backslashes |
| `grep -i "crash\|fatal\|c0000005\|Access violation"` | "no crash markers" | the actual crash was `0xc0000008`, absent from the list — reported as *"not a crash, a hang"* |
| `grep '^VideoPlayer:' <gameplay>.unity` | "0 VideoPlayers in the scene" | the component arrives at runtime via a **UI canvas prefab**, so the scene file is silent |
| slicing `status` output by **line number** to count categories | wrong counts, twice | status is a **column**, not a section — rows of different kinds interleave |

Every one of those is a true statement about the command and a false statement about the world.

## The habit

Before treating a negative result as a finding, ask the second question:

> *What would this check fail to see, even if the thing were there?*

- **Validate the check against a case where you already know the answer.** In the log example the
  working machine was right there and would have exposed the broken pattern instantly.
- **Prefer a positive control.** Grep for something you are certain is present; if that also
  returns zero, the check is broken, not the world.
- **Widen once before concluding.** For crash hunting, match the *shape* (`EXCEPTION_`,
  `0xc0000[0-9a-f]*`) rather than an enumerated list of codes you happened to think of.
- **Static file ≠ runtime.** A scene or prefab grep answers "what is serialized here", never "what
  exists at runtime". Instrument the running process when the question is about runtime.

## Why this earns its own entry

The related learning `a-guard-that-cannot-fire-is-not-evidence` is about a **guard in the code**
that could never trip. This one is about **your own tooling** — the grep, the counter, the scan you
just wrote to answer a question. The failure feels different (you wrote it seconds ago, so it feels
trustworthy) and the cost is identical: a whole line of reasoning anchored on a number that never
meant anything.

The tell that it is happening: you are explaining *away* a result that contradicts a fact someone
already gave you. Re-check the instrument first.
