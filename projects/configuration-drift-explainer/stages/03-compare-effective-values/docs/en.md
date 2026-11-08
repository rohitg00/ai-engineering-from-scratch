# Compare effective values

> Distinguish equal, changed, missing and unexpected keys.

**Type:** Build
**Languages:** Go
**Stage:** 3 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Compare expected resolved values with the observed scalar map. Emit one sorted row per union key. A missing key is different from a present null. Evaluate equality before redacting so two different secret values still report changed.

## Worked example

The effective timeout is 5 but observed timeout is 30, so kind is changed. api_token also changes, but both displayed values and every history value become [REDACTED]. region stays equal.

```figure
pj-configuration-drift-explainer-3
```

## Implement the contract

`Compare(in Input) Report` returns `schemaVersion:1`, `drift:boolean`, and sorted `changes`. Each row has `key`, `kind`, `expected`, `observed`, `history`, `redacted`. Sensitive keys match password/secret/token/api-key/credential case-insensitively or the explicit sensitive list.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py configuration-drift-explainer --init /tmp/configuration-drift-explainer-work
python3 scripts/project_test.py configuration-drift-explainer --stage 3 --path /tmp/configuration-drift-explainer-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Add an explicit allowlist for a CI consumer that only considers selected drift rows blocking.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
