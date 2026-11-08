# Fixtures for lesson 32

Every file here is a program you built. `ledger.c` is the shared fixture of the reverse engineering track (the same source as `manuals/reverse-engineering-101/capture/fixtures/ledger.c`). The objects were built on macOS 26.2 with Apple clang 17.0.0 (clang-1700.6.3.2) and SDK 26.2. `build_fixtures.sh` runs every command below.

| File | Exact build command |
|---|---|
| `ledger-x86_64-O0.o` | `clang -target x86_64-unknown-linux-gnu -O0 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O0.o` |
| `ledger-x86_64-O1.o` | `clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O1.o` |
| `ledger-x86_64-O2.o` | `clang -target x86_64-unknown-linux-gnu -O2 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O2.o` |
| `ledger-arm64-O1.o` | `clang -target arm64-apple-macos -O1 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-arm64-O1.o` |
| `tiny-x86_64` | `python3 build_tiny_elf.py` |

The three x86-64 objects need no Linux sysroot because `ledger.c` includes no headers. The arm64 object carries an `LC_BUILD_VERSION` command with the SDK version, so a build with another SDK gives different bytes. The committed bytes are the fixture, and the tests read them, so the build is not part of the test run.

Oracle text, captured with `/Library/Developer/CommandLineTools/usr/bin/llvm-objdump` (Apple LLVM version 17.0.0):

| File | Capture command |
|---|---|
| `ledger-x86_64-O0.objdump.txt` | `llvm-objdump -h -t -r ledger-x86_64-O0.o` |
| `ledger-x86_64-O1.objdump.txt` | `llvm-objdump -h -t -r ledger-x86_64-O1.o` |
| `ledger-x86_64-O2.objdump.txt` | `llvm-objdump -h -t -r ledger-x86_64-O2.o` |
| `ledger-arm64-O1.objdump.txt` | `llvm-objdump -h -t -r ledger-arm64-O1.o` |
| `ledger-arm64-O1.load-commands.txt` | `llvm-objdump --macho --private-headers ledger-arm64-O1.o` |
| `tiny-x86_64.objdump.txt` | `llvm-objdump -h -t -r -p tiny-x86_64` |

SHA-256 of the objects:

```
b2046c121930d3d1e5ba84ba796f9e9e161df2fe76f7b9dcf8db63f690447e13  ledger-x86_64-O0.o
9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f  ledger-x86_64-O1.o
ce31eaf10e7cb88fb8e313abfdb4f743964646339260c471ff97d60137bbe89b  ledger-x86_64-O2.o
fe67e3783e24427e4c3264e0e6ff9060f685cdd0939def1cdd99dad66e21c900  ledger-arm64-O1.o
```
