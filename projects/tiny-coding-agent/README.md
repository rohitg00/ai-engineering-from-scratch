# Tiny Coding Agent

A repair agent that exposes the patch/test evidence trail and refuses unsupported success claims.

The Orchard basket repair runs in a disposable copy of a trusted Python workspace. Resolve every requested file under that root before opening it. A path may look local while a symlink redirects it outside the workspace.

## Start with a learner workspace

[The agent loop](../../phases/14-agent-engineering/01-the-agent-loop/docs/en.md), [Data management](../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Language foundation: [Python data structures](https://docs.python.org/3/tutorial/datastructures.html).

Use Python 3.10+ and its standard library. POSIX is required where the project uses file locks or process-group supervision.

```bash
python3 scripts/project_test.py tiny-coding-agent --init learning-artifacts/tiny-coding-agent
python3 scripts/project_test.py tiny-coding-agent --stage 1 --path learning-artifacts/tiny-coding-agent
```

## Build route

1. [Confine file tools to a workspace](stages/01-confine-paths/docs/en.md)
2. [Apply exact patches with preconditions](stages/02-apply-exact-patches/docs/en.md)
3. [Run real tests through one allowed command](stages/03-run-real-tests/docs/en.md)
4. [Stop the coding loop on evidence or budget](stages/04-bound-the-loop/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
python3 learning-artifacts/tiny-coding-agent/cli.py projects/tiny-coding-agent/examples/workspace projects/tiny-coding-agent/examples/proposals.json --copy-to basket-repair --out repair-trace.json
```

To inspect the complete reference first, replace `learning-artifacts/tiny-coding-agent` with `projects/tiny-coding-agent/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

The CLI copies a trusted Python workspace to a new destination, then runs its tests as local code. The supplied proposal planner selects prewritten repairs from observed failures; it does not invent patches. POSIX process-group timeout stops descendants, but memory and output quotas require an OS-level runner.

```bash
python3 scripts/project_test.py tiny-coding-agent --all --solution --strict
python3 scripts/project_test.py tiny-coding-agent --all --path learning-artifacts/tiny-coding-agent --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.

## Primary references

- [Mechanism and API reference](https://docs.python.org/3/library/subprocess.html)
