#!/bin/sh
set -u
cd "$(dirname "$0")"
mkdir -p tools

R2=${R2:-r2}
RIZIN=${RIZIN:-rizin}
PYTHON_WITH_ANGR=${PYTHON_WITH_ANGR:-python3}

FUNCS="leaf_add eight_args mixed by_value big_ret sum_varargs keeps call8 call_varargs"

r2_script() {
  echo "echo [afcl]; afcl;"
  for f in $FUNCS; do
    echo "echo [afc $f]; afc @ sym.$f; echo [afi $f]; afi @ sym.$f; echo [afv $f]; afv @ sym.$f; echo [afs $f]; afs @ sym.$f;"
  done
  echo "echo [afcr eight_args]; afcr @ sym.eight_args;"
}

rizin_script() {
  echo "echo [afcl]; afcl;"
  for f in $FUNCS; do
    echo "echo [afc $f]; afc @ sym.$f; echo [afi $f]; afi @ sym.$f; echo [afvl $f]; afvl @ sym.$f;"
  done
  echo "echo [afcr eight_args]; afcr @ sym.eight_args;"
}

if command -v "$R2" >/dev/null 2>&1; then
  "$R2" -v > tools/radare2-version.txt 2>&1
  for stem in convention-x86_64-linux-O2 convention-x86_64-windows-O2 convention-aarch64-linux-O2 convention-x86_64-linux-O0; do
    "$R2" -A -q -e scr.color=0 -e bin.relocs.apply=true -c "$(r2_script | tr '\n' ' ')" "$stem.o" > "tools/radare2-$stem.txt" 2>&1
  done
else
  echo "radare2 absent"
fi

if command -v "$RIZIN" >/dev/null 2>&1; then
  "$RIZIN" -v > tools/rizin-version.txt 2>&1
  for stem in convention-x86_64-linux-O2 convention-x86_64-windows-O2 convention-aarch64-linux-O2 convention-x86_64-linux-O0; do
    "$RIZIN" -A -q -e scr.color=0 -c "$(rizin_script | tr '\n' ' ')" "$stem.o" > "tools/rizin-$stem.txt" 2>&1
  done
else
  echo "rizin absent"
fi

if "$PYTHON_WITH_ANGR" -c 'import angr' >/dev/null 2>&1; then
  for stem in convention-x86_64-linux-O2 convention-x86_64-windows-O2 convention-aarch64-linux-O2; do
    "$PYTHON_WITH_ANGR" -I angr_cc.py "$stem.o" > "tools/angr-$stem.txt" 2>&1
  done
else
  echo "angr absent"
fi
