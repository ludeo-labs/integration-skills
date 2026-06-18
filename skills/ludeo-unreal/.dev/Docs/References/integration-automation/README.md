# integration-automation — Prior Project Reference

These files are from a **prior Ludeo integration automation project** (`integration-automation` repo). They contain valuable SDK documentation and research templates, but were written for **engine-agnostic C++ integration**, not Unreal Engine specifically.

## How to Use These Files

These documents serve as **reference material** for building the integration skill. They are NOT the skill itself and should not be followed as-is for UE integrations.

**Use for:** SDK concepts, lifecycle patterns, research questionnaire structure, critical requirements (CR-002 through CR-008).

**Do NOT use for:** Build system setup, conditional compilation patterns, or UE-specific architecture decisions.

## Critical Caveats for Unreal Engine

### Macro Guards Do Not Apply to UE

The original project emphasized `#ifdef LUDEO_SDK_ENABLED` macro guards as the primary conditional compilation pattern (CR-001). **This does not apply to Unreal Engine.**

UE uses **plugin architecture**:
- All Ludeo code lives in a separate plugin (enabled/disabled as a unit)
- Game code uses runtime class lookup (`StaticLoadClass`) — no compile-time dependency
- UE's Header Tool (UHT) does not support `UCLASS`/`UPROPERTY` inside custom preprocessor blocks
- No per-file `#ifdef` guards needed in game code

### Build Integration Section Is Outdated

The original `04-BUILD-INTEGRATION.md` Section 8 (Unreal Engine) contained outdated `.uplugin` and `.Build.cs` patterns. It was not included in this reference set. Use the Lyra reference docs and UE Integration Spec instead.

## File Inventory

| File | Content | UE Caveats |
|------|---------|------------|
| `00-CRITICAL-REQUIREMENTS.md` | 8 non-negotiable SDK rules | CR-001 (macros) does not apply to UE |
| `01-AI-AGENT-GUIDE.md` | Integration workflow and decision framework | Pitfalls table references macros; use plugin approach |
| `02A-RESEARCH-ARCHITECTURE.md` | Architecture analysis template | Adapt generic refs to UE (AGameModeBase, etc.) |
| `02B-RESEARCH-OBJECTS.md` | Object analysis template | None — universally applicable |
| `02C-RESEARCH-ACTIONS.md` | Action analysis template | None — universally applicable |
| `02D-RESEARCH-ENVIRONMENT.md` | Environment analysis template | UE: Sequencer for cutscenes, APlayerCameraManager |
| `02E-RESEARCH-TECHNICAL.md` | Technical analysis template | UE: FAsyncTask, Task Graph for jobs |
| `03-SDK-FUNDAMENTALS.md` | Core SDK concepts and API patterns | None — universally applicable |
| `05-LIFECYCLE-MANAGEMENT.md` | SDK lifecycle implementation guide | None — universally applicable |

## Original Project

The `integration-automation` project used LangGraph-based multi-agent orchestration to automate Phase 0 (research and planning) of SDK integration. It covered code structure mapping, integration point discovery, and implementation planning, but did not generate or execute integration code.
