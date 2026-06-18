---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: 2
question: "What are the exact gameplay tag strings used for phase transitions? Grep for the actual tag values in config files and data assets — do not assume tag names from class/subsystem names."
sanitized: true
---

Phase tags are game-specific and often prefixed with the game's namespace. In Lyra, the phase subsystem header mentions `GamePhase.Playing`, but the actual tag used by ShooterCore is `ShooterGame.GamePhase.Playing`. The prefix comes from the game feature's tag hierarchy, not the subsystem code.

Using the wrong tag causes the phase callback to silently never fire — no error, no warning. The N-way gate's game-phase condition is never met, so `BeginGameplay()` is never called.

**How to catch this during analysis (Stage 1-2):**

1. **Grep for the actual tag values in .ini files and data assets**, not in C++ headers:
   ```
   Grep("GamePhase", glob: "*.ini")
   Grep("GamePhase", glob: "*.uasset")  // won't work on binary, but...
   ```

2. **Search for `NativeGameplayTags` or `UE_DEFINE_GAMEPLAY_TAG` in the game's source** — these define the actual string values:
   ```
   Grep("UE_DEFINE_GAMEPLAY_TAG.*GamePhase", glob: "*.cpp")
   Grep("FGameplayTag::RequestGameplayTag.*GamePhase", glob: "*.cpp")
   ```

3. **Check the GameFeature plugin's tag config files** — ShooterCore has tag definitions that include the `ShooterGame.` prefix.

4. **Run the game and grep logs for the phase tag string** — the log shows the exact tag when a phase starts: `Beginning Phase 'ShooterGame.GamePhase.Playing'`.

**Rule:** During Stage 2 analysis, always verify gameplay tag strings by finding where they are DEFINED (not where they are referenced), and confirm the full tag path including any game/feature prefixes.
