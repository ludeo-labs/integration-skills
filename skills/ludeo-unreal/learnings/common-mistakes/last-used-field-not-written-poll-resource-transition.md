---
category: common-mistakes
tier: generalizable
sourceGame: TacticsGame
phase: 6
question: "Are you about to detect an 'ability/item/weapon used' action by polling a 'LastUsedX' / 'CurrentX' convenience field for a change? STOP and verify that field is actually WRITTEN on the use path (BP graph: look for a Set node). It often isn't. The reliable signal is the consumable-resource transition the use causes — a charge consumed (count drops) or a cooldown started (timer rises)."
sanitized: true
---

# A "LastUsedX" field is often not written on the use path — poll the resource transition instead

## The trap

To detect an "ability used" (or item used / weapon fired) action, the obvious move is to poll a
conveniently-named field like `LastUsedAbility` (a `TSubclassOf`/class ref) and fire when it
changes. On one turn-based game this **never fired** even though the player clearly used an
ability — because **nothing on the ability-activation path writes that field.** It was vestigial.

## How it was diagnosed (do this before trusting any "last used" field)

1. Runtime: used the ability, the action never fired → not "no ability used", a detection miss.
2. Asset scan: the field name appeared in **only** the ability-system component asset (so any
   write is in its own graphs — narrow the search).
3. BP call-graph (`graph-function`) of the activation chain: the activator just delegated to an
   evaluate/assess function and ultimately to the player-controller interface's `ActivateAbility`
   — and **none of those functions contained a `Set LastUsedAbility` node** (the inspector's
   `graph-function` *does* list variable-Set nodes, e.g. `Set AbilityCounter`, so their absence
   is real, not a tooling gap). Conclusion: the field is not written on use.

A leaf field whose name *sounds* like the signal you want is not the signal until a `Set` node
proves it. Field names lie.

## The reliable signal: the resource transition the use causes

Using an ability/item almost always mutates a **consumable resource** that the HUD reads — a
charge count, a cooldown timer, an ammo count. Those arrays are real, live, and (in a Ludeo
integration) usually already captured/restored for state. Detect the use from their transition:

```cpp
// per tracked unit, compared against the previous poll's arrays:
bool bUsed = false;
for (i) if (Charges[i]   < PrevCharges[i])   { bUsed = true; break; }   // a charge consumed
if (!bUsed)
  for (i) if (Cooldowns[i] > PrevCooldowns[i]) { bUsed = true; break; } // a cooldown STARTED
PrevCharges = Charges; PrevCooldowns = Cooldowns;
if (bUsed) ReportAction(TEXT("AbilityUsed"));
```

**The discriminator that matters:** a per-turn "reduce all cooldowns" step *lowers* cooldowns
every turn, so test for a cooldown **increase** (just put on cooldown), not any change. Charges
typically only drop on use (they refill by increasing), so a charge **decrease** = a use.

## How to apply

- Before polling any `Last*`/`Current*` convenience field for an event, confirm with the BP
  graph that the use path writes it. If it doesn't, switch to the resource transition.
- Track the previous-poll resource arrays per entity; baseline them at registry build so the
  first poll doesn't fire spuriously.
- This runs in both Creator and Player Flow (actions must fire on replay).

## Cross-reference

- `common-mistakes/ondestroyed-not-for-bp-death.md` — same "poll a real state transition, not a
  convenient-looking signal" theme, for kills.
- `common-mistakes/verify-capture-source-actually-varies.md` — verify a field actually changes
  with the gameplay it represents before trusting it.
