# Confine file tools to a workspace

**Stage 1 of 4.** Python. Plan about 2 hours.

An agent file tool must interpret paths relative to the workspace, then resolve symlinks before checking containment. String prefixes are insufficient: /tmp/work-other starts with /tmp/work but is a different directory.

This protects file-tool paths in a trusted local teaching workspace. It does not sandbox Python tests, prevent a concurrent symlink race, or isolate hostile code. Only run trusted fixtures in this project.

```figure
pj-tiny-coding-agent-1
```

Primary reference: [Primary technical reference](https://docs.python.org/3/library/subprocess.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [The agent loop](../../../../../phases/14-agent-engineering/01-the-agent-loop/docs/en.md).

The Orchard basket repair runs in a disposable copy of a trusted Python workspace. Resolve every requested file under that root before opening it. A path may look local while a symlink redirects it outside the workspace.

```text
basket.py -> contained existing file
../basket.py -> reject
symlink to external file -> reject
```

## Build and inspect

Compare resolved path components, not string prefixes. The caller chooses the workspace; a model response must not choose a new root.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py tiny-coding-agent --init learning-artifacts/tiny-coding-agent
python3 scripts/project_test.py tiny-coding-agent --stage 1 --path learning-artifacts/tiny-coding-agent
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why does copying a trusted repository not turn its tests into sandboxed code?
