# Estimate text with a documented bound

**Stage 1 of 4.** Rust. Plan about 2 hours.

Count Unicode scalar values and use a configurable characters-per-token ratio with ceiling division. This intentionally rough estimator is useful for a preflight warning. Exact admission later uses recorded provider usage rather than pretending this is BPE.

```figure
pj-token-counter-and-cost-meter-1
```

## Implementation boundary

```rust
pub fn estimate(text:&str, chars_per_token:u64)->Result<u64,Error>
```

Primary reference: [Official reference](https://doc.rust-lang.org/std/primitive.u64.html#method.checked_mul).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Tokenizers](../../../../../phases/10-llms-from-scratch/01-tokenizers/docs/en.md).

Start with a visible approximation. At four characters per token, 21 Unicode scalar values estimate six tokens. This is a baseline for preflight planning; actual provider counts can differ by language, punctuation and tokenizer.

```text
characters=21; ratio=4
ceil(21/4)=6 estimated tokens
```

## Build and inspect

Use quotient plus a remainder check, avoiding overflow from adding ratio-1. Never label this result a provider tokenizer count.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py token-counter-and-cost-meter --init learning-artifacts/token-counter-and-cost-meter
python3 scripts/project_test.py token-counter-and-cost-meter --stage 1 --path learning-artifacts/token-counter-and-cost-meter
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why might the same number of characters cost different token counts in two languages?
