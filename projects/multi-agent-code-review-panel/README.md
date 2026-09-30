# Multi-Agent Code Review Panel

A review disagreement workbench that measures when quorum helps and when it hides findings.

Node 22.18+ and Python 3 for the grader; TypeScript objects, sets, promises, AbortSignal and precision/recall. The core uses standard libraries. The grader checks your selected workspace; it never fills in missing behavior from the reference.

## Build and run your version

From the repository root, initialize once. A fresh starter fails intentionally.

```bash
python3 scripts/project_test.py multi-agent-code-review-panel --init learning-artifacts/multi-agent-code-review-panel
python3 scripts/project_test.py multi-agent-code-review-panel --stage 1 --path learning-artifacts/multi-agent-code-review-panel --strict
```

Implement each stage, then run the cumulative grader and the supplied input driver:

```bash
python3 scripts/project_test.py multi-agent-code-review-panel --all --path learning-artifacts/multi-agent-code-review-panel --strict
cd learning-artifacts/multi-agent-code-review-panel
node cli.ts --input samples/review.json --output panel.json --html panel.html
```

The driver and offline samples are provided scaffolding. Its imports resolve to your implementation. Public input types and function signatures live in the starter and [API contract](API.md).

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py multi-agent-code-review-panel --all --solution --strict
cd projects/multi-agent-code-review-panel/solution
node cli.ts --input samples/review.json --output panel.json --html panel.html
```

## Observe the change

The broad reviewer flags a comment and two real candidates: precision 2/3. Quorum removes the lone comment false positive and reaches precision 1 while preserving the TLS severity disagreement. A budget of1 produces no consensus.

Edit a copy of the sample and rerun the command. Keep the input beside the output so someone else can reproduce the result; the supplied samples are authored teaching data.

## Integration and limits

Input files maps names to text or lines. Optional reviewers contain id,cost,findings recordings. Expected labels use {file,line,rule}; the report records the source fingerprint and per-reviewer versus consensus metrics.

Local reviewers are distinct static heuristics, not independent LLMs. Consensus measures support, not truth. External callbacks must honor AbortSignal; timeout cannot undo a remote side effect.

## Stages

1. [Validate reviewer evidence](stages/01-evidence/docs/en.md)
2. [Aggregate independent support](stages/02-agreement/docs/en.md)
3. [Reserve costs and enforce deadlines](stages/03-budgets/docs/en.md)
4. [Measure panel precision and recall](stages/04-evaluate/docs/en.md)


## Primary references

[AbortController in Node](https://nodejs.org/api/globals.html#class-abortcontroller)
[Node test runner](https://nodejs.org/api/test.html)

## Reuse a PR review receipt

Run PR Review Reporter on an authored diff, then provide its schema_version1 output with `--pr-report /path/review.json` and a matching full source snapshot:

```bash
node cli.ts --input samples/pr-snapshot.json --pr-report /path/review.json --output composed-panel.json
```

The adapter converts high/medium/low severity to3/2/1, preserves file/line/rule identity and records pr_diff_sha256. Imported findings still pass the panel's source quote gate. This proves artifact compatibility; it does not turn correlated lexical detectors into independent judgments.
