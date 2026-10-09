# Configuration Drift Explainer

Help a developer compare declared defaults, environment overrides and observed JSON configuration. Preserve precedence and redaction rules, expose shadowed values, and attach every explanation to its source file or variable name. Export a drift report that an assistant can consume without receiving secret values.

Standard libraries only. Four stages, approximately eight hours. Go implementations are exercised by the grader.

## Build it

1. [Load named configuration layers](stages/01-load-layers/docs/en.md)
2. [Resolve precedence with provenance](stages/02-resolve-provenance/docs/en.md)
3. [Compare effective values](stages/03-compare-effective-values/docs/en.md)
4. [Export redacted CI evidence](stages/04-export-ci-evidence/docs/en.md)

```bash
python3 scripts/project_test.py configuration-drift-explainer --init /tmp/configuration-drift-explainer-work
python3 scripts/project_test.py configuration-drift-explainer --stage 1 --path /tmp/configuration-drift-explainer-work --strict
python3 scripts/project_test.py configuration-drift-explainer --all --solution --strict
```

The fresh starter fails until you implement it. Reference-solution runs never grant learner completion certificates.

## Run your own configuration

```bash
cd projects/configuration-drift-explainer/solution
go run . --input fixtures/config.json --out /tmp/drift.json
python3 -c 'import json; r=json.load(open("/tmp/drift.json")); print([c["key"] for c in r["changes"] if c["kind"] != "equal"])'
go build -o /tmp/drift-explainer .
/tmp/drift-explainer --input fixtures/config.json --check
```

Input schema: `layers:[{name,values:{key:scalar}}]`, `observed:{key:scalar}`, optional `sensitive:[key]`. Later layers win. This explicitly flat contract does not merge nested objects or expand shell variables. Use named source identifiers, never secret values, in layer names.

The version-1 report records equal, changed, missing and unexpected values plus ordered precedence history. Automatic redaction recognizes password, secret, token, api-key and credential key names; `sensitive` supplies additional exact keys. Redaction covers current and historical values, including unexpected observed keys. Classification happens before redaction. This naming heuristic cannot detect secrets hidden in an innocently named value; explicit classification belongs to the caller.

The built binary returns 2 for `--check` drift. File exports use owner-only permissions on creation. See [Go JSON](https://pkg.go.dev/encoding/json) for encoding behavior.

## Completion evidence

```bash
python3 scripts/project_test.py configuration-drift-explainer --all --path /tmp/configuration-drift-explainer-work --strict --report /tmp/configuration-drift-explainer-result.json
```

Local reports are unsigned, self-reported evidence. The editable figures calculate illustrative values; the CLI runs the actual implementation.
