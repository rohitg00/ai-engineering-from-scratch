# Validate a portable bundle

**Stage 1 of 4.** Typescript. Plan about 2 hours.

Accept a named bundle with a SKILL.md and optional reference files. Validate every relative path before touching disk. Reject dot segments, absolute paths, drive prefixes, backslashes and reserved installation metadata. Limit each text file to 100 KB. The installer reads an in-memory bundle, leaving network fetching and signature trust as separate responsibilities.

The boundary for this stage is `safePath, validate`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

```figure
pj-skill-installer-1
```

## Worked Orchard case

Before coding, review [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

A portable bundle carries metadata and relative UTF-8 files. Treat SKILL.md as an entry document and reject any resource name that could escape the selected install root. The original Orchard bundle includes a restore checklist.

```text
name=orchard-release
files: SKILL.md, references/checklist.md
../settings.json -> rejected
```

## Build and inspect

Validate every file path before creating directories. Reserve .installed.json for the installer receipt.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-installer --init learning-artifacts/skill-installer
python3 scripts/project_test.py skill-installer --stage 1 --path learning-artifacts/skill-installer
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why must a Windows backslash be rejected even when the current machine uses slash paths?
