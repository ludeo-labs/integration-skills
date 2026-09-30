---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 7
question: "Does the Unity build folder you are about to upload hold anything that must not ship (the `_BackUpThisFolder_ButDontShipItWithYourGame` / `_BurstDebugInformation_DoNotShip` folders, a local-testing config file)? Check the folder itself before the first upload."
sanitized: true
---

# `ludeo builds upload` sends every file in the folder

Observed on Ludeo CLI v1.6.2, on the first upload of an engagement. For the CLI's login, see
[[ludeo-cli-set-token-ignores-config]].

## There is no exclude option

`builds upload` sends everything under `--local-directory`. A Unity player folder often holds
Unity's two must-not-ship debug folders (here 2.4 GB of `.pdb` files, ~1,300 of 1,728 files) and
any local-testing file left beside the exe. A local config that the runtime applies over baked
settings is the dangerous one: uploaded, it can switch the cloud player off the launcher sign-in.

The dry run shows only the first ~20 files, then `... and N more files`, so it will not reliably
show you these. Check the folder yourself.

**Do this instead:** move those entries out of the folder (a same-volume move is a rename, so it is
instant) for the upload, and move them back in a `finally`. Compare the dry run's `Total files`
before and after as evidence that the move took effect.
