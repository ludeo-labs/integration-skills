# Writing Learnings Without Leaking Client Code

This skill accumulates learnings from real integrations. Those integrations are
for **clients** — third-party studios whose C# source, namespaces, class names,
scene/prefab layout, and internal architecture are **their proprietary IP**. A
learning is read on *future* integrations for *other* clients (and, in time,
served from a shared vector database). **Anything client-specific that survives
into a learning is a leak of one client's code to every other client.**

The rule below is **client-agnostic on purpose.** It is not a denylist of one
studio's symbols — those are worthless the moment a second client arrives. It
is a discipline you apply to *every* learning regardless of which game it came
from.

---

## The principle: pattern, not payload

> **A learning captures the transferable pattern. It never reproduces the
> client's payload.**

The value of a learning is the *mechanism* — "defer the health write one frame
with a coroutine because the character controller re-initializes stats in its
own `Start()`." That sentence transfers to any Unity game and exposes nothing.
The leak is everything *around* the mechanism: the client's real namespace and
class names, verbatim method bodies, `File.cs:line` references, commit hashes,
`.asmdef` names, scene/prefab/asset names, and the studio/title name. None of
that teaches anything the neutral version doesn't.

Sanitize **as you write.** A learning is never "cleaned up later" — by then it
is already in the corpus.

**The test for every learning, before you save it:**

> *Could a reader name the client studio or game from this file, or copy-paste
> anything that belongs to them?* If yes → it is not sanitized. Fix it.

---

## What to strip — three tiers

| Tier | Element | Why it leaks | Action |
|---|---|---|---|
| **1 — Attribution** (zero transfer value) | Studio / game / title names; the client's root **namespace** (e.g. `StudioName.Game.*`); `.asmdef` / assembly names that carry the title; client class **prefixes** (a 2–4 letter `XxxManager` convention); `File.cs:line` for *game* source; commit hashes; branch names; internal tool / package names; scene, prefab, `GameObject`, and asset names that identify the title | Directly names the client or their content | **Delete**, or replace with a neutral role descriptor. |
| **2 — Payload** (the real leak) | Verbatim client method bodies; `[Serializable]` field layouts; serialized-field / inspector lists; enum-value sets; private-member inventories of a client class | Is literally the client's source, copyable as-is | **Rewrite as a minimal synthetic illustration** using neutral role-based names — show the *shape*, not their source. |
| **3 — Keep** (not proprietary; IS the lesson) | Ludeo SDK symbols (`LudeoSDK`, `ILudeoStateHandler`, `SetAttribute` / `GetAttribute`, `SendAction`, `LudeoController` / `LudeoFlowSwitch` / `LudeoGameplaySessionManager`, room/session lifecycle…); stock Unity API (`MonoBehaviour`, `Awake` / `OnEnable` / `Start` / `Update` / `FixedUpdate`, `GameObject`, `Transform`, `Vector3`, `Quaternion`, `ScriptableObject`, `Coroutine`, `SceneManager`…) | Public API shared by everyone | **Leave verbatim** — this is what the learning teaches. |

Source coordinates and commit hashes have **no transfer value** even when they
are not strictly secret — they only point back at one client's repo. Strip them
always. (References into the **Ludeo SDK's own** source — `Ludeo*.cs:NN` — are
acceptable, because the SDK is the shared surface every integration uses.)

---

## Neutral naming convention

When you replace a client identifier, **encode the _role_ and drop the client
signature.** The role is what makes a pattern transfer; the signature is the
leak.

| Don't write | Write |
|---|---|
| `AcmeHealthComponent` (a client MonoBehaviour) | `HealthComponent` |
| `Acme.Game.Combat.WeaponController` (client namespace) | `WeaponController` (drop the namespace) |
| `enum AcmeMatchPhase { ... }` | `enum MatchPhase { Warmup, Playing, Ended }` |
| `AcmeGame.asmdef` | *(delete — cite no assembly name)* |
| `PlayerController.cs:412` | *(delete — cite no file/line)* |
| commit `a10dc11` | *(delete — "a later commit")* |
| the studio name, the game's title, an iconic mode/mechanic/enemy name | "the game", "the game team", "the mission", "a level", a generic role descriptor |

