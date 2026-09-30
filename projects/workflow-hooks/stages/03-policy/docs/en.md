# Approve and select scoped rules

**Stage 3 of 4.** Typescript. Plan about 2 hours.

Require independent-session support before an explicit approval transition. Retired rules cannot be silently resurrected. At hook time, include only approved rules matching the current scope or global scope. Return source ids with injected rule text so the user can trace where persistent guidance came from.

The boundary for this stage is `transition, hook`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

```figure
pj-workflow-hooks-3
```

## Worked Orchard case

Before coding, review [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html) and [Repository memory and state](../../../../../phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md). Complete [stage 2](../../02-consolidate/docs/en.md) first.

Approval applies to an exact candidate digest. A second source can change that digest and force another review. Retiring a rule removes it from emitted context while keeping its evidence available for inspection.

```text
candidate -> inspect approval_digest
approve exact digest -> approved
emit orchard -> original rule + evidence
retire -> next emit omits rule
```

## Build and inspect

Apply state and scope filtering together. Never let a global or frequently repeated candidate bypass explicit approval.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py workflow-hooks --stage 3 --path learning-artifacts/workflow-hooks
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What should the CLI do when the user supplies yesterday's digest after new evidence arrived?
