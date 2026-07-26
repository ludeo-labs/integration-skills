---
category: save-systems
tier: generalizable
sourceGame: EndlessFPS
phase: 5
question: "Does the curated slice pre-populate the player's inventory at spawn, or only a basic loadout? If items picked up during play are gone on a fresh Player Flow spawn, restore must ADD them via the game's own AddItem function — not reflection-set quantities on items that don't exist."
sanitized: true
---

# Reconstruct the inventory via the game's own AddItem — don't reflection-set on items that aren't there

## Precondition

The curated slice gives the player only a **basic loadout** at spawn (e.g. a melee weapon); everything
else — guns, ammo, consumables — is acquired during play. On a fresh Player Flow spawn those acquired
items do **not** exist in the inventory.

The inventory is **event-driven** (Pattern 2 in `bp-state-machine-vs-property-driven-init`): items are
created/added through an `AddItem`-style function that fires the game's own add/equip events, slot
assignment, and HUD updates.

## The trap

Capturing each inventory item's class + quantity, then on restore reflection-writing `Quantity` onto the
matching existing item, **silently no-ops** — because the items aren't in the inventory yet. The HUD shows
the basic loadout only; the captured ammo/weapons never appear. (Reflection-set works only for state that
already exists; it cannot *create* inventory entries or fire the add-item cascade.)

## The fix

1. **Capture the FULL inventory** at Creator time, not just quantity-bearing items: for every entry in the
   inventory's item array, write `ItemClass_i` (the item-data class path), `ItemQty_i`, and `ItemSlot_i`.
   Also capture the currently-wielded item's class.

2. **Restore by calling the game's own add-item function.** Find its exact signature first (it usually
   takes a *class*, not an instance, and returns the created item):

   ```
   AddItem(ItemClass: class, Optional_GUID, OptionalSlotIndex) -> (InventoryItem, Success, ...)
   ```

   For each captured item: if an instance of that class already exists (e.g. the basic loadout the game
   added at spawn), reuse it; otherwise `AddItem(StaticLoadClass(path))` and take the returned instance.
   Then set the captured `Quantity` on it. Invoke via `ProcessEvent` with the class set on the class-typed
   param and the result read from the object out-param:

   ```cpp
   UFunction* Func = Inventory->FindFunction(TEXT("AddItem"));
   uint8* P = (uint8*)FMemory_Alloca(Func->ParmsSize); FMemory::Memzero(P, Func->ParmsSize);
   for (TFieldIterator<FProperty> It(Func); It; ++It) {
       if (It->GetFName() == TEXT("ItemClass"))
           if (FClassProperty* CP = CastField<FClassProperty>(*It))
               CP->SetObjectPropertyValue(P + CP->GetOffset_ForInternal(), ItemClass);
   }
   Inventory->ProcessEvent(Func, P);                 // creates + adds, fires the game's add cascade
   // read back the InventoryItem out-param, then reflection-set its Quantity
   ```

3. **Re-wield** the captured weapon via the inventory's wield function (single object param), after the
   items are present.

## Clean before re-add — the default loadout is not in your capture

Restoring additively on top of the spawn loadout leaves **leftover/duplicate default items**: the game
already added its basic loadout before your restore ran, and any default item that is not in the capture
(or is, at a different slot/quantity) survives alongside what you add. Before re-adding, **clear the
spawn loadout via the game's own remove-item function** (find its signature the same way as `AddItem` —
it typically takes the item instance and returns a success flag), then add the captured items each at
its captured slot and quantity. Using the game's removal keeps the HUD/equip state in sync; emptying the
backing array reflectively desyncs them.

## Why use the game's function and not NewObject

The add-item function spawns the item with the correct outer/GUID, assigns a slot, registers it in the
inventory array, and fires the events the HUD/equip logic listen for. `NewObject` + manual array push
skips all of that and leaves the inventory half-wired.

## Finding the signature

Function input/output pins aren't shown by a name-only function dump or a call-graph trace. Use a BP
introspection pass that lists each `UFunction`'s parameter pins (name + type + in/out) to get the exact
`AddItem` / wield / reload signatures before writing the `ProcessEvent` calls.

## How to apply

Stage 3 Player Flow, before assuming the inventory is restorable by setting quantities: confirm whether the
slice pre-populates the inventory. If not, capture the full inventory and re-create each item through the
game's own add-item function. See also `weapon-restore-via-manual-classpath-writes` for the weapon-class +
`ProcessEvent`-wield pattern.
