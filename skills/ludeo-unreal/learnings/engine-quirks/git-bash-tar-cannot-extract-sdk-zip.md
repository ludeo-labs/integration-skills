---
category: engine-quirks
tier: universal
sourceGame: EndlessFPS
phase: 3
question: null
sanitized: true
---

# On Windows, don't extract the SDK release zip with git-bash `tar` — use Python or Expand-Archive

The LudeoUESDK release asset is a **zip** (~816 MB, ~4 GB extracted). On Windows,
the `tar` available inside git-bash is **GNU tar**, which does not read the zip
container — it fails with:

```
tar: This does not look like a tar archive
tar: Skipping to next header
tar: Exiting with failure status due to previous errors
```

It can exit non-zero having extracted nothing (or worse, a partial tree).

**Use a zip-aware extractor instead:**

```bash
# Reliable, cross-platform, and fast (~10s for the SDK zip):
python -c "import zipfile; zipfile.ZipFile('LudeoUESDK-<tag>.zip').extractall('Plugins/LudeoUESDK')"
```

or PowerShell `Expand-Archive` (slower for multi-GB archives but works).

`robocopy`/`cp` for tree copies and `Expand-Archive`/Python `zipfile` for zips —
verify the extract afterward (e.g. the C SDK `…/SDK/Bin/Win64/Release/LudeoSDK-Win64-Release.dll`
exists) before assuming success, because a failed/partial extract can still report
a zero file count rather than an error.
