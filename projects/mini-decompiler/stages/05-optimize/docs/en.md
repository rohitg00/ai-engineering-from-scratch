# Simplify and fold idioms

Stage 5 of 8. This stage applies [Lifting to Pseudocode](../../../../../phases/13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md), section "Stage 6: Simplify, Substitute, Remove Dead Code", and [Compiler Idioms and Optimization](../../../../../phases/13-tools-and-protocols/39-compiler-idioms-and-optimization/docs/en.md) for division by a constant.

## What you build

You build the passes that turn SSA statements into expressions a person can read:

- a bottom-up simplifier that turns a branch on flags into a comparison, folds constants, removes `+ 0` and `* 1`, folds nested casts, turns a scaled load into an element access `base[index]` and an offset load into a field access `base->field_4`,
- copy and constant propagation,
- dead code elimination,
- merging of phis that carry the same value on every edge,
- single-use substitution that never moves a load across a store or a call,
- recognition of signed division by a constant.

`optimize` repeats them until no pass changes anything.

## Why it matters

After stage 4, `tenths_and_fifths` at `-O1` is 14 statements of multiplies, shifts and flag writes. Its source is one line. The passes in this stage recover that line, and each step can be checked: a pass that changes the value of the function makes the stage 8 differential test fail.

The division idiom is the case where a wrong fold is easy to write. A multiplier that is close to the right one gives the correct quotient for small inputs and a wrong one for large inputs. The fold is allowed only when the arithmetic proves it.

## Work through one concrete case

At `-O1`, clang compiled `value / 10 + value / 5` as:

```text
movslq  %edi, %rax
imulq   $0x66666667, %rax, %rax
movq    %rax, %rcx
sarq    $0x22, %rcx        shift 34
movq    %rax, %rdx
shrq    $0x3f, %rdx        sign bit of the product
addl    %edx, %ecx         quotient for 10
sarq    $0x21, %rax        shift 33
addl    %edx, %eax         quotient for 5
addl    %ecx, %eax
```

The form is `((long)x * m >> s) + sign bit`. To recover the divisor, `magic_divisor(m, s)` tries d = floor(2^s / m) and d + 1, and keeps the d for which m is the ceiling of 2^s / d and the error stays small (Granlund and Montgomery, 1994):

| m | s | d | m * d - 2^s | bound 2^s / 2^31 | fold |
|---|---|---|---|---|---|
| 0x66666667 | 34 | 10 | 6 | 8 | yes |
| 0x66666667 | 33 | 5 | 3 | 4 | yes |
| 0x55555556 | 32 | 3 | 2 | 2 | yes |
| 0x66666668 | 34 | none | | | no |

Check one input by hand. For x = -7 and d = 10, the product is -7 * 1717986919 = -12025908433. Shifting right by 34 rounds toward minus infinity and gives -1. The sign bit of the product is 1. The sum is 0, which equals the C result of -7 / 10. `division_identity_holds` repeats this check on a sample that includes `INT_MIN`, `INT_MAX` and the values from -40 to 40 before the pass folds.

After SSA the two shared values are `rax_2 = rax_1 * 0x66666667` and `rdx_2 = rax_2 >>u 63`. The simplifier finds `trunc32(rcx_2) + trunc32(rdx_2)` where `rcx_2 = rax_2 >>s 34`, follows both sides to the same product, and replaces the sum with `edi_0 / 10`. Dead code removal then deletes the product, the shifts and every flag write, because nothing reads them. The function ends as one statement:

```text
return edi_0 / 10 + edi_0 / 5
```

`thirds` uses `shrq $0x20` for the quotient. The result is truncated to 32 bits, and for a shift of exactly 32 the low 32 bits of a logical shift equal those of an arithmetic shift. So the pass accepts a logical shift only when the shift is 32.

For `fold`, the loop condition `flags_6 = cmp(zext64(ecx_1), rdx_3)` with `jne` becomes `zext64(esi_0) != rdx_3` after copy propagation replaces `ecx_1` with `esi_0`. Two of the four loop phis carry the same value on every edge (`eax_2` and `esi_2`), so one is merged into the other and two phis remain.

```figure
pj-mini-decompiler-5
```

Set the divisor to 10 and the shift to 33 in the lab. The multiplier is 0x33333334 and the error is 8, which is twice the bound of 4, so the pass must leave the multiply in the output.

## Implement the contract

Implement these in the `passes` module. The starter supplies `c_div`, `truncate`, `OptimizeReport`, `place_of`, `definition_order`, `count_uses`, `has_call`, `contains_load`, `stmt_has_side_effect` and `simplify_function`.

| function | contract |
|---|---|
| `magic_divisor(multiplier, shift) -> int or None` | The divisor d > 1 such that the multiplier is ceil(2^shift / d) and `multiplier * d - 2^shift <= 2^shift >> 31`. `None` for a shift outside 32 to 63 or a multiplier that is not positive. |
| `division_identity_holds(multiplier, shift, divisor, samples=None) -> bool` | Evaluate the idiom with 64-bit wraparound on every sample and compare with `c_div`. |
| `make_simplifier(defs, recognize_division, report=None, order=None)` | Return a function for `rewrite` that applies the rules listed in "What you build". Record each folded division in `report.divisions` once. |
| `remove_dead_code(fn, uses) -> int` | Delete an assignment or phi whose destination has no use, except an assignment that contains a call. |
| `propagate_copies(fn) -> int` | Replace uses of `x = y` (same width) and `x = constant`, but never inside a phi source. |
| `substitute_once(fn, uses) -> bool` | Move one single-use definition into its use in the same block. A value that contains a load does not move across a store or a call. |
| `merge_congruent_phis(fn) -> int` | Two phis in one block with equal values on every edge and the same width: replace the later with the earlier. |
| `optimize(fn, recognize_division=True, rounds=400) -> OptimizeReport` | Simplify, then run dead code, copies, phi merging and substitution in that order, restarting after any change. |

## Verify and inspect

```bash
python3 scripts/project_test.py mini-decompiler --stage 5 --path learning-artifacts/mini-decompiler --strict
cd learning-artifacts/mini-decompiler
python3 -m minidec decompile samples/samples-x86_64-O1.o --function tenths_and_fifths --ir
python3 -m minidec decompile samples/samples-x86_64-O1.o --function tenths_and_fifths --ir --no-division-idioms
```

The first command prints `return edi_0 / 10 + edi_0 / 5` in the optimized IR. The second keeps `0x66666667`, `>>s 34` and `>>u 63`.

## Failure cases

- `magic_divisor(0x66666667, 31)` is `None`: a shift below 32 cannot come from this idiom.
- `magic_divisor(0x66666668, 34)` is `None`: one more than the right multiplier fails the ceiling check.
- `division_identity_holds(0x66666667, 34, 11)` is false.
- In `record`, the load of `m->reads` comes before the store to `m->reads`. Substitution must keep `ecx_2 = rdi_0->field_0 + 1` above `store32(rdi_0) = ecx_2`, or the C reads the new value.

## Extensions

- Recognize unsigned division, which uses `mul` and `shr` with no sign correction, and the forms clang emits when the multiplier does not fit in 32 bits.
- Recognize `x % d` as `x - (x / d) * d` after the division fold.
- Add global value numbering and compare the statement count of every fixture function before and after.
