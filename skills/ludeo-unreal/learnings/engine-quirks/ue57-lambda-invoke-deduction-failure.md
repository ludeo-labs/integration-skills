---
category: engine-quirks
tier: universal
sourceGame: Lyra
phase: 3
question: null
sanitized: true
---

# UE 5.7: Capturing lambdas in SDK delegate CreateLambda cause Invoke template deduction failure

In UE 5.7, passing a capturing lambda via `FLudeoSessionOnActivatedDelegate::CreateLambda([this](...) { ... })` causes a compile error in `Tuple.h` / `Invoke.h`:

```
error C2672: 'Invoke': no matching overloaded function found
note: 'TMemberFunctionPtrOuter_T': Failed to specialize alias template
      PtrMemFunType=ULudeoSessionSubsystem::ActivateSession::<lambda_1>
```

UE 5.7's `Invoke` system cannot deduce the member function pointer type from a capturing lambda used inside the delegate's `ApplyAfter`.

**Fix:** Use `CreateUObject` instead of `CreateLambda` for SDK async delegates:
```cpp
// WRONG — fails in UE 5.7:
FLudeoSessionOnActivatedDelegate::CreateLambda([this](const FLudeoResult& Result, ...) { ... });

// CORRECT:
FLudeoSessionOnActivatedDelegate::CreateUObject(this, &ThisClass::OnSessionActivated);
```

This may be specific to UE 5.7's Invoke implementation. Earlier UE versions may not have this issue.
