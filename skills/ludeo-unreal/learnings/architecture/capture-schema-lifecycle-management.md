---
category: architecture
tier: universal
sourceGame: TacticsGame
phase: 4
question: null
sanitized: true
---

# Manage the capture schema as a versioned contract from day one

The attribute set you write IS a persistence format: captured Ludeos outlive every
code change, QA accumulates them as test assets, and the SDK hard-asserts when a
reader requests a string attribute a capture doesn't have. TacticsGame went v1→v4 in
two days of iteration; this is the management discipline that made that survivable.

## The rules

1. **Version every capture.** Write an int `SchemaVersion` on the metadata object from
   the very first build. Costs nothing; without it, compatibility handling is
   impossible later (int reads are the only ones that fail gracefully).
2. **Bump on ANY attribute-set or attribute-SEMANTICS change.** Adding/removing
   attributes is obvious; semantic changes need a bump too (TacticsGame v3 changed
   what `Transform` MEANS — puppet pose instead of a dead unit-actor constant — with
   no structural change). A reader can't distinguish "right name, wrong meaning"
   without the version.
3. **Maintain a MinSupportedSchemaVersion floor, and accept a RANGE.** Newer code
   should play older captures when the old data is semantically valid:
   - read the metadata object in its own FIRST pass (collection order is not
     guaranteed) and validate `Min <= version <= Current`;
   - gate every newer attribute's READ on the capture's version — never probe with
     ExistAttribute (unsafe in an Enter scope);
   - gate the APPLY side too: skipping a read leaves C++ defaults, and writing those
     defaults onto the game clobbers correct fresh-load values (armor=0 on every unit).
   - set the floor at the oldest *semantically correct* version, not the oldest
     structurally readable one (v1/v2 stayed rejected: their data was wrong, and
     "successfully" restoring wrong data is worse than a clean re-record message).
4. **Bundle additions; batch the re-records.** Each Current bump obsoletes QA's
   capture library for new-fidelity testing. When an investigation surfaces several
   missing attributes, ship them as ONE version bump, and tell QA explicitly which
   Ludeos need re-recording and which still replay (compat floor).
5. **Document the version history where the constant lives.** A one-line changelog
   comment per version (v2: +BattleTimeSeconds; v3: Transform = puppet pose; v4:
   +subclass combat state) is what lets the next agent reason about old captures.
6. **Reject outside the range as a logged NO-OP** (pairs with validate-before-disturb):
   the live session continues, the message says "re-record required" — never an
   assert, never a half-restore.

## Why this earns day-one effort

Every one of these rules was back-filled under pressure on TacticsGame after a
schema-less v1 made the first incompatibility a hard crash risk. The discipline is
~30 lines of code when designed in, and a debugging arc when retrofitted.
