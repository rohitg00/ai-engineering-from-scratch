# Trace declared dependencies and unknown outcomes

Stage 3 of 4. Trace references to concrete plan addresses.

## Build the mechanism

svc.app references svc.db.endpoint. The graph connects svc.app to svc.db even though the endpoint value is unknown.

```figure
pj-infrastructure-plan-explainer-3
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement impact_graph(plan), preserving unresolved resource references and filtering variable/local expression roots.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py infrastructure-plan-explainer --stage 3 --path learning-artifacts/infrastructure-plan-explainer --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

This graph follows declared resource references. Dynamic module outputs and provider behavior can require information outside the saved plan.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
