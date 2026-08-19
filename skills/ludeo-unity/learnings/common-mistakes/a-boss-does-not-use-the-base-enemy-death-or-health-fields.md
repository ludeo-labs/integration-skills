---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "5,6"
question: "Does a boss inherit the base enemy class? Then check whether it actually uses the base class's death method and health field — bosses commonly count their own lives and route their defeat through their own method, so a hook or a getter on the base class silently never applies to them."
sanitized: true
---

# A boss inherits the enemy class but uses none of its death path or its health field

The boss class extended the ordinary enemy class, so the enemy work was assumed to cover it. Two
separate bugs came from that assumption, and each was reported as its own mystery.

**1. The kill action never fired.** The `EnemyKill`/`BossKill` hook sat in the base enemy's
`DieForGood()`, dispatching on `this is Boss`. No boss ever reaches that method: each boss
decrements its **own** `remainingLives` field in its own hit handler and calls a shared
`Defeated(Player)` on the boss base class, which goes straight to the level's end-goal object. The
base class's death method — and therefore the hook, and therefore the branch — was dead code for
every boss in the game.

**2. The boss captured and restored at full health.** The state writer read the base class's
`RemainingLives()` accessor, which returns the base `livesLeft` field. Bosses never touch it, so
every boss was captured at its authored starting health regardless of how far the fight had got,
and restored the same way.

## The fixes are both one-liners in the right place

Send the action from the boss base class's shared defeat method — all bosses route through it, and
its `Player` parameter *is* the player guard, so no "was this damage from the player" flag is
needed. Send it before the end-goal call, so the kill precedes the level-complete it cascades into.

For health, make the two state accessors `virtual` on the base enemy and override them on the boss
base class to map to the boss's own field. No new state key, no change to the capture or restore
call sites:

```csharp
public override int RemainingLives()          => bossLives;
public override void SetRemainingLives(int v) => bossLives = v;
```

Check the accessors have no other callers first. Here they existed only for the integration, so
overriding them could not affect gameplay.

## Two traps found by the compile gate, not by reading

- One boss declared its **own** `private int remainingLives`, shadowing the base field (`CS0108`).
  The override would have read a field that boss never decrements. Delete the shadow.
- The dispatching `this is Boss` branch becomes unreachable once the action moves. Leaving it is
  harmless (external code can still kill a boss through the base path) but do not cite it as
  working coverage.

## The same root pattern, one layer down: overrides that never call base

The kill action for *ordinary* enemies failed the same way, and it is worth holding as the general
form. The player-attribution flag was set in the base enemy's damage method — and **twelve subclasses
override that method without calling `base`**, including the one that fills the game's first level.
The hook was structurally unable to fire for essentially any enemy the player can stomp.

The fix is to move the mark to the **caller** rather than the callee: the player's own foot-collision
component sets it immediately before the virtual dispatch, where no override can bypass it. The
base-class mark stays for the bosses, which override a *different* method and so still reach base.

Before trusting any hook on a virtual member:

```
grep -c "override .*<MemberName>"        # how many subclasses redefine it
grep -L "base\.<MemberName>" <those files>   # how many never call base
```

Then hook the one path that cannot be overridden — usually the caller.

**The general habit:** for every hook or accessor you add to a base class, count the overrides that
skip base, grep which subclasses actually reach the member, and check nothing shadows the field you
read. Inheritance is not participation. Related:
[[a-green-compile-does-not-prove-your-edit-compiled]].
