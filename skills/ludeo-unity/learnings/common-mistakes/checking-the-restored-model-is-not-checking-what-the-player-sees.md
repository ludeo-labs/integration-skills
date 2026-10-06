---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "5"
question: "Does any HUD element you are restoring get its value PUSHED to it once (a counter, a meter, a label set by a command or an event) rather than read from the model every frame? If so, your restore's read-back can pass on the model while the player looks at the pre-restore value - assert the rendered value too."
sanitized: true
---

# Checking the restored model is not checking what the player sees

The restore's own read-back is the right instinct, and there is a separate learning saying to do it for
every value written. This is its blind spot: a read-back compares what you wrote against what the model
now holds, and both can be correct while the screen shows something else entirely.

**How it happened.** A side objective was restored to "2 of 8 collected". The verification checked
everything the model could be asked: the objective was registered on its manager, its quest was active
in the right state, the parts were spawned, the already-collected ones were hidden, and the remaining
count read exactly 6 of 8. Every assertion passed. The screenshot from the same run showed the
objective's HUD counter reading **0/8**.

The cause is ordering around a *push*. Restoring the objective went through the game's own accept path,
which pushes the HUD counter once — with zero collected, because that is what accepting means — and the
only other thing that recomputes it is a quest activity/state refresh, which that same accept path had
already fired. The trim to "2 collected" ran afterwards and changed the model, and nothing told the HUD.
The counter's current value is not stored anywhere: the quest object carries only the maximum, and the
running count is handed straight to the record. So there was no model field that disagreed — the wrong
number existed only as rendered text.

## What to do

- **When the restore adjusts a value after driving a game path that displays it, push the display too.**
  One line, and it belongs next to the model write so the two cannot drift.
- **Assert the rendered value in the harness**, not only the model. Reading UI text is the brittle part
  of a scenario, so make it fail loudly and by name ("the counter could not be read — has the record's
  layout changed?") rather than quietly returning null and passing.
- **Take the screenshot and look at it.** This was not found by a failing assertion; it was found by
  reading the image from a run whose every step reported ok. A scenario that captures a screenshot and
  nobody opens it is a scenario with a hole in it.

## The generalisable shape

Ask, for each restored value the player can see: *is this display pulled from the model, or pushed into
the display?* Pulled displays self-correct and need nothing. Pushed displays need the push, and the push
has to happen **after** the last write to the value — which, when you are re-driving one of the game's
own paths to get the sibling updates, is usually after that path has already pushed the wrong number.

The same trap applies to anything else fed by a one-shot notification rather than a per-frame read: a
minimap marker, an objective banner, a stat panel opened before the restore finished, an achievement
meter.
