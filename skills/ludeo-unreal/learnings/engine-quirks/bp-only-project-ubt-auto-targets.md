---
category: engine-quirks
tier: universal
sourceGame: VoyagerV2
phase: 2
question: "Is this a Blueprint-only project? Check Intermediate/Source/ for auto-generated .Target.cs files. If they exist (CommonUI etc.), do NOT create Source/. If they DON'T exist, you MUST create Source/ with minimal .Target.cs files or packaging will silently skip plugin DLLs."
sanitized: true
---

# Blueprint-only projects: Source/ directory decision is critical for packaging

Blueprint-only UE projects have no `Source/` directory. Whether to create one depends on whether UBT auto-generates `.Target.cs` files.

**Step 1: Check for auto-generated targets**
After the first editor compile, check `Intermediate/Source/` for `.Target.cs` files. Certain plugins (CommonUI, ModularGameplay, etc.) cause UBT to auto-generate them.

**If auto-generated targets EXIST (e.g., VoyagerV2 with CommonUI):**
- Do NOT create `Source/` — it causes CS0101 duplicate class conflicts
- UBT message: "has no code, but is being treated as a code-based project because: CommonUI plugin is enabled"

**If auto-generated targets DO NOT EXIST (e.g., FPSGameStarterKit without CommonUI):**
- You MUST create a full minimal game module: `Source/<GameName>/` with `<GameName>.Target.cs`, `<GameName>Editor.Target.cs`, `<GameName>.Build.cs`, `<GameName>.cpp` (with `IMPLEMENT_PRIMARY_GAME_MODULE`), `<GameName>.h`
- Target.cs files alone are NOT enough — linking the monolithic game exe requires `IMPLEMENT_PRIMARY_GAME_MODULE` to define `GInternalProjectName`, `FMemory_Malloc/Realloc/Free`, `GNameBlocksDebug`, and other globals. Without them, you get a wall of `LNK2001` unresolved externals.
- Also add the module to `.uproject` `Modules` array
- Without these, `BuildCookRun -build` silently skips C++ compilation — plugin modules and RuntimeDependencies (DLLs) are never staged
- Symptom: packaged build has no `Binaries/` directory, runtime error "module could not be found"
- See `bp-only-packaging-needs-source-module.md` for the complete file templates

**This check must happen during Stage 0/2 setup, BEFORE the first packaging attempt.**
