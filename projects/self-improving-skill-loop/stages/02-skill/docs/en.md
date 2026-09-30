# Execute and score a transparent routing skill

**Stage 2 of 4.** Python. Plan about 2 hours.

A routing skill is an ordered list of conjunctions. Matching every term makes multiword rules more specific than a bag of independent keywords, and first-match order is part of the contract. Evaluation stores predicted and expected labels per case so an aggregate cannot hide who regressed.

```figure
pj-self-improving-skill-loop-2
```

## Implementation boundary

```python
def route(text,rules,default='unknown'):
    raise NotImplementedError("Implement the stage contract")
```

Primary reference: [Reference 1](https://docs.python.org/3/library/hashlib.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Model evaluation](../../../../../phases/02-ml-fundamentals/09-model-evaluation/docs/en.md). Complete [stage 1](../../01-dataset/docs/en.md) first.

The routing skill is a transparent ordered list. A rule requires every term, and the first matching rule wins. Record each expected/predicted pair before calculating accuracy so errors can drive a proposal.

```text
rule terms=[password,reset], label=access
"password reset expired" -> access
"password rejected" -> unknown
```

## Build and inspect

Normalize input words once. Empty term sets must never become match-everything rules.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py self-improving-skill-loop --stage 2 --path learning-artifacts/self-improving-skill-loop
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What happens when a broad early rule shadows a more precise later rule?
