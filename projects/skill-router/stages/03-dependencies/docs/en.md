# Resolve dependencies before execution

**Stage 3 of 4.** Typescript. Plan about 2 hours.

Use depth-first traversal with separate active and visited sets. Active membership catches a cycle; visited membership avoids duplicate execution through a diamond. Validate permission requirements on dependencies as well as the selected skill. Emit dependencies before their consumers and reject unknown dependency ids instead of silently skipping work.

The boundary for this stage is `plan`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

```figure
pj-skill-router-3
```

## Worked Orchard case

Before coding, review [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html) and [Tool schema design](../../../../../phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md). Complete [stage 2](../../02-score/docs/en.md) first.

Selecting release-review first requires check-tests. A depth-first traversal emits dependencies before the selected skill and validates permissions throughout the graph. A denied dependency blocks the whole plan.

```text
release-review requires check-tests
allowed=[read]
plan=[check-tests,release-review]
```

## Build and inspect

Track active and visited sets separately: active finds cycles, visited prevents repeated execution. Do not append a parent before its dependencies.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-router --stage 3 --path learning-artifacts/skill-router
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What would happen if check-tests secretly required a network permission?
