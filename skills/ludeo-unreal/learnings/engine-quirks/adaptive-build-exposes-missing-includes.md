---
category: engine-quirks
tier: universal
sourceGame: ActionRoguelike
phase: 3
question: null
sanitized: true
---

# Adaptive non-unity build exposes missing includes

When UBT detects modified files via `git status`, it excludes them from the unity build ("Excluded from unity file: X.cpp"). This means includes that were previously resolved transitively through the unity file are now missing.

**Symptom:** A file that compiled before your changes now fails with "cannot open include file" or "incomplete type" errors — even though you didn't change those lines.

**Fix:** Add the missing `#include` explicitly to the `.cpp` file. The file was always missing it; the unity build was masking the problem.

**Example from ActionRoguelike:** `RogueGameState.cpp` used `GetSubsystem<URoguePickupSubsystem>()` but only had a forward declaration via `RoguePickupItemReplication.h`. Adding `#include "Pickups/RoguePickupSubsystem.h"` fixed it.
