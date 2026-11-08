# Export redacted CI evidence

> Produce a report an assistant can consume without receiving secret values.

**Type:** Build
**Languages:** Go
**Stage:** 4 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Compose the stages in the CLI. Output JSON to stdout and optionally a mode-0600 file. The report is the only exported data structure. `--check` exits 2 when drift is present, 0 when equal, and 1 for invalid input or I/O failures.

## Worked example

Run the README command and use Python to load the report: schemaVersion is 1 and changed keys are api_token and timeout. Searching the serialized bytes for either fixture token must find nothing.

```figure
pj-configuration-drift-explainer-4
```

## Implement the contract

`Export(in Input) ([]byte,error)` serializes only `Compare(in)`. CLI: `go run . --input PATH --out PATH [--check]`. Go run wraps child exit codes, so build a binary when checking exact exit code 2.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py configuration-drift-explainer --init /tmp/configuration-drift-explainer-work
python3 scripts/project_test.py configuration-drift-explainer --stage 4 --path /tmp/configuration-drift-explainer-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Integrate the built binary into CI and pass the redacted JSON as an assistant attachment. Source names and nonsecret values remain visible; select sensitive keys deliberately.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
