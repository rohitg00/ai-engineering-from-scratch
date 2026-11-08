# Export an accessible visual storyboard and data receipt

Stage 4 of 4. Produce portable SVG charts and machine-readable receipts.

## Build the mechanism

The line chart breaks around weeks 2 and 3. The gap remains visible in both the SVG and the exported null values.

```figure
pj-chart-storyboard-builder-4
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Input JSON contains csv, roles, optional periods, and charts [{grammar,reducer,annotations}]. Outputs chart-N.svg, chart-specs.json, storyboard.html. The consumer loads chart-specs.json, selects each charts entry and calls render_svg(spec); this reproduces the portable visual without the input CSV.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py chart-storyboard-builder --stage 4 --path learning-artifacts/chart-storyboard-builder --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

This tool supports categorical bars and ordered lines with explicit period order. It does not infer dates, causation or confidence intervals; use a separate statistical analysis for those.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
