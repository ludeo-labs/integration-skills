---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: 2
question: null
sanitized: true
---

# FLudeoResult::ToString() returns TStringView<ANSICHAR>, not FString

Cannot dereference with `*` for UE_LOG. Must convert to FString first.

**Wrong:**
```cpp
UE_LOG(LogLudeo, Error, TEXT("Failed: %s"), *Result.ToString());
```

**Correct:**
```cpp
UE_LOG(LogLudeo, Error, TEXT("Failed: %s"), *FString(Result.ToString().GetData()));
```
