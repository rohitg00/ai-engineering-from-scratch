# Stop on completion, stalling or budget

Stage 2 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Observe after every action. Stop if the state repeats, if policy blocks an action, or if the step budget is consumed. Completion requires the DOM success flag and a separate screenshot check. Trace every selected action before execution. The fixture backend is explicitly a simulator; it supplies deterministic observations to test the loop and does not claim browser coverage.

The boundary for this stage is `runAgent, FixtureDriver`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

An empty two-field form needs four observations: fill name, fill email, submit, verify. A budget of 3 can perform the submit but cannot establish completion, so the terminal state remains budget-exhausted.

```figure
pj-browser-agent-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `runAgent, FixtureDriver` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Observe after every mutation. Compare successive complete observations to detect a stalled driver; compare requested values before accepting done. If capturing or inspecting the screenshot fails, return `status: "screenshot-error"`, the trace, a reason, and the screenshot path when available (`null` if capture failed). Omit visual metrics when no image was inspected. Direct calls to `inspectPNG` still throw on invalid images.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py browser-agent --init learning-artifacts/browser-agent`. Then grade cumulatively:

```bash
python3 scripts/project_test.py browser-agent --stage 2 --path learning-artifacts/browser-agent --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/browser-agent
node cli.ts --task samples/contact.json --output browser-run.json
```

## Investigate the failure boundary

Use samples/accessibility.json, where the name is already correct. Explain why three observations now suffice without changing the policy.




## References

[Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
[PNG specification](https://www.w3.org/TR/png-3/)
[HTML form controls](https://html.spec.whatwg.org/multipage/forms.html)
