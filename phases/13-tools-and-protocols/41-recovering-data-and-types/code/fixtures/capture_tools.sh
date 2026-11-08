#!/bin/sh
set -u
cd "$(dirname "$0")"
mkdir -p tools

LLDB=${LLDB:-lldb}
RIZIN=${RIZIN:-rizin}
R2=${R2:-r2}
PYTHON_WITH_PYELFTOOLS=${PYTHON_WITH_PYELFTOOLS:-python3}
GHIDRA_INSTALL_DIR=${GHIDRA_INSTALL_DIR:-}

if command -v "$LLDB" >/dev/null 2>&1; then
  "$LLDB" --version > tools/lldb-version.txt 2>&1
  "$LLDB" -b -o 'image lookup -t account' -o 'image lookup -n bump' account-x86_64-O0-g.o > tools/lldb-account.txt 2>&1
  "$LLDB" -b -o 'image lookup -t Rect' -o 'image lookup -t Shape' shapes-x86_64-O0-g.o > tools/lldb-shapes.txt 2>&1
else
  echo "lldb absent"
fi

if command -v "$RIZIN" >/dev/null 2>&1; then
  "$RIZIN" -v > tools/rizin-version.txt 2>&1
  "$RIZIN" -A -q -e bin.dbginfo=true -e scr.color=0 -c 'echo [ts]; ts; echo [tsc account]; tsc account; echo [afvd in bump]; afvd @ sym.bump; echo [pdf of bump]; pdf @ sym.bump' account-x86_64-O0-g.o > tools/rizin-account.txt 2>&1
  "$RIZIN" -A -q -e scr.color=0 -c 'echo [ts]; ts; echo [afvd in bump]; afvd @ sym.bump; echo [pdf of bump]; pdf @ sym.bump' account-x86_64-O1.o > tools/rizin-account-nodwarf.txt 2>&1
else
  echo "rizin absent"
fi

if command -v "$R2" >/dev/null 2>&1; then
  "$R2" -v > tools/radare2-version.txt 2>&1
  "$R2" -A -q -e bin.dbginfo=true -e bin.relocs.apply=true -e scr.color=0 -c 'echo [ts]; ts; echo [tsc account]; tsc account; echo [afvd in bump]; afvd @ sym.bump; echo [pdf of bump]; pdf @ sym.bump' account-x86_64-O0-g.o > tools/radare2-account.txt 2>&1
else
  echo "radare2 absent"
fi

if "$PYTHON_WITH_PYELFTOOLS" -c 'import elftools' >/dev/null 2>&1; then
  "$PYTHON_WITH_PYELFTOOLS" -c 'import sys, elftools; print(sys.version.split()[0], elftools.__version__)' > tools/pyelftools-version.txt
  "$PYTHON_WITH_PYELFTOOLS" -I pyelftools_struct.py account-x86_64-O0-g.o > tools/pyelftools-account.txt 2>&1
else
  echo "pyelftools absent"
fi

if [ -n "$GHIDRA_INSTALL_DIR" ] && [ -x "$GHIDRA_INSTALL_DIR/support/analyzeHeadless" ]; then
  PROJ="${TMPDIR:-/tmp}/ghidra41-$$"
  mkdir -p "$PROJ"
  for OBJ in account-x86_64-O0-g.o account-x86_64-O1.o; do
    case "$OBJ" in
      *-g.o) OUT=tools/ghidra-account-dwarf.txt ;;
      *) OUT=tools/ghidra-account-nodwarf.txt ;;
    esac
    "$GHIDRA_INSTALL_DIR/support/analyzeHeadless" "$PROJ" lab41 -import "$OBJ" -postScript ListTypes.java -scriptPath ghidra -deleteProject 2>&1 \
      | sed -n 's/^INFO  ListTypes.java> \(.*\) (GhidraScript) *$/\1/p' > "$OUT"
  done
  "$GHIDRA_INSTALL_DIR/support/analyzeHeadless" "$PROJ" lab41 -import shapes-x86_64-O0-g.o -postScript ListTypes.java -scriptPath ghidra -deleteProject 2>&1 \
    | sed -n 's/^INFO  ListTypes.java> \(.*\) (GhidraScript) *$/\1/p' > tools/ghidra-shapes-dwarf.txt
  grep "^application.version\|^application.release.name" "$GHIDRA_INSTALL_DIR/Ghidra/application.properties" > tools/ghidra-version.txt
  "${JAVA_HOME:-/usr}/bin/java" -version 2>&1 | grep -m1 "version" >> tools/ghidra-version.txt
  rm -rf "$PROJ"
else
  echo "Ghidra absent (set GHIDRA_INSTALL_DIR)"
fi
