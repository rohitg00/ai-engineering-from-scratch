# Apply a glossary to translation proposals

Stage 2 of 4. Apply a reviewed glossary to supplied translation proposals.

## Build the mechanism

An independently authored Spanish proposal says "Abre el map". The glossary map→mapa changes that residual term to "Abre el mapa".

```figure
pj-subtitle-localization-desk-2
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement propose(cues,translations,glossary). No provider is required; translations are supplied target-language text, not invented machine output.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py subtitle-localization-desk --stage 2 --path learning-artifacts/subtitle-localization-desk --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

A glossary cannot translate grammar or meaning. Missing proposals keep source text and a translation_missing flag.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
