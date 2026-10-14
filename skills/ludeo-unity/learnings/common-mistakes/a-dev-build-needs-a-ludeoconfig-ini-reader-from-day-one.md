---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: 1
question: null
sanitized: true
---

# A dev build needs a `LudeoConfig.ini` reader from day one — dropping the file next to the exe does nothing on its own

**What happened.** An integration ran for days with the tester's Steam id baked into
`LudeoSettings.asset` (`runWithoutLauncher = true`, `launcherUserId` set). Local dev builds signed in
fine, so the optional "dev override" step in phase 1 looked unnecessary and was skipped. When the Steam
id was removed from the asset ahead of a cloud build, the next dev build had **no identity at all**. A
`LudeoConfig.ini` with the Steam id and beta branch had been sitting next to the exe the whole time,
copied over from other integrations, but nothing in this project read it. The file was silently
ignored: no error, no log line, just a dev build that could not create Ludeos. Two other integrations
on the same team already had a reader, so the integrator reasonably expected every game to have one.

**Why it is easy to miss.** Nothing about the file announces that it is unread. The plugin's own
`LocalConfigSystem` reads **only** the baked `LudeoSettings` asset (plus `RunCommands.json` in
StreamingAssets); it has no ini support. A reader is integration code, and it only exists if the
integration wrote it.

**The rule.** Add the reader in **phase 1 of every integration**, not when someone first needs it:

- `LudeoConfigFile.Apply()` reads `LudeoConfig.ini` from `Path.Combine(Application.dataPath, "..")`
  (next to the exe) and edits the **in-memory** instance from `LudeoUnityHelpers.GetLudeoSettings()`.
  That is the same object the SDK copies.
- Call it **before `LudeoManager.Initialize()`**. The SDK copies every `LudeoSettings` field into its
  internal config exactly once, inside `Initialize()` (`LocalConfigSystem.SetInternalConfig`); a change
  made afterwards lands nowhere, and nothing reports it.
- Keys: `runWithoutLauncher`, `steamUser`, `betaBranch` (launcher-free sign-in needs **both** of the
  last two), plus optional `platformUrl`, `apiKey`, `gameVersion`.
- Apply it only in a Development Build. Ignore it in the Editor, and in the release/upload build log an
  **error** and ignore the file: a stray ini there must not undo the launcher posture phase 7 enforces.
- Keep `launcherUserId` **empty** in the asset; the tester identity lives only in the dev build's ini.
- Make the reader log one greppable line (`config: applied … steamUser=… betaBranch=…`), and log when
  the file is absent. "The file is there but nothing happened" is the failure this prevents.

**Verify.** Launch the dev build from its own folder. `Player.log` must show the `config: applied` line
with the tester's Steam id, followed by `Initialize`, `CreateSession` and `Activate` succeeding.
`Activate` is the actual sign-in. Then check that the upload folder contains **no** `LudeoConfig.ini`.

Code and file template: `references/ludeo-integration-docs/unity/UPM-INSTALL-AND-DEFINES.md` →
*`LudeoConfig.ini`*; the step itself is phase 1 Step 2b.
