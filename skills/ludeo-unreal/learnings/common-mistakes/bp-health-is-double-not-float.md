---
category: common-mistakes
tier: generalizable
sourceGame: VoyagerV2
phase: 3
question: "Is this a Blueprint-only project? If so, BP 'float' properties are stored as FDoubleProperty (double) in UE5, not FFloatProperty (float). Use CastField<FDoubleProperty> first, with FFloatProperty fallback."
sanitized: true
---

In UE5 Blueprint-only projects, what appears as a "float" variable in the Blueprint editor is stored internally as `FDoubleProperty` (double), NOT `FFloatProperty` (float). Using `ContainerPtrToValuePtr<float>()` on a double property reads the wrong byte size and returns garbage/zero.

**Fix:** Always try `FDoubleProperty` first, then fall back to `FFloatProperty`:
```cpp
if (FDoubleProperty* DoubleProp = CastField<FDoubleProperty>(Prop))
{
    const double* Value = DoubleProp->ContainerPtrToValuePtr<double>(Comp);
    return Value ? *Value : 0.0;
}
if (FFloatProperty* FloatProp = CastField<FFloatProperty>(Prop))
{
    const float* Value = FloatProp->ContainerPtrToValuePtr<float>(Comp);
    return Value ? (double)*Value : 0.0;
}
```

**Symptom:** Health always reads as 100 (default), Kill/Death actions never fire because poll-based detection never sees health change.
