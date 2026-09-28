---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "4,5"
question: "Do several gameplay elements (attack slots, hit zones, limbs) share one visual object, so that hiding the visual takes all of them out of play?"
sanitized: true
---

# When several logic elements share one visual, the visual carries part of the state

A multi-limb boss attacks in phases. In the second phase, 11 attack elements drive 8 visible limbs: several elements
share one limb model. Destroying an element hides its limb, and the phase's attack picker only chooses elements whose
limb is shown, so the siblings sharing that limb are out too. (The designers' inspector note said so; the code only
shows it through the picker's `visual.activeSelf` test.)

The restore recorded, per element, "resolved" and "limb shown". It resolved the destroyed elements and then, for
the current phase, showed every hidden limb again, on the theory that a hidden limb meant an attack in progress (a
swiping limb hides its model while its element acts). With 4 elements destroyed, most limbs were hidden by
destruction, not by an attack, and they all came back: the viewer faced the full set instead of the one limb the
creator had left.

## Fix

Decide per **visual**, not per element: a visual with any resolved element stays hidden; only a visual hidden while
none of its elements is resolved (an attack in progress) is shown again for the restarted phase. Capture both masks
so either rule can be applied, and add a check that flags "a destroyed limb is shown again".

## Generalization

Before restoring "which parts are gone", find out what the game itself reads to decide that a part is gone. When
that is a shared object's visibility rather than each element's state, the shared object is part of the state.
