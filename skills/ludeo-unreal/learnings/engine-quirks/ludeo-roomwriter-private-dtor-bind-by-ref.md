---
category: engine-quirks
tier: universal
sourceGame: StoryPuzzleGame
phase: 4
question: null
sanitized: true
---

# FLudeoRoomWriter has a private destructor — bind GetRoomWriter() by const ref, never copy to a value

`FLudeoRoom::GetRoomWriter()` returns a `const FLudeoRoomWriter&`, and `FLudeoRoomWriter`'s
destructor is **private** (only `FLudeoRoom` is a friend). Storing the writer in a **named value
local** therefore fails to compile:

```cpp
const FLudeoRoomWriter Writer = Room->GetRoomWriter();   // error C2248: cannot access
                                                         // private member ~FLudeoRoomWriter
```

The copy-constructed local would have to be destroyed at end of scope, and the destructor is
inaccessible. Bind by reference instead — no copy, no destruction at the call site:

```cpp
const FLudeoRoomWriter& Writer = Room->GetRoomWriter();   // OK
Writer.CreateObject(Params);
Writer.DestroyObject(Params);
```

Calling directly on the temporary also works (`Room->GetRoomWriter().SendAction(...)`), which is
why a lifecycle phase that only ever calls a method inline never trips this — it surfaces the
first time a state-tracking phase caches the writer in a local to reuse it across several
`CreateObject` / `DestroyObject` calls.

This is the same family as `writable-object-private-constructor-storage` (FLudeoWritableObject has
no public constructor → store via `TOptional`): the SDK's handle-wrapper classes restrict their
special member functions on purpose. Default rule: hold SDK wrappers **by reference** when the SDK
owns them, and by `TOptional<>` when you own them.
