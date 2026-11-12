#!/usr/bin/env bash
set -euo pipefail

# Install the agent workbench pack into the current repo.
# Usage: bin/install.sh [--force]
#
# Every packaged file is checked before anything is written. Without --force,
# an existing file with different content stops the install before the target
# is touched; re-installing an identical pack is a clean no-op. --force
# replaces conflicting regular files. A symlinked destination (or a symlinked
# directory on the way to it) is replaced with a real one, never written
# through, so no write lands outside the target repository.

FORCE="${1:-}"
TARGET="$(pwd)"
PACK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

required=("AGENTS.md" "VERSION" "docs" "schemas" "scripts")
for path in "${required[@]}"; do
    if [[ ! -e "$PACK_ROOT/$path" ]]; then
        echo "missing pack source: $PACK_ROOT/$path" >&2
        exit 1
    fi
done

# Managed files: source under the pack, destination relative to the target.
sources=()
dests=()
sources+=("$PACK_ROOT/AGENTS.md"); dests+=("AGENTS.md")
sources+=("$PACK_ROOT/VERSION");   dests+=(".workbench-version")
while IFS= read -r src; do
    sources+=("$src")
    dests+=("${src#"$PACK_ROOT/"}")
done < <(find "$PACK_ROOT/docs" "$PACK_ROOT/schemas" "$PACK_ROOT/scripts" -type f | sort)

# Pass 1: classify every destination before writing anything.
conflicts=()
for i in "${!sources[@]}"; do
    rel="${dests[$i]}"
    dest="$TARGET/$rel"
    probe="$TARGET"
    IFS=/ read -ra parts <<< "$rel"
    for part in "${parts[@]:0:${#parts[@]}-1}"; do
        probe="$probe/$part"
        if [[ -L "$probe" ]] || { [[ -e "$probe" ]] && [[ ! -d "$probe" ]]; }; then
            conflicts+=("$rel (path component $part is not a real directory)")
            continue 2
        fi
    done
    if [[ -L "$dest" ]]; then
        conflicts+=("$rel (symlink)")
    elif [[ -e "$dest" ]] && ! cmp -s "${sources[$i]}" "$dest"; then
        conflicts+=("$rel (differs)")
    fi
done

if [[ "$FORCE" != "--force" ]] && (( ${#conflicts[@]} > 0 )); then
    echo "refusing to overwrite; pass --force to replace:" >&2
    printf '  %s\n' "${conflicts[@]}" >&2
    exit 1
fi

# Pass 2: write. Identical files are left untouched so re-installing an
# already installed pack is idempotent.
for i in "${!sources[@]}"; do
    rel="${dests[$i]}"
    dest="$TARGET/$rel"
    dir="$TARGET"
    IFS=/ read -ra parts <<< "$rel"
    for part in "${parts[@]:0:${#parts[@]}-1}"; do
        dir="$dir/$part"
        if [[ -L "$dir" ]]; then
            rm "$dir" # replace a symlinked directory instead of writing through it
        fi
        mkdir -p "$dir"
    done
    if [[ -L "$dest" ]] || ! cmp -s "${sources[$i]}" "$dest" 2>/dev/null; then
        rm -f "$dest" # a symlinked destination is replaced, not followed
        cp "${sources[$i]}" "$dest"
    fi
done

echo "pack installed at version $(cat "$PACK_ROOT/VERSION")"
echo "next: edit task_board.json, set acceptance commands, run scripts/init_agent.py"
