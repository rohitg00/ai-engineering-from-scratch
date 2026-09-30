# Persist rules across sessions

**Stage 4 of 4.** Typescript. Plan about 2 hours.

Write a versioned JSON snapshot to a unique sibling temporary file with owner-only permissions, then rename it into place. Readers see the old or new complete file. Missing storage means an empty collection, while malformed storage is an error. This snapshot store supports one writer process; cross-process merge and locking are a separate extension.

The boundary for this stage is `save, load`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

```figure
pj-workflow-hooks-4
```

## Worked Orchard case

Before coding, review [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html) and [Repository memory and state](../../../../../phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md). Complete [stage 3](../../03-policy/docs/en.md) first.

The CLI captures JSONL corrections, saves a versioned store, reloads it in another process and emits a neutral JSON hook payload. It retains evidence, supports retirement and preserves API_KEY exactly across restart.

```text
capture -> store.json
approve -> stored state approved
emit -> additional_context plus evidence locators
malformed store -> error, not empty success
```

## Build and inspect

Write a unique sibling temporary file and rename. This store has a single-writer contract; add locking before using simultaneous writers.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py workflow-hooks --stage 4 --path learning-artifacts/workflow-hooks
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
node learning-artifacts/workflow-hooks/cli.ts capture orchard-rules.json projects/workflow-hooks/examples/corrections.jsonl
node learning-artifacts/workflow-hooks/cli.ts inspect orchard-rules.json
```

capture, inspect, approve, retire and emit are file-based commands. emit returns neutral JSON with additional_context and resolvable evidence; an agent integration must map that field to its documented hook interface. Approval requires the current digest. Stores are versioned, atomic and single-writer.

## Investigate next

How would your agent integration map additional_context into its documented hook wire format?
