# Price with checked integers

**Stage 3 of 4.** Rust. Plan about 2 hours.

The fixture rate card uses nano-dollars per token. Charge uncached input, cached input and output at separate rates. Every multiplication and sum is checked for overflow, and no floating-point rounding can silently change the bill.

```figure
pj-token-counter-and-cost-meter-3
```

## Implementation boundary

```rust
pub fn cost(usage:&Usage,rates:&Rates)->Result<u64,Error>
```

Primary reference: [Official reference](https://doc.rust-lang.org/std/primitive.u64.html#method.checked_mul).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Tokenizers](../../../../../phases/10-llms-from-scratch/01-tokenizers/docs/en.md). Complete [stage 2](../../02-validate-recorded-usage/docs/en.md) first.

Use supplied integer rate cards in nano-dollars per token. With input=2, output=5 and cached=1, the recorded request costs 260 nano-dollars. These fixture rates are not current provider prices.

```text
60 uncached * 2 = 120
40 cached * 1 = 40
20 output * 5 = 100
total=260 nano_dollars
```

## Build and inspect

Multiply and add with checked u64 operations. Do not round each component through floating-point dollars.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py token-counter-and-cost-meter --stage 3 --path learning-artifacts/token-counter-and-cost-meter
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

How would an overflow affect budget admission if arithmetic wrapped silently?
