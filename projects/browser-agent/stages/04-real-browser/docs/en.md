# Drive the real fixture and score the run

Stage 4 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Serve fixture.html over loopback and navigate to it with gstack browse. GstackDriver reads DOM observations, fills labels, clicks the observed button and captures a real screenshot. Commands use argument arrays instead of a shell. Run the same bounded policy with --live and compare its trace with the fixture backend. Keep completion scores separate for simulated and real-browser runs.

The boundary for this stage is `GstackDriver, scoreRuns`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

The real adapter navigates the configured loopback URL, reads labels through JavaScript, fills observed ids and captures browser-result.png. Its screenshot comes from Chromium; fixture mode deliberately reuses authored pixels.

```figure
pj-browser-agent-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `GstackDriver, scoreRuns` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Keep binary and arguments separate in execFileSync. A task value containing quotes remains one fill argument. Supply an allowed origin before navigation, then recheck it on every observation.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py browser-agent --init learning-artifacts/browser-agent`. Then grade cumulatively:

```bash
python3 scripts/project_test.py browser-agent --stage 4 --path learning-artifacts/browser-agent --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/browser-agent
node cli.ts --task samples/contact.json --output browser-run.json
```

## Investigate the failure boundary

Serve fixture.html at127.0.0.1:8877, set BROWSE_BIN, and run cli.ts --task samples/contact.json --live. Record the mode, action count and screenshot together.

Offline mode exercises fixture transitions and recorded pixels. Pixel greenness is a fixture-specific signal, not general visual understanding. The live CLI is limited to explicitly allowed loopback pages.


## References

[Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
[PNG specification](https://www.w3.org/TR/png-3/)
[HTML form controls](https://html.spec.whatwg.org/multipage/forms.html)
