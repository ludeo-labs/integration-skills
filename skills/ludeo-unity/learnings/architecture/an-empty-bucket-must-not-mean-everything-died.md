---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: 5
question: "Does your restore treat 'absent from the bucket' as 'this entity was destroyed before the capture instant'? Then decide NOW what it does when the bucket is empty and the scene is not — without a rail, one bad capture empties the level."
sanitized: true
---

# "Absent means it was destroyed" is fail-dangerous — an empty bucket must never mean everything died

Matching restores (the scene load produces the entities, the restore matches them) need a terminal
rule: an entity that was dead at capture has no bucket entry, so **absence is the signal to remove
it**. That rule is correct, cheap, and it is what stops every collected pickup reappearing in a
replay.

It is also fail-dangerous, and it took a bad capture to show it. When a payload overflow
([[the-state-upload-is-lossy-above-a-ceiling]]) left the Enemy bucket empty, the rule concluded that
all 31 enemies had been killed and destroyed every one of them — turning a *capture* failure into a
silently empty level, reported as "restore works but I see no enemies at all".

## The rail

**Removal is only meaningful when capture demonstrably worked.** Refuse to remove anything when a
bucket is empty while the scene still holds objects of that type, and say so in the log:

```
restore: Enemy bucket empty but 31 in scene - refusing to remove (capture likely truncated)
```

An empty bucket has two possible meanings — "the player killed everything" and "the capture did not
arrive" — and they are indistinguishable from inside the restore. The safe reading of an ambiguous
signal is the one that leaves the level playable. A replay with a few too many enemies is a fidelity
bug; a replay with none is not the moment at all.

Worth stating plainly: this was a latent assumption in the original design, not a regression. It
needed a *different* bug to expose it, which is exactly the class of thing to look for when
reviewing a restore — ask of every inference the restore makes, "what does this conclude if the
data is simply missing?"

## Remove through the game's own path, never raw Destroy

The removal pass must call whatever the game calls — the pickup's own collect/despawn method, the
entity's own destroy method, a soft-destroy — because `Object.Destroy` strands pooled objects and
leaves their spawner unnotified. Related: [[write-restored-state-to-whoever-owns-it]], which is the
same principle for writes.
