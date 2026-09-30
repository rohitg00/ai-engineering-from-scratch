# Protect edits during upgrades

**Stage 4 of 4.** Typescript. Plan about 2 hours.

Before replacing an installation, verify that every tracked file still matches the prior digest and no unmanaged files have appeared. Refuse upgrades when users edited a tracked file or added their own file. The user can move those changes into the source bundle deliberately. Successful repeated installs leave no staging or backup directories behind.

The boundary for this stage is `install`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

```figure
pj-skill-installer-4
```

## Worked Orchard case

Before coding, review [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 3](../../03-install/docs/en.md) first.

An upgrade must preserve local edits. Compare the current files with the previous installed digest and reject modified or unmanaged files. The demo edits the checklist, retries installation, and retains the edit.

```text
installed checklist hash=A
local edit -> current hash=B
upgrade -> modified installation; local text remains
```

## Build and inspect

Read the existing receipt and verify its file list before moving the destination. Restore a moved backup if the final rename fails.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-installer --stage 4 --path learning-artifacts/skill-installer
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
node learning-artifacts/skill-installer/cli.ts inspect projects/skill-installer/examples/orchard-release.json codex
```

inspect is a dry run. install needs bundle, agent, root and trusted expected source digest. Supported destination mappings are codex=.agents/skills, claude=.claude/skills and cursor=.cursor/skills. Discovery paths are configured locally; successful installation does not prove a separately running agent activated the skill.

## Investigate next

What would a reviewable merge need to show before replacing a locally edited checklist?
