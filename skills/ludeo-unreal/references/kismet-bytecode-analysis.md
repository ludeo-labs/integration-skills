# Kismet Bytecode Analysis — Mission-Flow Restoration Workflow

When Player Flow restoration of mission progression keeps failing ("script doesn't
continue", "one-shots re-fire on replay", "objective shows but the next step never
arms"), the root cause is almost always invisible from C++: the logic lives in
level-script / scripting-actor Blueprint graphs. This workflow makes those graphs
readable so restore decisions are made from evidence instead of playtest bisection.

**Tool:** `tools/LudeoKismetDump/` — a self-contained plugin (UE4 + UE5). Copy into
`<Project>/Plugins/`, enable in the `.uproject`, build a Development editor target.
It links the engine's own `ScriptDisassembler` Developer module, so the opcode set
always matches the engine version. Compiled out of Shipping/Test.

## When to use

- Phase 7/8 (expansion / Player Flow polish) when per-property restore leaves
  "limbo" states or re-fired one-shots and the responsible logic is in BP graphs.
- Before designing objective/mission-state restore semantics for a new title.
- Per new map/mission of an already-integrated title, to enumerate its scripting
  surface up front (~1 hour of reading instead of playtest archaeology).

## Workflow

### 1. Offline dump (preferred — no game session needed)

```
RunKismetDump.bat <Project>.uproject [-Maps=Sub1,Sub2] [-Classes=Sub1] [-OutDir=path] [-Paths=/Game,/Foo | -AllPaths]
```

**GameFeature / content-plugin titles (Lyra-style): pass `-AllPaths`.** The default
scan covers `/Game` only, but such titles mount their real gameplay maps at
`/<PluginName>` (e.g. `/ShooterMaps`) — a default run dumps only frontend/overview
maps and silently misses the missions. `-AllPaths` walks every mounted non-engine
content root; `-Paths=` scans an explicit list.

Runs the `LudeoDumpKismet` commandlet headlessly: loads each map (plus classic
streaming sublevels — scripting classes usually live in a dedicated scripting
sublevel, not the persistent map), and writes per-class artifacts under
`<ProjectSaved>/LudeoKismet/<Map>/`:

- `<Class>.kismet.txt` — disassembled bytecode of every function
- `<Class>.events.txt` — function inventory; `BndEvt__` stubs parsed into
  (actor, delegate-signature) pairs; plus the class's compiled-in dynamic
  bindings (component delegate property → handler function)
- `<Class>.vars.txt` — class-declared variables with Replicated / RepNotify /
  Transient / SaveGame flags
- `_PlacedActorBindings.txt` (per map) — serialized delegate invocation lists
  of placed actors. **This is the static answer to "which delegate does this
  stub actually bind"**: stub names only carry the delegate *signature*, and
  same-signature delegates (OnActivated vs OnCompleted patterns) are
  indistinguishable from the name. Level-script bound events are serialized
  into the placed actor in the map — not into bytecode, not into the BPGC —
  so this file is the only offline place the (actor, delegate property,
  handler) triple exists.

Known limitation: UE5 World Partition cells / Level Instances aren't walked
(persistent-level scripts still dump). Classic streaming is fully covered.

**If the build fails with duplicate-rules errors (`CS0101 ... already contains a
definition`):** the project keeps its `*.Target.cs` nested inside the module
folder (`Source/<Module>/`) instead of `Source/` — UBT's content-only check
only looks at `Source/` top level, decides the project has no code, and
generates a colliding temp target under `Intermediate/Source/` because this
plugin needs compiling. Don't restructure the project. Instead seed prebuilt
binaries: copy `Plugins/LudeoKismetDump/Binaries/` from any sibling project
already built on the SAME engine version, delete `Intermediate/Source/`, and
run the commandlet directly — with binaries present, no compile is triggered.

### 2. In-game cheats (ad-hoc checks)

- `LudeoKismet.DisassembleBP <ClassSubstring> [name]` — disassemble loaded classes.
- `LudeoKismet.DumpDelegateBindings <ClassSubstring> [name]` — live invocation
  lists of every multicast delegate on matching world actors ("who listens to
  this event *right now*"). Run after gameplay starts so BeginPlay bindings exist.

### 3. Reading the dump

Event stubs are tiny functions that call `ExecuteUbergraph_<BP>` with a literal
int32 entry offset; convert to hex and find `Label_0x<hex>:` in the ubergraph.
Build two tables first; everything else follows from them:

1. **Event → entry offset** (from the stubs) — what world events the script
   reacts to. Resolve each stub's actual delegate *property* (not just the
   signature in the name) from `_PlacedActorBindings.txt`.
2. **State-mutation call sites** — grep the ubergraph for the game's
   objective/mission-state transition methods (e.g. `::Activate`, `::Complete`,
   `::Fail`, `::AddProgress`) and resolve each call's target object from the
   preceding `Instance variable named <X>_RefProperty` context line.

Latent nodes (`Delay`, timers) appear as calls taking a `LatentActionInfo` literal;
the `literal CodeSkipSizeType` inside it is the continuation offset.

## What to look for (patterns that decide restore semantics)

- **Bound-event sparsity.** Script listeners on objective-style delegates are
  usually few; most bindings are HUD widgets. Enumerate the real ones — the
  restore blast radius is smaller than it looks.
- **Per-state delegate semantics.** Activation handlers typically ARM the world
  (enable interactables, place waypoints, enable trigger volumes) — a restored
  "active" objective must re-fire its activation path or the player is stranded.
  Completion handlers typically GRANT one-shots (XP/reward calls, VO, next-step
  triggers) — a restored "complete" objective must be silent or those re-fire.
  Restore ended states with late-join semantics (direct state write + HUD-update
  broadcast, no gameplay events); re-fire activation for active states.
- **Scripter-built idempotent re-derivers.** Look for self-gated re-entrant custom
  events (often named `Try...`): `if (!FlagA) return; if (!FlagB) return; <arm world>`.
  Scripters write these because multiple paths converge on the same arming logic.
  If the gate flags are restored (reflection capture of BP variables), calling
  these events by name post-restore re-derives the armed world state safely —
  zero engine edits. Check each candidate's body before trusting it.
- **Setter-based activation.** Volume/zone enabling commonly goes through methods
  like `SetVolumeEnabled(true)` plus marker/state-actor calls — writing the
  underlying property bit (e.g. `bActorEnableCollision`) is NOT equivalent.
- **Load-bearing latent state.** Mid-flight `Delay` chains and level-placed timer
  actors can't be property-restored. Triage from the dump: most are VO/ambience
  loops (acceptable loss); the few gameplay-critical ones (escape/arrival timers)
  need either replicated-field restore or an explicit re-trigger.
- **One-shot guards.** Booleans like "already spawned X" / "intro played" gate
  re-execution; restoring them (reflection capture) is what makes re-running
  boot-time script paths safe.

## Sanity checks

- Skip `SKEL_` / `REINST_` classes (editor duplicates) — the tool does this, but
  remember it when counting functions.
- Bytecode is static: dump location/timing in a session doesn't matter, only that
  the class is loaded. Delegate-binding dumps ARE runtime state — capture them
  in-session after gameplay starts, or rely on the static `BndEvt__` stub names.
- Validate the offline dump once against an in-game `LudeoKismet.DisassembleBP`
  of the same class (same labels/offsets) before trusting it for a new engine
  version.
