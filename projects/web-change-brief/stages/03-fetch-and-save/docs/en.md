# Fetch one page without losing the baseline

> Bound live HTTP work and verify saved snapshot integrity.

**Type:** Build  
**Language:** Go  
**Stage:** 3 of 4  
**Time:** About 2 hours

## What you are building

A failed fetch must not become the next baseline. Fetch and validate first; compute and write the report; replace a prior baseline only through an explicit action. The CLI does this once per invocation. It does not create a recurring monitor.

```figure
pj-web-change-brief-3
```

## Work through an example

A page returning HTTP 503 fails before parsing. A successful HTML response larger than 2 MB also fails. A redirect to a different host requires a new explicit URL. A valid saved baseline round-trips through JSON, while changing its block text without updating the digest makes LoadSnapshot fail.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `FetchHTML(ctx context.Context, rawURL string, client *http.Client) (string, error)`
- `SaveSnapshot(path string, snapshot Snapshot) error`
- `LoadSnapshot(path string) (Snapshot, error)`

Accept only HTTP(S) URLs without credentials, status 200, and text/html or application/xhtml+xml. Read through a limit of MaxHTMLBytes+1 to detect overflow. Apply cancellation and a default 15-second client timeout, with at most three requests and same-host redirects (including an unchanged explicit port). When the selected URL uses HTTPS, every redirect must keep HTTPS. An explicitly selected HTTP URL remains supported. Save via a temporary file in the same directory followed by rename. Load validates the canonical URL and content checksum.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Use httptest.NewServer to test actual responses without the internet. Test timeout/cancellation separately from status handling. A same-directory temporary file keeps rename semantics local to one filesystem. Delete temporary files even on errors.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py web-change-brief --init my-web-change-brief
python3 scripts/project_test.py web-change-brief --stage 3 --path my-web-change-brief
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

Does a successful fetch mean you saw content produced by client-side JavaScript? Which server or rate-limit behavior should remain visible to the person running this tool?

## Connect it to the finished artifact

A standalone change report, changes.json and a reusable baseline.json snapshot. The extractor is a deliberately limited readable-block scanner, not an HTML5 DOM or browser. It does not execute JavaScript, evaluate CSS visibility or fetch linked resources. Block order is ignored; repeated text counts are retained. Filtering phrases can hide useful changes, so use the same explicit filter policy for both snapshots.

After completing the project, try your own inputs:

```bash
cd my-web-change-brief
go run . --before fixtures/before.html --after fixtures/after.html --url https://example.invalid/makerspace --out ./web-change-output
```

Support conditional requests with ETag or Last-Modified, preserving the distinction between unchanged content, a failed request and an empty page. Keep scheduling outside the fetch function.

## Primary reference

[Official API documentation](https://pkg.go.dev/net/http). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
