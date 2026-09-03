---
category: architecture
tier: generalizable
sourceGame: ActionAdventureSample
phase: 3
question: "Are you deciding, per non-interactive segment, whether to emit StartNoneLudeable/StopNoneLudeable or PauseLudeo/ResumeLudeo?"
sanitized: true
---

# Classify non-gameplay segments by whether the simulation actually freezes — the game's own code already tells you

The two standard pairs are easy to conflate:

| Pair | Meaning |
|---|---|
| `StartNoneLudeable` / `StopNoneLudeable` | The sim **keeps running**; tracking continues; the **backend excludes** the window (needs the one-time platform global-trigger mapping). |
| `PauseLudeo` / `ResumeLudeo` | A **true sim freeze** — local capture hygiene, no backend mapping. |

You do not have to judge each segment by feel. **The discriminator is already in the game's source:
does the segment write `Time.timeScale = 0f` (or otherwise stop the sim)?** Grep the `timeScale` writes
and cross-reference them against the state-change sites.

In the source integration the split came out **exact**, along the game's own state enum:

- every segment that entered the `Paused` state also wrote `Time.timeScale = 0f` — tutorial popup,
  in-game menu, pause menu, game-over screen, full-map screen → **`PauseLudeo`/`ResumeLudeo`**;
- **no** segment that entered the `Cinematics` state touched `timeScale` — shop, dialogue, an altar
  interaction, the upgrade screen, cutscenes, teleports, scripted intros → **`StartNoneLudeable`/
  `StopNoneLudeable`**.

That is a strong sign the split is real and not an artifact: the game team had already made the same
distinction, one state per semantics. When a codebase has that shape, the classification is a two-line
rule in the state machine rather than a per-feature judgement call — and it is defensible in review
because every row cites a `timeScale` write or its absence.

## Caveats

- **Verify, don't assume the enum names map cleanly.** A state called "paused" that does *not* stop the
  sim is a non-ludeoable window, not a `PauseLudeo`. Trust the `timeScale` evidence over the name.
- **Some engines/games freeze without `timeScale`** (a manager-level `IsPaused` that gates every
  `Update`, a custom clock). Look for the game's real freeze primitive; `timeScale` is the common case,
  not the definition.
- **Whole non-gameplay screens (main menu, loading) need neither pair** — they sit outside any gameplay
  session and are handled by session bracketing alone.

Emit both pairs through the same transition machine so a `Paused → Cinematics` move closes one span and
opens the other: [[non-ludeoable-spans-as-a-state-machine-not-paired-calls]].
