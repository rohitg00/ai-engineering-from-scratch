# Reserve costs and enforce deadlines

Stage 3 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Reserve each reviewer cost before launching it. Skip work that cannot fit the remaining budget and record the decision. Race each reviewer against a deadline and abort its signal when time expires. Failures remain in the trace while completed reviews can still be aggregated. Adapters must honor AbortSignal to stop external work; the runner cannot force a remote service to cancel.

The boundary for this stage is `runPanel`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

Three reviewers cost one unit each and budget 2 admits only the first two. Their work starts concurrently, while a1000 ms deadline marks slow reviewers timeout and aborts their signals.

```figure
pj-multi-agent-code-review-panel-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `runPanel` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Reserve each cost before starting its promise. Keep timeout and failure events in the trace while aggregating completed reviews; otherwise a cheap-looking partial panel hides skipped work.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py multi-agent-code-review-panel --init learning-artifacts/multi-agent-code-review-panel`. Then grade cumulatively:

```bash
python3 scripts/project_test.py multi-agent-code-review-panel --stage 3 --path learning-artifacts/multi-agent-code-review-panel --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/multi-agent-code-review-panel
node cli.ts --input samples/review.json --output panel.json --html panel.html
```

## Investigate the failure boundary

Implement a reviewer that ignores AbortSignal. Show that the runner can stop waiting but cannot guarantee the external work stopped.




## References

[AbortController in Node](https://nodejs.org/api/globals.html#class-abortcontroller)
[Node test runner](https://nodejs.org/api/test.html)
