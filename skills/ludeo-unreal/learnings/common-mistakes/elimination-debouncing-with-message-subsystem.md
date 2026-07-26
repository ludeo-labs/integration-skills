---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: 6
question: "Does the game use a message/event bus where elimination events might be received multiple times (e.g., from multiple processors rebroadcasting)?"
sanitized: true
---

# Elimination debouncing needed for GameplayMessageSubsystem-based games

In Lyra (and similar games using UGameplayMessageSubsystem), elimination messages can arrive multiple times because multiple processors listen and rebroadcast. Without debouncing, a single kill produces multiple Kill + Death actions in Studio Labs.

**Fix:** Add a timestamp-based debounce guard:

```cpp
// In the component:
double LastEliminationTime = 0.0;
static constexpr double EliminationDebounceWindow = 0.5; // seconds

void HandleEliminationMessage(FGameplayTag Channel, const FLyraVerbMessage& Payload)
{
    double CurrentTime = GetWorld()->GetTimeSeconds();
    if (CurrentTime - LastEliminationTime < EliminationDebounceWindow)
    {
        return; // duplicate within debounce window
    }
    LastEliminationTime = CurrentTime;

    // Report Kill + Death actions...
}
```

The reference integration uses a 0.5s debounce window. The skill says "don't add dedup proactively" but for GameplayMessageSubsystem, duplicates are the norm, not the exception.
