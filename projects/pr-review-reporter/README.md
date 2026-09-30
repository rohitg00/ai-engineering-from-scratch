# PR Review Reporter

A local patch-review artifact that preserves Git line evidence and can enter CI as SARIF.

Node 22.18+, Python 3 and Git only for --repo mode; unified diff counters, JSON, exact source quotes and HTML escaping. The core uses standard libraries. The grader checks your selected workspace; it never fills in missing behavior from the reference.

## Build and run your version

From the repository root, initialize once. A fresh starter fails intentionally.

```bash
python3 scripts/project_test.py pr-review-reporter --init learning-artifacts/pr-review-reporter
python3 scripts/project_test.py pr-review-reporter --stage 1 --path learning-artifacts/pr-review-reporter --strict
```

Implement each stage, then run the cumulative grader and the supplied input driver:

```bash
python3 scripts/project_test.py pr-review-reporter --all --path learning-artifacts/pr-review-reporter --strict
cd learning-artifacts/pr-review-reporter
node cli.ts --diff samples/change.diff --output review.json --html review.html --sarif review.sarif
```

The driver and offline samples are provided scaffolding. Its imports resolve to your implementation. Public input types and function signatures live in the starter and [API contract](API.md).

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py pr-review-reporter --all --solution --strict
cd projects/pr-review-reporter/solution
node cli.ts --diff samples/change.diff --output review.json --html review.html --sarif review.sarif
```

## Observe the change

The sample patch adds eval(input) at new-file line 2 and a comment at line 3. The report retains one anchored candidate, suppresses the comment and writes matching JSON, HTML and SARIF locations.

Edit a copy of the sample and rerun the command. Keep the input beside the output so someone else can reproduce the result; the supplied samples are authored teaching data.

## Integration and limits

Use --diff - for stdin, --repo /path --base REF --head REF for a read-only Git diff, or --candidates recorded-findings.json to validate another reviewer's findings against the supplied patch.

Four lexical detectors are narrow review candidates, not an exploit verdict. Binary and combined diffs are outside scope. Quoted Git paths are decoded before validating traversal and anchoring. No remote PR comment is posted.

## Stages

1. [Recover new-file line numbers](stages/01-diff-lines/docs/en.md)
2. [Generate narrow review candidates](stages/02-inspect/docs/en.md)
3. [Verify and merge findings](stages/03-anchors/docs/en.md)
4. [Publish a local escaped report](stages/04-report/docs/en.md)


## Primary references

[Git diff format](https://git-scm.com/docs/diff-format)
[Python subprocess and JSON](https://docs.python.org/3/library/json.html)

## Feed the panel

The Multi-Agent Code Review Panel accepts this report through --pr-report. Its adapter preserves file, line and rule, maps severity to a numeric vote and retains diff_sha256. Supply the panel with the matching new-file source snapshot; an outdated snapshot should reject the imported quote.
