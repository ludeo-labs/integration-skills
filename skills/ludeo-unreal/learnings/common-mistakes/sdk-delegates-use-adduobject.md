---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: 3
question: null
sanitized: true
---

# SDK multicast delegates: use AddUObject, not AddRaw

When binding Ludeo SDK session notification delegates from a UObject-derived class (like ULudeoSessionSubsystem), use `AddUObject` instead of `AddRaw`.

**Wrong:**
```cpp
ActiveSession->GetOnLudeoSelectedDelegate().AddRaw(this, &ULudeoSessionSubsystem::OnLudeoSelected);
```

**Correct:**
```cpp
ActiveSession->GetOnLudeoSelectedDelegate().AddUObject(this, &ULudeoSessionSubsystem::OnLudeoSelected);
```

`AddRaw` is for non-UObject C++ classes. UE5.7 enforces this at compile time.
