---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 7
question: "Is the machine's `ludeo` CLI already logged in for some other game, or does the Unity build folder hold anything that must not ship (the `_BackUpThisFolder_ButDontShipItWithYourGame` / `_BurstDebugInformation_DoNotShip` folders, a local-testing config file)? Check both before the first `auth set-token` and the first upload."
sanitized: true
---

# `ludeo auth set-token` overwrites the one global login, and `builds upload` sends every file in the folder

Observed on Ludeo CLI v1.6.2. Two things surprised us, both on the first upload of an engagement.

## 1. `set-token` ignores `--config`

`ludeo --config <other.json> auth set-token --access-token <t>` still wrote to
`~/.ludeo/config.json` (it printed `Config saved to: ...\.ludeo\config.json`). That file holds one
token, and tokens are **bound to one game version**. If the machine was already logged in for another
game, that login is now gone, and nothing asks you first.

A `--config` file that does not exist yet is also unusable: the CLI loads it with
`environment: ""` and every command fails with
`unknown environment "": must be 'production', 'staging', or 'development'`.

**Do this instead:** run `ludeo auth status` first. If a token is already saved, ask whose it is
before replacing it (`ludeo builds list` prints `Using Game ID from access token: <id>`, and
`builds get` shows its `Base Path`). If both games need uploads from one machine, pass
`--access-token` per call instead of saving it.

## 2. There is no exclude option

`builds upload` sends everything under `--local-directory`. A Unity player folder often holds
Unity's two must-not-ship debug folders (here 2.4 GB of `.pdb` files, ~1,300 of 1,728 files) and
any local-testing file left beside the exe. A local config that the runtime applies over baked
settings is the dangerous one: uploaded, it can switch the cloud player off the launcher sign-in.

The dry run shows only the first ~20 files, then `... and N more files`, so it will not reliably
show you these. Check the folder yourself.

**Do this instead:** move those entries out of the folder (a same-volume move is a rename, so it is
instant) for the upload, and move them back in a `finally`. Compare the dry run's `Total files`
before and after as evidence that the move took effect.
