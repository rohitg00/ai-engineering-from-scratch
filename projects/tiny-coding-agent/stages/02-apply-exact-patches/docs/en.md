# Apply exact patches with preconditions

**Stage 2 of 4.** Python. Plan about 2 hours.

A patch is an assertion about the current file, not a blind instruction to overwrite it. Require the old text to appear exactly once. If the model guessed stale code or an ambiguous snippet, reject the patch and preserve the file.

Write the replacement to a temporary file in the same directory, preserve the target's permission bits, then atomically replace the target. This avoids leaving a half-written source file if the process fails while writing and keeps executable scripts executable.

```figure
pj-tiny-coding-agent-2
```

Primary reference: [Primary technical reference](https://docs.python.org/3/library/subprocess.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [The agent loop](../../../../../phases/14-agent-engineering/01-the-agent-loop/docs/en.md). Complete [stage 1](../../01-confine-paths/docs/en.md) first.

A patch states exactly what it expects to replace. The broken basket multiplies neither price nor quantity: it returns price + quantity. Replace that expression only when it appears once.

```text
old: price + quantity
new: price * quantity
occurrences=1 -> write; occurrences=0 or 2 -> reject
```

## Build and inspect

Count exact matches before opening a temporary output file. Preserve file permissions when replacing the original. Capture the temporary path before writing and remove it in a `finally` block, including when writing, closing, or replacing fails. The original stays unchanged until replacement succeeds.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py tiny-coding-agent --stage 2 --path learning-artifacts/tiny-coding-agent
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What should happen when another editor fixes the file after the planner proposes a patch?
