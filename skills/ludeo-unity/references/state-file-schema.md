# State File Schema — `ludeo-integration-plan/integration.json`

Full reference for the state file the skill creates in the target game repo. SKILL.md's
**Per-Session Flow → Step 1: Detect State** reads this file to work out where the integration left
off; every phase records decisions and findings into it.

> **Path differs from the Unreal skill on purpose.** `ludeo-unreal` uses `.ludeo/integration.json`.
> The Unity skill already owns `ludeo-integration-plan/` for every other artifact it produces
> (`KYG.md`, `CODE_MAP.json`, `OBJECT_TRACKING.md`, `RESTORATION_PLAN.md`, `TDD_<Game>.md`), so the
> state file joins them rather than introducing a second state directory. **The schema is the portable
> part, not the path.** `schemaVersion` is versioned independently of Unreal's.

> **Commit it.** Unlike a scratch file, this is reviewable project state — decisions, blockers and
> deferrals belong in code review. Do not add it to `.gitignore`.

```json
{
  "schemaVersion": 1,
  "gameTitle": "GameName",
  "unityVersion": "2022.3.62f2",
  "renderPipeline": "URP 14.0.12",
  "scriptingBackend": "Mono",
  "gameType": "TPS",
  "currentPhase": 2,

  "saveSystem": {
    "group": null,
    "mechanism": null,
    "format": null,
    "saveEntryPoints": [],
    "transitionCacheRuledOut": false,
    "humanConfirmedClassification": false
  },
  "stateApproach": null,

  "launchModel": {
    "creator": null,
    "player": null,
    "sdkReadinessGateRequired": null,
    "humanConfirmed": false
  },

  "buildTarget": {
    "platform": "StandaloneWindows64",
    "variant": null,
    "storeAppId": null
  },

  "auth": {
    "mode": "explicit",
    "runWithoutLauncher": true,
    "betaVersion": null,
    "flippedToImplicitForShip": false
  },

  "sdkSetup": {
    "upmPackage": {
      "method": "local-file|embedded|unitypackage",
      "version": "4.3.1.0",
      "path": "file:../../<extracted>/Release/com.ludeo.sdk@4.3.1.0",
      "mutable": true,
      "portableToFreshClone": false
    }
  },

  "vcs": { "type": "git", "branch": "feature/ludeo-integration-#1" },

  "preferences": {
    "compileGateExecution": { "mode": "agent-headless", "lastAsked": "2026-08-12" },
    "smokeTestExecution":   { "mode": "agent-headless", "lastAsked": "2026-08-12" }
  },

  "curatedSlice": {
    "scene": null,
    "sessionBoundary": null,
    "description": null,
    "entities": [],
    "actions": [],
    "restorationApproach": "reconciliation|manual"
  },

  "phases": {
    "1": { "status": "completed", "completedAt": "2026-08-12", "artifact": "ludeo-integration-plan/KYG.md" },
    "2": { "status": "not_started", "artifact": "ludeo-integration-plan/CODE_MAP.json" },
    "3": { "status": "not_started", "artifact": "ludeo-integration-plan/TDD_<Game>.md" },
    "4": { "status": "not_started", "artifact": "ludeo-integration-plan/OBJECT_TRACKING.md" },
    "5": { "status": "not_started", "artifact": "ludeo-integration-plan/RESTORATION_PLAN.md" },
    "6": { "status": "not_started", "artifact": "ludeo-integration-plan/GAME_ACTIONS_MAP.md" },
    "7": { "status": "not_started" },
    "8": { "status": "not_started" }
  },

  "decisions": [
    { "phase": 1, "topic": "Target build", "decision": "Demo build", "rationale": "single-player, so networked co-op state stays out of capture/restore scope", "date": "2026-08-12" }
  ],
  "findings": [
    { "phase": 1, "type": "hook_point", "description": "platform auth init - Activate must be gated on this", "file": "Assets/Scripts/.../PlatformNetwork.cs", "line": 45 }
  ],
  "knownIssues": [
    { "id": "SHIP-1", "severity": "ship-blocker", "resolveByPhase": 7, "detail": "runWithoutLauncher must flip to false before any cloud build" }
  ],
  "temporaryArtifacts": [
    { "path": "Assets/Ludeo/Editor/LudeoSmokeTest.cs", "deleteAfter": "player-build smoke leg passes" }
  ]
}
```

