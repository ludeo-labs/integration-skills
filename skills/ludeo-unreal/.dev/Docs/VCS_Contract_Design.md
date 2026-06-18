# VCS Contract Design (git + Perforce)

Living spec for making the Ludeo integration skill VCS-agnostic so it works on studios using **git/GitHub** or **Perforce (p4)**. Status: **design / not yet implemented**. Companion: `Git_vs_Perforce_for_Git_Users.md` (background for the team) and `Git_vs_Perforce_for_Git_Users.md → "How these differences impact the skill"` (the affected surface).

## Settled decisions

- **D1 — p4 operations: MCP-primary, layered.** Default-recommend the **official Perforce P4 MCP** (governance, permission-respecting, read+write, Swarm review + shelving). Layered stack:
  1. Primary: the Perforce MCP server (like `sdk-docs` in config).
  2. Rule: call MCP `edit`/`add` before any Write/Edit on a workspace file.
  3. Safety net: `reconcile`/`status` at the **end of every code-producing stage** (alongside the compile/verification gate) to catch written-but-not-opened files — **gated by integrator confirmation** before it runs, since `reconcile` opens/reverts files.
  4. Fallback: raw `p4` CLI for any operation when no MCP is present.
  5. Avoid `allwrite` (Perforce discourages it; escape hatch only).
- **D2 — Isolation: human-confirmed.** Encourage a branch (git) or **stream** (p4); most studios use streams. The skill proposes the name and asks the integrator to create/confirm it (as it does for the git branch today) rather than auto-creating.
- **D3 — Workspace preconditions: verify, don't create.** The skill assumes a working, synced, logged-in p4 workspace exists and verifies it via `p4 info` / `p4 login -s`. It does not create the client spec or log in — if missing, it tells the human to set that up first.
- **D4 — Detection keys off where the *code* lives.** git-tracks-the-`.uproject` → git; else `p4 where <uproject>` resolves → p4; ambiguous → ask. Content-in-p4-but-code-in-git reads as git (Lyra-in-git carries no content in VCS anyway). **Single VCS in v1** — no mixed mode.

## The contract operations

Stage logic calls these by name; `references/vcs/git.md` and `references/vcs/p4.md` implement them; Phase-0 detection picks which file loads.

| Operation | git | p4 (official P4 MCP → CLI fallback) |
|-----------|-----|-------------------------------------|
| `detect_vcs` | `.git` present / git tracks `.uproject` | `p4 info` + `p4 where <uproject>` |
| `create_isolation(name)` | `git checkout -b ludeo-integration/<game>` | confirm/switch to a task or dev **stream** (human-confirmed); or a pending changelist |
| `acquire_component(name, dest)` | submodule · download+commit · existing | existing · **download zip → extract → MCP `add`** (CLI `p4 add` fallback) |
| `ensure_editable(path)` | no-op | MCP `edit` (existing) / `add` (new) before write; `reconcile` net before review |
| `open_review(summary)` | GitHub PR | MCP **shelve + Swarm review**, or hand off a changelist |
| `guard_destructive` | never blind `git reset`/`checkout --`/`submodule deinit` | MCP safety defaults (`P4_READONLY_MODE`, `P4_DISABLE_DELETE`) + never blind `p4 revert`/`p4 sync -f` |

## Per-session wiring

The skill runs **one stage per session** and reloads SKILL.md fresh each time, so the VCS choice must be re-established every session from state — not just at setup.

1. **Phase 0 (first session)** runs `detect_vcs` and records `integration.json → vcs`.
2. **Every subsequent session**, in the Per-Session Flow **Step 1 (Detect State)**: after reading `integration.json`, read `vcs.type`. If `p4`, load `references/vcs/p4.md` **before any file write** and keep its `ensure_editable` rule in force for the whole session. If `git`, git is the no-op default (load `vcs/git.md` only if needed).
3. **Step 4 (Check MCP Servers)** gains: if `vcs.type == p4`, check for a Perforce MCP server; record `vcs.p4.mcp` (server name or `null` → CLI fallback).
4. **Always-loaded guardrail.** Because SKILL.md is always in context but `vcs/p4.md` is loaded on demand, add a short **"VCS-aware edits"** rule to the SKILL.md body: *"If `vcs.type == p4`, you MUST `ensure_editable` (Perforce MCP `edit`/`add`, or `p4 edit`/`add`) before any Write/Edit to a workspace file — a p4 workspace is read-only by default and the write will fail otherwise. See `references/vcs/p4.md`."* This survives even if the agent doesn't re-read p4.md mid-session.

## `integration.json` schema additions

