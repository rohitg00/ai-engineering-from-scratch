# Score words and repository paths

**Stage 2 of 4.** Typescript. Plan about 2 hours.

Award two points for each matched keyword and three for each matched file path. Return score reasons alongside the score. Support star within one path segment and double-star across segments, escape regular expression punctuation, and reject absolute or parent-traversing file paths. `**/` matches zero or more complete directories: `**/*.ts` matches `main.ts`, and `src/**/*.ts` matches both `src/main.ts` and `src/lib/main.ts`. Normalize backslashes and reject Windows drive-absolute paths as well as slash-rooted paths. Resolve tied scores by priority and then id so ranking is reproducible.

The boundary for this stage is `matchPath, rank`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

```figure
pj-skill-router-2
```

## Worked Orchard case

Before coding, review [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html) and [Tool schema design](../../../../../phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md). Complete [stage 1](../../01-catalog/docs/en.md) first.

Repeated evidence must not inflate a match. The Orchard request repeats the same changed path, but it should earn its path contribution only once. Keywords contribute two points and distinct matched paths contribute three.

```text
keywords release,replicas -> 4 points
files deploy/orchard.yaml repeated twice -> 3 points
score=7, not 10
```

## Build and inspect

Canonicalize separators and deduplicate before scoring. Keep reasons aligned with the exact evidence counted.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-router --stage 2 --path learning-artifacts/skill-router
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Should two different path rules matching one file count as two independent observations?
