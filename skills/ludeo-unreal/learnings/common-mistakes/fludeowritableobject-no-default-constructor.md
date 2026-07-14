---
category: common-mistakes
tier: universal
sourceGame: VoyagerV2
phase: 5
question: null
sanitized: true
---

FLudeoWritableObject has no default constructor. Cannot be used as a direct struct member or in containers that require default construction. Use TOptional<FLudeoWritableObject> instead.

```cpp
// WRONG — won't compile (UHT generated code needs default ctor)
struct FTrackedEntityInfo
{
    FLudeoWritableObject WritableObj;  // error C2512
};

// CORRECT
struct FTrackedEntityInfo
{
    TOptional<FLudeoWritableObject> WritableObj;
};

// Access pattern:
Info.WritableObj.Emplace(Result.GetValue());  // set
Info.WritableObj.GetValue().WriteData(...);    // use
Info.WritableObj.IsSet();                      // check
```
