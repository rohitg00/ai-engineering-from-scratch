# Validate recorded usage

**Stage 2 of 4.** Rust. Plan about 2 hours.

Cached input is a subset of input, never an extra token category to add twice. A provider record with cached greater than total input is invalid. Parse all three counters from an explicit comma-separated fixture wire format; reject signs and missing fields.

```figure
pj-token-counter-and-cost-meter-2
```

## Implementation boundary

```rust
pub fn parse_usage(line:&str)->Result<Usage,Error>
```

Primary reference: [Official reference](https://doc.rust-lang.org/std/primitive.u64.html#method.checked_mul).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Tokenizers](../../../../../phases/10-llms-from-scratch/01-tokenizers/docs/en.md). Complete [stage 1](../../01-estimate-text-with-a-documented-bound/docs/en.md) first.

The JSON adapter reads recorded input/output usage and cached input details. Rust validates the corresponding input,output,cached triplet. Cached tokens are a subset of input tokens, not an additional input charge.

```text
input_tokens=100; output_tokens=20; cached_tokens=40
wire=100,20,40
uncached input=60
```

## Build and inspect

Reject booleans, negative values and cached counts above input. Keep provider response normalization outside the arithmetic core.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py token-counter-and-cost-meter --stage 2 --path learning-artifacts/token-counter-and-cost-meter
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What should happen when a provider response omits required input usage?