**Notes:**

- `schemaVersion`: `1` for all files created against this schema. Independent of the Unreal skill's
  version line — do not assume a shared number means a shared shape.
- `currentPhase`: integer 1–8. Phase names: 1 Install + KYG, 2 Map Code, 3 SDK Lifecycle, 4 Map
  Objects, 5 Tracking & Restore, 6 Actions, 7 Validate & Upload, 8 Polish & Completion.
- `phases.<n>.artifact`: **the file whose existence proves the phase ran.** Step 1 checks these rather
  than trusting `status` alone — a `status` is something an agent typed; a file on disk is a fact.
  Phases 7–8 have no single artifact, so their status is trusted as-is.
- `saveSystem.group`: `1` (full gameplay-state save), `2` (checkpoint/partial), `3` (none — settings
  or meta-progression only). Set in phase 1 KYG. Group 3 means **every** restorable entity is manual
  per CR-006 — it is a scope driver, not a footnote.
- `saveSystem.transitionCacheRuledOut`: set `true` only once you have confirmed the save path you
  found is the canonical one, **not** a streaming/transition cache holding partial deltas. Phase 1
  warns this is a common misclassification.
- `saveSystem.humanConfirmedClassification`: `false` until a human confirms. The agent may classify
  from greps, but must not record the classification as confirmed on its own authority.
- `stateApproach`: `"attributes"` (default and strongly preferred) or `"blobs"`. Set in phase 5.
- `launchModel`: two independent axes — `creator`: `menu-gated` | `boot-straight`;
  `player`: `gallery` | `preselected` | `both`. A **product decision**, so `humanConfirmed` matters;
  do not infer it from the first scene alone. Either non-default value implies
  `sdkReadinessGateRequired: true` (`unity/LAUNCH-AND-READINESS.md`).
- `auth.runWithoutLauncher`: `true` = explicit auth (development; authenticates with no store client
  running). **A shipped/cloud build MUST be `false`** — the Ludeo platform is itself the launcher.
  `flippedToImplicitForShip` is the phase-7 gate's record that this actually happened.
- `sdkSetup.upmPackage.portableToFreshClone`: `false` when the `file:` path points outside the repo.
  A fresh clone or CI run will not resolve the package until this is `true` — surface it, don't bury it.
- `preferences.*.mode`: `agent-headless` | `human-runs`. **Records who runs each gate so it is not
  renegotiated every session.** Where a matching editor is installed and the project is not locked, the
  agent can run compile gates itself (`-batchmode`) and play-mode tests via the Test Framework; only
  judgement-on-a-live-game needs a person. Re-ask if `lastAsked` is stale or the environment changed.
- `curatedSlice`: set in phase 2, confirmed by the human. `sessionBoundary` is the gameplay segment a
  room brackets (`OpenRoom` → `CloseRoom`) — **not** "what a Ludeo is". A Ludeo is a highlight the
  platform derives from the captured segment; conflating the two mis-scopes phase 3.
- `curatedSlice.restorationApproach`: game-level default. The **per-entity** reconciliation-vs-manual
  matrix lives in `CODE_MAP.json` → `save_system.per_entity` (phase 4).
- `knownIssues[].resolveByPhase` makes a deferred problem findable by the phase that must fix it. A
  blocker recorded only in a commit message is a blocker nobody greps.
- Phases accumulate fields beyond this template as the integration progresses. **Preserve fields you
  do not recognise when updating; never rewrite the file from this template.**
