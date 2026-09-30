# Token Counter and Cost Meter

Usage reconciliation explaining why real billing differs from preflight estimates.

Start with a visible approximation. At four characters per token, 21 Unicode scalar values estimate six tokens. This is a baseline for preflight planning; actual provider counts can differ by language, punctuation and tokenizer.

## Start with a learner workspace

[Tokenizers](../../phases/10-llms-from-scratch/01-tokenizers/docs/en.md), [Verification gates](../../phases/14-agent-engineering/38-verification-gates/docs/en.md). Language foundation: [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html).

Install Rust (`rustc`) and Python 3.10+. The core uses the Rust standard library; Python adapters compile into private temporary directories.

```bash
python3 scripts/project_test.py token-counter-and-cost-meter --init learning-artifacts/token-counter-and-cost-meter
python3 scripts/project_test.py token-counter-and-cost-meter --stage 1 --path learning-artifacts/token-counter-and-cost-meter
```

## Build route

1. [Estimate text with a documented bound](stages/01-estimate-text-with-a-documented-bound/docs/en.md)
2. [Validate recorded usage](stages/02-validate-recorded-usage/docs/en.md)
3. [Price with checked integers](stages/03-price-with-checked-integers/docs/en.md)
4. [Admit work against a ledger](stages/04-admit-work-against-a-ledger/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
python3 learning-artifacts/token-counter-and-cost-meter/usage.py projects/token-counter-and-cost-meter/examples/usage.json --out usage-ledger.json
```

To inspect the complete reference first, replace `learning-artifacts/token-counter-and-cost-meter` with `projects/token-counter-and-cost-meter/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

Rates are explicit fixture inputs in integer nano-dollars per token, not current provider prices. usage.py normalizes recorded usage JSON and delegates checked arithmetic to Rust. Its ledger is a sequential replay saved with --out; it is not a live billing service or concurrent reservation store.

```bash
python3 scripts/project_test.py token-counter-and-cost-meter --all --solution --strict
python3 scripts/project_test.py token-counter-and-cost-meter --all --path learning-artifacts/token-counter-and-cost-meter --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.

## Primary references

- [Official reference](https://doc.rust-lang.org/std/primitive.u64.html#method.checked_mul)
