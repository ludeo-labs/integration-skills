---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 3
question: null
sanitized: true
---

SDK handle types (`FLudeoPlayerHandle`, `FLudeoRoomHandle`, `FLudeoSessionHandle`, `FLudeoHandle`) store their underlying value as a **private** `uint64` member. Do not access it directly (e.g., `PlayerHandle.PlayerHandle == 0`). Instead, use the implicit conversion operator to the native C SDK handle type and compare to `nullptr`:

```cpp
// WRONG: private member access
if (PlayerHandle.PlayerHandle == 0) return;

// CORRECT: use conversion operator
if (static_cast<LudeoHGameplaySession>(PlayerHandle) == nullptr) return;
```

Each handle type has a conversion operator to its native type: `FLudeoPlayerHandle` → `LudeoHGameplaySession`, `FLudeoRoomHandle` → `LudeoHRoom`, `FLudeoSessionHandle` → `LudeoHSession`, `FLudeoHandle` → `LudeoHDataReader`.
