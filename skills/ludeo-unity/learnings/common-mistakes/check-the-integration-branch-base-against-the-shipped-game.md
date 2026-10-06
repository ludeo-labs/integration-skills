---
category: common-mistakes
tier: generalizable
sourceGame: IdleSample
phase: "1,7"
question: "Was the Ludeo integration branch cut from the trunk while game development continued on a separate release/content branch? Compare the integration branch's base with the head of the branch the shipped game is built from."
sanitized: true
---

# Check which game the integration branch actually contains before you ship it

**What happened.** The integration branch was cut from the trunk weeks before release, while the studio
kept shipping from a separate content/release branch (balancing passes, new content, the release
candidate, several hotfixes). Every Ludeo build, cloud uploads included, was a pre-release game. It
surfaced only when a "bug" turned out to be already fixed on the release branch.

## The habit

- **Ask the integrator which branch is the shipped game.** Do not assume it is the trunk.
- **Check at phase 1, and re-check before every upload:** compare the integration branch's base with the
  head of the branch the store build comes from (`git merge-base`, or your VCS's equivalent).
- **If they diverged and the integrator wants the real game:** merge the release head into the
  integration branch, then treat it as a game update. Re-scope every wave against the diff, re-run every
  gate, re-apply and re-check every one-line hook the merge touched by hand, and expect the game's save
  code to refuse or archive saves made by the old builds. Save DTOs are the quiet casualty:
  [[rebuilt-save-dtos-default-every-field-the-capture-never-wrote]].
