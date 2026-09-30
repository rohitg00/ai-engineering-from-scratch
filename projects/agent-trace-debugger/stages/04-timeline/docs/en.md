# Render an inspectable timeline

Stage 4 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Generate a standalone HTML timeline with one row per span, scaled bars and error coloring. Escape span names before inserting them into markup. Include own time, total time, wall time, tokens and error count. Empty traces still produce a readable artifact. The output is a local static report and does not load third-party scripts.

The boundary for this stage is `render`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

The supplied baseline and changed trace both have 100 ms wall time. The changed model span spends 200 additional tokens and fails. Looking only at total latency would conceal that regression.

```figure
pj-agent-trace-debugger-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `render` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

The CLI analyzes each input independently, then subtracts matching aggregate metrics. Escape span names before embedding them in HTML, and keep the JSON receipt for automated comparisons.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py agent-trace-debugger --init learning-artifacts/agent-trace-debugger`. Then grade cumulatively:

```bash
python3 scripts/project_test.py agent-trace-debugger --stage 4 --path learning-artifacts/agent-trace-debugger --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/agent-trace-debugger
node cli.ts --input samples/trace.jsonl --baseline samples/before.jsonl --output trace.html --json trace.json
```

## Investigate the failure boundary

Add a span named <script>alert(1)</script>. It must be visible as text while the token/error delta remains numeric.

Input is the documented JSONL Span contract, not a native OTLP export. Tokens must be exclusive per-span usage. Cross-machine clocks must be normalized before import.


## References

[OpenTelemetry traces concepts](https://opentelemetry.io/docs/concepts/signals/traces/)
[Node test runner](https://nodejs.org/api/test.html)
