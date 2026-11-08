# Export address-linked review explanations

Stage 4 of 4. Publish exact resource identities beside sanitized change evidence.

## Build the mechanism

A replacement keeps its address and a stable section anchor. A reviewer can connect that section to the resource-impact graph by id.

```figure
pj-infrastructure-plan-explainer-4
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Pass saved Terraform JSON directly: terraform show -json saved.plan > input.json, then python3 cli.py input.json --output review. Outputs change-brief.md, resource-impact.json, review.html. The downstream consumer loads resource-impact.json and follows graph.edges from/to into resources by id. No Terraform binary or provider credentials are needed to explain an existing JSON file.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py infrastructure-plan-explainer --stage 4 --path learning-artifacts/infrastructure-plan-explainer --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

The tool never applies a plan. It does not predict outage duration, full execution order, costs or runtime dependency discovery; configuration references are evidence with explicit unresolved items.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
