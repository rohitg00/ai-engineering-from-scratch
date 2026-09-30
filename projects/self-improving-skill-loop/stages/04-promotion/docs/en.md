# Require a separate gate before promotion

**Stage 4 of 4.** Python. Plan about 2 hours.

Compare baseline and candidate on the same reserved cases. Require a minimum aggregate gain and zero losses on previously correct cases, then identify the exact candidate with a digest. This gate evaluates an artifact; it never rewrites a user skill or deploys it. Repeatedly tuning on the same holdout leaks information, so rotate a genuinely new evaluation set for later rounds.

```figure
pj-self-improving-skill-loop-4
```

## Implementation boundary

```python
def gate(holdout,baseline,candidate,min_gain=.05):
    raise NotImplementedError("Implement the stage contract")
```

Primary reference: [Reference 1](https://docs.python.org/3/library/hashlib.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Model evaluation](../../../../../phases/02-ml-fundamentals/09-model-evaluation/docs/en.md). Complete [stage 3](../../03-propose/docs/en.md) first.

A passing holdout gate produces a candidate digest for human review. Promotion requires that exact digest, writes a versioned rules file, and preserves the previous file for rollback. Published sample tickets are examples, not an unseen benchmark.

```text
baseline accuracy=0; candidate accuracy=1; no regression -> eligible
wrong digest -> no write
exact digest -> promote and retain .previous
```

## Build and inspect

Bind approval to serialized rule content and recompute the digest before writing. Never infer approval from a good score.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py self-improving-skill-loop --stage 4 --path learning-artifacts/self-improving-skill-loop
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
python3 learning-artifacts/self-improving-skill-loop/cli.py projects/self-improving-skill-loop/examples/support-cases.json --out experiment.json
```

The experiment proposes deterministic routing rules from development data. Explicit development/holdout input is audited for content and group leakage. Promotion needs --promote-to and the exact --approve-digest printed by the passing gate. The previous rules remain in <destination>.previous for manual rollback; this is a single-writer file workflow.

## Investigate next

How would you freeze the next holdout before editing the skill again?

The `--dataset-audit audit.json` option consumes the dataset split auditor's versioned `partitions.train` and `partitions.test` records, preserving labels and sources and rechecking leakage locally. `--export-skill orchard-routing` writes a new draft `SKILL.md` plus `references/rules.json`; it does not install or activate the candidate.
