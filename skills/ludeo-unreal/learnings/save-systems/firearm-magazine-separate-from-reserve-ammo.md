---
category: save-systems
tier: generalizable
sourceGame: EndlessFPS
phase: 4
question: "Does the game store a firearm's loaded magazine separately from the reserve ammo held in inventory? If so, restoring reserve ammo alone leaves the gun empty — call the weapon's reload-from-reserve function after restoring reserve + wielding."
sanitized: true
---

# A firearm's loaded magazine is separate state from inventory reserve ammo

## The misconception

After restoring the player's inventory (including the ammo item's reserve `Quantity`) and re-wielding the
gun, the weapon is still **empty** — the player has to manually reload before firing. "The weapon is
restored but not loaded."

## Why

Most FPS weapon systems split ammo into two pieces of state:

- **Reserve ammo** — a count on an inventory ammo item (what you captured as the item's `Quantity`).
- **Loaded magazine** — held separately by the firearm (often read via a `GetLoadedAmmo()` accessor with
  no directly-settable backing field exposed). A freshly-wielded firearm spawns with an **empty** magazine.

Restoring the inventory restores the reserve, not the magazine. So the gun shows the right reserve count
but has nothing chambered.

## The fix

After restoring reserve ammo and wielding the weapon, call the weapon's **reload-from-reserve** function to
move ammo reserve → magazine. These are usually no-input functions that return a success bool and run
synchronously (distinct from the animated, delegate-driven player reload):

```cpp
// pseudo: fill the magazine from the (already-restored) reserve
const bool bShellByShell = WieldClass->GetName().Contains(TEXT("Shotgun")); // shotguns load one shell/call
const FName ReloadFn = bShellByShell ? TEXT("ReloadFromAmmoShotgun") : TEXT("ReloadFromAmmo");
for (int32 r = 0; r < 16; ++r) {
    if (!CallFunctionReadBool(WieldedItem, ReloadFn, TEXT("Success"))) break; // full or reserve empty
    if (!bShellByShell) break; // magazine-fed firearms fill in one call
}
```

Prefer the **synchronous** reload-from-reserve function over the animated player-reload (`CharacterReload`
with an output delegate): the animated version is timer/montage-driven and won't complete while you pause
for the room open, so the magazine loads a beat into gameplay instead of on frame 0.

## Accounting caveat

Filling the magazine from reserve leaves the reserve one magazine lower than at capture (you captured the
reserve only — the loaded rounds were separate). For exact fidelity, also capture the firearm's
`GetLoadedAmmo()` at Creator time and top the reserve up by that amount before reloading. Usually not worth
it — "gun is loaded and usable" is the goal; the small reserve discrepancy is invisible in play.

## How to apply

Stage 3 Player Flow for any game with magazine-fed weapons: after the inventory + wield restore, drive the
weapon's reload-from-reserve so the gun is loaded on the first frame. Reserve-only restore is not enough.
