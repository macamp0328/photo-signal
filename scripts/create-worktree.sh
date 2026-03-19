#!/usr/bin/env bash
# create-worktree.sh — Create an isolated git worktree with a unique dev server port.
#
# Usage: ./scripts/create-worktree.sh <branch-name>
# Example: ./scripts/create-worktree.sh claude/my-feature
#
# The worktree name (slug) is derived from the branch name by stripping any
# "claude/" or "copilot/" prefix and replacing non-alphanumeric chars with "-".
# Port assignment: scans existing worktrees for the highest dev port in use and
# increments by 1. Base is 5200 (preview = dev - 1000, so base preview is 4200).

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
WORKTREES_DIR="$REPO_ROOT/.claude/worktrees"

# ── Validate argument ────────────────────────────────────────────────────────

if [ $# -lt 1 ]; then
  echo "Usage: $0 <branch-name>" >&2
  echo "Example: $0 claude/my-feature" >&2
  exit 1
fi

BRANCH="$1"

# ── Derive a slug from the branch name ──────────────────────────────────────

# Strip common prefixes, lowercase, replace non-alphanumeric with dash, trim dashes
SLUG=$(echo "$BRANCH" | sed 's|^claude/||;s|^copilot/||' | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')

if [ -z "$SLUG" ]; then
  echo "Error: could not derive a slug from branch name '$BRANCH'" >&2
  exit 1
fi

WORKTREE_PATH="$WORKTREES_DIR/$SLUG"

if [ -d "$WORKTREE_PATH" ]; then
  echo "Error: worktree already exists at $WORKTREE_PATH" >&2
  exit 1
fi

# ── Find the next available port ─────────────────────────────────────────────

HIGHEST_DEV_PORT=5199  # one below the base so the first worktree gets 5200

# Scan all worktree launch.json files (and the root .claude/launch.json) for the highest
# port already in use so we never collide with an existing worktree or the root config.
scan_launch_json() {
  local file="$1"
  python3 -c "
import json, sys
try:
    data = json.load(open(sys.argv[1]))
    ports = [c.get('port', 0) for c in data.get('configurations', []) if c.get('port', 0) >= 5200]
    print(max(ports) if ports else 0)
except Exception:
    print(0)
" "$file" 2>/dev/null || echo 0
}

# Include root .claude/launch.json
if [ -f "$REPO_ROOT/.claude/launch.json" ]; then
  port=$(scan_launch_json "$REPO_ROOT/.claude/launch.json")
  if [ "$port" -gt "$HIGHEST_DEV_PORT" ] 2>/dev/null; then
    HIGHEST_DEV_PORT=$port
  fi
fi

# Include all worktree launch.json files
if [ -d "$WORKTREES_DIR" ]; then
  while IFS= read -r launch_file; do
    port=$(scan_launch_json "$launch_file")
    if [ "$port" -gt "$HIGHEST_DEV_PORT" ] 2>/dev/null; then
      HIGHEST_DEV_PORT=$port
    fi
  done < <(find "$WORKTREES_DIR" -maxdepth 3 -name "launch.json" 2>/dev/null)
fi

DEV_PORT=$((HIGHEST_DEV_PORT + 1))
PREVIEW_PORT=$((DEV_PORT - 1000))

# ── Create the git worktree ───────────────────────────────────────────────────

echo "Creating worktree '$SLUG' on branch '$BRANCH'..."
git -C "$REPO_ROOT" worktree add "$WORKTREE_PATH" -b "$BRANCH"

# ── Write .claude/launch.json ────────────────────────────────────────────────

mkdir -p "$WORKTREE_PATH/.claude"

python3 - "$WORKTREE_PATH/.claude/launch.json" "$DEV_PORT" "$PREVIEW_PORT" <<'PYEOF'
import json, sys

out_path = sys.argv[1]
dev_port = int(sys.argv[2])
preview_port = int(sys.argv[3])

config = {
    "version": "0.0.1",
    "configurations": [
        {
            "name": "photo-signal",
            "runtimeExecutable": "npm",
            "runtimeArgs": ["run", "preview", "--", "--port", str(preview_port)],
            "port": preview_port,
            "autoPort": True
        },
        {
            "name": "dev",
            "runtimeExecutable": "npx",
            "runtimeArgs": ["vite", "--port", str(dev_port)],
            "port": dev_port,
            "autoPort": True
        },
        {
            "name": "dev-worktree",
            "runtimeExecutable": "npm",
            "runtimeArgs": ["run", "dev", "--", "--port", str(dev_port)],
            "port": dev_port,
            "autoPort": True
        }
    ]
}

with open(out_path, "w") as f:
    json.dump(config, f, indent=2)
    f.write("\n")
PYEOF

# ── Copy settings.json (SessionStart hook) ───────────────────────────────────

if [ -f "$REPO_ROOT/.claude/settings.json" ]; then
  cp "$REPO_ROOT/.claude/settings.json" "$WORKTREE_PATH/.claude/settings.json"
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "✓ Worktree created"
echo "  Name:         $SLUG"
echo "  Branch:       $BRANCH"
echo "  Path:         $WORKTREE_PATH"
echo "  Dev port:     $DEV_PORT  (npm run dev)"
echo "  Preview port: $PREVIEW_PORT  (npm run preview)"
echo ""
echo "Open with: claude \"$WORKTREE_PATH\""
