---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 4,5
question: "Does the game have — or once have — a multiplayer late-join / host-migration path, even a dead or out-of-scope one? Read it twice: its state packet is the best inventory of what a live run consists of (phase 4 census), and its apply method is the best reference for restore write order (phase 5). Never plan to CALL it — walk its call graph in the mode you ship first; such paths are very often reachable only from the networking branch, or sit behind a commented-out call."
sanitized: true
---

# Late-join code is a census checklist and ordering prior art — never a callable path

Netcode that catches a player up to a match in progress has to solve the Ludeo problem: move a
**running** match to another machine, mid-fight. That makes it the most valuable thing to read in a
game that has, or once had, multiplayer — twice over, for two different phases — and the most
dangerous thing to plan to call.

## Read 1 (phase 4): the state packet is the best run inventory

The object census has to enumerate every kind of state a live run consists of. The standard discovery
input is the save system (`06 §2.5`). A save is built to **reload a run between sessions**: it routinely
omits transient and visual state a viewer notices, and it includes meta/settings state a moment must
not carry. A late-join / host-migration packet is built to transfer a run **mid-fight**, which is almost
exactly what a moment needs. The one observed enumerated, in a single method, 24 categories — spawned
actors and prefab variants, quest and challenge state, trigger states, weather, animator states,
cutscene and dialogue progress, visual-effect state, and more.

Working that list out from scratch, by reading gameplay code, is the slowest and least reliable part of
a census. Here it was one method, written by people who know the codebase, and validated by shipping.

To find it, grep for the multiplayer manager's late-join/host-migration entry points, and for a method
that *collects* rather than *serializes* — names of the shape `CollectGameState`, `BuildStatePacket`,
`GatherWorldState`, `GetFullState`. The value is in the list of sub-calls, one per category.

**Check who still calls it** before drawing any conclusion about the save from it. In the case observed
the packet was reachable only from the network late-join path; the single-player save's call into it
had been commented out — so the same read that gave the census its best input also revealed that the
save no longer captured a run at all ([[an-iserializable-implementation-is-not-proof-the-save-writes-it]]).

The generalization: **anywhere the game already has to move a live run somewhere else** — late join,
host migration, a spectator handoff, a mid-session cloud save, a QA repro tool — someone has already
enumerated what a live run is. Find that enumeration before writing your own. See also
[[find-the-studio-s-own-repro-tooling-first]]: the repro tool reproduces the *world*, the state packet
enumerates the *entities*.

## Read 2 (phase 5): the apply path is ordering prior art

While scoping a restore you will go looking for prior art: somewhere in this game, does anything
already take a bundle of saved values and push them into an entity that is **already alive**? That is
exactly the operation a Ludeo restore performs, and finding it feels like a large win — a validated
field list, a validated write order, and the game's own answer to every "which setter actually owns
this value" question.

You will often find one. It will usually be **the netcode's late-join path**: the code that catches a
player joining a match in progress and has to bring their entity up to the state everyone else is
already in. That is the same shape as a restore, which is why it is the best ordering reference in the
codebase.

**It is also usually unreachable in the mode you are shipping.** In one integration the discovered
path was a personal-loadout record with a well-written apply method covering skills, attributes,
inventory and cooldowns — recorded in the plan as "an existing, working mid-run restore path". The call
graph said otherwise:

- the manager-level loader's only call site was **commented out**;
- a single-player-specific loader existed with a plausible name, correct body, and **zero callers
  anywhere**;
- the **writer** half's only call site was also commented out — so nothing ever produced the record it
  consumed;
- the one live caller of the apply method was the **late-join handler**, in a networking mode that was
  explicitly out of scope for the integration.

In single-player the loadout was instead built fresh by a chain of initialize/set-default/auto-assign
calls — a completely different path with a different order.

## Why this keeps happening

Multiplayer support tends to arrive after single-player, needs mid-run state transfer that
single-player never needs, and then gets descoped, disabled or shipped for a mode most players do not
touch. The code stays: complete, correct, compiling, and dead. Nothing warns you, because there is
nothing wrong with it.

Notice this is the **same failure as a commented-out top-level save body, or an interface implemented
on every gameplay class that nothing ever registers.** All three are one mistake: *an implementation
being present, correct and complete says nothing about whether it runs.* If a codebase has sprung this
trap once, assume it will spring again — and check the call graph of the next piece of prior art
**before** it reaches a plan document.

## How to check, in the order that costs least

1. **Grep the call sites of the entry point, not the method you admire.** Walk out one level at a time
   until you reach something a real single-player run demonstrably executes.
2. **Read every hit, do not just count them.** A commented-out call still matches a plain text search,
   and a method with a plausible single-player name proves nothing about whether anyone calls it.
3. **Check the writer, not only the reader.** An apply path that consumes a record nothing ever
   produces is dead even if the apply itself is invoked.
4. **Ask which mode the live caller belongs to.** If it is a late-join, host-migration, spectator or
   replay handler and that mode is out of scope, the path is unreachable for you.
5. **Then find the real path.** Whatever single-player *does* run instead is what your restore must
   agree with — and it will often use different setters in a different order.

## What survives, and what does not

**Keep it as a reading list.** The apply order is the genuine prize: which values must land before
which, and which setter owns each value. Read it closely and mirror the order.

**Do not plan to call it, and do not record it as validated behaviour.** Write to the owning
primitives directly, and — because you are now the first caller of an ordering nobody has executed in
this mode — verify each value after writing it rather than trusting the sequence.

Also worth stating plainly in the plan document: prior art that has never run is **not** de-risking.
Recording it as such produces a plan that reads as well-supported while resting on nothing, which is
worse than recording no prior art at all.
