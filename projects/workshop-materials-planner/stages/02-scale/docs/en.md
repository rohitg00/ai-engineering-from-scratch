# Scale consumables and shared equipment separately

Stage 2 of 4. Scale consumables and reusable tools with different equations.

## Build the mechanism

At eight participants, two sheets each means 16 sheets. One pair of scissors per three participants means ceil(8/3)=3 pairs.

```figure
pj-workshop-materials-planner-2
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement scale(model,participants=None); preserve exact decimal quantities as strings.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py workshop-materials-planner --stage 2 --path learning-artifacts/workshop-materials-planner --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

Nine participants still need three pairs, but ten need four. Test the discontinuity instead of multiplying every material linearly.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
