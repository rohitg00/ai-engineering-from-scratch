# Install atomically within a root

**Stage 3 of 4.** Typescript. Plan about 2 hours.

Check the expected digest before creating directories. Inspect each agent directory with lstat and reject symlinks. Stage the complete translated bundle beside the destination, then rename it. An existing managed installation moves to a temporary backup so a failed final rename can restore it. This educational transaction assumes a single trusted local writer; hostile concurrent filesystem replacement requires OS-level isolation.

The boundary for this stage is `install`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

```figure
pj-skill-installer-3
```

## Worked Orchard case

Before coding, review [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 2](../../02-translate/docs/en.md) first.

Install into a caller-owned disposable root. The installer writes every file to a private sibling directory and renames it into the agent discovery path only after the bundle is complete.

```text
root/.agents/skills/orchard-release/
SKILL.md + references/checklist.md + .installed.json
```

## Build and inspect

Check parent directories for symlinks before staging. Keep the agent directory mapping separate from portable skill content.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-installer --stage 3 --path learning-artifacts/skill-installer
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What should a reader observe if a write fails before the rename?
