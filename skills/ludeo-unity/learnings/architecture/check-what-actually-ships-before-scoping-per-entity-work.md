---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: 4
question: "Before scoping per-entity work (bosses, level types, mechanics), open Build Settings and list which of those scenes are actually ENABLED. The shippable set is often a fraction of what the repo contains, and it decides what you can verify."
sanitized: true
---

# Scope against the scenes that actually ship, not the ones in the repo

A boss wave was planned across the three boss classes in the repo. Reading Build Settings first
would have changed the plan, because only **one** boss scene was enabled: of the other two, every
variant scene was disabled and one had no scene in Build Settings at all.

That single fact reorders the work:

- the only **testable** boss was the hardest one — no phase field at all, ten coroutines, so its
  fight progress had to be inferred from an observable proxy;
- the boss with a clean phase index and no coroutines — the nearly-free case — **could not be
  verified at all**, so wiring it would have meant shipping unverified code. It was deliberately left
  unwired, on the grounds that shipping-unverified is how the previous wave's bugs got in;
- a third boss was never read.

The same check pays off outside boss work. On the same integration, level order is derived from
Build Settings, and the shipped build contained **five** levels of the game's full set — so a
question about "level 2" was really a question about one of five reachable scenes, and two of the
bosses could not be reached by playing at all.

## The check, and what to do with it

```
grep -E "path:|enabled:" ProjectSettings/EditorBuildSettings.asset | paste - - | grep "enabled: 1"
```

Then in the census, mark each entity with **reachable / not reachable in this build**, and:

- put reachable-and-load-bearing first;
- for anything unreachable, either get a scene enabled for testing or write it down as *unwired
  because unverifiable* — a plan that silently includes unverifiable work reads as coverage it does
  not have;
- remember the variant trap: a folder may hold both a normal and an easier/alternate scene, and only
  one is enabled. The one you open in the Editor is not necessarily the one the player plays.

Related: [[a-scenes-yaml-does-not-list-what-its-prefabs-contain]] — the other half of "what is
actually in this level", and the same lesson about checking rather than assuming.
