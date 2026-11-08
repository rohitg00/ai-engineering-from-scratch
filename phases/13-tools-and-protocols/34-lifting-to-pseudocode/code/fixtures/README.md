# Fixtures for lesson 34

`ledger.c` is the shared fixture of Reverse Engineering 101. The lesson keeps its own copy so the code runs on its own.

## Objects

Built on macOS 26.2 arm64 with Apple clang 17.0.0 (clang-1700.6.3.2). Both builds are reproducible byte for byte.

| File | Command | SHA-256 |
|---|---|---|
| `ledger-x86_64-O1.o` | `clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O1.o` | `9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f` |
| `ledger-x86_64-O0.o` | `clang -target x86_64-unknown-linux-gnu -O0 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O0.o` | `b2046c121930d3d1e5ba84ba796f9e9e161df2fe76f7b9dcf8db63f690447e13` |

## Reference disassembly

`ledger-x86_64-O1.objdump.txt` and `ledger-x86_64-O0.objdump.txt` are the output of:

```bash
/Library/Developer/CommandLineTools/usr/bin/llvm-objdump -d -r ledger-x86_64-O1.o
/Library/Developer/CommandLineTools/usr/bin/llvm-objdump -d -r ledger-x86_64-O0.o
```

Apple LLVM version 17.0.0. The tests require the decoder in `../main.py` to agree with every line.

## Ghidra pseudocode through rea

`ghidra/percent_change.json`, `ghidra/grade.json`, and `ghidra/total.json` are the Evidence records that rea 6.5.0 returned for the `decompile` verb (operation `procedure_pseudo_code`) with the Ghidra 12.1.4 provider. Run on 2026-10-14 on macOS 26.2 arm64 with OpenJDK 21.0.12.1:

```bash
export GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
npx -y rea-agents@6.5.0 decompile "$PWD/ledger-x86_64-O1.o" percent_change --provider ghidra --format json
npx -y rea-agents@6.5.0 decompile "$PWD/ledger-x86_64-O1.o" grade --provider ghidra --format json
npx -y rea-agents@6.5.0 decompile "$PWD/ledger-x86_64-O1.o" total --provider ghidra --format json
```

Each call took about 10 seconds. The `subject.local_path` field records the path of the copy under `manuals/reverse-engineering-101/capture/fixtures/`, which has the same SHA-256.

`ghidra/ledger-x86_64-O1.ghidra.c` holds the three `raw_result.value` strings verbatim.

`ghidra/ledger-x86_64-O1.ghidra-repaired.c` is the same text with the smallest edits that make it compile. The edits are:

1. `typedef unsigned int uint;` and `typedef unsigned long ulong;` because Ghidra prints its own type names.
2. `DAT_001000b4` is defined as the 20 bytes at `.rodata` offset 0x14 of the object, so `&DAT_001000b4 + (ulong)uVar2 * 4` stays byte arithmetic as Ghidra meant it. Ghidra placed `.rodata` at 0x001000a0 in its ephemeral project, so 0x001000b4 is `.rodata + 0x14`.
3. In `percent_change`, the return type `undefined1 [16]` became `int`, the third parameter `param_3` was removed, and the two 16-byte `auVar` temporaries became the low eight bytes of the quotient truncated to `int`. The `grade` and `total` functions are unchanged.

The test `test_lifted_functions_behave_like_the_source_on_an_input_grid` compiles this file next to `ledger.c` and the lifter output and compares all three over the same inputs.
