# Execute reads within step and response budgets

Stage 2 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Charge steps before starting an operation and charge serialized output before retaining it. Output limits cannot undo the cost of a call, but they prevent a large result from flooding later context. Keep partial results and an explicit terminal state so a budget stop remains diagnosable.

## Work through one concrete case

With max_steps=2, a three-action plan retains at most two results. With max_chars=1, the first provider can still run before its result is found too large; no output is retained.

```figure
pj-cloud-agent-with-aws-strands-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `executor.py`: `execute`. This artifact is stage 2 of Cloud Agent With AWS Strands. It consumes explicit inputs and returns an inspectable result that the next stage can use.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

A step budget limits dispatch. A serialized-output budget limits retained context. Name these different guarantees in the result and retain the already completed rows on exhaustion.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py cloud-agent-with-aws-strands --init learning-artifacts/cloud-agent-with-aws-strands`. Then grade cumulatively:

```bash
python3 scripts/project_test.py cloud-agent-with-aws-strands --stage 2 --path learning-artifacts/cloud-agent-with-aws-strands --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/cloud-agent-with-aws-strands
python3 cli.py samples/input.json --output incident.json
```

## Investigate the failure boundary

Return a 1000-character string from the first read. Show why bounding provider response bytes is a separate adapter responsibility.




## References

[Reference 1](https://strandsagents.com/docs/user-guide/concepts/model-providers/custom_model_provider/)
