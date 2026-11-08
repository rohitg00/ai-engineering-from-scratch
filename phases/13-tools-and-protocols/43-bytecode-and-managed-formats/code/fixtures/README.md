# Fixtures for lesson 43

Every file here was written or built on this machine from the source beside it. `build_fixtures.sh` holds the exact commands and writes `versions.txt` and `sha256.txt`. Nothing is downloaded.

| Folder | Source | Built outputs | Oracle text |
|---|---|---|---|
| `python/` | `ledger.py` (the same four functions as `ledger.c`, plus a `LABELS` tuple) | `ledger.cpython-31N.pyc` (checked-hash) and `ledger.cpython-31N.timestamp.pyc` for N in 1, 2, 3, 4, written by `compile_pyc.py` under each interpreter with `dfile="ledger.py"` | `ledger.cpython-31N.dis.txt` from `python3.1N -m dis ledger.py`, `ledger.cpython-314.dis-caches.txt` from `python3.14 -m dis -C -O ledger.py`, `ledger.cpython-314.adaptive.txt` from `dis.dis(..., adaptive=True)` after 200 calls |
| `java/` | `Ledger.java` | `Ledger.class` (`javac`, JDK 21.0.12.1), `Ledger-g.class` (`javac -g`), `Ledger-gnone.class` (`javac -g:none`), `Ledger-jdk25.class` (`javac`, JDK 25.0.2) | `*.javap-c.txt` from `javap -c -p`, `*.javap-v.txt` from `javap -v -p`, both with JDK 21 |
| `wasm/` | `ledger.wat` (copied from the manual fixtures) | `ledger.wasm` (copied, equal byte for byte to `wat2wasm ledger.wat`), `ledger-names.wasm` from `wat2wasm --debug-names` | `*.wasm2wat.txt` from `wasm2wat`, `*.objdump.txt` from `wasm-objdump -h -x -d`, both wabt 1.0.42 |
| `dotnet/` | `Ledger.cs` and `LedgerNet.csproj` | `LedgerNet.dll` (`dotnet build -c Release`, SDK 8.0.205, net8.0, `DebugType` none) | `LedgerNet.metadump.txt` from `MetaDump/Program.cs`, a System.Reflection.Metadata reader that prints tables, methods, IL bytes, and the `System.Reflection.Emit.OpCodes` table |
| `native/` | `ledger.c` | `ledger-x86_64-O0.o`, copied from lesson 33 (`clang -target x86_64-unknown-linux-gnu -O0 -fno-asynchronous-unwind-tables -c`) | `ledger-x86_64-O0.objdump.txt`, the lesson 33 `llvm-objdump -d` capture |

`java/Ledger-g.r2.txt`, `wasm/ledger.r2.txt`, and `dotnet/LedgerNet.r2.txt` hold `rabin2 -I` and `radare2 -qc` output from radare2 6.2.4, built from source. The build script writes them only when `rabin2` and `radare2` are on `PATH`.

Interpreters and tools recorded in `versions.txt`: Python 3.11.14, 3.12.12, 3.13.12, 3.14.6; javac 21.0.12.1 and 25.0.2; wabt 1.0.42; .NET SDK 8.0.205. Python 3.15 was not installed when the fixtures were built, so the 3.15 magic number in `main.py` comes from the CPython source and not from a file here.

The timestamp pyc files store the mtime of `ledger.py` at build time, 1791975565, and its size, 497. A fresh checkout gives the source a new mtime, so an import would recompile. The checked-hash files do not depend on the mtime.
