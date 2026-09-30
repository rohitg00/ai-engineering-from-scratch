# Read a JSONL trace

Stage 1 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Parse one JSON object per nonempty line. Require stable ids, names, finite start and end times, nonnegative token counts and an explicit ok or error state. A malformed line stops processing with its line number. Silently dropping bad spans would distort timing and cost conclusions. Times are relative milliseconds, not wall-clock timestamps.

The boundary for this stage is `parseTrace`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

A file containing a blank line, a valid root and malformed text must report the malformed text as line 3. Filtering blank lines before numbering would incorrectly blame line 2.

```figure
pj-agent-trace-debugger-1
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `parseTrace` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Enumerate physical lines first, ignore blanks inside that loop, and validate finite start/end/tokens after JSON parsing. Retain zero-duration spans; they are valid observations.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py agent-trace-debugger --init learning-artifacts/agent-trace-debugger`. Then grade cumulatively:

```bash
python3 scripts/project_test.py agent-trace-debugger --stage 1 --path learning-artifacts/agent-trace-debugger --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/agent-trace-debugger
node cli.ts --input samples/trace.jsonl --baseline samples/before.jsonl --output trace.html --json trace.json
```

## Investigate the failure boundary

Record one nested span from a local script. Keep times in relative milliseconds and account for token usage on exactly one span.




## References

[OpenTelemetry traces concepts](https://opentelemetry.io/docs/concepts/signals/traces/)
[Node test runner](https://nodejs.org/api/test.html)
