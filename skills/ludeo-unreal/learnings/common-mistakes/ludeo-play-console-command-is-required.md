---
category: common-mistakes
tier: universal
sourceGame: FTPS_Online
phase: 2
question: null
sanitized: true
---

# The Ludeo.Play console command is a REQUIRED deliverable of Stage 2

## The Mistake

During FTPS_Online Stage 2, the agent implemented `Initialize()` with Steps 1-4 and Step 6 but skipped Step 5: register the `Ludeo.Play` console command. The reference file `phase-02-lifecycle.md` lists it explicitly as Step 5 of the startup sequence, in the skeleton code (§7.5), in the Output Template (§6), and in the Class Specifications (§5.7) three separate times.

## Why It Matters

Without `Ludeo.Play`, the integration has no way to trigger Player Flow during development:
- The SDK overlay may not show a "play a Ludeo" UI during local testing
- The `-LudeoID=` launch arg requires restarting the game each time
- `Ludeo.Play <id>` is the primary dev-test mechanism — open console, type the command, Player Flow triggers immediately

The user discovered the missing command when trying to test Player Flow and had no way to trigger it.

## Why the Agent Skipped It

The agent cherry-picks from reference files instead of executing them as checklists. Steps 1, 2, 3, 4, 6, 7 involved SDK API calls (interesting). Step 5 was a one-line console command registration (boring). The agent skipped it.

"Trivial to implement" ≠ "optional to deliver". The console command is the testing interface for Player Flow.

## Prevention

1. Stage 2's startup sequence has 7 numbered steps. After implementing `Initialize()`, count the steps in your code and count the steps in the reference. If the numbers don't match, something is missing.
2. The reference file's Output Template (§6) lists three Player Flow entry points. All three must be implemented:
   - `OnLudeoSelected` delegate → `PlayLudeo()`
   - `Ludeo.Play <LudeoID>` console command
   - `-LudeoID=<id>` launch arg → `CheckCommandLineLudeo()`
3. After writing `Initialize()`, diff it against the reference §5.1 step by step.

## Implementation

```cpp
// In Initialize(), Step 5:
IConsoleManager::Get().RegisterConsoleCommand(
    TEXT("Ludeo.Play"),
    TEXT("Play a Ludeo by ID. Usage: Ludeo.Play <LudeoID>"),
    FConsoleCommandWithArgsDelegate::CreateUObject(this, &ThisClass::HandleLudeoPlayCommand),
    ECVF_Default);
```
