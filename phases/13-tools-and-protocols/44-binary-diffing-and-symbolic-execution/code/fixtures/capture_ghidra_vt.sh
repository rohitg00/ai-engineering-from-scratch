#!/bin/sh
set -eu
cd "$(dirname "$0")"
GHIDRA="${GHIDRA_HOME:-/opt/homebrew/Cellar/ghidra/12.1.4/libexec}"
HEADLESS="$GHIDRA/support/analyzeHeadless"
WORK="${GHIDRA_WORK:-${TMPDIR:-/tmp}/ledger-version-tracking}"
SCRIPTS="$(pwd)/ghidra"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
mkdir -p "$WORK/project" "$WORK/settings" "$WORK/cache" "$WORK/tmp"
export XDG_CONFIG_HOME="$WORK/settings"
export XDG_CACHE_HOME="$WORK/cache"
export JAVA_TOOL_OPTIONS="-Djava.io.tmpdir=$WORK/tmp -Dapplication.settingsdir=$WORK/settings -Dapplication.cachedir=$WORK/cache"

"$HEADLESS" "$WORK/project" ledger -import ledger-x86_64-O0.o ledger-x86_64-O1.o ledger-x86_64-O2.o -overwrite > "$WORK/import.log" 2>&1

"$HEADLESS" "$WORK/project" ledger -process ledger-x86_64-O2.o -noanalysis -scriptPath "$SCRIPTS" -postScript ListVersionTrackingMatches.java /ledger-x86_64-O0.o /ledger-x86_64-O1.o > "$WORK/vt-O0-vs-O1.log" 2>&1
sed -n 's/.*> \(VT|.*\) (GhidraScript).*/\1/p' "$WORK/vt-O0-vs-O1.log" > ghidra-vt-O0-vs-O1.txt

"$HEADLESS" "$WORK/project" ledger -process ledger-x86_64-O0.o -noanalysis -scriptPath "$SCRIPTS" -postScript ListVersionTrackingMatches.java /ledger-x86_64-O1.o /ledger-x86_64-O2.o > "$WORK/vt-O1-vs-O2.log" 2>&1
sed -n 's/.*> \(VT|.*\) (GhidraScript).*/\1/p' "$WORK/vt-O1-vs-O2.log" > ghidra-vt-O1-vs-O2.txt

"$JAVA_HOME/bin/java" -version 2>&1 | head -1 > ghidra-version.txt
sed -n 's/.*VT|ghidra|\(.*\) (GhidraScript).*/Ghidra \1/p' "$WORK/vt-O1-vs-O2.log" | head -1 >> ghidra-version.txt
