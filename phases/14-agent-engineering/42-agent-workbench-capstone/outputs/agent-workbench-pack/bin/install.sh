#!/usr/bin/env bash
set -euo pipefail

# Install the agent workbench pack into the current repo.
# Usage: bin/install.sh [--force]

if [[ $# -gt 1 || ( $# -eq 1 && "$1" != "--force" ) ]]; then
    echo "Usage: bin/install.sh [--force]" >&2
    exit 2
fi
FORCE="${1:-}"
TARGET="$(pwd -P)"
PACK_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"

required=("AGENTS.md" "VERSION" "docs" "schemas" "scripts")
for path in "${required[@]}"; do
    if [[ ! -e "$PACK_ROOT/$path" ]]; then
        echo "missing pack source: $PACK_ROOT/$path" >&2
        exit 1
    fi
done

sources=("$PACK_ROOT/AGENTS.md" "$PACK_ROOT/VERSION")
while IFS= read -r -d '' source; do
    sources+=("$source")
done < <(find "$PACK_ROOT/docs" "$PACK_ROOT/schemas" "$PACK_ROOT/scripts" -type f -print0)

conflicts=()
for source in "${sources[@]}"; do
    if [[ "$source" == "$PACK_ROOT/VERSION" ]]; then
        relative=".workbench-version"
    else
        relative="${source#"$PACK_ROOT"/}"
    fi
    destination="$TARGET/$relative"
    current="$TARGET"
    IFS='/' read -r -a components <<< "$relative"
    unsafe=false
    for ((index = 0; index < ${#components[@]}; index++)); do
        current="$current/${components[index]}"
        if [[ -L "$current" ]]; then
            conflicts+=("$relative (symlinked path)")
            unsafe=true
            break
        fi
        if (( index < ${#components[@]} - 1 )) && [[ -e "$current" && ! -d "$current" ]]; then
            conflicts+=("$relative (non-directory parent)")
            unsafe=true
            break
        fi
    done
    if [[ "$unsafe" == true ]]; then
        continue
    fi
    if [[ -e "$destination" ]]; then
        if [[ ! -f "$destination" ]]; then
            conflicts+=("$relative (not a regular file)")
        elif [[ "$FORCE" != "--force" ]] && ! cmp -s "$source" "$destination"; then
            conflicts+=("$relative (different existing file)")
        fi
    fi
done

if (( ${#conflicts[@]} )); then
    echo "target conflicts; no files were installed:" >&2
    printf '  %s\n' "${conflicts[@]}" >&2
    echo "Use --force to replace conflicting regular files; resolve symlinked paths separately." >&2
    exit 1
fi

mkdir -p "$TARGET/docs" "$TARGET/schemas" "$TARGET/scripts"
for source in "${sources[@]}"; do
    if [[ "$source" == "$PACK_ROOT/VERSION" ]]; then
        relative=".workbench-version"
    else
        relative="${source#"$PACK_ROOT"/}"
    fi
    destination="$TARGET/$relative"
    if [[ -e "$destination" && "$FORCE" != "--force" ]]; then
        continue
    fi
    mkdir -p "$(dirname "$destination")"
    cp -p "$source" "$destination"
done

echo "pack installed at version $(cat "$PACK_ROOT/VERSION")"
echo "next: edit task_board.json, set acceptance commands, run scripts/init_agent.py"
