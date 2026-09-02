# Ludeo Studio MCP (`ludeo-mcp`)

Automates the **Studio Labs** platform work this skill otherwise hands to the human. Step 1 item 0 installs it (before its first use at item 10);
every row below still has a manual fallback, so an absent server never blocks a phase.

> **The tool set is growing.** This table is the reviewed set; the rules at the bottom cover the rest.

## Setup

Copy the `ludeo-mcp` entry from `<skill-base-dir>/config/mcp_config.template.json` into the project's
`.mcp.json` (or `claude mcp add`), then start a fresh session so it connects. Ask the Ludeo integrations
team for the URL and credentials.

**Identify it by its tools, not by its name.** The name carries a deployment suffix (a staging deployment
appears as `ludeo-mcp-staging`), so match the `ludeo-mcp` prefix — or just look for `list_game_environments`
and `ping` in your tool list. Confirm the production name with the integrations team before pinning it
anywhere. **If more than one `ludeo-mcp*` server is connected** — a staging entry kept alongside production — they expose the same tools, so nothing disambiguates them. **Stop and ask the human which deployment to use**, name it in your reply, and use only that one for the rest of the integration. Guessing here means writing the beta version to the wrong platform.

## Touchpoints

| Touchpoint | Tool | R/W | Assert when | Manual fallback |
| --- | --- | --- | --- | --- |
| **Phase 1** — session-init Step 10, before any other studio call | `list_game_environments` | R | **Once.** Takes a required `versionId` — the **Game ID** from Studio Labs → **Game Options → Info** (the game **version** uuid, not the backend `gameId`), which only the human has, so **ask for that first**; the tool replaces the *which environment, and what beta version does it carry* question, not the Game ID one. Record **every** environment it returns — id + current Beta Version Name — in `integration.json → sdkSetup.ludeoEnvironments`; later studio calls reuse that list. **An integration can target more than one environment** (a QA one while you iterate, production at ship), so this resolves the *set*, not a single choice: the target is picked per write, not once. **The tool reports no membership**, so Step 10’s question still goes to the human. | Ask the human which environments exist, which one this build targets, and what beta version it currently carries. |
| **Phase 3 · §3.16 Config Setup** — where `SteamAuthID` + `BetaBranchName` are set | `set_beta_version_name` **(not deployed yet — fall back until it appears in your tool list)** | **W** | **Invariant, not a schedule, and it holds per environment:** the beta version of the environment *this build targets* equals `[Ludeo] BetaBranchName`. **What that value actually does is bind the build to a Ludeo environment** — it is spelled as a Steam branch name, but the name undersells it: mismatch and the session routes to the wrong environment (or none), silently. Not `GameVersion`. Resolve it the way the SDK does (command line → env var → ini; empty means production), assert it once set, and **re-assert whenever it changes**. | Ask the human to set it on the environment in Studio Labs. |
| **Phase 1** — once the environments are known | `invite_user_to_env` **(not deployed yet — fall back until it appears in your tool list)** | **W** | **On demand.** Until the game is live on Ludeo, only people invited to the environment can capture — anyone else's attempt fails silently (this is the same wall Step 10 asks about, for everyone other than the integrator). Ask **once** in phase 1 whether anyone else needs to make Ludeos, and invite whoever they name. **Membership is per environment** — an invite to one grants nothing in another, so anyone who must capture in a second environment needs inviting there too. Ask again when new people appear, or when the integration starts targeting another environment. | Ask the human to invite them in Studio Labs. |

`list_game_environments` returns each environment's `envId`, its current **Beta Version Name**, and
`hasBetaAccessCode` (never the code itself). A `betaVersionName` of `null` means one was never assigned —
not the same as an empty one, so report which of the two you saw rather than flattening them.

**More than one environment is normal, and more than one may be in play during a single integration** — prod, QA and demo commonly coexist. Never pick for the human: list what came back (id + current Beta Version Name) and have them say which one this build is for. Ask again rather than assuming the answer carries over, because the write confirmation shows a *value* changing and not which environment it lands on — a wrong target sails straight through that gate.
The **Assert when** column is a condition to hold, not a call count. Cadence follows from it: a tool whose
invariant depends on local state is re-called whenever that state changes.

## Rules

- **Reads are free.** Call one instead of asking the human a question the platform can answer.
- **Writes are outward-facing.** A write changes what everyone in that environment sees, and an invite
  reaches a real person. Before any write tool, show what it will change — `environment · field · old → new`,
  or **every invitee by name** — and wait for an explicit go-ahead. Treat that as firm: an
  unambiguous yes to *this* write, not approval carried over from an earlier step, and never inferred from
  the human having asked for the surrounding task. Never fire one as a side effect of another step.
- **Tools not in this table.** If a connected `ludeo-mcp` tool covers a step this skill documents as a
  manual Studio Labs action: **reads** — use it and say what it returned; **writes** — don't, add a row here
  first so a human reviews it. Never guess a tool name that isn't in your tool list.
- **Gate on the tool, not the server.** A connected server missing a tool is the common case today, not an
  edge one — check your tool list for the exact name before taking the connected branch anywhere in this
  skill, and fall back when it is absent.
- **Server absent** → follow the fallback column, and tell the human you're handing that step to them.
