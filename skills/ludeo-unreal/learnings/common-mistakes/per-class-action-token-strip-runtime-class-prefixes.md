---
category: common-mistakes
tier: generalizable
sourceGame: TacticsGame
phase: 6
question: "Are you deriving a per-class action name token (e.g. Destroy<UnitClass>, Kill<EnemyType>) from a class path? Derive it from the ACTUAL runtime class name and account for ALL wrapper/family prefixes (BP_, a project 'BP_PX_'-style wrapper, a 2-letter family code), not the short name you saw in the asset browser — and log the derived token on the first few events to confirm it matches your allowlist."
sanitized: true
---

# Per-class action tokens: derive from the runtime class name and strip every wrapper prefix

## Precondition

You emit an additive per-class action alongside a broad one (e.g. `DestroyEnemyUnit` plus a named
`Destroy<Class>` for an allowlisted set of classes — see
`architecture/additive-action-emission-for-composable-goals.md`). Because `SendAction` carries
only PlayerID + ActionName (no attribution data), the class can only live in the action name, so
you derive a token from the entity's class path and gate it on an allowlist.

## The mistake

The token derivation was written against the **short name seen in the asset browser / level
inspector** (e.g. `Family_ShipName_Puppet`). But the real runtime class carries a **project
wrapper prefix** the browser view hides — the actual generated class was
`BP_<Wrapper>_<Family>_ShipName_Puppet_C`. The derivation stripped a 2-letter family prefix and
the `_Puppet`/`_C` suffixes but **not** the `BP_<Wrapper>_` prefix, so it produced
`<Wrapper>_<Family>_ShipName` instead of `ShipName`. That never matched the allowlist, so the
broad action fired but the named bucket silently never did. Builds were green; only a runtime log
of the derived token exposed it.

## The fix

- Derive the token from the **actual runtime class** (`Actor->GetClass()->GetPathName()` — for a
  visual/puppet entity, resolve the puppet first and use ITS class), not an asset name you typed.
- Strip **every** layer, outermost first: the `BP_` / project wrapper prefix
  (`Token.RemoveFromStart(...)`), then the short family code, then the `_Puppet`/`_C` suffixes.
- **Log the derived token + allowlist-match on the first few events** (`token='ShipName' named=1`)
  and confirm against a real run before trusting it. The mismatch is invisible without this —
  the broad action keeps working and hides the gap.
- Keep the allowlist config-driven (an ini key), and seed its default with the tokens your
  derivation actually produces for the curated slice's classes — not the names you assume.

## General lesson

Class-path-derived strings (action tokens, ObjectTypes, identity keys) must be validated against
the **runtime** class name. Project naming conventions wrap generated classes in prefixes that
don't appear in the editor's friendly name; a derivation tuned to the friendly name silently
produces wrong tokens. One runtime log line per derivation during bring-up catches it; static
reasoning does not.

## Cross-reference

- `architecture/additive-action-emission-for-composable-goals.md` — the broad + named-bucket
  pattern this token feeds.
- `common-mistakes/objecttype-must-be-class-path.md` — related class-path-as-identity concern.
