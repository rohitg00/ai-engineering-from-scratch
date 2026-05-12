#!/usr/bin/env bash
set -euo pipefail

# Install the agent workbench pack into the current repo.
# Usage: bin/install.sh [--force]

FORCE="${1:-}"
TARGET="$(pwd)"
PACK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -e "$TARGET/AGENTS.md" && "$FORCE" != "--force" ]]; then
    echo "AGENTS.md already exists. Pass --force to overwrite." >&2
    exit 1
fi

cp "$PACK_ROOT/AGENTS.md" "$TARGET/AGENTS.md"
mkdir -p "$TARGET/docs" "$TARGET/schemas" "$TARGET/scripts"
cp -r "$PACK_ROOT/docs/." "$TARGET/docs/"
cp -r "$PACK_ROOT/schemas/." "$TARGET/schemas/"
cp -r "$PACK_ROOT/scripts/." "$TARGET/scripts/"
echo "$(cat "$PACK_ROOT/VERSION")" > "$TARGET/.workbench-version"

echo "pack installed at version $(cat "$PACK_ROOT/VERSION")"
echo "next: edit task_board.json, set acceptance commands, run scripts/init_agent.py"
