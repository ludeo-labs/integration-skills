# Writing Learnings Without Leaking Client Code

This skill accumulates learnings from real integrations. Those integrations are
for **clients** — third-party studios whose engine source, class names, file
layout, and internal architecture are **their proprietary IP**. A learning is
read on *future* integrations for *other* clients (and, in time, served from a
shared vector database). **Anything client-specific that survives into a
learning is a leak of one client's code to every other client.**

The rule below is **client-agnostic on purpose.** It is not a denylist of one
studio's symbols — those are worthless the moment a second client arrives. It
is a discipline you apply to *every* learning regardless of which game it came
from.

---

## The principle: pattern, not payload

> **A learning captures the transferable pattern. It never reproduces the
> client's payload.**

The value of a learning is the *mechanism* — "fire `OnRep_X(OldValue)` after
`ImportText`, deferred to `HasBegunPlay()`." That sentence transfers to any UE
game and exposes nothing. The leak is everything *around* the mechanism: the
client's real class names, verbatim method bodies, `file.cpp:line` references,
commit hashes, module-API macros, asset/level names, and the studio/title name.
None of that teaches anything the neutral version doesn't.

Sanitize **as you write.** A learning is never "cleaned up later" — by then it
is already in the corpus.

**The test for every learning, before you save it:**

> *Could a reader name the client studio or game from this file, or copy-paste
> anything that belongs to them?* If yes → it is not sanitized. Fix it.

---

## What to strip — three tiers

| Tier | Element | Why it leaks | Action |
|---|---|---|---|
| **1 — Attribution** (zero transfer value) | Studio / game / title names; client class **prefixes** (e.g. a 2–4 letter `XxxClassName` convention); `<STUDIO>_API` macros; `file.cpp:line` / `file.h:line` for *game* source; commit hashes; branch names; internal tool / module names; asset, level, and Blueprint names that identify the title | Directly names the client or their content | **Delete**, or replace with a neutral role descriptor. |
| **2 — Payload** (the real leak) | Verbatim client method bodies; struct / enum field layouts; delegate-set enumerations; private-member inventories of a client class | Is literally the client's source, copyable as-is | **Rewrite as a minimal synthetic illustration** using neutral role-based names — show the *shape*, not their source. |
| **3 — Keep** (not proprietary; IS the lesson) | Ludeo SDK symbols (`FLudeoWritableObject`, `ULudeoSessionSubsystem`, `DataWriter`/`DataReader`, scoped guards…); stock Unreal Engine API (`FProperty`, `ImportText`, `OnRep_X`, `ProcessEvent`, `HasBegunPlay`, `UGameplayStatics`, GAS types…) | Public API shared by everyone | **Leave verbatim** — this is what the learning teaches. |

Source coordinates and commit hashes have **no transfer value** even when they
are not strictly secret — they only point back at one client's repo. Strip them
always. (References into the **Ludeo SDK's own** source — `LudeoXxx.cpp:NN` — are
acceptable, because the SDK is the shared surface every integration uses.)

---

## Neutral naming convention

When you replace a client identifier, **keep the Unreal type prefix
(`A`/`U`/`F`/`E`/`I`) and encode the _role_, drop the client signature.** The
role is what makes a pattern transfer; the signature is the leak.

| Don't write | Write |
|---|---|
| `A<Prefix>DisplayCase` (a client container actor) | `AContainerActor` |
| `U<Prefix>PropDamageComponent` | `UDestructibleComponent` |
| `F<Prefix>DamageEvent` | `FGameplayDamageEvent` |
| `E<Prefix>DisplayCaseState { ... }` | `EReplicatedState { Default, Active, Destroyed }` |
| `<STUDIO>_API` | `GAME_API` |
| `<ClientClass>.cpp:8333` | *(delete — cite no file/line)* |
| commit `a10dc11` | *(delete — "a later commit")* |
| the studio name, the game's title, an iconic mode/mechanic/enemy name | "the game", "the game team", "the mission", "a level", a generic role descriptor |

If a learning genuinely generalizes across several real classes, say so by
**archetype**, not by name: *"validated across three replicated-state archetypes
— a toggle actor, a multi-state container, and a door/gate actor"* instead of
listing the client's three class names.

