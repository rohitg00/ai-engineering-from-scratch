# Translate metadata and hash content

**Stage 2 of 4.** Typescript. Plan about 2 hours.

Keep one body of instructions while regenerating a small quoted metadata header. Preserve references byte-for-byte. Compute a SHA-256 digest over sorted path/content pairs, so file insertion order cannot change integrity. The digest detects changed content but does not establish publisher identity; obtaining a trusted expected digest is the caller's responsibility.

The boundary for this stage is `digest, translate`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

```figure
pj-skill-installer-2
```

## Worked Orchard case

Before coding, review [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 1](../../01-bundle/docs/en.md) first.

Serialize name and description as JSON-compatible double-quoted YAML scalars. The Rust validator accepts that same subset, including escapes. Source and translated digests differ because translation rewrites metadata.

```text
source bundle digest -> expected source identity
translated SKILL.md: name: "orchard-release"
translated digest -> installed content identity
```

## Build and inspect

Sort file entries before hashing. A digest verifies content against a trusted expectation; computing it from untrusted bytes does not establish publisher identity.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-installer --stage 2 --path learning-artifacts/skill-installer
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

How should a description containing a quote survive installer-to-validator round trip?
