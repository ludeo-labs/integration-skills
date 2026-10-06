# Ludeo Studio MCP (`ludeo-mcp`)

Automates the **Studio Lab** platform work this skill otherwise hands to the user. Phase 1 installs it;
every row below still has a manual fallback, so an absent server never blocks a phase.

> **The tool set is growing.** This table is the reviewed set; the rules at the bottom cover the rest.

## Setup

Copy the `ludeo-mcp` entry from `<skill-base-dir>/config/mcp_config.template.json` into the project's
`.mcp.json` (or `claude mcp add`), then start a fresh session so it connects. Ask the Ludeo integrations
team for the URL and credentials, and don't add the entry until you have them — the template's URL is a placeholder.

**Identify it by its tools, not by its name.** The name **may** carry a deployment suffix (a staging deployment
appears as `ludeo-mcp-staging`), so match the `ludeo-mcp` prefix — or just look for `list_game_environments`
and `ping` in your tool list. Confirm the production name with the integrations team before pinning it
anywhere. **If more than one `ludeo-mcp*` server is connected** — a staging entry kept alongside production — they expose the same tools, so nothing disambiguates them. **Stop and ask the user which deployment to use**, name it in your reply, and use only that one for the rest of the integration. Guessing here means writing the beta version to the wrong platform.

## Touchpoints

| Touchpoint | Tool | R/W | Assert when | Manual fallback |
| --- | --- | --- | --- | --- |
| **Phase 1** — before any other studio call | `list_game_environments` | R | **Before every write, and at every gate that names an environment** — reads are free, and the recorded list is a cache, not the truth. Takes a required `versionId` — the **Game ID** from Studio Lab → **Game Options → Info** (the game **version** uuid, not the backend `gameId`), which only the user has, so **ask for that first**. Record **every** environment it returns — name, id, current Beta Version Name — in `KYG.md` → **Ludeo platform**; update the record when a re-read differs, and take `old` in a write confirmation from the fresh read. **An integration can target more than one environment** (QA while you iterate, production at ship), so this resolves the *set*: the target is picked per write. | Ask the user which environments exist and what Beta Version Name each carries; record them the same way. |
| **Phase 1 · Step 2** — where `betaVersion` is set on `LudeoSettings` | `set_beta_version_name` **(not deployed yet — fall back until it appears in your tool list)** | **W** | **Invariant, per environment:** the Beta Version Name of the environment a **local** run targets equals the branch that run reports — **explicit** auth: `LudeoSettings.betaVersion`; **implicit**: the Steam beta branch the user's Steam client has selected (ask *"which Steam beta branch do you run it on?"*, not *"what name do you want?"*). That match is what routes a local session to its environment; a mismatch routes it elsewhere, silently. **A cloud run doesn't read it** — the cloud token selects the environment, and the build reaches it through `ludeo builds assign --env-id` (phase 7). Not `gameVersion`. **Re-assert whenever the value changes or the target does.** Names are unique within one Game ID, so the tool rejects a name another environment already uses. | Ask the user to set `<name>` on `<environment>` in Studio Lab; if `list_game_environments` is listed, re-read to confirm it landed. |
| **Phase 1** — once the environments are known | `invite_user_to_env` **(not deployed yet — fall back until it appears in your tool list)** | **W** | **On demand, per environment.** Until the game is live on Ludeo, only people in an environment can capture there — anyone else's attempt fails silently, the integrator included. **Membership is per environment**: an invite to one grants nothing in another, and no tool reports membership, so the integrator's own is always a question. Ask in phase 1 who else needs to make Ludeos, and in which environment; ask again when new people appear or the target environment changes. | Ask the user to invite them to `<environment>` in Studio Lab. |

`list_game_environments` returns each environment's `envId`, its current **Beta Version Name**, and
`hasBetaAccessCode` (never the code itself). A `betaVersionName` of `null` means one was never assigned —
not the same as an empty one, so report which of the two you saw rather than flattening them.

**More than one environment is normal** — prod, QA and demo commonly coexist, and one integration may use several. Never pick for the user: list what came back (name, id, Beta Version Name) and have them say which one this write is for. Ask again rather than assuming the answer carries over — the user approves a value, and unless you name the target, a wrong environment sails through.

The **Assert when** column is a condition to hold, not a call count. Cadence follows from it: a tool whose
invariant depends on local state is re-called whenever that state changes.

## Rules

- **Reads are free.** Call one instead of asking the user a question the platform can answer.
- **Writes are outward-facing.** A write changes what everyone in that environment sees, and an invite
  reaches a real person. Before any write tool, show what it will change — `environment · old → new`,
  or `environment · every invitee by name` — and wait for an explicit go-ahead — the same rule
  [`7-upload-build.md`](7-upload-build.md) applies to `ludeo builds upload`. Never fire one as a side
  effect of another step.
- **Tools not in this table.** If a connected `ludeo-mcp` tool covers a step this skill documents as a
  manual Studio Lab action: **reads** — use it and say what it returned; **writes** — don't, add a row here
  first so a human reviews it. Never guess a tool name that isn't in your tool list.
- **Gate on the tool, not the server.** A connected server missing a tool is the common case today, not an
  edge one — check your tool list for the exact name before taking the connected branch anywhere in this
  skill, and fall back when it is absent.
- **Server absent** → follow the fallback column, and tell the user you're handing that step to them.
