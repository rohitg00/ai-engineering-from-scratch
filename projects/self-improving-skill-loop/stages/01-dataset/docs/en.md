# Split labeled cases without identity leakage

**Stage 1 of 4.** Python. Plan about 2 hours.

Hash each stable case id to choose a partition independent of file order. A duplicate identity is rejected before evaluation. The split is deterministic, but it does not promise perfectly balanced label counts; inspect both partitions and reserve the evaluation partition before proposing rules.

```figure
pj-self-improving-skill-loop-1
```

## Implementation boundary

```python
def split_cases(cases,holdout_fraction=.25):
    raise NotImplementedError("Implement the stage contract")
```

Primary reference: [Reference 1](https://docs.python.org/3/library/hashlib.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Model evaluation](../../../../../phases/02-ml-fundamentals/09-model-evaluation/docs/en.md).

Holdout separation must follow content and groups, not just ids. Two tickets with different ids can repeat the same customer message. Normalize content and union related records before assigning the component to a partition.

```text
id d1: "Invoice wrong"
id h1: "INVOICE   wrong"
fingerprint equal -> one partition, or reject explicit split
```

## Build and inspect

Union both duplicate-content edges and group edges before hashing a component. Reject conflicting labels for identical normalized content.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py self-improving-skill-loop --init learning-artifacts/self-improving-skill-loop
python3 scripts/project_test.py self-improving-skill-loop --stage 1 --path learning-artifacts/self-improving-skill-loop
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Can two distinct messages from one customer thread safely be treated as independent examples?
