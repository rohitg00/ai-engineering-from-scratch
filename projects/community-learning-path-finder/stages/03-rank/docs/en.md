# Rank alternatives under an explicit time budget

Stage 3 of 4. Maximize goal coverage inside a stated time budget.

## Build the mechanism

A 45-minute quick map may beat a 90-minute full route when both cover the same stated map goal. Distinct goals covered outrank time savings.

```figure
pj-community-learning-path-finder-3
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement rank_paths(index,goals,budget,completed=None). Combine closed routes, deduplicate the union of shared prerequisites, then rank by coverage, minutes and IDs.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py community-learning-path-finder --stage 3 --path learning-artifacts/community-learning-path-finder --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

The ranking reflects explicit goals and estimated minutes, not instructional quality or a guarantee of mastery.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
