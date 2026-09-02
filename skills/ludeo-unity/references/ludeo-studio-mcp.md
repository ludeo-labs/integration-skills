# Ludeo Studio MCP (`ludeo-mcp`)

Automates the **Studio Lab** platform work this skill otherwise hands to the user. Phase 1 installs it;
every row below still has a manual fallback, so an absent server never blocks a phase.

> **The tool set is growing.** This table is the reviewed set; the rules at the bottom cover the rest.

## Setup

Copy the `ludeo-mcp` entry from `<skill-base-dir>/config/mcp_config.template.json` into the project's
`.mcp.json` (or `claude mcp add`), then start a fresh session so it connects. Ask the Ludeo integrations
team for the URL and credentials.

**Identify it by its tools, not by its name.** The name carries a deployment suffix (a staging deployment
appears as `ludeo-mcp-staging`), so match the `ludeo-mcp` prefix — or just look for `list_game_environments`
and `ping` in your tool list. Confirm the production name with the integrations team before pinning it
anywhere. **If more than one `ludeo-mcp*` server is connected** — a staging entry kept alongside production — they expose the same tools, so nothing disambiguates them. **Stop and ask the user which deployment to use**, name it in your reply, and use only that one for the rest of the integration. Guessing here means writing the beta version to the wrong platform.

## Touchpoints

| Touchpoint | Tool | R/W | Assert when | Manual fallback |
| --- | --- | --- | --- | --- |
| **Phase 1** — before any other studio call | `list_game_environments` | R | **Once.** Takes a required `versionId` — the **Game ID** from Studio Lab → **Game Options → Info** (the game **version** uuid, not the backend `gameId`), which only the user has, so **ask for that first**; the tool replaces the *which environment, and what beta version does it carry* question, not the Game ID one. Record **every** environment it returns — id + current Beta Version Name — in `ludeo-integration-plan/KYG.md`; later studio calls reuse that list. **An integration can target more than one environment** (a QA one while you iterate, production at ship), so this resolves the *set*, not a single choice: the target is picked per write, not once. | Ask the user which environments exist, which one this build targets, and what beta version it currently carries. |
| **Phase 1 · Step 2** — where `launcherUserId` + `betaVersion` are set on `LudeoSettings` | `set_beta_version_name` **(not deployed yet — fall back until it appears in your tool list)** | **W** | **Invariant, not a schedule, and it holds per environment:** the beta version of the environment *this build targets* equals `LudeoSettings.betaVersion`. **What that value actually does is bind the build to a Ludeo environment** — it is spelled as a Steam branch name, but the name undersells it: mismatch and the session routes to the wrong environment (or none), which is a silent failure, not an error. Not `gameVersion`. Assert it against the environment you are targeting now; **re-assert whenever the value changes or the target does** — switching environments mid-integration is normal, and each one carries its own name. **Name the environment in the confirmation**, never just the value. | Ask the user to set it on the environment in Studio Lab. |
| **Phase 1** — once the environments are known | `invite_user_to_env` **(not deployed yet — fall back until it appears in your tool list)** | **W** | **On demand.** Until the game is live on Ludeo, only people invited to the environment can capture — anyone else's attempt fails silently. Ask **once** in phase 1 whether anyone besides the integrator needs to make Ludeos, and invite whoever they name. **Membership is per environment** — an invite to one grants nothing in another, so anyone who must capture in a second environment needs inviting there too. Ask again when new people appear, or when the integration starts targeting another environment. | Ask the user to invite them in Studio Lab. |

`list_game_environments` returns each environment's `envId`, its current **Beta Version Name**, and
`hasBetaAccessCode` (never the code itself). A `betaVersionName` of `null` means one was never assigned —
not the same as an empty one, so report which of the two you saw rather than flattening them.

**More than one environment is normal, and more than one may be in play during a single integration** — prod, QA and demo commonly coexist. Never pick for the user: list what came back (id + current Beta Version Name) and have them say which one this build is for. Ask again rather than assuming the answer carries over, because the write confirmation shows a *value* changing and not which environment it lands on — a wrong target sails straight through that gate.

The **Assert when** column is a condition to hold, not a call count. Cadence follows from it: a tool whose
invariant depends on local state is re-called whenever that state changes.

## Rules

- **Reads are free.** Call one instead of asking the user a question the platform can answer.
- **Writes are outward-facing.** A write changes what everyone in that environment sees, and an invite
  reaches a real person. Before any write tool, show what it will change — `environment · field · old → new`,
  or **every invitee by name** — and wait for an explicit go-ahead — the same rule
  [`7-upload-build.md`](7-upload-build.md) applies to `ludeo builds upload`. Never fire one as a side
  effect of another step.
- **Tools not in this table.** If a connected `ludeo-mcp` tool covers a step this skill documents as a
  manual Studio Lab action: **reads** — use it and say what it returned; **writes** — don't, add a row here
  first so a human reviews it. Never guess a tool name that isn't in your tool list.
- **Gate on the tool, not the server.** A connected server missing a tool is the common case today, not an
  edge one — check your tool list for the exact name before taking the connected branch anywhere in this
  skill, and fall back when it is absent.
- **Server absent** → follow the fallback column, and tell the user you're handing that step to them.
