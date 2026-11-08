# Fixtures for lesson 40

Every file here is a program you built. `ledger.c` is the shared fixture of the reverse engineering track (the same source as lesson 32). `main.c` calls its four functions, `puts`, and `printf`, and holds a string-pointer table (`names`) and a function-pointer table (`fns`), so the linked image needs both binds and rebases. The objects and images were built on macOS 26.2 with Apple clang 17.0.0 (clang-1700.6.3.2), `ld` from PROJECT:ld-1230.1, and SDK 26.2. `build_fixtures.sh` runs every command below. The committed bytes are the fixture, and the tests read them, so the build is not part of the test run.

Only Mach-O links on this machine. The ELF and COFF objects compile here with `clang -target`, and no ELF or PE link editor is installed, so the two linked images in those formats were written byte by byte by the two Python scripts from the specifications. They were not run; `llvm-objdump` and the library probe read them.

| File | Exact build command |
|---|---|
| `libledger.dylib` | `clang -target arm64-apple-macos -O1 -fno-asynchronous-unwind-tables -dynamiclib -install_name @rpath/libledger.dylib ledger.c -o libledger.dylib` |
| `ledger_main` | `clang -target arm64-apple-macos -O1 -fno-asynchronous-unwind-tables main.c -L. -lledger -Wl,-rpath,@executable_path -o ledger_main` |
| `ledger_main_nochain` | the `ledger_main` command plus `-Wl,-no_fixup_chains` |
| `ledger_main.stripped` | `cp ledger_main ledger_main.stripped && strip ledger_main.stripped` |
| `libledger.stripped.dylib` | `cp libledger.dylib libledger.stripped.dylib && strip libledger.stripped.dylib` |
| `ledger-arm64-O0.o`, `main-arm64-O0.o` | `clang -target arm64-apple-macos -O0 -fno-asynchronous-unwind-tables -c FILE.c` |
| `ledger-arm64-O2.o`, `main-arm64-O2.o` | the same with `-O2` |
| `static-arm64-O0`, `static-arm64-O2` | `clang -target arm64-apple-macos -OLEVEL -fno-asynchronous-unwind-tables main-arm64-OLEVEL.o ledger-arm64-OLEVEL.o -o static-arm64-OLEVEL` |
| `static-arm64-O0.stripped`, `static-arm64-O2.stripped` | `cp` then `strip` |
| `ledger-x86_64-O1.o`, `main-x86_64-O1.o` | `clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c FILE.c` |
| `tiny-dyn-x86_64` | `python3 build_tiny_dyn_elf.py` |
| `ledger-x86_64.obj`, `main-x86_64.obj` | `clang -target x86_64-pc-windows-msvc -O1 -fno-asynchronous-unwind-tables -c FILE.c` |
| `tiny-x86_64.exe` | `python3 build_tiny_pe.py` |

`ledger-x86_64-O1.o` has the same SHA-256 as the lesson 32 fixture of the same name.

Captured tool text, with the exact command. `llvm-objdump` is `/Library/Developer/CommandLineTools/usr/bin/llvm-objdump` (Apple LLVM version 17.0.0); `otool`, `nm`, `strip`, and `dyld_info` are the ones in `/usr/bin`.

