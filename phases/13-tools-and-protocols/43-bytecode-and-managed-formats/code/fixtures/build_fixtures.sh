#!/bin/sh
set -eu
cd "$(dirname "$0")"

JDK21=/opt/homebrew/opt/openjdk@21/bin
JDK25=/opt/homebrew/opt/openjdk/bin
DOTNET=${DOTNET:-/usr/local/share/dotnet/dotnet}
unset JAVA_TOOL_OPTIONS
export PYTHONDONTWRITEBYTECODE=1
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
WORK=$(mktemp -d "${TMPDIR:-/tmp}/ledger-fixtures.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
export DOTNET_CLI_HOME="$WORK/dotnet-home" NUGET_PACKAGES="$WORK/nuget"

{
  echo "captured $(date -u +%Y-%m-%dT%H:%M:%SZ) on $(uname -sm)"
  for py in python3.11 python3.12 python3.13 python3.14; do
    command -v "$py" >/dev/null 2>&1 && "$py" --version
  done
  "$JDK21/javac" -version 2>&1
  "$JDK25/javac" -version 2>&1
  echo "wabt $(wat2wasm --version)"
  echo "dotnet sdk $("$DOTNET" --version)"
} > versions.txt

for py in python3.11 python3.12 python3.13 python3.14; do
  command -v "$py" >/dev/null 2>&1 || { echo "skip $py: not installed"; continue; }
  "$py" python/compile_pyc.py
  tag=$("$py" -c 'import sys; print(sys.implementation.cache_tag)')
  (cd python && "$py" -m dis ledger.py > "ledger.$tag.dis.txt")
done
(cd python && python3.14 -m dis -C -O ledger.py > ledger.cpython-314.dis-caches.txt)
python3.14 python/compile_pyc.py adaptive > python/ledger.cpython-314.adaptive.txt

"$JDK21/javac" -d "$WORK/default" java/Ledger.java && cp "$WORK/default/Ledger.class" java/Ledger.class
"$JDK21/javac" -g -d "$WORK/g" java/Ledger.java && cp "$WORK/g/Ledger.class" java/Ledger-g.class
"$JDK21/javac" -g:none -d "$WORK/gnone" java/Ledger.java && cp "$WORK/gnone/Ledger.class" java/Ledger-gnone.class
"$JDK25/javac" -d "$WORK/jdk25" java/Ledger.java && cp "$WORK/jdk25/Ledger.class" java/Ledger-jdk25.class
for variant in Ledger Ledger-g Ledger-gnone Ledger-jdk25; do
  "$JDK21/javap" -v -p "java/$variant.class" > "java/$variant.javap-v.txt"
  "$JDK21/javap" -c -p "java/$variant.class" > "java/$variant.javap-c.txt"
done

wat2wasm wasm/ledger.wat -o "$WORK/ledger.wasm"
cmp "$WORK/ledger.wasm" wasm/ledger.wasm
wat2wasm --debug-names wasm/ledger.wat -o wasm/ledger-names.wasm
wasm-validate wasm/ledger.wasm
wasm-validate wasm/ledger-names.wasm
wasm2wat wasm/ledger.wasm > wasm/ledger.wasm2wat.txt
wasm2wat wasm/ledger-names.wasm > wasm/ledger-names.wasm2wat.txt
wasm-objdump -h -x -d wasm/ledger.wasm > wasm/ledger.objdump.txt
wasm-objdump -h -x -d wasm/ledger-names.wasm > wasm/ledger-names.objdump.txt

mkdir -p "$WORK/ledgernet" "$WORK/metadump"
cp dotnet/Ledger.cs dotnet/LedgerNet.csproj "$WORK/ledgernet/"
cp dotnet/MetaDump/Program.cs dotnet/MetaDump/MetaDump.csproj "$WORK/metadump/"
"$DOTNET" build "$WORK/ledgernet/LedgerNet.csproj" -c Release -o "$WORK/ledgernet/out" --nologo -v quiet
cp "$WORK/ledgernet/out/LedgerNet.dll" dotnet/LedgerNet.dll
"$DOTNET" build "$WORK/metadump/MetaDump.csproj" -c Release -o "$WORK/metadump/out" --nologo -v quiet
"$DOTNET" "$WORK/metadump/out/MetaDump.dll" dotnet/LedgerNet.dll > dotnet/LedgerNet.metadump.txt

if command -v rabin2 >/dev/null 2>&1 && command -v radare2 >/dev/null 2>&1; then
  { rabin2 -I java/Ledger-g.class; radare2 -e scr.color=0 -qc 'pd 14 @ sym.Ledger.grade' java/Ledger-g.class; } > java/Ledger-g.r2.txt 2>&1
  { rabin2 -I wasm/ledger.wasm; radare2 -e scr.color=0 -qc 'is; pd 28 @ sym.grade' wasm/ledger.wasm; } > wasm/ledger.r2.txt 2>&1
  { rabin2 -I dotnet/LedgerNet.dll; radare2 -e scr.color=0 -qc 'is~Ledger.' dotnet/LedgerNet.dll; } > dotnet/LedgerNet.r2.txt 2>&1
  radare2 -v | head -1 >> versions.txt
else
  echo "skip radare2 captures: rabin2 or radare2 not on PATH"
fi

shasum -a 256 python/*.pyc java/*.class wasm/*.wasm dotnet/*.dll native/*.o > sha256.txt
cat versions.txt
