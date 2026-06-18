---
category: architecture
tier: universal
sourceGame: Lyra
phase: 2
question: null
sanitized: true
---

# FLudeoManager::GetInstance() returns TWeakPtr, not a reference

The SDK's entry point `FLudeoManager::GetInstance()` returns `TWeakPtr<FLudeoManager>`, not a reference or raw pointer. Must pin before use:

```cpp
TWeakPtr<FLudeoManager> ManagerWeak = FLudeoManager::GetInstance();
TSharedPtr<FLudeoManager> Manager = ManagerWeak.Pin();
if (!Manager.IsValid()) { /* handle error */ return; }
Manager->Initialize();
```

For the SDK tick lambda, capture the weak pointer (not the shared pointer) to avoid preventing cleanup:

```cpp
SDKTickerHandle = FTSTicker::GetCoreTicker().AddTicker(
    FTickerDelegate::CreateLambda([ManagerWeak](float DeltaTime) -> bool
    {
        if (TSharedPtr<FLudeoManager> Mgr = ManagerWeak.Pin())
        {
            Mgr->Tick();
        }
        return true;
    })
);
```
