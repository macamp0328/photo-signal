#!/usr/bin/env bash
# cleanup-worktrees.sh — Identify and optionally prune stale git worktrees.
#
# Usage:
#   ./scripts/cleanup-worktrees.sh           # Dry run: show status table
#   ./scripts/cleanup-worktrees.sh --prune   # Remove stale worktrees (prompts for confirmation)
#   ./scripts/cleanup-worktrees.sh --prune --yes  # Remove without confirmation
#
# A worktree is STALE if its branch is merged into main (safe to remove).
# A worktree is PROTECTED if it has uncommitted changes, unpushed commits, or unmerged work.
# When run from a linked worktree it is shown as ACTIVE (current); from the main (non-linked)
# worktree it is shown as MAIN (current).

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
PRUNE=false
YES=false

for arg in "$@"; do
  case "$arg" in
    --prune) PRUNE=true ;;
    --yes)   YES=true ;;
    *)
      echo "Usage: $0 [--prune] [--yes]" >&2
      exit 1
      ;;
  esac
done

# ── Collect worktree list ────────────────────────────────────────────────────

# git worktree list --porcelain output:
#   worktree <path>
#   HEAD <sha>
#   branch refs/heads/<name>   (or "detached")
#   <blank line>

declare -a WT_PATHS WT_BRANCHES WT_HEADS

current_path=""
current_branch=""
current_head=""

while IFS= read -r line; do
  if [[ "$line" == worktree\ * ]]; then
    current_path="${line#worktree }"
  elif [[ "$line" == HEAD\ * ]]; then
    current_head="${line#HEAD }"
  elif [[ "$line" == branch\ * ]]; then
    current_branch="${line#branch refs/heads/}"
  elif [[ -z "$line" ]] && [[ -n "$current_path" ]]; then
    WT_PATHS+=("$current_path")
    WT_BRANCHES+=("$current_branch")
    WT_HEADS+=("$current_head")
    current_path=""
    current_branch=""
    current_head=""
  fi
done < <(git -C "$REPO_ROOT" worktree list --porcelain; echo "")

CURRENT_WT="$(git -C "$REPO_ROOT" rev-parse --show-toplevel)"
# The first entry in git worktree list is always the main (non-linked) repo
MAIN_REPO_PATH="${WT_PATHS[0]:-}"
MAIN_HEAD="$(git -C "$REPO_ROOT" rev-parse main 2>/dev/null || git -C "$REPO_ROOT" rev-parse master 2>/dev/null)"

# ── Analyse each worktree ────────────────────────────────────────────────────

declare -a STALE_PATHS STALE_BRANCHES

printf "\n%-40s %-40s %s\n" "WORKTREE" "BRANCH" "STATUS"
printf "%-40s %-40s %s\n" "$(printf '%0.s-' {1..38})" "$(printf '%0.s-' {1..38})" "------"

total=0
stale_count=0
protected_count=0
active_count=0

for i in "${!WT_PATHS[@]}"; do
  path="${WT_PATHS[$i]}"
  branch="${WT_BRANCHES[$i]}"
  head="${WT_HEADS[$i]}"

  # Shorten path for display
  display_path="${path#"$REPO_ROOT/"}"
  [[ "$display_path" == "$path" ]] && display_path="$(basename "$path")"

  # Shorten branch for display (strip claude/ and copilot/ prefixes)
  display_branch="${branch#claude/}"
  display_branch="${display_branch#copilot/}"

  # Skip the main (non-linked) worktree — always the first entry in the list
  if [[ "$path" == "$MAIN_REPO_PATH" ]]; then
    label="MAIN"
    [[ "$path" == "$CURRENT_WT" ]] && label="MAIN (current)"
    printf "%-40s %-40s %s\n" "${display_path:0:38}" "${display_branch:0:38}" "$label"
    continue
  fi

  total=$((total + 1))

  # Current worktree (the one running this script)
  if [[ "$path" == "$CURRENT_WT" ]]; then
    printf "%-40s %-40s %s\n" "${display_path:0:38}" "${display_branch:0:38}" "ACTIVE (current)"
    active_count=$((active_count + 1))
    continue
  fi

  # ── Staleness check: branch merged into main ────────────────────────────

  is_merged=false
  if git -C "$REPO_ROOT" branch --merged main 2>/dev/null | grep -qxF "  $branch" 2>/dev/null; then
    is_merged=true
  elif [[ -n "$head" && "$head" != "0000000000000000000000000000000000000000" ]]; then
    # Also stale if the worktree commit is reachable from main
    if git -C "$REPO_ROOT" merge-base --is-ancestor "$head" "$MAIN_HEAD" 2>/dev/null; then
      is_merged=true
    fi
  fi

  # ── Safety check: uncommitted changes ──────────────────────────────────

  has_uncommitted=false
  if git -C "$path" status --porcelain 2>/dev/null | grep -q .; then
    has_uncommitted=true
  fi

  # ── Safety check: unpushed commits ─────────────────────────────────────
  # Only check when we have a branch name and a matching remote ref.

  has_unpushed=false
  if [[ -n "$branch" ]] && git -C "$REPO_ROOT" show-ref --verify --quiet "refs/remotes/origin/$branch"; then
    if git -C "$path" log "origin/$branch..HEAD" --oneline 2>/dev/null | grep -q .; then
      has_unpushed=true
    fi
  fi

  # ── Classify ────────────────────────────────────────────────────────────

  if $has_uncommitted; then
    status="PROTECTED (uncommitted changes)"
    protected_count=$((protected_count + 1))
  elif $has_unpushed; then
    status="PROTECTED (unpushed commits)"
    protected_count=$((protected_count + 1))
  elif $is_merged; then
    status="STALE (merged)"
    STALE_PATHS+=("$path")
    STALE_BRANCHES+=("$branch")
    stale_count=$((stale_count + 1))
  else
    status="ACTIVE"
    active_count=$((active_count + 1))
  fi

  printf "%-40s %-40s %s\n" "${display_path:0:38}" "${display_branch:0:38}" "$status"
done

echo ""
echo "Summary: $total worktrees — $stale_count stale, $protected_count protected, $active_count active"

# ── Prune mode ──────────────────────────────────────────────────────────────

if ! $PRUNE; then
  if [[ $stale_count -gt 0 ]]; then
    echo ""
    echo "Run with --prune to remove stale worktrees."
  fi
  exit 0
fi

if [[ $stale_count -eq 0 ]]; then
  echo ""
  echo "Nothing to prune."
  exit 0
fi

echo ""

if ! $YES; then
  read -r -p "Remove $stale_count stale worktree(s)? [y/N] " confirm
  if [[ "${confirm,,}" != "y" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

removed=0
for i in "${!STALE_PATHS[@]}"; do
  path="${STALE_PATHS[$i]}"
  branch="${STALE_BRANCHES[$i]}"

  echo "Removing: $path ($branch)..."
  git -C "$REPO_ROOT" worktree remove "$path" 2>/dev/null || \
    git -C "$REPO_ROOT" worktree remove --force "$path"

  # Safe-delete the local branch (fails gracefully if not merged)
  git -C "$REPO_ROOT" branch -d "$branch" 2>/dev/null && \
    echo "  Deleted branch $branch" || \
    echo "  Branch $branch kept (not fully merged via git — skipping)"

  removed=$((removed + 1))
done

git -C "$REPO_ROOT" worktree prune

echo ""
echo "✓ Removed $removed stale worktree(s) and pruned metadata."
