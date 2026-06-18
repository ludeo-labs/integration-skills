---
category: engine-quirks
tier: universal
sourceGame: VoyagerV2
phase: 2
question: null
sanitized: true
---

# FAudioDevice requires #include "AudioDevice.h"

`FAudioDevice` is forward-declared in AudioMixer headers but not fully defined. Using `FAudioDevice*` methods (e.g., `SetTransientPrimaryVolume`) requires `#include "AudioDevice.h"` explicitly. Without it: `error C2027: use of undefined type 'FAudioDevice'`.
