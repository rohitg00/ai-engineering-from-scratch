# Admit work against a ledger

**Stage 4 of 4.** Rust. Plan about 2 hours.

Reserve a quoted amount only if spent plus quote is within the configured limit. An exact boundary is accepted; a rejected reservation never mutates the ledger. This example is single-process accounting and does not claim concurrent distributed guarantees.

```figure
pj-token-counter-and-cost-meter-4
```

## Implementation boundary

```rust
pub fn reserve(spent:&mut u64,quote:u64,limit:u64)->Result<u64,Error>
```

Primary reference: [Official reference](https://doc.rust-lang.org/std/primitive.u64.html#method.checked_mul).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Tokenizers](../../../../../phases/10-llms-from-scratch/01-tokenizers/docs/en.md). Complete [stage 3](../../03-price-with-checked-integers/docs/en.md) first.

Replay reservations against recorded usage. The first Orchard request reserves 600 and settles 260, releasing 340. A later request requiring 1,500 is blocked when only 430 remains. Saved JSON retains request ids and all settlement fields.

```text
limit=1000
request 1 reserved=600 actual=260 unused=340
request 2 actual=310 -> spent=570
remaining=430; larger reservation -> blocked
```

## Build and inspect

A settlement must record actual usage even when it exceeds the estimate. Mark an overrun explicitly; do not hide it by capping the billed cost.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py token-counter-and-cost-meter --stage 4 --path learning-artifacts/token-counter-and-cost-meter
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
python3 learning-artifacts/token-counter-and-cost-meter/usage.py projects/token-counter-and-cost-meter/examples/usage.json --out usage-ledger.json
```

Rates are explicit fixture inputs in integer nano-dollars per token, not current provider prices. usage.py normalizes recorded usage JSON and delegates checked arithmetic to Rust. Its ledger is a sequential replay saved with --out; it is not a live billing service or concurrent reservation store.

## Investigate next

Which fields can the agent-budget-planner reuse without confusing a quote with actual usage?
