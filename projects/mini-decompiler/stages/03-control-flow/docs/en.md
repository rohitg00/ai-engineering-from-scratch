# Recover control flow

Stage 3 of 8. This stage applies [Disassembly and Control Flow](../../../../../phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md), sections "Recursive Descent", "Basic Blocks", "Dominators With the Iterative Algorithm" and "The Jump Table in grade at -O0", and [Compiler Idioms and Optimization](../../../../../phases/13-tools-and-protocols/39-compiler-idioms-and-optimization/docs/en.md) for the bounds-check idiom.

## What you build

You build the control-flow graph of one function:

1. `recursive_descent` decodes only the bytes that control flow reaches from the entry.
2. A jump table resolver turns `jmpq *%rax` into a list of targets, with the table found through its relocation and its length taken from the bounds check.
3. `ControlFlowGraph` splits the instructions into basic blocks with typed edges: `jump`, `taken`, `fallthrough` and `table`.
4. The graph computes reverse postorder, immediate dominators, dominance frontiers, post-dominators, back edges and natural loops.

## Why it matters

A linear sweep decodes alignment padding as if it were code. Recursive descent decodes only what can run, but it stops at an indirect jump unless something tells it where the jump goes. For the fixtures that something is the relocation on the `lea` that loads the table base and the relocations inside the table.

Dominators are the input of everything after this stage. SSA places phis on dominance frontiers (stage 4). A back edge is an edge to a block that dominates its source, and every loop that stage 7 emits starts from one. The immediate post-dominator of a branch is the place where its two arms join again, and stage 7 uses it to close an `if`.

## Work through one concrete case

`band` at `-O0` occupies 0x50 to 0xba, with 6 bytes of padding up to 0xc0.

Without a resolver, recursive descent from 0x50 decodes 16 instructions. It follows the `ja` at 0x62 to the default block at 0xae, falls through to 0x64, and stops at `jmpq *%rax` at 0x76. That jump is listed in `unresolved`, and the six case blocks are never reached.

The resolver walks back from the jump:

| address | instruction | role |
|---|---|---|
| 0x5e | `subq $0x5, %rax` | bounds check against 5 |
| 0x62 | `ja 0xae` | out of range goes to default |
| 0x68 | `leaq (%rip), %rcx` | table base, relocation `.rodata-0x4` resolves to `.rodata+0x0` |
| 0x6f | `movslq (%rcx,%rax,4), %rax` | load a 4-byte signed entry |
| 0x73 | `addq %rcx, %rax` | entry plus base |
| 0x76 | `jmpq *%rax` | the indirect jump |

The bounds check allows indexes 0 to 5, so the table has 6 entries. Each entry has a `.rodata` relocation against `.text`. Entry i is at `.rodata+4i`, so its target is `addend + (table base - entry offset)`: 0x78, 0x81, 0x8a, 0x93, 0x9c and 0xa5. With the resolver the descent decodes 28 instructions, and the linear sweep of the same range decodes 29 because it also decodes the `nopw` padding.

The graph has 10 blocks and 15 edges, six of them `table` edges. The immediate dominator of every case block is 0x64, the block that holds the jump. The default block 0xae and the return block 0xb5 have immediate dominator 0x50, because both the default path and the case paths reach them. The immediate post-dominator of the entry is 0xb5.

At `-O1` the same `switch` has no indirect jump. clang loaded the result from a value table with `movl (%rcx,%rax,4), %eax`. `find_value_tables` reports that table, reads its six 4-byte values from the bytes (5, 8, 12, 20, 20, 35), and marks the evidence as `bytes`, because no relocation is inside a value table.

`fold` at `-O1` is a rotated loop. Its blocks start at 0x70, 0x74, 0x80, 0x92 and 0x93. The block at 0x80 branches back to itself, so (0x80, 0x80) is the only back edge, the natural loop is `{0x80}`, and the dominance frontier of 0x80 is `{0x80}`. At `-O0` the loop has its exit test in the header: the back edge is 0xe1 to 0xd9, and the post-dominator of the header is the exit block 0xfe.

```figure
pj-mini-decompiler-3
```

Add the back edge to the entry in the lab. The entry has no predecessor inside the function but has an implicit edge from the caller, so the entry enters its own dominance frontier. The `dominance_frontiers` contract below requires that case.

## Implement the contract

Implement these in the `cfg` module. The starter supplies `JumpTable`, `Descent`, `Block`, `FunctionGraph`, `find_value_tables`, `build_cfg`, `dominates`, `ControlFlowGraph.dominators`, `summary` and the register helpers.

| function | contract |
|---|---|
| `recursive_descent(code, entries, end=None, resolver=None) -> Descent` | Worklist from `entries`. A jump continues at its target, a branch at both successors, a call after itself, a return stops. An address inside a decoded instruction is a conflict `(address, instruction start)`. An undecodable byte stops that path and is listed. An indirect jump stops unless `resolver` returns a `JumpTable`. An entry outside `[0, end)` raises `ValueError`. |
| `bounds_check(instructions, before) -> (limit, address)` | The last `cmp $N` or `sub $N` followed by `ja` before `before`. Returns `(None, None)` when there is none. |
| `recover_table(elf, instructions, load, jump, section=".text") -> JumpTable or None` | Find the RIP-relative `lea` that wrote the base register of `load`, resolve its relocation, take `limit + 1` entries of `scale` bytes, from relocations when present and from bytes otherwise. |
| `jump_table_resolver(elf, section=".text") -> Resolver` | Match `lea table(%rip), base; movslq (base, index, 4), reg; add base, reg; jmp *reg` backwards from the jump. |
| `ControlFlowGraph(entry, instructions, tables=None)` | `_leaders`, then `_build`: blocks with typed successor edges. The entry must be a decoded address or `ValueError` is raised. |
| `reverse_postorder()`, `back_edges()`, `natural_loops()`, `post_dominators()` | As named. Post-dominators use a virtual `EXIT` node that every return block reaches. |
| `immediate_dominators(entry, order, predecessors) -> dict` | The iterative algorithm of Cooper, Harvey and Kennedy over reverse postorder. |
| `dominance_frontiers(idom, predecessors) -> dict[int, set[int]]` | For a join with two or more predecessors, walk each predecessor up the dominator tree to the join's immediate dominator. For the entry, a predecessor walk continues up to and including the entry. |

## Verify and inspect

```bash
python3 scripts/project_test.py mini-decompiler --stage 3 --path learning-artifacts/mini-decompiler --strict
cd learning-artifacts/mini-decompiler
python3 -m minidec cfg samples/samples-x86_64-O0.o band
```

The JSON shows `unresolvedWithoutTables: ["0x76"]`, the table with `"evidence": "relocation"`, 10 blocks and the immediate dominator of each block.

## Failure cases

- An entry at 4 in a 1-byte range raises `ValueError`.
- `74 03 b8 01 00 00 00 c3`: the `je` targets 5, which is inside the `mov` at 2. The descent records the conflict `(5, 2)` and keeps the instructions at 0, 2 and 7.
- `31 c0 0f 0a c3`: the path stops at the undecodable byte at 2, which is listed as unresolved.
- `48 8b 45 f0 ff e0 c3`: an indirect jump through a value loaded from the stack matches no idiom. It stays unresolved, and the graph summary lists `0x4`.

## Extensions

- Resolve the absolute jump table form `jmpq *table(,%rax,8)` that non-PIC code uses, with `R_X86_64_32S` relocations.
- Detect a tail call: a `jmp` to another function symbol. Treat it as a call followed by a return.
- Compute the loop nesting forest for irreducible graphs and report the extra entries of each loop.
