---
id: s04-data-round-trip
name: DataWriter values come back through DataReader on restore
suite: ludeo-verification
applies-to: [new]
build-target: Shipping (packaged build, not the editor)
---

# s04 — DataWriter values come back through DataReader on restore

Verifies the data layer: everything the game writes into a Ludeo with `DataWriter` during capture is
read back identically with `DataReader` on restore. State that isn't written is state that won't restore.

## Game-specific adaptation
- Find every `DataWriter` call in the integration and list the keys/fields the game persists.
- Find the matching `DataReader` reads on the restore path. Build the expected key → value map for the
  moment captured in s02.

## Preconditions / setup
- s02 passed (a Ludeo with written data exists) and s03 passed (restore works).
- The list of `DataWriter` keys and their captured values is recorded.

## Steps
| # | Action | Expected result |
| - | ------ | --------------- |
| 1 | Restore the s02 Ludeo (as in s03) | Game enters the captured moment |
| 2 | For each `DataWriter` key, read the value the game restored via `DataReader` | Each value equals the captured value |
| 3 | Check for keys written but not read (or read but never written) | No orphaned keys on either side |
| 4 | Watch the log during read-back | No "missing key" / "type mismatch" / default-fallback warnings |

## Pass criteria
- PASS only if **every written key reads back with the same value and type**, with no orphaned keys and
  no read warnings. Any missing key, value/type mismatch, or silent default is a FAIL.

## Evidence to capture
- The key → (written, read) comparison table.
- The SDK log covering the read-back.

## Notes
- A field that visibly matches on screen (s03) but isn't actually written/read here is a latent bug —
  it will diverge as soon as the game logic touches it. s04 catches what s03's visual check can miss.
