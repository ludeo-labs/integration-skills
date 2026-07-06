# VCS Contract — git / GitHub

Implementation of the VCS contract for git. Loaded when `integration.json → vcs.type == "git"`. See `README.md` for the operation list and `detect_vcs`.

State recorded in `integration.json → vcs.git`:
```json
"git": { "remote": "origin", "branch": "ludeo-integration/<game>" }
```

## `create_isolation(name)`

All integration work goes on a dedicated branch. **Tell the human explicitly that you are about to
create a new git branch for the integration**, propose the name, and ask them to confirm before running it:

```bash
git -C "<project>" checkout -b ludeo-integration/<game-name>
```

If the repo has a branch-naming convention, follow it instead (e.g. `feature/ludeo-integration`). Record the chosen branch in `vcs.git.branch`.

## `acquire_component(name, dest)`

The **LudeoUESDK** plugin installs at `Plugins/LudeoUESDK`; the **Ludeo C SDK** belongs at `Plugins/LudeoUESDK/Source/LudeoSDK/SDK`. Source URLs and the release info are in `config/sdk-sources.json`. If already present → confirm. Otherwise ask the human which method:

- **Download & include (recommended):** download the self-contained release zip. The repo is **public** — no auth needed. With `gh`: `gh release download <tag> -R ludeo-labs/unreal-plugin-releases -p '*.zip'` (omit `<tag>` for the latest). **Without `gh`:** a plain HTTPS GET works — `curl -L -O <downloadUrl>` (or `wget`/`Invoke-WebRequest`), or open `…/releases/latest` in a browser; to resolve the latest asset URL programmatically, read `.assets[].browser_download_url` from `https://api.github.com/repos/ludeo-labs/unreal-plugin-releases/releases/latest`. See `config/sdk-sources.json → ludeoUESDKPlugin.release` (`ghDownload` / `noGhDownload` / `downloadUrl`). Extract into `Plugins/LudeoUESDK`, commit directly. The release **bundles the C SDK** at `Source/LudeoSDK/SDK/` — a single download satisfies both components (no separate C SDK step). Prefer this release asset over GitHub's source-archive zip (the latter won't resolve LFS binaries). (If an anonymous GET 404s, the public flip may be pending — fall back to authenticated `gh`; see the config's `privateNote`.)
- **Git submodule:** add the plugin as a submodule, then the C SDK as a **nested** submodule (you cannot add it from the parent root — `cd` into the plugin with an absolute path and combine with `&&`):
  ```bash
  git -C "<project>" submodule add <plugin-repo-url> Plugins/LudeoUESDK
  cd "<project>/Plugins/LudeoUESDK" && git submodule add <csdk-repo-url> Source/LudeoSDK/SDK
  ```
- **Already present:** confirm the path.

After the LudeoUESDK submodule is added, ask whether a specific branch is needed (engine-version or game-specific patches):
```bash
cd "<project>/Plugins/LudeoUESDK" && git checkout <branch>
```

Record `sdkSetup.<component>.method` (`submodule` | `download` | `existing`), `path`, and any `branch`.

## `ensure_editable(path)`

**No-op.** git working-tree files are writable; Write/Edit just work. New files are picked up by `git add` at commit time.

## `open_review(summary)`

Open a GitHub Pull Request from the integration branch (only when the human requests it, after the compile-fix gate passes):

```bash
gh pr create --title "<summary>" --body "<body>"
```

Iterate on PR feedback; capture corrections as learnings.

## `guard_destructive`

Never run an irreversible git command based on a single failed check. Confirm state with at least two independent checks (absolute paths) first. Treat these as destructive and never run them speculatively:

`git reset --hard` · `git checkout -- <path>` · `git submodule deinit` · `git rm --cached` · `git clean -fd` · `rm -rf`

When operating inside a submodule, always `cd` using the full absolute project path and combine subsequent commands with `&&` in a single call — the bash tool does not preserve working directory between calls.
