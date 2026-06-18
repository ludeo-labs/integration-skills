#!/usr/bin/env bash
# sync-learnings.sh — Copy learnings from the installed skill location back to this repo.
# Run this periodically to ensure accumulated learnings are committed and not lost.
#
# Usage: bash .dev/scripts/sync-learnings.sh
#
# The installed skill location is determined by scanning common Claude Code skill paths.
# If your skill is installed elsewhere, set SKILL_DIR before running:
#   SKILL_DIR=/path/to/skill bash .dev/scripts/sync-learnings.sh

set -euo pipefail

# Resolve the SKILL root (NOT the git toplevel). In the integration-skills
# monorepo the git toplevel is the repo root, not this skill — so climb two
# levels from .dev/scripts/ to reach skills/ludeo-unreal/. The git commands
# below still work: they pass absolute paths and git resolves the enclosing repo.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_LEARNINGS="$REPO_DIR/learnings"

# --- Find the installed skill directory ---
if [ -z "${SKILL_DIR:-}" ]; then
    # Search common locations
    # The installed name follows the SKILL.md frontmatter (ludeo-unreal-integration);
    # also try the monorepo folder name (ludeo-unreal) in case the installer uses it.
    CANDIDATES=(
        "$HOME/.claude/skills/ludeo-unreal-integration"
        "${USERPROFILE:-}/.claude/skills/ludeo-unreal-integration"
        "$HOME/.claude/skills/ludeo-unreal"
        "${USERPROFILE:-}/.claude/skills/ludeo-unreal"
        "$HOME/.claude/plugins/cache/*/skills/ludeo-unreal"
        "/mnt/c/Users/*/.claude/skills/ludeo-unreal-integration"
        "/mnt/c/Users/*/.claude/skills/ludeo-unreal"
        "/mnt/c/Users/*/.claude/plugins/cache/*/skills/ludeo-unreal"
    )
    for candidate in "${CANDIDATES[@]}"; do
        # Handle glob expansion
        for expanded in $candidate; do
            if [ -d "$expanded/learnings" ]; then
                SKILL_DIR="$expanded"
                break 2
            fi
        done
    done
fi

if [ -z "${SKILL_DIR:-}" ] || [ ! -d "$SKILL_DIR/learnings" ]; then
    echo "ERROR: Could not find installed skill with learnings directory."
    echo "Set SKILL_DIR to the skill's root directory and re-run:"
    echo "  SKILL_DIR=/path/to/skill bash scripts/sync-learnings.sh"
    exit 1
fi

SKILL_LEARNINGS="$SKILL_DIR/learnings"

echo "Source (installed skill): $SKILL_LEARNINGS"
echo "Target (this repo):       $REPO_LEARNINGS"
echo ""

# --- Sync: copy new/updated files from skill to repo ---
NEW_COUNT=0
UPDATED_COUNT=0
SKIPPED_COUNT=0
CONFLICT_COUNT=0

for category in "$SKILL_LEARNINGS"/*/; do
    [ -d "$category" ] || continue
    category_name=$(basename "$category")
    target_dir="$REPO_LEARNINGS/$category_name"
    mkdir -p "$target_dir"

    for file in "$category"*.md; do
        [ -f "$file" ] || continue
        filename=$(basename "$file")
        target_file="$target_dir/$filename"

        if [ ! -f "$target_file" ]; then
            cp "$file" "$target_file"
            echo "  NEW: $category_name/$filename"
            NEW_COUNT=$((NEW_COUNT + 1))
        elif ! diff -q "$file" "$target_file" > /dev/null 2>&1; then
            # Guard: this sync is direction-blind (installed wins), which has
            # repeatedly clobbered committed repo-side edits that weren't yet
            # mirrored to the installed copy. If the repo file's last COMMIT is
            # newer than the installed file's mtime, the repo edit postdates the
            # installed content — skip and tell the operator to push repo->installed.
            if git -C "$REPO_DIR" ls-files --error-unmatch "$target_file" > /dev/null 2>&1; then
                repo_commit_ts=$(git -C "$REPO_DIR" log -1 --format=%ct -- "$target_file" 2>/dev/null || echo 0)
                inst_ts=$(stat -c %Y "$file" 2>/dev/null || echo 0)
                if [ "${repo_commit_ts:-0}" -gt "${inst_ts:-0}" ]; then
                    echo "  CONFLICT (skipped): $category_name/$filename"
                    echo "    repo commit is NEWER than the installed copy — mirror repo->installed first"
                    echo "    (copy the repo file over \$SKILL_DIR, or reinstall the skill), then re-run this sync."
                    CONFLICT_COUNT=$((CONFLICT_COUNT + 1))
                    continue
                fi
            fi
            cp "$file" "$target_file"
            echo "  UPDATED: $category_name/$filename"
            UPDATED_COUNT=$((UPDATED_COUNT + 1))
        else
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        fi
    done
done

echo ""
echo "Done. $NEW_COUNT new, $UPDATED_COUNT updated, $SKIPPED_COUNT unchanged, $CONFLICT_COUNT conflict(s) skipped."

# --- Regenerate the learnings index (Step 3 loads it; stale = new learnings invisible) ---
if command -v node > /dev/null 2>&1; then
    node "$REPO_DIR/scripts/generate-learnings-index.mjs"
elif command -v node.exe > /dev/null 2>&1 && command -v wslpath > /dev/null 2>&1; then
    node.exe "$(wslpath -w "$REPO_DIR/scripts/generate-learnings-index.mjs")"   # WSL: Windows node via interop
else
    echo "WARNING: node not found — learnings/INDEX.md NOT regenerated."
    echo "Run manually: node scripts/generate-learnings-index.mjs (validate-skill.mjs fails while stale)"
fi

if [ $((NEW_COUNT + UPDATED_COUNT)) -gt 0 ]; then
    echo ""
    echo "New/updated files are in your working tree. Review and commit:"
    echo "  cd $REPO_DIR"
    echo "  git add learnings/"
    echo "  git commit -m 'chore: sync learnings from installed skill'"
fi