If a learning genuinely generalizes across several real classes, say so by
**archetype**, not by name: *"validated across three trackable archetypes — a
pooled projectile, a pickup, and a destructible prop"* instead of listing the
client's three class names.

**Watch the giveaways that aren't class names.** Proper nouns and iconic mechanic
names identify a title even without a namespace — an enemy archetype's nickname,
a signature mode/phase name, a recognizable objective verb. Map these to neutral
role descriptors (`heavy enemy` → `PawnType_Heavy`; a signature mode → `MatchState`
/ `WavePhase`; a signature objective verb → a generic `DeviceActivated` /
`AreaCleared`). If a term would let a fan name the game, neutralize it.

---

## Concrete before/after

The example below uses an obviously-fictional placeholder prefix (`Acme`). Real
learnings come from real clients — never reproduce a real prefix even as a "bad
example"; a real symbol in the "before" block leaks just as surely as one in a
learning.

**Before — leaks the client (do not do this):**

```csharp
// Acme-team-authored respawn hook — re-applies loadout in Start()
namespace Acme.Game.Player {
    public class AcmePlayerCharacter : MonoBehaviour {
        void Start() { LoadoutManager.ApplyDefault(this); }
    }
}
```
> Findings spanned `AcmePlayerCharacter`, `AcmeEnemyDrone`, `AcmeTurret` …

**After — same lesson, no leak:**

```csharp
// Game-authored respawn hook — re-applies loadout in Start()
public class PlayerCharacter : MonoBehaviour {
    void Start() { /* game re-applies default loadout here */ }
}
```
> Validated across three spawn archetypes: a player character (loadout re-applied
> in `Start`, so restore must run one frame later), a pooled enemy (reused
> instance — restore must reset, not assume fresh), and a static turret (trivial).

The reader still learns the mechanism, the ordering rule, and the pooled-instance
caveat — and cannot tell which game it came from.

---

## Frontmatter

- `sourceGame:` — **must be an abstract codename from the allowlist** in
  `config/learning-policy.json` (e.g. `FPSSample`, `PlatformerSample`, or a
  codename added for the current engagement). A real studio or title name in this
  field is itself a leak and fails validation. New clients get a new codename
  added to the allowlist at the start of the engagement.
- `sanitized: true` — your explicit attestation that you ran the checklist
  below. Learnings without it are treated as unreviewed.

---

## Pre-save checklist

Run this on **every** learning before writing it:

- [ ] No studio / game / title names, anywhere (body, comments, prose, logs).
- [ ] No client root namespace, no `.asmdef` / assembly name, no client class prefix — neutral role-based names only.
- [ ] No `game-source.cs:line`, no commit hashes, no branch names.
- [ ] No scene / prefab / `GameObject` / asset names that identify the title.
- [ ] No internal tool / package / pipeline names.
- [ ] No iconic mode / mechanic / enemy proper nouns that identify the title.
- [ ] No verbatim client method body, serialized-field layout, enum-value set, or private-member list — synthetic illustration only.
- [ ] Ludeo SDK + stock Unity identifiers kept as-is (these are the lesson).
- [ ] `sourceGame:` is an allowlisted codename; body matches it (nothing real bleeds through).
- [ ] `sanitized: true` set.
- [ ] **The test:** a reader cannot name the client, and cannot copy anything that's theirs.

---

## Keep public-sample names as-is

Asset / class names from **public, open-source or sample** Unity games (Unity's
own sample projects, published GitHub templates) are **not** client IP and must
be **left unchanged** — renaming them loses real, citable reference points. When
in doubt whether a name is a public sample or a client symbol, treat it as a
client symbol and neutralize it.

---

## Corpus consistency (maintainers)

The same client class must map to the **same** neutral name in every learning, or
the corpus stops agreeing with itself. The fixed client→neutral mapping for the
existing corpus is a **maintainer-only** reference and is deliberately **not
shipped in this repo** (it would itself be a catalog of client symbols). It lives
in the untracked maintainer notes (`skills/ludeo-unreal/.dev/`, shared with the
Unreal skill — a client is a client regardless of engine). When sanitizing a new
engagement, add its mapping there — never to this published file.
