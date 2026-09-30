# Self-Correcting Workflow Hooks

A correction ledger showing why a rule exists, what it changed and how to undo it.

A correction is evidence from a specific session and source locator. Preserve the exact case of API_KEY in the rule; case folding would turn a useful instruction into a contradictory one.

## Start with a learner workspace

[Repository memory and state](../../phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md), [Verification gates](../../phases/14-agent-engineering/38-verification-gates/docs/en.md). Language foundation: [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html).

Use Node 22.18+ and Python 3.10+ for the grader. Core TypeScript runs without package installation.

```bash
python3 scripts/project_test.py workflow-hooks --init learning-artifacts/workflow-hooks
python3 scripts/project_test.py workflow-hooks --stage 1 --path learning-artifacts/workflow-hooks
```

## Build route

1. [Capture corrections with provenance](stages/01-corrections/docs/en.md)
2. [Count independent sessions](stages/02-consolidate/docs/en.md)
3. [Approve and select scoped rules](stages/03-policy/docs/en.md)
4. [Persist rules across sessions](stages/04-durability/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
node learning-artifacts/workflow-hooks/cli.ts capture orchard-rules.json projects/workflow-hooks/examples/corrections.jsonl
node learning-artifacts/workflow-hooks/cli.ts inspect orchard-rules.json
```

To inspect the complete reference first, replace `learning-artifacts/workflow-hooks` with `projects/workflow-hooks/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

capture, inspect, approve, retire and emit are file-based commands. emit returns neutral JSON with additional_context and resolvable evidence; an agent integration must map that field to its documented hook interface. Approval requires the current digest. Stores are versioned, atomic and single-writer.

```bash
python3 scripts/project_test.py workflow-hooks --all --solution --strict
python3 scripts/project_test.py workflow-hooks --all --path learning-artifacts/workflow-hooks --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.

## Primary references

- [Node filesystem operations](https://nodejs.org/api/fs.html)
- [JSON data interchange](https://www.rfc-editor.org/rfc/rfc8259)
