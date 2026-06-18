---
category: save-systems
tier: universal
sourceGame: VoyagerV2
phase: 4
question: null
sanitized: true
---

# SDK Asserts on Unregistered Object References During WriteData

When SaveWorld traverses a UPROPERTY that references a UObject not in the WritableObjectMap, the SDK hits `check(false)` at LudeoWritableObject.cpp:448 instead of gracefully skipping the reference.

This means ALL objects reachable through the property filter MUST be registered as writable objects BEFORE any WriteData calls. Blueprint components commonly cross-reference each other (HealthComp → StatsComp, StatsComp → HealthComp), creating circular dependencies that SaveWorld can't handle without pre-registering everything.

**Workaround:** Use PropertyName filter restricted to value-type properties only (float, int, bool, string). Exclude all object-reference properties. But this limits what can be saved to the actor's direct value properties, not sub-object state.
