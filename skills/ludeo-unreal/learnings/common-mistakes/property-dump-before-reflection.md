---
category: common-mistakes
tier: universal
sourceGame: VoyagerV2
phase: 4
question: null
sanitized: true
---

Always add a diagnostic property dump when first integrating with a Blueprint-only game. Don't guess property names — dump all properties on gameplay components (HealthComp, WeaponComp, etc.) on first entity registration and read the log.

Common surprises found in VoyagerV2:
- Health property name: "Health" (correct, but type is double not float)
- Energy property name: "EnergyValue" (NOT "Energy")
- Weapon is on "InventoryComp" (NOT "WeaponComp") as "EquippedWeapon" (NOT "CurrentWeapon")
- WeaponComp has "IsFiringPressed", "IsAiming", "IsSwitchingWeapons" (useful for actions)
- HealthComp has "IsAlive" (bool) — more reliable than checking Health > 0

**Pattern:** Use TFieldIterator<FProperty> on each component class, log name + CPPType. Filter to gameplay-relevant components by name substring.
