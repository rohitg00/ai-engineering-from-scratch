# Propose rules from development errors only

**Stage 3 of 4.** Python. Plan about 2 hours.

Generate candidates only from mistakes in the development split. A token needs repeated support and an unambiguous label; this stops one-off names and contradictory examples from immediately becoming policy. Candidate generation never receives holdout cases. It proposes a change rather than publishing one.

```figure
pj-self-improving-skill-loop-3
```

## Implementation boundary

```python
def propose(development,rules,min_support=2):
    raise NotImplementedError("Implement the stage contract")
```

Primary reference: [Reference 1](https://docs.python.org/3/library/hashlib.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Model evaluation](../../../../../phases/02-ml-fundamentals/09-model-evaluation/docs/en.md). Complete [stage 2](../../02-skill/docs/en.md) first.

Propose from development errors only. Invoice appears in two billing examples and can become a rule; a term used by both billing and access examples is ambiguous. Keep the holdout text out of this function.

```text
development: invoice wrong; invoice late -> billing
min_support=2 -> candidate terms=[invoice]
holdout: invoice missing -> used only after proposal
```

## Build and inspect

Count each term once per case and collect all associated labels. Require a unique label and enough independent support before proposing it.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py self-improving-skill-loop --stage 3 --path learning-artifacts/self-improving-skill-loop
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What failure would repeated copies of one development message cause without deduplication?
