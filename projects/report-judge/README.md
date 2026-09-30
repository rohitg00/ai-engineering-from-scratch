# Report Judge

An evidence-audit workbench showing uncertainty and claims requiring human review.

Audit each factual sentence separately. Orchard has a sourced retry limit and an unrelated deployment claim; one valid marker must not make the whole paragraph pass.

## Start with a learner workspace

[Retrieval augmented generation](../../phases/11-llm-engineering/06-rag/docs/en.md), [Model evaluation](../../phases/02-ml-fundamentals/09-model-evaluation/docs/en.md), [Verification gates](../../phases/14-agent-engineering/38-verification-gates/docs/en.md). Language foundation: [Python data structures](https://docs.python.org/3/tutorial/datastructures.html).

Use Python 3.10+ and its standard library. POSIX is required where the project uses file locks or process-group supervision.

```bash
python3 scripts/project_test.py report-judge --init learning-artifacts/report-judge
python3 scripts/project_test.py report-judge --stage 1 --path learning-artifacts/report-judge
```

## Build route

1. [Parse claims and citation references](stages/01-claims/docs/en.md)
2. [Check evidence before averaging scores](stages/02-support/docs/en.md)
3. [Report precision coverage and source recall](stages/03-metrics/docs/en.md)
4. [Compare paired revisions with bootstrap intervals](stages/04-compare/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
python3 learning-artifacts/report-judge/cli.py projects/report-judge/examples/claims.json --out evidence-audit.json --html evidence-audit.html
```

To inspect the complete reference first, replace `learning-artifacts/report-judge` with `projects/report-judge/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

The judge provides conservative lexical evidence checks. Order, numbers and negation expose some false matches; paraphrases can still be rejected and other false matches remain. Missing recall/coverage labels are null. No automated score proves truth.

```bash
python3 scripts/project_test.py report-judge --all --solution --strict
python3 scripts/project_test.py report-judge --all --path learning-artifacts/report-judge --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.
