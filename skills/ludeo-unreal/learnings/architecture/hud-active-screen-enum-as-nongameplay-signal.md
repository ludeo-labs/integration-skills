---
category: architecture
tier: generalizable
sourceGame: EndlessFPS
phase: 3
question: "Does the game's HUD (or a UI manager) track a single 'active screen' / UI-state enum — one value per full-screen overlay, with a resting/gameplay value? If so, that one enum is a uniform non-ludeoable signal covering inventory + pause menu + dialogs + examine screens together, instead of a separate flag per overlay."
sanitized: true
---

# A HUD "active screen" enum is a uniform non-ludeoable signal for all UI overlays

## Precondition

The game routes its full-screen UI through a single state variable on the HUD (or a UI manager) — an enum/byte like `CurrentActiveScreen` whose resting value is "gameplay/none" and whose other values each name an overlay (inventory, in-game menu, document, examine, puzzle, save/load…). Verify the resting/gameplay index (it is almost always the enum's default value, i.e. 0).

## Why it matters

Stage 5 must mark non-gameplay UI segments (`StartNoneLudeable`/`StopNoneLudeable`, or `PauseLudeo`/`ResumeLudeo` in Player Flow). When the integrator asks to cover several overlays (e.g. "the pause menu **and** the inventory screen"), hunting for a separate boolean per overlay is fragile — each lives on a different widget BP, and you may not know all of them.

If the HUD already collapses "which full-screen UI is up" into one enum, that single value is a complete, uniform signal: **non-default = some non-gameplay screen is open**. It covers every overlay the HUD knows about in one read, including ones you didn't enumerate.

## How to apply

Read it off the local HUD via reflection (BP-only projects expose it as a `byte<...Enum>` property; `GetInt` returns the index):

```cpp
if (APlayerController* PC = World->GetFirstPlayerController())
{
    if (AHUD* HUD = PC->GetHUD())
    {
        int32 ActiveScreen = 0;
        if (LudeoReflect::GetInt(HUD, TEXT("CurrentActiveScreen"), ActiveScreen) && ActiveScreen != 0)
        {
            return true; // an overlay is up → non-ludeoable segment
        }
    }
}
```

OR this with the engine-pause and custom-pause checks for a complete `IsInNonGameplaySegment()`.

## Caveats

- **Confirm the gameplay index.** This assumes the resting value is 0. Verify against the enum default (BP inspection shows the property default, e.g. `NewEnumerator0`) and confirm at runtime that opening an overlay actually fires `StartNoneLudeable`. If the resting state isn't 0, compare against the discovered gameplay enumerator instead.
- **Possibly broader than asked.** A non-zero value also catches document/examine/puzzle screens, not just the inventory+menu the integrator named. For a combat-only curated slice those don't occur, so it's harmless — but if a screen must stay ludeoable, exclude its specific enumerator.
- Discover the enum + its values via BP inspection (`inspect-path` on the HUD Blueprint reports the property, type, and default).

## Related

- `custom-pause-via-timedilation-not-engine-pause.md` — the pause half of the same `IsInNonGameplaySegment()`.
- `menu-overlay-detection-for-nonludeable.md` — the CommonUI `UPrimaryGameLayout` layer-polling variant (different UI architecture, same goal).
