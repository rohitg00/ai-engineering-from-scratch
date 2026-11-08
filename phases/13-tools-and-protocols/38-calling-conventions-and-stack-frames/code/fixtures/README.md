# Fixtures for lesson 38

Every object here was compiled on this machine from `convention.c` with the commands in `build_fixtures.sh`. Nothing is downloaded. The compiler was Apple clang 17.0.0 (clang-1700.6.3.2); the listings come from `llvm-objdump` and `llvm-dwarfdump` of Apple LLVM 17.0.0 in the Command Line Tools. `toolchain-versions.txt` records the versions, and `SHA256SUMS.txt` the digests.

`convention.c` declares `memcpy` and `strncpy` itself and includes only `stdarg.h` and `stddef.h`, because no Linux or Windows sysroot is installed and only clang's own headers resolve for the cross targets. The structs use `long long`, because `long` is 4 bytes on the MSVC target and 8 bytes on the others.

| File | Built with | Purpose |
|---|---|---|
| `convention-x86_64-linux-O0.o`, `-O2.o` | `clang -target x86_64-unknown-linux-gnu -O0/-O2 -fno-asynchronous-unwind-tables -c convention.c` | System V AMD64 psABI |
| `convention-x86_64-windows-O0.o`, `-O2.o` | `clang -target x86_64-pc-windows-msvc -O0/-O2 -fno-asynchronous-unwind-tables -c convention.c` | Microsoft x64 |
| `convention-aarch64-linux-O0.o`, `-O2.o` | `clang -target aarch64-unknown-linux-gnu -O0/-O2 -fno-asynchronous-unwind-tables -c convention.c` | AAPCS64 |
| `convention-arm64-macos-O2.o` | `clang -target arm64-apple-macos -O2 -fno-asynchronous-unwind-tables -c convention.c` | Apple arm64 differences (variadic slots, frame record position) |
| `convention-x86_64-windows-O2-seh.o` | same as the Windows `-O2` object without `-fno-asynchronous-unwind-tables` | `.pdata` and `.xdata` unwind tables (`.sections.txt`, `.xdata.txt`, `.relocs.txt`) |
| `convention-x86_64-linux-O2-eh.o`, `convention-aarch64-linux-O2-eh.o` | same as the Linux `-O2` objects without `-fno-asynchronous-unwind-tables` | `.eh_frame` call frame information (`.eh-frame.txt` from `llvm-dwarfdump --eh-frame`) |
| `convention-x86_64-linux-O0-noredzone.o` | Linux `-O0` with `-mno-red-zone` | the leaf frame without the red zone |
| `convention-x86_64-linux-O2-fp.o` | Linux `-O2` with `-fno-omit-frame-pointer` | the frame pointer kept at `-O2` |
| `*.objdump.txt` | `llvm-objdump -d -r FILE.o` | the listings the analyzer reads |
| `*.symbols.txt` | `llvm-objdump -t FILE.o` | symbol tables for reference |

`tools/` holds captures made by `capture_tools.sh` on 2026-10-14: radare2 6.2.4 (`afcl`, `afc`, `afi`, `afv`, `afs`, `afcr`), rizin 0.9.1 (`afcl`, `afc`, `afi`, `afvl`, `afcr`), and angr 10.0.3 (`angr_cc.py`: `CFGFast` then `CompleteCallingConventions`, printing the recovered convention class and prototype). The lesson code reads these captures; it does not need the tools installed.
