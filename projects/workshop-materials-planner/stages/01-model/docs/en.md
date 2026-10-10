# Model participants, materials and inventory units

Stage 1 of 4. Validate quantities, units and explicit sharing rules.

## Build the mechanism

Eight participants need paper per person and scissors per group of three. A bottle of glue has no known milliliter quantity unless you supply that conversion.

```figure
pj-workshop-materials-planner-1
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement validate(document). Conversion factor describes one source unit in target units.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py workshop-materials-planner --stage 1 --path learning-artifacts/workshop-materials-planner --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

Reject negative quantities, duplicate material IDs, zero sharing groups and inconsistent conversion cycles.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
