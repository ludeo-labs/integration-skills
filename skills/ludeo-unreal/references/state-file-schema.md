# State File Schema — `.ludeo/integration.json`

Full reference for the state file the skill creates in the target game repo. SKILL.md Step 1 reads this file to detect where the integration left off; every phase records decisions and findings into it.

```json
{
  "schemaVersion": 2,
  "gameTitle": "GameName",
  "engineVersion": "UE 5.x",
  "gameType": "FPS",
  "currentPhase": 1,
  "saveSystemGroup": null,
  "saveSystemEvidence": {
    "referenceSampleMatch": null,
    "cppUPropertySaveGameFound": false,
    "isBlueprintOnly": false,
    "bpVariablesInspected": [],
    "humanConfirmedClassification": false,
    "method": null
  },
  "stateApproach": null,
  "packagingTarget": "packaged",
  "vcs": {
    "type": "git",
    "git": { "remote": "origin", "branch": "ludeo-integration/<game>" },
    "svn": {
      "url": null,
      "repositoryRoot": null,
      "workingCopyRevision": null,
      "branchPlan": null,
      "commitPolicy": null
    },
    "p4": {
      "port": null,
      "client": null,
      "stream": null,
      "depotPath": null,
      "mcp": null,
      "changelist": null
    }
  },
  "preferences": {
    "smokeTestExecution": {
      "mode": "human-runs",
      "lastAsked": "2026-04-05"
    }
  },
  "curatedSlice": {
    "mapName": "LevelWaveCombat",
    "gameMode": "BP_WaveGameMode",
    "description": "Wave-based combat arena — self-contained combat loop",
    "entities": ["Player", "SoldierAI", "MeleeAI", "Pickups"],
    "actions": ["Kill", "Death", "AbilityUsed", "PickupCollected"],
    "restorationApproach": "reconciliation|manual"
  },
  "sdkSetup": {
    "uePlugin": {
      "method": "zip|submodule|existing",
      "tag": "4.2.0",
      "path": "Plugins/LudeoUESDK",
      "branch": null
    },
    "cSdk": {
      "method": "bundled-in-plugin-zip|submodule|existing",
      "path": "Plugins/LudeoUESDK/Source/LudeoSDK/SDK"
    }
  },
  "phases": {
    "0": { "status": "completed", "completedAt": "2026-03-19" },
    "1": { "status": "in_progress" },
    "2": { "status": "not_started" },
    "3": { "status": "not_started" },
    "4": { "status": "not_started" },
    "5": { "status": "not_started" },
    "6a": { "status": "not_started" },
    "6b": { "status": "not_started" },
    "7": { "status": "not_started" }
  },
  "decisions": [
    {
      "phase": 1,
      "topic": "Save System Classification",
      "decision": "Group 1 — Full Save System",
      "rationale": "Game has existing SaveGame system compatible with SaveWorld",
      "date": "2026-03-19"
    }
  ],
  "findings": [
    {
      "phase": 1,
      "type": "hook_point",
      "description": "GameState has OnMatchStarted delegate",
      "file": "Source/Game/GameState.h",
      "line": 42
    }
  ]
}
```

**Notes:**
- `schemaVersion`: Must be `2` for all files created or migrated to the current schema. The migration detector in `references/migration.md` flags files missing this field or carrying the old `currentStage` key.
- `currentPhase`: Integer 0–8 indicating the last completed or in-progress phase. Phase names: 0 Setup+Intake, 1 Mapping, 2 Lifecycle, 3 Map Objects, 4 Tracking & Restore, 5 Actions, 6 Verification & Cloud, 7 Expansion, 8 Polish.
- Phase 0 is setup only (no TDD section). TDD sections 1-7 correspond to phases 1-7.
- `saveSystemGroup`: Set during Phase 1 — `1` (Full Save), `2` (Checkpoint-Only), or `3` (No Save). Drives integration strategy for later phases.
- `curatedSlice`: Set during Phase 1 — defines the gameplay moment that Phases 3-5 are scoped to. Entities and actions are populated during analysis and confirmed by the human.
- `curatedSlice.restorationApproach`: Set during Phase 1 — `"reconciliation"` (use SaveWorld + property filters, like FPSGameStarterKit) or `"manual"` (read each property from DataReader, apply to spawned entities). Drives Phase 4 Player Flow implementation.
- `stateApproach`: Set during Phase 4 — `"SaveWorld"` or `"Manual"` (may differ from restoration approach for full game coverage in Phase 7).
- Phases also accumulate fields not shown in the template above as the integration progresses (e.g. `tools`, `intake`, `pauseMechanism`, `skillImprovementNotes`) — preserve unknown fields when updating, never rewrite the file from this template.
