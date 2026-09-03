---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: 4
question: "Does the game implement any pickup (potions, charges, consumables) as a count incremented on an object the player permanently owns, rather than as an inventory entry or a world object that transfers ownership?"
sanitized: true
---

# A consumable can be a count on a permanent object, not an inventory entry

The census missed the player's health potions entirely, and the miss survived a full wave
of restore verification. Reason: there was no inventory list to enumerate and no pickup
object that joined the player. The player **permanently owns** one instance of each
consumable as a child object; "picking up a potion" merely increments a synced `count`
field on that instance. Every census lens that looks for *collections* (inventories,
item lists, attachment points) or *ownership transfer* (world pickup → player) sees
nothing, because nothing is added or transferred - one integer changes.

The report that exposed it was "I picked up a health potion and it was not in the
restored moment" - which was then misdiagnosed (twice, across sessions) as a healing
mechanic bug, because the analyst pattern-matched "potion doesn't restore health" to the
heal path instead of asking what kind of thing a potion IS in this game. Establish the
mechanic first: is the reported thing an object, an entry, or a counter?

## The rule

When censusing player state, explicitly hunt the counter-shaped inventory: grep the
pickup/grant paths (`count++`, `Increase*Slot`, ammo-style increments) and capture those
counts as attributes. They are cheap (one int each), invisible to collection-shaped
sweeps, and their absence is exactly the kind of thing only a human replaying their own
moment notices.
