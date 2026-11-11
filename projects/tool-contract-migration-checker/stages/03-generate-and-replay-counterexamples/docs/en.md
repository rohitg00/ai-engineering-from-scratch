# Generate and replay breaking-call counterexamples

Stage 3 of 4. Read [Stage 2](../../02-classify-schema-changes/docs/en.md) before starting; this stage turns classified changes into concrete failing call fixtures.

## What changes

Static schema diffs show what changed in the abstract, but developers need concrete counterexamples: an exact payload that passed the old contract yet fails the new contract. Furthermore, running recorded production tool calls through both validators shows whether any actual historical usage is disrupted.

The boundary for this stage is `generate_counterexamples` and `replay_calls`.

## Work through one concrete case

When a new required field `session_id` is introduced:

```figure
pj-tool-contract-migration-checker-3
```

The synthesizer creates a minimal payload omitting `session_id` (satisfying the old contract) and verifies it fails the new contract with a `"missing required property: session_id"` error.

## Implement the contract

Implement `generate_counterexamples(old_contract, new_contract)` and `replay_calls(old_contract, new_contract, calls)` in your workspace `main.py`.

- `generate_counterexamples` tries to build one minimal payload for each breaking change: added required fields, removed properties, narrowed and introduced enums, narrowed types, tightened bounds, and closed schemas. It keeps a payload only after checking that it passes the old contract and fails the new one. When no candidate does, it leaves that change without a counterexample instead of emitting a wrong one.
- `replay_calls` partitions saved historical calls into:
  - `preserved`: valid under both old and new contracts.
  - `broken`: valid under the old contract but rejected by the new contract.
  - `already_invalid`: rejected by the old contract.
  - `breaking_rate`: `len(broken) / (len(preserved) + len(broken))` (or 0.0 if empty).

## Verify and inspect

```bash
python3 scripts/project_test.py tool-contract-migration-checker --stage 3 --path learning-artifacts/tool-contract-migration-checker --strict
```

## References

[Property-Based and Generative Testing](https://hypothesis.works/)
