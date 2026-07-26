---
category: common-mistakes
tier: universal
sourceGame: TacticsGame
phase: 5
question: null
sanitized: true
---

# Probe readable objects with an INT discriminator attribute before any FString read

## The problem this solves

`FLudeoReadableObject::ReadData(FString&)` **hard-asserts** when the attribute is
missing (see [[sdk-readdata-asserts-on-missing-attribute]]), and `ExistAttribute`
pre-checks are unsafe inside an Enter scope (see
[[sdk-data-reader-current-handle-is-process-global]]). So a Player Flow reader that
starts with string reads will CRASH on any foreign Ludeo (another game/integration),
any pre-integration capture, or any old-schema capture — exactly the inputs a
validate-first selection handler must reject gracefully.

## The pattern

Primitive-type reads (`int32`, `bool`, `float`...) return `false` gracefully on
missing attributes. Exploit the asymmetry:

1. Write an **int `ObjKind` attribute on every writable object** (0=meta, 1=entity,
   2=camera, ...), and an **int `SchemaVersion`** on the metadata object.
2. On the read side, inside the Enter scope, read `ObjKind` FIRST:
   - read returns `false` → not our object → skip it (foreign Ludeo objects become
     a no-op instead of a crash);
   - `ObjKind` known → the object was written by this integration, which always
     writes its full attribute schema → the FString reads that follow are safe.
3. Read `SchemaVersion` (int, also tolerant) before anything else on the metadata
   object; mismatch → reject the whole Ludeo gracefully ("re-record required").
4. If NO object yields a metadata kind → reject: foreign or pre-integration Ludeo.

Combined with validate-before-disturb (see
[[validate-ludeo-selection-before-disturbing-session]]), a bad selection ends as a
logged no-op with the live session untouched — never an assert.

## Rule of thumb

Every object kind gets exactly one int discriminator; every string attribute is only
read after the discriminator identified the object as schema-complete. The
discriminator costs 4 bytes per object per write and removes the entire
foreign-input crash class.

## Extension: backward compatibility = version-GATED reads, in two passes

When the schema grows (new attributes), old captures don't have to be rejected:
maintain `MinSupportedSchemaVersion` and gate every newer attribute's read on the
capture's version (`if (SchemaVersion >= N) ReadData(NewAttr...)`) — never probe with
`ExistAttribute` (unsafe inside an Enter scope). Two requirements (TacticsGame):

1. **Read the metadata object in its own FIRST pass.** The SDK's object collection
   does NOT guarantee the metadata object comes first; reading a data object's
   versioned string attributes before knowing the capture's version re-opens the
   assert. Pass 1: find meta, validate version range; pass 2: everything else,
   version-gated.
2. **Gate the restore side too.** A v(N-1) capture leaves vN fields at C++ defaults —
   APPLYING those defaults clobbers correct fresh-load values (e.g. writing armor=0
   onto every unit). Skip both the read AND the apply for attributes newer than the
   capture.
3. Min-version is a SEMANTIC line, not just structural: TacticsGame kept v3+ playable
   but rejected v1/v2 because their Transform attribute had semantically wrong data
   (the never-moving logic-actor constant) — playing them would faithfully restore
   garbage.
