# Find feasible paths and expose missing prerequisites

Stage 2 of 4. Expand a target into its prerequisite-first sequence.

## Build the mechanism

Publishing needs collection, and collection needs basics. With basics completed, the route contains collection then publishing.

```figure
pj-community-learning-path-finder-2
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement path_for(index,target,completed=None), returning missing prerequisites separately from the known steps.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py community-learning-path-finder --stage 2 --path learning-artifacts/community-learning-path-finder --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

A missing prerequisite cannot be silently skipped. Explicitly completed external IDs can satisfy it.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
