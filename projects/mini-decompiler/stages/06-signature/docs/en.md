# Recover the signature and types

Stage 6 of 8. This stage applies [Calling Conventions and Stack Frames](../../../../../phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames/docs/en.md), section "System V: Two Independent Register Sequences and a Red Zone", [Lifting to Pseudocode](../../../../../phases/13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md), sections "Stage 4: Parameters From the Calling Convention" and "Stage 7: Types From Use", and [Recovering Data and Types](../../../../../phases/13-tools-and-protocols/41-recovering-data-and-types/docs/en.md).

## What you build

You build signature recovery for the optimized SSA function:

1. **Parameters.** The System V psABI passes the first six INTEGER arguments in `%rdi`, `%rsi`, `%rdx`, `%rcx`, `%r8` and `%r9`. A register read at version 0 is read before any write. The highest such argument register fixes the count, so a function that reads only `%rsi` still has two parameters. A read of another register before any write is an undefined read. The recovery reports it and does not make it a parameter.
2. **Webs.** A phi and its sources are one C variable. Union-find joins them, and each web gets one name: `param_N` for an argument, `local_8` for a stack slot, `eax_1` for a register value.
3. **Types.** The widest definition in a web gives `int` or `long`. A web used as the base of a scaled element access becomes a pointer to the element. A web used as the base of constant offsets becomes a pointer to a struct with one field per offset. Pointer types spread along copies and phis.
4. **Signedness.** Arithmetic shifts, signed division, signed compares and sign extension say signed. Logical shifts and unsigned division say unsigned. A lone unsigned compare is the range-check idiom of a `switch`, and it does not make the value unsigned.
5. **Return type.** The width of the value in `%rax` at each return. If no path writes `%rax`, the result is `void`, and that guess is listed as an unknown.

Every decision carries the instructions that support it.

## Why it matters

The machine code has no types. A wrong parameter count changes the call in the stage 8 driver. A wrong width truncates a `long`. A wrong signedness flips the result of a compare for negative inputs. Each of these produces C that compiles and computes the wrong answer, so each type has to point at its evidence.

## Work through one concrete case

`record` at `-O1` after stage 5:

```text
block 0xa0 -> exit
  ecx_2 = rdi_0->field_0 + 1
  store32(rdi_0) = ecx_2
  eax_2 = esi_0 + rdi_0->field_4
  store32(rdi_0 + 4) = eax_2
  return eax_2 / ecx_2
```

Version 0 reads: `rdi_0` and `esi_0`. The highest argument register is `%rsi`, so there are two parameters. `rdi` is read at 64 bits and `esi` at 32 bits.

`rdi_0` is the base of `field_0` and `field_4`, both 32 bits wide. The web of `rdi_0` becomes `struct record_param_1 *` with fields at 0x0 and 0x4. The return value is 32 bits wide. The signature report:

```json
{
  "declaration": "int record(struct record_param_1 *param_1, int param_2)",
  "params": [
    {"name": "param_1", "register": "rdi", "width": 64, "ctype": "struct record_param_1 *", "signedness": "pointer",
     "evidence": ["%rdi is read before any write", "accessed through constant offsets 0x0, 0x4"]},
    {"name": "param_2", "register": "rsi", "width": 32, "ctype": "int", "signedness": "none",
     "evidence": ["%esi is read before any write"]}
  ],
  "structs": {"record_param_1": {"0x0": 32, "0x4": 32}},
  "evidence": ["2 argument register(s) read before write", "return value width 32 from the value in %rax at every return",
               "signed instructions: 0xae cltd; 0xaf idivl %ecx"]
}
```

`param_2` has signedness `none`: no instruction touches it directly with a signed or unsigned choice, so `int` is a default and stage 7 lists that as an unknown.

Three more fixture results:

| function | declaration | deciding evidence |
|---|---|---|
| `fold` | `int fold(int *param_1, int param_2)` | `(rdi, rdx, 4)` is a scaled 4-byte access; `jle` on `param_2` is signed |
| `band` | `int band(int param_1)` | only `cmp $5` and `ja` touch it: `unsigned-compare`, the range check |
| `tenths_and_fifths` without the division fold | `int tenths_and_fifths(int param_1)` | `movslq` and `sarq` say signed |

```figure
pj-mini-decompiler-6
```

Clear `%rdi` but keep `%rsi` in the lab. The count stays at two, because the psABI assigns registers by position. Change the `%esi` evidence to `cmp then ja`: the type stays `int` and the signedness becomes `unsigned-compare`.

## Implement the contract

Implement these in the `types` module. The starter supplies `Param`, `Signature`, `ctype`, `utype`, `declaration` and `live_keys`.

| function | contract |
|---|---|
| `collect_params(fn)` | Set `fn.params` to the argument registers up to the highest one read at version 0, `fn.param_widths` from `fn.def_width`, and `fn.undefined_reads` to other version 0 reads except `flags` and `rax`. |
| `coalesce_webs(fn)` | Union every phi with its sources. Set `fn.web_names` for every SSA key and `fn.web_types` to `int` or `long` from the widest member. |
| `signedness_by_web(fn) -> dict[str, set[str]]` | For each web label, the evidence kinds: `signed`, `unsigned-arithmetic`, `unsigned-compare`. |
| `signedness_label(kinds) -> str` | `none`, `signed`, `unsigned`, `unsigned-compare` or `mixed`. `signed` with anything else is `mixed`; any `unsigned-arithmetic` without `signed` is `unsigned`. |
| `infer_types(fn)` | Element pointers, struct pointers with `fn.structs`, unsigned types for `unsigned` webs, and `fn.return_type`. |
| `recover_signature(fn) -> Signature` | Run the four steps above and build the `Signature` with parameter evidence and instruction evidence. |

## Verify and inspect

```bash
python3 scripts/project_test.py mini-decompiler --stage 6 --path learning-artifacts/mini-decompiler --strict
cd learning-artifacts/mini-decompiler
python3 -m minidec decompile samples/samples-x86_64-O1.o --function record --json
```

The `--json` output carries the signature report with its evidence. The C text above it needs stage 7.

## Failure cases

- A function that reads only `%esi` has two parameters, and `param_1` is unused.
- A function that reads `%r10` before writing it has no parameter for it. `r10` goes into `undefinedReads`, and its web is named `undefined_r10`.
- A function that returns without writing `%rax` is `void`, with an unknown that says a caller could contradict it.
- A value that both `sarl` and `shrl` touch is `mixed`. The type stays signed, and the unsigned use gets a cast in stage 7.

## Extensions

- Read stack arguments above the return address for a seventh parameter, and floating-point arguments from `%xmm0` to `%xmm7`.
- Merge the struct layouts of two functions that receive the same pointer, and report conflicting widths at one offset.
- Detect a returned struct passed in `%rax` and `%rdx`, and a large struct returned through a hidden pointer in `%rdi`.
