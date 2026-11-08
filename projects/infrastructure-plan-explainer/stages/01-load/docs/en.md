# Load a versioned plan without exposing sensitive values

Stage 1 of 4. Retain unknown and sensitive markers while dropping raw plan fields.

## Build the mechanism

The database password becomes [sensitive], including passwords nested in arrays. Its computed endpoint becomes [unknown] even when the after object omits that key.

```figure
pj-infrastructure-plan-explainer-1
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement load_plan(document). Accept format major 1; ignore unrelated fields and retain only sanitized resource evidence plus dependency references.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py infrastructure-plan-explainer --stage 1 --path learning-artifacts/infrastructure-plan-explainer --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

A saved plan can include secrets. Read the exported sanitized artifact; never copy raw variables or prior_state into the brief.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
