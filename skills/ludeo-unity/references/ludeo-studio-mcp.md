# Ludeo Studio MCP (`ludeo-mcp`)

Automates the **Studio Lab** platform work this skill otherwise hands to the user. Phase 1 installs it;
every row below still has a manual fallback, so an absent server never blocks a phase.

> **The tool set is growing.** This table is the reviewed set; the rules at the bottom cover the rest.

## Setup

Copy the `ludeo-mcp` entry from `<skill-base-dir>/config/mcp_config.template.json` into the project's
`.mcp.json` (or `claude mcp add --transport http ludeo-mcp https://mcp.ludeo.com/mcp`), then start a fresh
session so it connects. **It signs in with OAuth — no token goes in the file.** The client prompts the user to
log in with their Studio Lab account (Claude Code: `/mcp` → Authenticate); until they do, the server is listed but
its tools aren't.

**Identify it by its tools, not by its name.** The name **may** carry a deployment suffix (a staging deployment
appears as `ludeo-mcp-staging`), so match the `ludeo-mcp` prefix — or just look for `list_game_environments`
and `ping` in your tool list. Which deployment to use:

- **One `ludeo-mcp` (production) connected** → use it.
- **Only `ludeo-mcp-staging` connected** → staging is for Ludeo's own test games, and the rest of this skill (the SDK's platform URL, the CLI) assumes production. Ask which platform the game lives on; for production, add the production entry and don't use staging.
- **Both connected** → ask the user which one, and name it in your reply. They don't expose the same tools — staging gets new tools first, write tools included — so guessing can put a write on the wrong platform.

Record the deployment you chose in `KYG.md` → **Ludeo platform** so this doesn't come back every session. From then on, **"in your tool list" means on that server**: a tool only the other one has doesn't count.

## Touchpoints

| Touchpoint | Tool | R/W | Assert when | Manual fallback |
| --- | --- | --- | --- | --- |
| **Phase 1** — before any other studio call | `list_game_environments` | R | **Before every write, and at every gate that names an environment** — reads are free, and the recorded list is a cache, not the truth. Takes a required `versionId` — the **Game ID** from Studio Lab → **Game Options → Info** (the game **version** uuid, not the backend `gameId`), which only the user has, so **ask for that first**. Record **every** environment it returns — name, id, current Beta Version Name — in `KYG.md` → **Ludeo platform**; update the record when a re-read differs, and take `old` in a write confirmation from the fresh read. **An integration can target more than one environment** (QA while you iterate, production at ship), so this resolves the *set*: the target is picked per write. | Ask the user which environments exist and what Beta Version Name each carries; record them the same way. After that, with no tool, use the recorded list and confirm only the target. |
| **Phase 1 · Step 2** — where `betaVersion` is set on `LudeoSettings` | `set_beta_version_name` **(not on production yet — fall back until it appears in your tool list)** | **W** | **Invariant, per environment:** the Beta Version Name of the environment a **local** run targets equals the branch that run reports — **explicit** auth: `LudeoSettings.betaVersion`; **implicit**: the Steam beta branch the user's Steam client has selected (ask *"which Steam beta branch do you run it on?"*, not *"what name do you want?"*). In **explicit** mode the platform is the source of truth: copy the target environment's current name into `LudeoSettings.betaVersion` rather than asking for one, and write only to an environment that has no name and isn't the default. See **The default branch** below. That match is what routes a local session to its environment; a mismatch routes it elsewhere, silently. **A cloud run doesn't read it** — the cloud token selects the environment, and the build reaches it through `ludeo builds assign --env-id` (phase 7). Not `gameVersion`. **Re-assert whenever the value changes or the target does.** Names are unique within one Game ID, so the tool rejects a name another environment already uses. | Ask the user to set `<name>` on `<environment>` in Studio Lab; if `list_game_environments` is listed, re-read to confirm it landed; on a mismatch, show the difference and ask — don't pass the gate on it. |
| **Phase 1** — once the environments are known | `invite_user_to_env` **(not on production yet — fall back until it appears in your tool list)** | **W** | **On demand, per environment.** Until the game is live on Ludeo, only people in an environment can capture there — anyone else's attempt fails silently, the integrator included. **Membership is per environment**: an invite to one grants nothing in another, and no tool reports membership, so the integrator's own is always a question. Ask in phase 1 who else needs to make Ludeos, and in which environment; invites go by email, and the invitee should accept signed in with the Steam account they'll capture with; ask again when new people appear or the target environment changes. | Ask the user to invite them to `<environment>` in Studio Lab. |

