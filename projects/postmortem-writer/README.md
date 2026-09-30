# Incident Postmortem Writer

Turn your JSONL incident logs and review decisions into an HTML evidence desk, exact-quote checks, owned actions and a source-bound approval receipt.

Level 2. Four stages, about eight hours. Implementation: Go, standard library only.

## Before you start

Use Go 1.22 or later and Python 3.12 or later for the grader. Be comfortable with functions, structs, slices, maps and returned errors. Complete the [environment setup](../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md) and [data management lesson](../../phases/00-setup-and-tooling/09-data-management/docs/en.md) first if these are unfamiliar.

## Stages

1. [Parse an incident event ledger](stages/01-parse-an-incident-event-ledger/docs/en.md)
2. [Build a stable bounded timeline](stages/02-build-a-stable-bounded-timeline/docs/en.md)
3. [Require evidence for each claim](stages/03-require-evidence-for-each-claim/docs/en.md)
4. [Publish a deterministic incident packet](stages/04-publish-a-deterministic-incident-packet/docs/en.md)

## Build it

```bash
python3 scripts/project_test.py postmortem-writer --init /tmp/postmortem-writer-work
python3 scripts/project_test.py postmortem-writer --stage 1 --path /tmp/postmortem-writer-work
python3 scripts/project_test.py postmortem-writer --all --solution --strict
```

## Run the artifact

```bash
cd projects/postmortem-writer/solution
go run .
```

`--events FILE --review FILE --out DIRECTORY` produces index.html, packet.json and packet.txt. Run the supplied files with `--events ../examples/events.jsonl --review ../examples/review.json --out /tmp/incident-packet`. With no arguments, the CLI prints a small original fixture. Evidence checks establish source provenance; causal judgment and reviewer identity remain human responsibilities.

The CLI and integration adapter are supplied in the learner starter. Implement the four stage functions; the adapter composes those same functions and cannot bypass unfinished work. Read integration.go after the core stages to see file boundaries, receipts and rendering.

The demo exercises the real reference implementation with offline fixtures and terminates. Each stage has at least five distinct tests, including boundaries and rejected inputs. Expected behavior lives in the stage tests; the implementation never reads the held-out test files. The grader preserves your code during initialization and reports incomplete runs honestly when a runtime is missing.

## Completion evidence

```bash
python3 scripts/project_test.py postmortem-writer --all --path /tmp/postmortem-writer-work --strict --report /tmp/postmortem-writer-result.json
```

Only a complete learner report can establish local completion. Reference runs do not grant a certificate. Reports are unsigned local evidence, and the project does not certify production readiness.

## Sources

[Official reference](https://sre.google/workbook/postmortem-culture/). All implementations and exercises are original. Fixture numbers are examples, not external benchmark claims or live service guarantees.
