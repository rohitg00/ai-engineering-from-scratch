# Load named configuration layers

> Reject ambiguous configuration before comparing environments.

**Type:** Build
**Languages:** Go
**Stage:** 1 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Build `Load` for a one-MiB JSON object containing ordered `layers`, required `observed`, and optional `sensitive` exact key names. Layer names must be unique. This tool uses flat, scalar keys; flatten nested configurations explicitly before use.

## Worked example

The fixture declares timeout 30 in defaults.json, then timeout 5 in env:TIMEOUT. Both values survive input parsing. A nested timeout object is rejected because this contract does not imply a deep-merge policy.

```figure
pj-configuration-drift-explainer-1
```

## Implement the contract

`Load(data []byte) (Input, error)` returns typed `Layer{Name, Values}` records. Reject unknown top-level/layer fields, trailing JSON, null maps, duplicate names and blank keys. Scalars may be null, string, boolean or number.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py configuration-drift-explainer --init /tmp/configuration-drift-explainer-work
python3 scripts/project_test.py configuration-drift-explainer --stage 1 --path /tmp/configuration-drift-explainer-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Add a separate JSON-flattening adapter and specify whether arrays should be atomic values.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
