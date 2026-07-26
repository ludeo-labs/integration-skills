---
category: engine-quirks
tier: generalizable
sourceGame: TacticsGame
phase: 2
question: "Do you need to know which maps/assets a DataTable or plain-Actor BP references, and is booting the headless editor (30-60s+) overkill for the question?"
sanitized: true
---

# Raw ASCII scan of .uasset bytes answers "what does this DataTable reference?" in seconds

## Precondition

You need asset references OUT of a `.uasset` (which maps a quick-play DataTable lists,
what level list a mode uses), and the BP Inspector can't help: DataTables aren't
Blueprints, and plain-`Actor` BPs are filtered from the `inspect` report.

## The Technique

String/name references inside `.uasset` files are stored as plain ASCII in the name
table. A regex over the raw bytes extracts them without any editor boot:

```powershell
$bytes = [System.IO.File]::ReadAllBytes($uassetPath)
$text  = [System.Text.Encoding]::ASCII.GetString($bytes)
[regex]::Matches($text, "<MapNamePattern>|<AssetNamePattern>") |
  ForEach-Object Value | Sort-Object -Unique
```

Used to answer "which arena maps does the quick-play DataTable include vs the demo-mode
DataTable?" across three DataTables in one second — the demo table referenced a strict
subset of levels, which immediately told us which maps the team considers demo-ready.

## Limits

- Read-only reconnaissance: you get names/paths, not row structure or property values.
- ASCII only — FNames are stored narrow unless they contain non-ANSI chars.
- For row-level data or writes you still need editor Python / the BP Inspector.
- False positives possible (a name appearing in an unrelated context) — treat results as
  leads to verify, not proof.

## When to prefer it

Any Stage 1 "what does X reference" question where the answer is a name list: map lists
in DataTables, which puppet/visual classes a folder pairs with, whether a config asset
mentions a class. Boot the editor only when you need structured values.
