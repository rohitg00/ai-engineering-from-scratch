# Infrastructure Plan Explainer

Read a saved Terraform plan JSON for a developer reviewing a proposed change. Preserve unknown and sensitive-value markers, separate replacement from in-place updates, and trace declared dependencies. Produce a review brief whose explanations link to exact plan addresses; never apply the plan.

The implementation uses Python 3.10+ and standard libraries. Samples are original teaching data. Read [API.md](API.md) for exact input, output and error contracts.

## Build your version

```bash
python3 scripts/project_test.py infrastructure-plan-explainer --init learning-artifacts/infrastructure-plan-explainer
python3 scripts/project_test.py infrastructure-plan-explainer --stage 1 --path learning-artifacts/infrastructure-plan-explainer --strict
```

A fresh starter fails clearly until you implement the first contract. Later stages retain your source file. The supplied CLI and presentation helpers are scaffolding; all domain decisions call your implementation.

```bash
python3 scripts/project_test.py infrastructure-plan-explainer --all --path learning-artifacts/infrastructure-plan-explainer --strict
cd learning-artifacts/infrastructure-plan-explainer
python3 cli.py samples/input.json --output my-output
```

## Run the reference and your own input

```bash
python3 scripts/project_test.py infrastructure-plan-explainer --all --solution --strict
cd projects/infrastructure-plan-explainer/solution
python3 cli.py samples/input.json --output demo-output
python3 cli.py /absolute/path/to/your-input.json --output your-output
```

Pass saved Terraform JSON directly: terraform show -json saved.plan > input.json, then python3 cli.py input.json --output review. Outputs change-brief.md, resource-impact.json, review.html. The downstream consumer loads resource-impact.json and follows graph.edges from/to into resources by id. No Terraform binary or provider credentials are needed to explain an existing JSON file.

## Worked example and limits

The database password becomes [sensitive], including passwords nested in arrays. Its computed endpoint becomes [unknown] even when the after object omits that key.

The tool never applies a plan. It does not predict outage duration, full execution order, costs or runtime dependency discovery; configuration references are evidence with explicit unresolved items.

## Stages

1. [Load a versioned plan without exposing sensitive values](stages/01-load/docs/en.md)
2. [Classify create, update, replace and delete actions](stages/02-actions/docs/en.md)
3. [Trace declared dependencies and unknown outcomes](stages/03-dependencies/docs/en.md)
4. [Export address-linked review explanations](stages/04-brief/docs/en.md)

## Primary references

- [Technical reference](https://developer.hashicorp.com/terraform/internals/json-format)
