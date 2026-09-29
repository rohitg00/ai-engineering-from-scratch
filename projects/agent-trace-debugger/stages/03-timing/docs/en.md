# Separate work time from waiting time

Stage 3 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Inclusive duration is end minus start. Exclusive duration subtracts the union of immediate child intervals, not their sum, because parallel children overlap. Root interval union provides wall time across runs. Tokens are local per span and summed once. The slowest result names the span with greatest exclusive duration, avoiding a root that is mostly waiting on children.

The boundary for this stage is `unionDuration, analyze`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

ChildA runs 10..60 and childB runs 40..90. Their summed duration is 100, their overlap is 20, and their union is 80. The 100 ms parent therefore owns 20 ms, not zero.

```figure
pj-agent-trace-debugger-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `unionDuration, analyze` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Sort intervals by start; extend the current end on overlap and commit the interval only when the next interval starts after it. Use immediate children when computing a span's exclusive duration.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py agent-trace-debugger --init learning-artifacts/agent-trace-debugger`. Then grade cumulatively:

```bash
python3 scripts/project_test.py agent-trace-debugger --stage 3 --path learning-artifacts/agent-trace-debugger --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/agent-trace-debugger
node cli.ts --input samples/trace.jsonl --baseline samples/before.jsonl --output trace.html --json trace.json
```

## Investigate the failure boundary

Move B start from 40 to 70 in the lab. Predict union 70 and parent own time 30 before observing the bars.




## References

[OpenTelemetry traces concepts](https://opentelemetry.io/docs/concepts/signals/traces/)
[Node test runner](https://nodejs.org/api/test.html)
