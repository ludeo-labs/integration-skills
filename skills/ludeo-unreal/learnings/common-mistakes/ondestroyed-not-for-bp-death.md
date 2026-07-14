---
category: common-mistakes
tier: generalizable
sourceGame: VoyagerV2
phase: 6
question: "Do enemies in this game call Destroy() when they die, or do they ragdoll/dissolve/fade? If not Destroy(), use poll-based health detection instead of OnDestroyed delegate."
sanitized: true
---

Do NOT use AActor::OnDestroyed delegate for Kill detection in Blueprint-based games where enemies die via ragdoll, dissolve effects, or death animations. OnDestroyed only fires when Destroy() is explicitly called or the actor is garbage collected — which may happen much later or never during gameplay.

**Fix:** Use poll-based detection: monitor AI health each tick. When health drops from >0 to <=0 (or actor becomes invalid), fire the Kill action.

```cpp
for (FTrackedEntityInfo& Info : TrackedEntities)
{
    if (Info.bIsPlayerOwned) continue;
    if (!Info.Actor.IsValid())
    {
        if (Info.PreviousHealth > 0.f) SendAction("Kill");
        continue;
    }
    float Health = GetHealthFromActor(Info.Actor.Get());
    if (Info.PreviousHealth > 0.f && Health <= 0.f)
        SendAction("Kill");
    Info.PreviousHealth = Health;
}
```
