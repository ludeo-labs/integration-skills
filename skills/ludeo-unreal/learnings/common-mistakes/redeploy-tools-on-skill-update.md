---
category: common-mistakes
tier: universal
sourceGame: FTPS_Online
phase: 2
question: null
sanitized: true
---

# Always diff and redeploy skill tools when the skill is updated

## What happened

The skill was updated mid-session with new BP Inspector capabilities. The deployed copies in `.ludeo/tools/` and `Plugins/LudeoBPInspector/` were stale. The first run attempt failed because the deployed `bp_inspector.py` didn't have the new graph inspection features.

## Prevention

When the skill is reloaded or the human says "the skill has been updated":

1. Diff every tool file against the skill's `tools/` directory
2. Redeploy any files that differ
3. Rebuild the editor target if C++ plugin source files changed

## Files to check

| Skill source | Deployed location | Needs rebuild? |
|---|---|---|
| `tools/bp_inspector.py` | `.ludeo/tools/bp_inspector.py` | No |
| `tools/RunBPInspector.bat` | `.ludeo/tools/RunBPInspector.bat` | No |
| `tools/SetupLudeoEnv.ps1` | `.ludeo/tools/SetupLudeoEnv.ps1` | No |
| `tools/BuildAndPackage.bat` | `.ludeo/tools/BuildAndPackage.bat` | No |
| `tools/LudeoBPInspector/Source/**` | `Plugins/LudeoBPInspector/Source/**` | **Yes** |
| `tools/LudeoBPInspector/*.uplugin` | `Plugins/LudeoBPInspector/*.uplugin` | **Yes** |
