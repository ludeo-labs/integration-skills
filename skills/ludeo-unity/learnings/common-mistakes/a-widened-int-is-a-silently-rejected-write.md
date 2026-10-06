---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 5,6
question: "Are your attribute keys typed separately from the values they carry (a typed key wrapper, a LudeoKeys-style constants class, a schema table)? C# widens int to float at the call site without a warning, so a key declared float over an int property compiles clean and is REJECTED by the SDK on every write — read the SDK's own error stream from a real capture run before trusting any attribute row — and first prove the SDK's Data log category is actually emitting, because it is often left off and its silence reads exactly like 'no errors'."
sanitized: true
---

# A widened `int` is a silently rejected write — the compiler won't tell you, the SDK will

A typed key wrapper is the right shape for an attribute integration: one place declares
`Key<float> Health`, `Key<int> Level`, and every writer goes through it, so the type is stated once
and cannot drift per call site. It removes a whole class of mistake.

It introduces one, and the compiler is on the mistake's side.

```csharp
// the key, in the keys class
Key<float> FormationGridX = new Key<float>("player.formationGridX");

// the writer, elsewhere
FormationGridX.Write(obj, player.FormationGridPosition.x);   // Vector2Int -> .x is an int
```

That compiles without a warning. C# widens `int` to `float` implicitly, so a key declared over the
**wrong** type is indistinguishable at the call site from one declared over the right type. The write
then reaches the SDK as a float against an attribute the platform schema holds as `Int32`, and the SDK
**refuses it**:

```
Data:Error Object 3, attribute 'player.formationGridX': Expected type Int32 but client specified Float
```

The SDK does not coerce. It rejects, keeps going, and the value never reaches the clip.

## Why nothing catches it

- **Not the compiler** — the widening is legal and silent. `long`→`float`, `int`→`double`,
  `float`→`double` and every enum-to-integral conversion have the same property.
- **Not the layer** — the write call returns nothing useful; the writer believes it wrote.
- **Not a schema sweep** — a sweep that registers every declared key registers it with the *declared*
  type, so it agrees with the writer and disagrees with the platform in exactly the same way.
- **Not the attribute census, and not desk review of capture.** In one integration a reviewer found one
  of these by reading the keys class, and wrote it up as *"harmless in practice — the SDK has no
  int/float coercion problem at these magnitudes."* That is the natural reading if you think of it as a
  precision question. It is not a precision question, it is a contract question, and the review also
  missed two sibling keys with the identical fault because it was reading rows rather than watching the
  SDK.
- **Not the restore plan** — every affected row looked satisfied end to end: the key exists, the writer
  writes it, the plan mirrors it back to a setter. Only the clip is missing the value.

## The check that does catch it

**Read the SDK's own error stream from a real capture run, and treat a per-tick error as a defect, not
as noise.** Grep the log for the SDK's data-layer errors and collapse them:

```bash
grep -oE "attribute '[^']+': Expected type [A-Za-z0-9]+ but client specified [A-Za-z0-9]+" <log> \
  | sort | uniq -c | sort -rn
```

Three names came back at **1,801 hits each** from a 55-second run — one per attribute per tick, for the
whole run. High repetition is what makes them easy to find *and* what makes them easy to scroll past:
they are visually indistinguishable from a stuck warning.

Do this **once per wave, on the first real capture**, before anyone plans a restore against those rows.
It costs one grep and it is the only check that compares your declared types against the platform's.

## Before trusting that grep: prove the `Data` category is emitting

The check above has a precondition, and when it fails the check returns a **clean result for a broken
integration**. The SDK groups its logging into categories — `Core`, `Session`, `Http`, `Data`, `Room`,
`Overlay`, `VideoEncoding` — with independent levels, and attribute writes and reads are reported on
**`Data`**. If `Data` is not enabled, the grep finds nothing, and nothing anywhere says the stream was off.

It gets switched off without anyone deciding to. Integrations set levels for one or two categories and
leave the rest:

```csharp
LudeoManager.SetLoggingLevel(LudeoLogLevel.Off, LudeoLogCategory.Http);   // it logs from socket threads
LudeoManager.SetLoggingLevel(coreLogLevel,      LudeoLogCategory.Core);
```

That looks complete, and silencing `Http` is legitimate — but `Data` is never named, and in one
integration it emitted **zero** lines across a whole session while the others emitted thousands. Count
what each category actually emitted rather than grepping for the error you expect:

```bash
grep -oE "^[0-9]{2}:[0-9]{2}:[0-9]{2}:[0-9]{3}:[A-Za-z]+:[A-Za-z]+" <log> \
  | sed 's/^[0-9:]*//' | sort | uniq -c | sort -rn
```

```
1759 Overlay:Log   1153 Core:Log   776 Session:Log   492 Http:Log
  48 Http:Error     46 Core:Error   20 Session:Error    3 Room:Log
```

`Room` appears with three lines; `Data` does not appear at all. A low-traffic category still shows up —
**absence means disabled, not quiet.**

Name `Data` explicitly, at **`Warning`**. The levels are ordered `Off, Fatal, Error, Warning, Log, …`, so
`Warning` includes the errors that explain a refused write, while `Log` on this category is
per-attribute-per-tick and buries the run. Raise it to `Log` only while chasing one attribute.

**Order the calls if any category is being silenced.** `SetLoggingLevel` also writes a single shared
field that gates the SDK's own managed logging, whatever category is passed — so the *last* call wins
that gate. Silence the noisy category first, set the diagnostic ones in the middle, and leave the
category you want the gate to reflect until last.

A diagnostic stream's silence is only evidence once you have shown the stream can speak — prefer a check
that enumerates what *did* arrive over one that greps for what you expected.

## Fixing it

Fix the **key**, to whatever the game's property actually is — do not cast the value to match the key.
The platform's registered type is generally right because it was registered from a correct earlier
write, and the game's own type is the ground truth for what the value means. A cast at the writer
would silence the error and bake a lossy conversion into the clip.

Check the sibling keys around it in the same commit. These cluster: the same author, in the same pass,
types a run of related keys the same way. One of the three found here was spotted by review; the two
next to it were not.

## The wider rule

Every value crossing from game code into an attribute passes through **two** type declarations — the
key's and the property's — and the language will quietly reconcile them for you in one direction. Any
integration that declares attribute types separately from the values they carry needs one runtime
confirmation that the two agree. Desk review cannot supply it, because the mismatch is invisible in
exactly the place a reviewer looks.
