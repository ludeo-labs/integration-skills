# Phase 03 — Validate build folder

Third ship gate. The folder you validate here is exactly what phase 4 uploads — `--local-directory`
is the folder and `--exec-path` is the executable inside it. Confirm it is complete, self-contained,
and actually launches before paying for an upload.

## 1. Goal / Purpose
Prove the build folder is complete, self-contained, and runs from inside itself with no missing DLLs
or assets — and pin down the exact `--local-directory` and `--exec-path` the upload will use.

## 2. Inputs (Input Contract)
- [ ] Phase 2 passed
- [ ] The build-folder path (the upload **root**) is known
- [ ] The intended executable, **relative to the build folder**, is known (becomes `--exec-path`)

## 3. Steps
1. **If the `validate-build` skill is installed, delegate to it** — it auto-detects Unity/Unreal/
   generic Windows builds, checks expected engine files, launches the exe from inside the folder, and
   recommends a `run.bat`. Otherwise run the checks inline (steps 2–6).
2. Detect the engine layout:
   - Unity: `<Game>_Data/`, `UnityPlayer.dll`, `<Game>.exe`, `MonoBleedingEdge/` (or IL2CPP `GameAssembly.dll`).
   - Unreal: `Engine/`, `<Game>/Binaries/Win64/<Game>.exe`, `<Game>/Content/Paks/*.pak`.
   - Generic Windows: an `.exe` plus its runtime DLLs/data alongside it.
3. Confirm the expected engine files for the detected layout are present.
4. Confirm the intended executable exists at `--exec-path` **relative to the build folder**.
5. Launch the executable **with the build folder as the working directory** and confirm it stays
   alive (no missing-DLL dialog, no immediate asset-load crash). Close it after it proves stable.
6. If there is no `run.bat`, recommend adding one (launches the exe relative to its own location) so
   the build is trivially runnable post-download.
7. Record `--local-directory` (the validated folder) and `--exec-path` into
   `.ludeo/cloud-upload.json` → `build`, and set `gates.buildFolder`.

## 4. Questions to ask the human
- Which folder is the upload **root** (the one whose name becomes the build's root/`basePath`)?
- Which executable inside it launches the game (the `--exec-path`)?
- Any external runtime dependency (VC++ redist, specific GPU driver) a clean machine would lack?

## 5. Patterns to apply
- Validate with the **working directory set to the build folder** — that surfaces absolute-path
  assumptions that only work on the dev machine.
- The folder you validate **is** `--local-directory`; the exe you confirm **is** `--exec-path`. Don't
  validate one folder and upload another.
- For a future **modification** build, the folder **name** matters — it must match the base build's
  root folder name (see phase 4). Note the root folder name now.

## 6. Output Contract
- A build folder confirmed complete, self-contained, and launchable.
- `build.localDirectory` + `build.execPath` recorded and ready for phase 4.
- `.ludeo/cloud-upload.json` → `gates.buildFolder = "pass"`.

## 7. Success Criteria
- [ ] Expected engine files for the detected layout are present
- [ ] `--exec-path` resolves and the exe launches and stays alive from inside the folder
- [ ] `--local-directory` and `--exec-path` recorded in state

## 8. Common Mistakes
- Uploading a folder that depends on an **absolute path** outside it (works locally, fails on Ludeo).
- Wrong `--exec-path` (points at a launcher/crash-handler, not the game).
- Missing redistributables the dev machine happens to have installed.
- Pointing the upload at a **parent** directory instead of the build root — inflates the upload and
  breaks the `basePath` that modification builds overlay onto.
