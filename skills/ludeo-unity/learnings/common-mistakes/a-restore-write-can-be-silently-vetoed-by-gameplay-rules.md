---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Are you restoring a stat (health, resource, timer) by assigning through the same setter gameplay uses? Check that setter for interceptor hooks - damage gates, invulnerability windows, clamps, die-state guards. Any of them can silently drop your write, and your own checks will not notice if they read the same mirror they wrote."
sanitized: true
---

# A restore write can be silently vetoed by gameplay rules

Stat systems commonly route writes through validation hooks: a `CheckUpdate`-style callback that
can veto the change, installed by buffs like spawn-protection invulnerability, die-state guards,
or clamping rules. Those rules are correct for gameplay — and wrong for restoration, which is not
gameplay: it is the authoritative re-statement of recorded fact.

In this integration, every wounded enemy was restored at full health for a whole day of testing.
The write executed, threw nothing, and did nothing: the spawn-protection buff's veto rejects any
health-LOWERING write while its condition holds, and at restore time it still held. Seventeen
enemies across two replays, all silently full.

## How it hides

Two ways at once:

- The veto is silent by design — a rejected write is not an error, it is the rules working.
- If your restore-verification reads back the same field it wrote (a mirror, a cached copy),
  it compares the write to itself and stays green. Only a checkpoint that reads the LIVE value
  the game actually plays with can catch it (see the make-the-restore-verify learning).

## The fix shape

Find the stat API's authoritative write — most systems have one precisely because gameplay rules
must sometimes be bypassed (`SetValueWithoutCheck`, `ForceSet`, direct instance assignment) — and
use it for every restored value. If none exists, remove the interceptor for the write and restore
it after.

Corollary discovered the same day: a deferred client-side init can recompute a derived value FROM
the stat you just wrote (`maxHealth = Health.value` on the host's next tick), turning the restored
current value into the maximum. Restored stat writes should be re-asserted once, after the
engine's deferred init window has passed (end of the settle is a natural point).