`list_game_environments` returns each environment's `envId`, its current **Beta Version Name**, and
`hasBetaAccessCode` (never the code itself). A `betaVersionName` of `null` means nothing is stored in the field the tool reads — not the same as `""`, so report which you saw rather than flattening them.

**The default branch.** Steam's default branch sends no name, and the platform routes it to one environment per game: the one Studio Lab marked as the default when the game was created, normally **Production** (stored as the sentinel `{}`). An environment whose name is empty is reached by no branch. The tool can't always show which environment is the default — older environments report `null` whether or not they carry the marker — so:

- Treat Production as the default-branch target, and confirm it with the user before relying on it — and before naming any environment that reads `null`, since that one may be the default. If `{}` ever shows up as a name, it is that marker: call it "default branch".
- Never put a name on that environment, never write `public`, and never clear a name with `set_beta_version_name` — clearing stores `""`, which no branch reaches. Changes to the default environment go to the user in Studio Lab, after you say what they would break.
- Every other environment needs a named branch: the Steam beta branch creators run (implicit), or the configured beta name (explicit). Unity's explicit pair requires a name, so explicit auth can only target a named environment — debug against a named QA environment, never by naming Production.

**More than one environment is normal** — prod, QA and demo commonly coexist, and one integration may use several. Never pick for the user: list what came back (name, id, Beta Version Name) and have them say which one this write is for. Ask again rather than assuming the answer carries over — the user approves a value, and unless you name the target, a wrong environment sails through.

The **Assert when** column is a condition to hold, not a call count. Cadence follows from it: a tool whose
invariant depends on local state is re-called whenever that state changes.

## Rules

- **Reads are free.** Call one instead of asking the user a question the platform can answer.
- **Writes are outward-facing.** A write changes what everyone in that environment sees, and an invite
  reaches a real person. Before any write tool, show what it will change — `environment · old → new`, and for a beta name say who the old value routed (anyone on that branch stops reaching this environment),
  or `environment · every invitee's email` — and wait for an explicit go-ahead — the same rule
  [`7-upload-build.md`](7-upload-build.md) applies to `ludeo builds upload`. Treat that as firm: an
  unambiguous yes to *this* write, not approval carried over from an earlier step, and never inferred from
  the user having asked for the surrounding task. Never fire one as a side
  effect of another step.
- **Tools not in this table.** If a connected `ludeo-mcp` tool covers a step this skill documents as a
  manual Studio Lab action: **reads** — use it and say what it returned; **writes** — don't, add a row here
  first so a human reviews it. Never guess a tool name that isn't in your tool list.
- **Gate on the tool, not the server.** A connected server missing a tool is the common case today, not an
  edge one — check your tool list for the exact name before taking the connected branch anywhere in this
  skill, and fall back when it is absent. A `ludeo-mcp*` server listed without its tools usually just isn't
  signed in — ask the user to sign in (Claude Code: `/mcp` → Authenticate) before falling back.
- **A call that errors** → say what it returned. A **read**: check the input with the user once (a mistyped Game ID is the usual cause), then take the fallback column. A **write** may have partly landed (an invite batch), so re-read before falling back. A **name clash** means another environment holds that name — ask which one keeps it. An **auth error** means the sign-in expired — ask the user to sign in again (Claude Code: `/mcp` → Authenticate). Don't retry in a loop.
- **Server absent** → follow the fallback column, and tell the user you're handing that step to them.
