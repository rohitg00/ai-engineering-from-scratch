# Prompt Regression Tester

A prompt-change review kit that identifies exactly which user commitments broke.

Orchard must return JSON and preserve a source locator. Keep `format-json` and `source-link` as different case ids: they are separate promises to the caller. The cassette hashes the entire case list, including prompts and checks, before comparing runs.

## Start with a learner workspace

[Structured outputs](../../phases/11-llm-engineering/03-structured-outputs/docs/en.md), [Model evaluation](../../phases/02-ml-fundamentals/09-model-evaluation/docs/en.md). Language foundation: [Python data structures](https://docs.python.org/3/tutorial/datastructures.html).

Use Python 3.10+ and its standard library. POSIX is required where the project uses file locks or process-group supervision.

```bash
python3 scripts/project_test.py prompt-regression-tester --init learning-artifacts/prompt-regression-tester
python3 scripts/project_test.py prompt-regression-tester --stage 1 --path learning-artifacts/prompt-regression-tester
```

## Build route

1. [Validate cases before scoring](stages/01-validate-cases/docs/en.md)
2. [Score recorded outputs without a model](stages/02-score-recordings/docs/en.md)
3. [Compare the same cases across revisions](stages/03-pair-revisions/docs/en.md)
4. [Gate releases on explicit tolerances](stages/04-gate-releases/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
python3 learning-artifacts/prompt-regression-tester/cli.py projects/prompt-regression-tester/examples/cases.json projects/prompt-regression-tester/examples/baseline.json projects/prompt-regression-tester/examples/candidate.json --out prompt-diff.json --markdown prompt-diff.md
```

To inspect the complete reference first, replace `learning-artifacts/prompt-regression-tester` with `projects/prompt-regression-tester/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

The supplied recordings are authored fixtures. The tool compares recorded responses; it does not call a model or establish semantic correctness. JSON case and response files are the public interface. A blocked gate exits 1.

```bash
python3 scripts/project_test.py prompt-regression-tester --all --solution --strict
python3 scripts/project_test.py prompt-regression-tester --all --path learning-artifacts/prompt-regression-tester --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.

## Primary references

- [Mechanism and API reference](https://docs.python.org/3/library/difflib.html)

Each recording binds stable test cases through `case_sha256` and records the exact `prompt_template` with `template_sha256`. Template revisions may differ; changing the tested tasks requires new recordings. The checked-in responses are marked `authored_fixture`, not provider measurements.
