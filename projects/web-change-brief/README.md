# Web Change Brief

Turn noisy HTML snapshots into a small report of exact readable text changes.

You build a standalone change report, changes.json and a reusable baseline.json snapshot. Inputs: Two saved HTML snapshots of the same URL, or a saved JSON baseline and one explicit live HTTP(S) URL.

## Before you start

Go 1.22 or newer. The required core uses standard libraries and runs offline. Go's standard library exposes HTTP limits, context cancellation, atomic file replacement and safe HTML templates with no framework.

- Write Go functions, slices, maps and error returns.
- Understand an HTTP response status, Content-Type and body.
- Understand that a text snapshot and a rendered web page expose different information.

## Build it

```bash
python3 scripts/project_test.py web-change-brief --init my-web-change-brief
python3 scripts/project_test.py web-change-brief --stage 1 --path my-web-change-brief
python3 scripts/project_test.py web-change-brief --all --solution --strict
```

The first command creates an intentionally incomplete workspace. Later stages extend the same source file; their tests include new held-out inputs. Reference-solution passes verify the examples and do not earn a learner certificate.

## Use it

```bash
cd projects/web-change-brief/solution
go run . --before fixtures/before.html --after fixtures/after.html --url https://example.invalid/makerspace --out ./web-change-output
```

Open the resulting index.html locally. Copy the HTML and JSON into your own workflow, or import the named functions from main. The included demo runs the same implementation on original fixtures:

```bash
python3 demo.py
```

## Stages

1. [Extract text before comparing pages](stages/01-extract-readable-blocks/docs/en.md)
2. [Compare exact text and preserve duplicates](stages/02-compare-snapshots/docs/en.md)
3. [Fetch one page without losing the baseline](stages/03-fetch-and-save/docs/en.md)
4. [Export a brief a person can inspect](stages/04-export-change-evidence/docs/en.md)

## What the result establishes

The extractor is a deliberately limited readable-block scanner, not an HTML5 DOM or browser. It does not execute JavaScript, evaluate CSS visibility or fetch linked resources. Block order is ignored; repeated text counts are retained. Filtering phrases can hide useful changes, so use the same explicit filter policy for both snapshots.

Live mode: go run . --fetch https://YOUR_HOST/YOUR_PAGE --baseline ./web-change-output/baseline.json --out ./next-report. Only the selected page is fetched, with an HTTP timeout, a 2 MB body limit and same-host redirects. HTTPS fetches reject redirects to HTTP. The existing baseline remains untouched unless --accept is explicitly passed after a successful report. No background monitoring or notifications are installed.

Provider tests use controlled responses or loopback HTTP. They verify request and response contracts, not a model's quality or live service availability. No account connection, outgoing message, recurring task or cloud deployment is configured by this project.

## Make it your own

Replace the authored fixtures with a small export from your workflow and write down the expected result before running it. Preserve a second set of examples for evaluation. A useful before-and-after demonstration should show the input, inspectable intermediate evidence and portable output; it should not substitute a popularity claim for a measured result.

## Primary reference

[Official API documentation](https://pkg.go.dev/net/http). All project code, lesson prose and fixtures are original.
