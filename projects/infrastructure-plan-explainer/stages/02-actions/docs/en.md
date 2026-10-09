# Classify create, update, replace and delete actions

Stage 2 of 4. Separate replacements from ordinary updates.

## Build the mechanism

["delete","create"] and ["create","delete"] both replace a resource. Their original actions remain available to inspect ordering.

```figure
pj-infrastructure-plan-explainer-2
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement classify(actions); reject unsupported sequences rather than guessing their meaning.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py infrastructure-plan-explainer --stage 2 --path learning-artifacts/infrastructure-plan-explainer --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

forget means Terraform stops managing an object. It is not equivalent to deleting the remote object.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