| File | Capture command |
|---|---|
| `ledger_main.otool-h.txt` | `otool -h ledger_main` |
| `ledger_main.otool-l.txt`, `ledger_main_nochain.otool-l.txt`, `ledger_main.stripped.otool-l.txt` | `otool -l FILE` |
| `ledger_main.otool-Iv.txt` | `otool -Iv ledger_main` |
| `ledger_main.stubs.txt` | `otool -v -s __TEXT __stubs ledger_main` |
| `ledger_main.dyld-fixups.txt`, `ledger_main_nochain.dyld-fixups.txt` | `dyld_info -fixups FILE` |
| `ledger_main.dyld-chain-details.txt` | `dyld_info -fixup_chain_details ledger_main` |
| `ledger_main.dyld-imports.txt` | `dyld_info -imports ledger_main` |
| `libledger.dyld-exports.txt`, `libledger.stripped.dyld-exports.txt` | `dyld_info -exports FILE` |
| `libledger.stripped.function-starts.txt`, `static-arm64-*.stripped.function-starts.txt` | `dyld_info -function_starts FILE` |
| `ledger_main.chained-fixups.txt` | `llvm-objdump --macho --chained-fixups ledger_main` |
| `ledger_main.nm.txt`, `ledger_main.stripped.nm.txt`, `libledger.nm.txt`, `libledger.stripped.nm.txt` | `nm -m FILE` |
| `static-arm64-*.nm.txt`, `static-arm64-*.stripped.nm.txt` | `nm -n FILE` |
| `static-arm64-*.stripped.objdump.txt` | `llvm-objdump --macho -d FILE` |
| `ledger-arm64-*.objdump-r.txt`, `main-arm64-*.objdump-r.txt` | `llvm-objdump -r FILE.o` |
| `ledger-x86_64-O1.objdump.txt`, `main-x86_64-O1.objdump.txt` | `llvm-objdump -h -t -r FILE.o` |
| `tiny-dyn-x86_64.objdump.txt` | `llvm-objdump -h -p -T -R -d tiny-dyn-x86_64` |
| `ledger-x86_64.obj.objdump.txt`, `main-x86_64.obj.objdump.txt` | `llvm-objdump -h -t -r FILE.obj` |
| `tiny-x86_64.exe.objdump.txt` | `llvm-objdump -h -p tiny-x86_64.exe` |
| `ledger_main.run.txt`, `ledger_main.stripped.run.txt`, `static-arm64-O2.stripped.run.txt` | `./FILE; echo exit=$?` |
| `probe-libs.txt` | `python3 -I probe_libs.py` with lief 1.0.0, pyelftools 0.33, pefile 2024.8.26 installed |

SHA-256 of the built files:

```
a6dd27ce057df5c4bdb815d2c0f63a9859200abbcc564d31ed39b77adcc1cca8  libledger.dylib
de687d408ac5fd0f9818d9bedb0cf8622a0bf3dac28553c6eba4f247e5b04ccc  ledger_main
5270e88803cc98d3c6cc2e18ded438e6037c2b81ab1e34846c29822a574870c0  ledger_main_nochain
70d5da586f7bc1142bb99779d458a7e326afec364239807dff021c3fe02bcd96  static-arm64-O0
f10bd475ac4f4d1aa7d30110e35eec5445bfab4f1d5a57b75337309e9dfd2164  static-arm64-O2
859dee59fb5e04047149720b9ff28d4bd8147106c01a13c4f9f31efdac2d3ff3  ledger-arm64-O0.o
3cb939fa89e947a1d4288946889c8b626db93be0c31ddc1259eba3cb2935af46  ledger-arm64-O2.o
5e49ce821ceca207bc4cf1d137e96599771e633cd76f732ad997f0990ba95b2d  main-arm64-O0.o
81a89ba01c9e085a457520cbf5f131889dd5077321dce419f668a1a78082045f  main-arm64-O2.o
9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f  ledger-x86_64-O1.o
b9574afdb10559ad8e5602a6010fb0882780057a17221217b9441f859b8a71d3  main-x86_64-O1.o
cd38a47432f17ec18d57755d3476443ddb9932e364f51742f734de54248655ad  tiny-dyn-x86_64
a81df8a4df50758b9d1fb36e5bad5b644e4f5324e692029852f1d46e0cbf63d5  ledger-x86_64.obj
7e24e1ec4a9815b2bfa627e063631656a1babafddbd79cee659d87ee3ce7ca91  main-x86_64.obj
d6ae0aba3b6b07b5180b68de9dd1106d0ea9a1cd8e00ac79149b6f40c46456a2  tiny-x86_64.exe
```
