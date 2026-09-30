# Browser Agent

A form-run receipt that checks the requested values before trusting the success banner.

Node 22.18+, Python 3, DOM labels, async functions, subprocess arguments and byte arrays. Live Chromium additionally requires an installed gstack browse executable. The core uses standard libraries. The grader checks your selected workspace; it never fills in missing behavior from the reference.

## Build and run your version

From the repository root, initialize once. A fresh starter fails intentionally.

```bash
python3 scripts/project_test.py browser-agent --init learning-artifacts/browser-agent
python3 scripts/project_test.py browser-agent --stage 1 --path learning-artifacts/browser-agent --strict
```

Implement each stage, then run the cumulative grader and the supplied input driver:

```bash
python3 scripts/project_test.py browser-agent --all --path learning-artifacts/browser-agent --strict
cd learning-artifacts/browser-agent
node cli.ts --task samples/contact.json --output browser-run.json
```

The driver and offline samples are provided scaffolding. Its imports resolve to your implementation. Public input types and function signatures live in the starter and [API contract](API.md).

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py browser-agent --all --solution --strict
cd projects/browser-agent/solution
node cli.ts --task samples/contact.json --output browser-run.json
```

## Observe the change

The contact task fills Mira Chen and mira@example.test, submits once, then verifies DOM state and screenshot pixels. The second sample starts with a filled name and needs one fewer action.

Edit a copy of the sample and rerun the command. Keep the input beside the output so someone else can reproduce the result; the supplied samples are authored teaching data.

## Integration and limits

Replace Driver with an adapter that implements observe, act and capture. Run cli.ts --live only after serving the authored fixture and setting BROWSE_BIN.

Offline mode exercises fixture transitions and recorded pixels. Pixel greenness is a fixture-specific signal, not general visual understanding. The live CLI is limited to explicitly allowed loopback pages.

For an actual browser run, serve the completed workspace in one terminal:

```bash
python3 -m http.server 8877 --bind 127.0.0.1
```

In another terminal in that workspace, set BROWSE_BIN to your installed gstack executable, then run `node cli.ts --task samples/contact.json --live`. The runner navigates the configured loopback URL itself and saves a real screenshot.

## Stages

1. [Turn DOM state into constrained actions](stages/01-observations/docs/en.md)
2. [Stop on completion, stalling or budget](stages/02-bounded-loop/docs/en.md)
3. [Verify screenshot pixels in Python](stages/03-visual-proof/docs/en.md)
4. [Drive the real fixture and score the run](stages/04-real-browser/docs/en.md)


## Primary references

[Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
[PNG specification](https://www.w3.org/TR/png-3/)
[HTML form controls](https://html.spec.whatwg.org/multipage/forms.html)
