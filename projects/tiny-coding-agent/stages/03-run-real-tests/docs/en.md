# Run real tests through one allowed command

**Stage 3 of 4.** Python. Plan about 2 hours.

The test tool owns its argv. Model text never becomes a shell command. Run the current Python interpreter with unittest discovery, disable interactive stdin, capture output, and enforce a timeout.

A zero-test run or a suite with skipped tests is a failure even when unittest exits zero. Read the final unittest summary from stderr; text printed by a fixture to stdout is not runner evidence. The tool executes trusted Python, so path confinement alone is not an OS security boundary.

```figure
pj-tiny-coding-agent-3
```

Primary reference: [Primary technical reference](https://docs.python.org/3/library/subprocess.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [The agent loop](../../../../../phases/14-agent-engineering/01-the-agent-loop/docs/en.md). Complete [stage 2](../../02-apply-exact-patches/docs/en.md) first.

Run the actual unittest suite before claiming a repair. In the original basket example, total(7,3) returns 10 instead of 21; total(7,0) returns 7 instead of 0. Both failures should disappear after the patch.

```text
before: 2 failed assertions
after: 2 executed tests, OK
zero tests or skipped tests -> not success
```

## Build and inspect

Read the final unittest summary from stderr and require a positive executed test count. On POSIX, stop the process group when the test deadline expires.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py tiny-coding-agent --stage 3 --path learning-artifacts/tiny-coding-agent
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why must a printed "Ran 999 tests" line not count as test evidence?
