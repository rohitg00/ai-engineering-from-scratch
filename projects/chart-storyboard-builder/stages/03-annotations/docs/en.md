# Attach annotations to the actual plotted values

Stage 3 of 4. Anchor every annotation to a computed point.

## Build the mechanism

The annotation "Opening event" for week 1 becomes "Opening event (18 people)" on the sum chart.

```figure
pj-chart-storyboard-builder-3
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement annotate(spec,requests). Only unique, nonmissing points can be annotated.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py chart-storyboard-builder --stage 3 --path learning-artifacts/chart-storyboard-builder --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

An annotation is a label, not a statistical significance claim. Causal language needs independent evidence.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