**Watch the giveaways that aren't class names.** Proper nouns and iconic mechanic
names identify a title even without a type prefix — an enemy archetype's nickname,
a signature mode/phase enum, a recognizable objective verb. Map these to neutral
role descriptors (`heavy enemy` → `KillHeavy` / `PawnType_Special_Heavy`; a
signature mode enum → `MatchState` / `WavePhase`; a signature objective verb →
a generic `DeviceActivated` / `AreaBreached`). If a term would let a fan name the
game, neutralize it.

---

## Concrete before/after

The example below uses an obviously-fictional placeholder studio prefix (`Acme`).
Real learnings come from real clients — never reproduce a real prefix even as a
"bad example"; a real symbol in the "before" block leaks just as surely as one in
a learning.

**Before — leaks the client (do not do this):**

```cpp
// Acme-team-authored OnRep handler — drives the full cascade
void AAcmeContainerActor::OnRep_CurrentState(EAcmeContainerState OldState)
{
    SetStateInternal(OldState, CurrentState, false);
}
```
> Findings spanned `AAcmeContainerActor`, `AAcmeGateActor`, `AAcmeCameraActor` …

**After — same lesson, no leak:**

```cpp
// Game-authored OnRep handler — drives the full cascade
void AReplicatedStateActor::OnRep_CurrentState(EReplicatedState OldState)
{
    SetStateInternal(OldState, CurrentState, /*bInitial=*/false); // fires OnStateChanged → BP cascade
}
```
> Validated across three replicated-state archetypes: a toggle actor with a
> native BeginPlay handler (must be excluded from OnRep), a multi-state
> container actor (works), and a door/gate actor (functional restore, partial
> visual fidelity).

The reader still learns the mechanism, the exclusion rule, and the door caveat —
and cannot tell which game it came from.

---

## Frontmatter

- `sourceGame:` — **must be an abstract codename from the allowlist** in
  `config/learning-policy.json` (e.g. `ActionGame`, `Lyra`, `ActionRoguelike`,
  `FPSGameStarterKit`, `VoyagerV2`). A real studio or title name in this field is
  itself a leak and fails validation. New clients get a new codename added to the
  allowlist at the start of the engagement.
- `sanitized: true` — your explicit attestation that you ran the checklist
  below. Learnings without it are treated as unreviewed.

---

## Pre-save checklist

Run this on **every** learning before writing it:

- [ ] No studio / game / title names, anywhere (body, comments, prose, logs).
- [ ] No client class prefix, no `<STUDIO>_API` macro — neutral role-based names only.
- [ ] No `game-source.cpp:line` / `.h:line`, no commit hashes, no branch names.
- [ ] No asset / level / Blueprint names that identify the title.
- [ ] No internal tool / module / pipeline names.
- [ ] No iconic mode / mechanic / enemy proper nouns that identify the title.
- [ ] No verbatim client method body, struct layout, delegate set, or private-member list — synthetic illustration only.
- [ ] Ludeo SDK + stock UE identifiers kept as-is (these are the lesson).
- [ ] `sourceGame:` is an allowlisted codename; body matches it (nothing real bleeds through).
- [ ] `sanitized: true` set.
- [ ] **The test:** a reader cannot name the client, and cannot copy anything that's theirs.

---

## Keep public-sample names as-is

Asset / class names from the **public, open-source or sample** games are **not**
client IP and must be **left unchanged** — renaming them loses real, citable
reference points. This includes `Lyra*` / `ARogue*` symbols, FPSGameStarterKit's
`BP_CharacterBase` / `BP_GInstance` / `BP_GState`, and VoyagerV2's `BP_AI_Char*` /
`BP_TurretMinigunCompanion`. When in doubt whether a name is a public sample or a
client symbol, treat it as a client symbol and neutralize it.

---

## Corpus consistency (maintainers)

The same client class must map to the **same** neutral name in every learning, or
the corpus stops agreeing with itself. The fixed client→neutral mapping for the
existing corpus is a **maintainer-only** reference and is deliberately **not
shipped in this repo** (it would itself be a catalog of client symbols). It lives
in the untracked maintainer notes (`.dev/`). When sanitizing a new engagement,
add its mapping there — never to this published file.
