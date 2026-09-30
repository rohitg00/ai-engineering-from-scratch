# Validate parent relationships

Stage 2 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

A child span must reference an existing parent and fit inside the parent interval. Check every ancestor chain for cycles and reject duplicate ids. Multiple roots are allowed because a trace can contain overlapping independent runs. Validation happens before aggregation so corrupted graphs cannot produce convincing charts.

The boundary for this stage is `validateTree`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

The root runs 0..100 and childA runs 10..80. A childB ending 110 violates containment even though each individual interval has a nonnegative duration. A->B->A violates ancestry even if every time is identical.

```figure
pj-agent-trace-debugger-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `validateTree` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Build an id map before walking ancestors. A fresh visited set per span catches cycles without confusing an ancestor shared by two valid children.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py agent-trace-debugger --init learning-artifacts/agent-trace-debugger`. Then grade cumulatively:

```bash
python3 scripts/project_test.py agent-trace-debugger --stage 2 --path learning-artifacts/agent-trace-debugger --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/agent-trace-debugger
node cli.ts --input samples/trace.jsonl --baseline samples/before.jsonl --output trace.html --json trace.json
```

## Investigate the failure boundary

Create two independent roots that overlap. They are valid; stage 3 must merge their time intervals instead of summing wall time.




## References

[OpenTelemetry traces concepts](https://opentelemetry.io/docs/concepts/signals/traces/)
[Node test runner](https://nodejs.org/api/test.html)
