---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "5,6"
question: "Are you writing a string attribute that joins several values with punctuation — a comma- or semicolon-separated list, coordinates, a decimal number rendered as text? String values containing commas, semicolons or periods never reached the clip, and WriteData returns nothing to say so. Use typed attributes, or join with an underscore."
sanitized: true
---

# Punctuated text values are silently refused

String attribute values containing commas, semicolons or periods never reached the clip. `WriteData`
returns `void`, so the refusal is invisible at the call site, and the SDK's data log — the only place a
refused write is reported — is often switched off (see
[[a-widened-int-is-a-silently-rejected-write]]).

## What it cost

To avoid one attribute name per element, an integration carried the positions of an objective's
collectible parts as one joined string per objective, `"x,y,z;x,y,z;..."`. Two hand captures replayed
with every part in the wrong place. The value turned out to be **absent** from the clip — not empty,
absent — while a brand-new integer written on the very next line, in the same scope and tick, arrived.

It took most of a day to see, and two "fixes" failed real captures first. Following the same cause
turned up a second casualty: item modifier lists joined with commas had never reached a single clip,
which is why their restore had stayed "unproven" for weeks — there had been nothing to prove.

## The near-miss: a probe that varied two things at once

"Long strings are dropped" was nearly written down. A parallel session refuted it: an existing
26-character identifier made of letters and underscores round-tripped on every run. The first probe
built to settle it was short **and** punctuated, so it varied two things at once and neither outcome
could have meant anything. Rebuilt with one variable — letters, digits and underscores only, made long —
it arrived at 61 characters. **It is the separators, not the length.** The exact offending character was
not isolated: all three were present in the failing value and none in the working one.

## The fix

- Use a **typed attribute** wherever the value has a type: a position is a `Vector3` (`part{n}Pos`),
  with a separate count so a cap never reads as "the recording had fewer".
- For a genuine list of names, join with **one named separator constant** that cannot occur in the
  values (`_` worked), assert that at write time, and parse on both separators so older data still reads.
- When a written value never arrives, write a trivially safe value right beside it and compare before
  theorising — and change one thing per probe.
- Use string attributes sparingly, as the SDK's own docs advise.
