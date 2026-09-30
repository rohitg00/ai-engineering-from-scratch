# Self-Improving Skill Loop

A correction-to-skill experiment runner preserving sources, preventing leakage and supporting rollback.

Holdout separation must follow content and groups, not just ids. Two tickets with different ids can repeat the same customer message. Normalize content and union related records before assigning the component to a partition.

## Start with a learner workspace

[Model evaluation](../../phases/02-ml-fundamentals/09-model-evaluation/docs/en.md), [Repository memory and state](../../phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md), [Verification gates](../../phases/14-agent-engineering/38-verification-gates/docs/en.md). Language foundation: [Python data structures](https://docs.python.org/3/tutorial/datastructures.html).

Use Python 3.10+ and its standard library. POSIX is required where the project uses file locks or process-group supervision.

```bash
python3 scripts/project_test.py self-improving-skill-loop --init learning-artifacts/self-improving-skill-loop
python3 scripts/project_test.py self-improving-skill-loop --stage 1 --path learning-artifacts/self-improving-skill-loop
```

## Build route

1. [Split labeled cases without identity leakage](stages/01-dataset/docs/en.md)
2. [Execute and score a transparent routing skill](stages/02-skill/docs/en.md)
3. [Propose rules from development errors only](stages/03-propose/docs/en.md)
4. [Require a separate gate before promotion](stages/04-promotion/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
python3 learning-artifacts/self-improving-skill-loop/cli.py projects/self-improving-skill-loop/examples/support-cases.json --out experiment.json
```

To inspect the complete reference first, replace `learning-artifacts/self-improving-skill-loop` with `projects/self-improving-skill-loop/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

The experiment proposes deterministic routing rules from development data. Explicit development/holdout input is audited for content and group leakage. Promotion needs --promote-to and the exact --approve-digest printed by the passing gate. The previous rules remain in <destination>.previous for manual rollback; this is a single-writer file workflow.

```bash
python3 scripts/project_test.py self-improving-skill-loop --all --solution --strict
python3 scripts/project_test.py self-improving-skill-loop --all --path learning-artifacts/self-improving-skill-loop --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.


The `--dataset-audit audit.json` option consumes the dataset split auditor's versioned `partitions.train` and `partitions.test` records, preserving labels and sources and rechecking leakage locally. `--export-skill orchard-routing` writes a new draft `SKILL.md` plus `references/rules.json`; it does not install or activate the candidate.
