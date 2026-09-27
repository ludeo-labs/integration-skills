# Ludeo Studio MCP (`ludeo-mcp`)

Automates the **Studio Labs** platform work this skill otherwise hands to the human. Step 4 installs it;
every row below still has a manual fallback, so an absent server never blocks a phase.

> **The tool set is growing.** This table is the reviewed set; the rules at the bottom cover the rest.

## Setup

Copy the `ludeo-mcp` entry from `<skill-base-dir>/config/mcp_config.template.json` into the project's
`.mcp.json` (or `claude mcp add`), then start a fresh session so it connects. Ask the Ludeo integrations
team for the URL and credentials.

**Identify it by its tools, not by its name.** The name carries a deployment suffix (a staging deployment
appears as `ludeo-mcp-staging`), so match the `ludeo-mcp` prefix — or just look for `list_game_environments`
and `ping` in your tool list. Confirm the production name with the integrations team before pinning it
anywhere.

## Touchpoints

| Touchpoint | Tool | R/W | Assert when | Manual fallback |
| --- | --- | --- | --- | --- |
| **Phase 1** — session-init Step 10, before any other studio call | `list_game_environments` | R | **Once.** Takes a required `versionId` — the **Game ID** from Studio Labs → **Game Options**, which only the human has, so **ask for that first**; the tool replaces the *which environment, and what beta version does it carry* question, not the Game ID one. Record the resolved environment id in `integration.json → sdkSetup.ludeoEnvironmentId` and use the result to answer Step 10 (is the Steam user in the environment). **The environment you settle on here is the one `set_beta_version_name` writes to** — these two rows are one step. | Ask the human which environment to target (Studio Labs → Environments) and what beta version it currently carries. |
| **Phase 3 · §3.16 Config Setup** — where `SteamAuthID` + `BetaBranchName` are set | `set_beta_version_name` **(not deployed yet — fall back until it appears in your tool list)** | **W** | **Invariant, not a schedule:** the environment's beta version equals `[Ludeo] BetaBranchName`. **What that value actually does is bind the build to a Ludeo environment** — it is spelled as a Steam branch name, but the name undersells it: mismatch and the session routes to the wrong environment (or none), silently. Not `GameVersion`. Resolve it the way the SDK does (command line → env var → ini; empty means production), assert it once set, and **re-assert whenever it changes**. | Ask the human to set it on the environment in Studio Labs. |

| **Phase 1** — once the environment is resolved | `invite_user_to_env` **(not deployed yet — fall back until it appears in your tool list)** | **W** | **On demand.** Until the game is live on Ludeo, only people invited to the environment can capture — anyone else's attempt fails silently (this is the same wall Step 10 asks about, for everyone other than the integrator). Ask **once** in phase 1 whether anyone else needs to make Ludeos, and invite whoever they name. Ask again later only if new people appear. | Ask the human to invite them in Studio Labs. |

`list_game_environments` returns each environment's `envId`, its current **Beta Version Name**, and
`hasBetaAccessCode` (never the code itself). A `betaVersionName` of `null` means one was never assigned —
not the same as an empty one, so report which of the two you saw rather than flattening them.
The **Assert when** column is a condition to hold, not a call count. Cadence follows from it: a tool whose
invariant depends on local state is re-called whenever that state changes.

## Rules

- **Reads are free.** Call one instead of asking the human a question the platform can answer.
- **Writes are outward-facing.** A write changes what everyone in that environment sees, and an invite
  reaches a real person. Before any write tool, show what it will change — `environment · field · old → new`,
  or **every invitee by name** — and wait for an explicit go-ahead — the same rule
  [`phase-07-verification-cloud.md`](phase-07-verification-cloud.md) applies to the CLI upload. Never fire
  one as a side effect of another step.
- **Tools not in this table.** If a connected `ludeo-mcp` tool covers a step this skill documents as a
  manual Studio Labs action: **reads** — use it and say what it returned; **writes** — don't, add a row here
  first so a human reviews it. Never guess a tool name that isn't in your tool list.
- **Server absent** → follow the fallback column, and tell the human you're handing that step to them.
