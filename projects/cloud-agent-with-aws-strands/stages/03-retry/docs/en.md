# Retry transient reads and reuse completed requests

Stage 3 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Retry only transient timeout failures and cache successful reads by a canonical action identity. A permission failure is not transient and must escape immediately. This cache is request-local: real cloud state changes, so a long-lived cache needs an explicit TTL or version instead of silently reusing old data.

## Work through one concrete case

The plan reads checkout metrics twice. The first call times out once and then succeeds; the second logical read reuses the cached value. Provider calls=2, completed logical reads=2, cache hits=1.

```figure
pj-cloud-agent-with-aws-strands-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `retry.py`: `request_key`, `cached_read`. This artifact is stage 3 of Cloud Agent With AWS Strands. It consumes explicit inputs and returns an inspectable result that the next stage can use.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Cache only successful results under a canonical pair of operation and resource. Permission errors bypass the timeout retry loop; repeating them cannot grant authority.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py cloud-agent-with-aws-strands --init learning-artifacts/cloud-agent-with-aws-strands`. Then grade cumulatively:

```bash
python3 scripts/project_test.py cloud-agent-with-aws-strands --stage 3 --path learning-artifacts/cloud-agent-with-aws-strands --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/cloud-agent-with-aws-strands
python3 cli.py samples/input.json --output incident.json
```

## Investigate the failure boundary

Change the second resource to another scoped service. It must produce a different cache key even though the operation is identical.




## References

[Reference 1](https://strandsagents.com/docs/user-guide/concepts/model-providers/custom_model_provider/)
