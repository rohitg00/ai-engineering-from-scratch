# Hedged Request Lab

Help client developers evaluate delayed duplicate requests for safe reads. Send a second attempt only after a configurable delay, accept the first valid response, and record cancellation, late completion and duplicate service work separately. Export a bounded HTTP client and a latency-versus-work report from controlled local endpoints.

Standard libraries only. Four stages, approximately eight hours. Go implementations are exercised by the grader.

## Build it

1. [Measure safe-read latency](stages/01-measure-safe-reads/docs/en.md)
2. [Schedule delayed duplicate attempts](stages/02-schedule-duplicate/docs/en.md)
3. [Validate winners and account for late work](stages/03-validate-and-account/docs/en.md)
4. [Export latency and duplicate-work tradeoffs](stages/04-export-tradeoffs/docs/en.md)

```bash
python3 scripts/project_test.py hedged-request-lab --init /tmp/hedged-request-lab-work
python3 scripts/project_test.py hedged-request-lab --stage 1 --path /tmp/hedged-request-lab-work --strict
python3 scripts/project_test.py hedged-request-lab --all --solution --strict
```

The fresh starter fails until you implement it. Reference-solution runs never grant learner completion certificates.

## Run the controlled endpoint comparison

```bash
cd projects/hedged-request-lab/solution
go run . --samples 3 --delay-ms 10 --out /tmp/hedge-report.json
python3 -c 'import json; r=json.load(open("/tmp/hedge-report.json")); print("call ratio",r["hedgedCalls"]/r["baselineCalls"],"server work",r["fixtureWork"])'
```

The terminating demo runs real loopback HTTP endpoints, with an 80ms primary and a 5ms secondary. It compares baseline and hedged winner latency, calls launched and server work. Service handlers deliberately keep working after client cancellation, so the completed counter demonstrates why a cancelled client request does not prove saved computation or billing.

Reuse `Hedged` for declared safe reads, or pass `--primary URL --secondary URL` to the CLI. Each endpoint must return HTTP 200 with JSON `{value:"nonempty string"}`. The caller is responsible for equivalent data versions and semantics between endpoints. The default client forbids redirects; the library accepts an explicitly supplied http.Client.

At most two GET attempts run per operation, response bodies are limited to 64KiB, each operation has a two-second ceiling and post-winner observation is bounded at 100ms. The version-1 receipt distinguishes winner latency, attempts, cancellation requests, observed cancellation, late observations and unobserved client attempts. Local percentiles are illustrative observations, not external service performance claims.

[Go contexts](https://pkg.go.dev/context), [Go HTTP](https://pkg.go.dev/net/http) and [HTTP safe methods](https://www.rfc-editor.org/rfc/rfc9110.html#name-safe-methods) define the library boundaries.

## Completion evidence

```bash
python3 scripts/project_test.py hedged-request-lab --all --path /tmp/hedged-request-lab-work --strict --report /tmp/hedged-request-lab-result.json
```

Local reports are unsigned, self-reported evidence. The editable figures calculate illustrative values; the CLI runs the actual implementation.