```json
"vcs": {
  "type": "git",                         // "git" | "p4"
  "git": {
    "remote": "origin",
    "branch": "ludeo-integration/<game>"
  },
  "p4": {
    "port": null,                        // P4PORT (often from env/P4CONFIG; null = inherit)
    "client": "Ronen-Lenovo",            // workspace/client spec name (verified, not created)
    "stream": "//depot/<game>-ludeo",    // isolation stream, or null if changelist-only
    "depotPath": "//depot/<game>/...",   // where the project maps in the depot
    "mcp": "perforce"                    // detected Perforce MCP server name, or null (CLI fallback)
  }
}
```

`sdkSetup.<component>.method` gains `"zip"`, with `downloadUrl` and `extractedTo`:

```json
"sdkSetup": {
  "uePlugin": { "method": "zip", "tag": "4.2.0", "downloadUrl": "https://github.com/EdgeGamingGG/ludeosdk-unreal-plugin/releases/download/4.2.0/LudeoUESDK-4.2.0.zip", "path": "Plugins/LudeoUESDK" },
  "cSdk":     { "method": "bundled-in-plugin-zip", "path": "Plugins/LudeoUESDK/Source/LudeoSDK/SDK" }
}
```
(For the git-submodule path, `uePlugin.method = "submodule"` and `cSdk.method = "submodule"` as before.)

## Phase-0 detection + setup sequence

Replaces/augments the current git-only Stage-0 steps (SKILL.md "Per-Session Flow → File does not exist → Stage 0"):

1. **`detect_vcs`** — git-tracks-`.uproject`? → git. Else `p4 info` succeeds + client root is an ancestor + `p4 where <uproject>` resolves? → p4. Both/neither/ambiguous → ask. Record `vcs.type`.
2. **Verify workspace (p4 only, D3)** — `p4 info` + `p4 login -s` succeed and client root covers the project. If not, stop and ask the human to set up / `p4 login` first. Record `vcs.p4.{client,depotPath}`.
3. **Detect Perforce MCP (p4 only)** — check for a Perforce MCP server; record `vcs.p4.mcp` (or `null` → CLI fallback). Recommend the official P4 MCP if absent.
4. **`create_isolation` (D2, human-confirmed)** — git: `git checkout -b ludeo-integration/<game>`. p4: propose a stream name; integrator confirms/creates; switch the client to it (`p4 sync`). Record `vcs.git.branch` / `vcs.p4.stream`.
5. **`acquire_component`** (LudeoUESDK, then C SDK) — existing at path? → confirm. Else download zip from `sdk-sources.json → <component>.downloadUrl` → extract to dest → make tracked (git commit/submodule; p4 `add` via MCP/CLI). **Validate** expected artifacts landed (e.g. `LudeoSDK-Win64-Release.dll` per `integration-automation/04-BUILD-INTEGRATION.md`). Record method/path.
6. **Proceed** to `.ludeo/` creation and the rest of Stage 0 — but every file write now goes through `ensure_editable` when `vcs.type == p4`.

## Skill files to change (when we implement)

- **`SKILL.md`** — Stage 0 steps 1-3 (branch/submodule → contract ops); the "Absolute Paths and Bash Safety" submodule/destructive-git guidance (→ VCS-aware, p4 equivalents); add the always-loaded "VCS-aware edits" rule; Per-Session Flow Step 1 + Step 4 additions; State File Schema (`vcs` block, `method: zip`); PR Cycle (→ `open_review`).
- **`references/vcs/README.md` + `git.md` + `p4.md`** — new; the contract implementations.
- **`config/sdk-sources.json`** — add `downloadUrl` per component for the zip path.
- **`config/mcp_config.template.json`** — add the Perforce MCP server entry.
- **`references/phase-02-lifecycle.md`** — SDK-setup section references the contract (already mostly VCS-agnostic; `-noP4` already present).
- **Tools** — `RunBPInspector` must `ensure_editable` the target `.uasset`(s) before `set-savegame` on p4.

## Open items

- **Zip endpoint — RESOLVED.** The plugin publishes a self-contained release asset `LudeoUESDK-4.2.0.zip` (816 MB; `gh release download 4.2.0 -R EdgeGamingGG/ludeosdk-unreal-plugin -p '*.zip'`) that **bundles the C SDK** already populated at `Source/LudeoSDK/SDK/` (verified: 3 modules + Win64/Linux/Android binaries, 4.0 GB extracted). So `acquire_component` collapses to a **single download** on the release path — no separate C SDK step. Recorded in `config/sdk-sources.json → ludeoUESDKPlugin.release`. Prefer the release asset over a source-archive zip (the latter wouldn't resolve LFS binaries). `ludeo-sdk-releases` has version tags but no release assets, so there's no standalone C SDK zip — only needed for the git-submodule path.
- **Verify official P4 MCP tool coverage** — confirm it exposes `edit`/`add`/`reconcile`/stream-switch; any gaps fall to CLI fallback (non-blocking).
- **D2 detail** — stream vs. changelist-only when a studio doesn't use streams; the human-confirm step covers both, but the prompt wording needs to handle each.
