# Binary Inspector

A static inspector that reads ELF, PE/COFF, and Mach-O files you compiled and reports their layout, names, links, and function starts.

You give it an ELF64 object, a COFF object, a PE32+ image, or a Mach-O 64 file. It reports the format, the architecture, and the sections and segments with permissions and entropy. It also reports symbols with demangled C++ names, imports, exports, relocations, Mach-O chained fixups, strings with their section, and function starts. With the unstripped build of the same source, it scores each function start method with precision and recall. It writes a JSON report, a standalone HTML report with a byte map, and a diff between two builds.

Python 3.10 or later and the standard library only. The grader also uses Python. The fixtures are already built, so you need clang only to rebuild them.

## Scope and rules

Every input in this project is a program you compiled from source in the fixtures. Use the inspector on your own builds. It reads files and never runs them. It does not remove protections, unpack, or analyze third-party software. Lesson [32](../../phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md) states the authorization rule that applies to every target in this track.

## Build and run your version

From the repository root, initialize once. A fresh starter fails stage 1 on purpose.

```bash
python3 scripts/project_test.py binary-inspector --init learning-artifacts/binary-inspector
python3 scripts/project_test.py binary-inspector --stage 1 --path learning-artifacts/binary-inspector --strict
```

The workspace has one stub module per stage, the CLI, the JSON Schema of the report, and the fixtures. Implement each stage, then run the cumulative grader and the CLI on any file:

```bash
python3 scripts/project_test.py binary-inspector --all --path learning-artifacts/binary-inspector --strict
cd learning-artifacts/binary-inspector
python3 cli.py inspect fixtures/tally-arm64-O2.stripped --truth fixtures/tally-arm64-O2 --json report.json --html report.html
python3 cli.py diff fixtures/tally-arm64-O0 fixtures/tally-arm64-O2 --json diff.json
python3 cli.py inspect path/to/your-own-build.o
```

The CLI and the fixtures are supplied scaffolding. Its imports resolve to your modules. The [API contract](API.md) lists every public function and its return shape.

## Inspect the reference separately

```bash
python3 scripts/project_test.py binary-inspector --all --solution --strict
cd projects/binary-inspector/solution
python3 cli.py inspect fixtures/tally-arm64-O2.stripped --truth fixtures/tally-arm64-O2 --json report.json --html report.html
```

## Observe the result

The demo command reads the stripped arm64 executable. Strip removed every defined symbol, so the `symbols` method finds 0 of 6 function starts. `LC_FUNCTION_STARTS` still lists all 6. Direct `bl` targets find 5, because nothing calls `main`. The prologue scan finds 1, because the five tally functions at `-O2` have no stack frame. The four imports from `libSystem` come from the chained fixups, with the address of each slot that dyld fills.

## Fixtures

The fixture folder holds two C files, one C++ file, the build script, and the outputs of Apple clang 17:

| Target | Files |
|---|---|
| x86-64 Linux ELF objects | `tally` at `-O0` and `-O2`, `main` at `-O2`, `names.cpp` at `-O2` |
| x86-64 Windows MSVC COFF objects | `tally` at `-O0` and `-O2`, `main` at `-O2` |
| arm64 macOS Mach-O | `tally-arm64-O2.o`, executables at `-O0` and `-O2`, a stripped copy of the `-O2` executable, a dylib and its stripped copy |
| PE32+ image | a small image that a Python script writes field by field, because the toolchain on the authoring machine has no Windows linker |

Rebuild with the build script in the fixture folder. The script writes a new list of SHA-256 sums. The committed list records the build that the tests describe. A rebuild of the `-O0` executable can differ in its debug map entries, which hold object file paths. The tests read the committed files.

A second program, `meter`, is the held-out case. Its sources, build script, and binaries live outside the workspace, and only the tests read them.

## Limits

- ELF64 and Mach-O 64 little-endian, COFF objects for x86-64 and arm64 machines, PE32+ images. ELF32, PE32, big-endian files, and universal Mach-O files fail with a message that names the reason.
- Chained fixups with pointer formats 2 and 6. The arm64e formats fail with a message.
- The demangler covers the documented Itanium subset and returns `None` for the rest, including MSVC names.
- Prologue and call target scans cover x86-64 and arm64.

## Stages

1. [Detect the format and parse the header](stages/01-headers/docs/en.md)
2. [Sections, segments, permissions, and entropy](stages/02-layout/docs/en.md)
3. [Symbols, string tables, and demangled names](stages/03-symbols/docs/en.md)
4. [Imports, exports, relocations, and chained fixups](stages/04-linkage/docs/en.md)
5. [Strings with sections and recovered function starts](stages/05-discovery/docs/en.md)
6. [JSON report, HTML byte map, and build diff](stages/06-report/docs/en.md)

## Lessons this project applies

- [32, Program Anatomy: an ELF reader from scratch](../../phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md)
- [40, Linking, Loading, and Stripped Binaries](../../phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/docs/en.md)
- [41, Recovering Data and Types](../../phases/13-tools-and-protocols/41-recovering-data-and-types/docs/en.md)

## Primary references

- [System V gABI](https://www.sco.com/developers/gabi/latest/contents.html)
- [Microsoft PE Format](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [Apple mach-o/loader.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h) and [mach-o/fixup-chains.h](https://github.com/apple-oss-distributions/dyld/blob/main/include/mach-o/fixup-chains.h)
- [Itanium C++ ABI, mangling](https://itanium-cxx-abi.github.io/cxx-abi/abi.html#mangling)
