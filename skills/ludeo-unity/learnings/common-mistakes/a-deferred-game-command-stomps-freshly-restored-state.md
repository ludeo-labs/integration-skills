---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does your restore trigger any game flow through a networked command or async request (equip a weapon, change class, apply appearance)? Read what that flow does when it RESOLVES - if it resets or re-derives state you also restore (ammo, slots, buffs), your restore writes are stomped a tick later, and only for creators whose values differed from the defaults."
sanitized: true
---

# A deferred game command stomps freshly-restored state

Networked games route player-facing operations through commands that resolve on a later tick, and
those operations often end by resetting dependent state to defaults — an equip flow that resets
ammo slots, a class change that clears buffs. When a restore calls such a flow and then
synchronously writes the dependent state, the resolution lands afterwards and quietly puts the
defaults back.

Here: the restore requested the gun equip (a Mirror `[Command]`), then wrote the recorded ammo
slots. The equip resolved a tick later and its last line is `ResetAmmo()`. The restored slot read
back as the default.

## Why it evades testing

The stomp restores DEFAULTS — so any test whose creator ran a default loadout passes perfectly.
It only bites when the recording differs from the defaults, which is exactly the case that
matters. One of two otherwise-identical test moments failed for this reason while the other was
green.

## The fix shape

Do not race the resolution — outlast it. Stash the parsed values and re-apply them from a
per-tick pass once the deferred operation has PROVABLY landed. Find a state change that the
resolution itself performs and use it as the landed-signal: here, the equip assigns a new weapon
instance in the same call that resets the slots, so "the instance changed" proves the reset is
behind you. A timer is not a landed-signal.
