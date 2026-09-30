# Validate a scoped cloud inspection plan

Stage 1 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

The model proposes intent; a deterministic validator grants authority. Accept only explicitly named read operations and resource ids from the caller scope. Reject unknown keys and oversized plans so additional model-generated instructions cannot silently become executable parameters.

## Work through one concrete case

A checkout incident plan contains metrics.read checkout and logs.read checkout. Both fit scope={checkout}. Replacing logs.read with logs.delete must reject the complete proposal before the first provider call.

```figure
pj-cloud-agent-with-aws-strands-1
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `plan.py`: `validate_plan`. This artifact is stage 1 of Cloud Agent With AWS Strands. It consumes explicit inputs and returns an inspectable result that the next stage can use.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Require exactly operation and resource keys. Do not let an extra shell or region property become an execution parameter because the model included it.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py cloud-agent-with-aws-strands --init learning-artifacts/cloud-agent-with-aws-strands`. Then grade cumulatively:

```bash
python3 scripts/project_test.py cloud-agent-with-aws-strands --stage 1 --path learning-artifacts/cloud-agent-with-aws-strands --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/cloud-agent-with-aws-strands
python3 cli.py samples/input.json --output incident.json
```

## Investigate the failure boundary

Add a second resource inventory-api outside scope. The provider-call spy should remain empty after validation fails.




## References

[Reference 1](https://strandsagents.com/docs/user-guide/concepts/model-providers/custom_model_provider/)
