# Resolve precedence with provenance

> Keep every shadowed setting while choosing the last declared value.

**Type:** Build
**Languages:** Go
**Stage:** 2 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Implement `Resolve` over validated layers. A later layer overrides an earlier one. Preserve all source names and values in order for each key. Resolution is an internal operation and can contain secrets; only the report is safe to export.

## Worked example

timeout has history [(defaults.json,30),(env:TIMEOUT,5)] and effective value 5. An unrelated region value remains local. Explicit null replaces an earlier value instead of deleting the key.

```figure
pj-configuration-drift-explainer-2
```

## Implement the contract

`Resolve(layers []Layer) map[string]Effective`, where `Effective{Value any, History []Source}` and `Source{Layer string, Value any}`. Empty layers produce an empty map.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py configuration-drift-explainer --init /tmp/configuration-drift-explainer-work
python3 scripts/project_test.py configuration-drift-explainer --stage 2 --path /tmp/configuration-drift-explainer-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Compare explicit null, missing key and an empty string. They represent three different effective configurations.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
