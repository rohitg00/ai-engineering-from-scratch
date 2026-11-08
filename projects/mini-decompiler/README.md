# Mini Decompiler

A decompiler for a defined x86-64 subset. It reads an ELF relocatable object that you compiled, turns each function into structured C, and then proves the output: it recompiles the C, compares relocation-masked bytes, runs the original and the decompiled version side by side over an input grid, and writes an evidence report that lists every unknown.

The core uses the Python standard library only. clang is optional: it enables the recompile and differential legs of stage 8. The grader checks your selected workspace; it never fills in missing behavior from the reference.

Analyze only programs that you compiled from source. The fixtures are small C functions written for this project.

## Build and run your version

From the repository root, initialize once. A fresh starter fails intentionally at stage 1.

```bash
python3 scripts/project_test.py mini-decompiler --init learning-artifacts/mini-decompiler
python3 scripts/project_test.py mini-decompiler --stage 1 --path learning-artifacts/mini-decompiler --strict
```

Implement each stage, then run the cumulative grader and the supplied command line:

```bash
python3 scripts/project_test.py mini-decompiler --all --path learning-artifacts/mini-decompiler --strict
cd learning-artifacts/mini-decompiler
python3 -m minidec decompile samples/samples-x86_64-O1.o
python3 -m minidec verify samples/samples-x86_64-O1.o --source samples/samples.c --opt O1 --out verify-O1
```

The command line, the IR printer, the C printer and the test driver generator are supplied scaffolding. Each stage starter adds the module for that stage with precise signatures and contracts, and it never overwrites a file from an earlier stage.

## Use it on your own object

Compile a C file with the fixture flags, then decompile and verify it:

```bash
clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c mine.c -o mine.o
python3 -m minidec disasm mine.o
python3 -m minidec cfg mine.o my_function
python3 -m minidec decompile mine.o --json --out mine-decompiled.c
python3 -m minidec verify mine.o --source mine.c --opt O1 --out verify-mine
```

`verify` writes `decompiled.c`, `recompiled.o`, `report.json` and the differential harness into the output folder. It exits 0 when the status is `pass` or `behaviour-only` and 1 when it is `fail` or `unknown`, so a CI job can gate on it. Functions outside the subset raise an error that names the address and the bytes.

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py mini-decompiler --all --solution --strict
cd projects/mini-decompiler/solution
python3 -m minidec decompile ../fixtures/samples-x86_64-O1.o
python3 -m minidec verify ../fixtures/samples-x86_64-O1.o --source ../fixtures/samples.c --opt O1 --out verify-O1
```

## Observe the result

At `-O1` all five fixture functions pass the behaviour grid: 183 cells in total. Four of them also recompile to the same masked bytes. `fold` recompiles 2 bytes longer, so the aggregate is `behaviour-only`, and the report says which leg did not match and why. The two division idioms in `tenths_and_fifths` fold to `param_1 / 10 + param_1 / 5`, and the value table of `band` comes back as `lookup_0[6] = {5, 8, 12, 20, 20, 35}`.

## The subset and its limits

Input is an ELF64 little-endian x86-64 relocatable object (`ET_REL`) built by clang for `x86_64-unknown-linux-gnu`. The decoder covers the integer instructions listed in stage 2. Signatures follow the System V psABI for up to six INTEGER arguments. There is no floating point, no stack argument, no struct return and no call through a pointer table.

A behaviour pass covers the declared grid on the host where it ran; it is not a proof of equivalence for every input. The behaviour leg compiles the original source for the host. A bytes pass is a statement about one compiler version with one set of flags.

## Fixtures

- The demonstration fixture: one C file with five functions, its objects at `-O0` and `-O1`, and the captured disassembler listings. The starter copies them into `samples`.
- The held-out fixture: four other functions with their objects and listings. No worked example uses them, and every stage tests them.
- Two near-miss candidate objects for the bytes leg: one with a changed table value and one with a wider accumulator.

## Stages

1. [Read an ELF relocatable object](stages/01-elf-loader/docs/en.md)
2. [Decode the x86-64 subset](stages/02-decoder/docs/en.md)
3. [Recover control flow](stages/03-control-flow/docs/en.md)
4. [Lift to IR and build SSA](stages/04-lift-and-ssa/docs/en.md)
5. [Simplify and fold idioms](stages/05-optimize/docs/en.md)
6. [Recover the signature and types](stages/06-signature/docs/en.md)
7. [Structure the graph and emit C](stages/07-structure-and-emit/docs/en.md)
8. [Prove the output](stages/08-verify/docs/en.md)

## Related lessons

- [Disassembly and Control Flow](../../phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md)
- [Lifting to Pseudocode](../../phases/13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md)
- [Rebuild and Prove Equal](../../phases/13-tools-and-protocols/36-rebuild-and-prove-equal/docs/en.md)
- [Calling Conventions and Stack Frames](../../phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames/docs/en.md)
- [Compiler Idioms and Optimization](../../phases/13-tools-and-protocols/39-compiler-idioms-and-optimization/docs/en.md)

## Primary references

- [ELF-64 Object File Format, version 1.5](https://uclibc.org/docs/elf-64-gen.pdf)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- Cooper, Harvey and Kennedy, [A Simple, Fast Dominance Algorithm](https://www.cs.tufts.edu/comp/150FP/archive/keith-cooper/dom14.pdf)
- Cytron, Ferrante, Rosen, Wegman and Zadeck, Efficiently Computing Static Single Assignment Form and the Control Dependence Graph, ACM TOPLAS 13(4), 1991
- Granlund and Montgomery, Division by Invariant Integers using Multiplication, PLDI 1994
- Cifuentes, Reverse Compilation Techniques, PhD thesis, Queensland University of Technology, 1994
