# Parse a typed skill catalog

**Stage 1 of 4.** Typescript. Plan about 2 hours.

A skill manifest declares an id, description, keywords, path patterns, priority, dependencies and permissions. Validate arrays and numbers at runtime rather than trusting a JSON cast. Tokenization normalizes punctuation and case and removes repeated words, so repeating a prompt cannot inflate its score.

The boundary for this stage is `parseSkill, tokens`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

```figure
pj-skill-router-1
```

## Worked Orchard case

Before coding, review [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html) and [Tool schema design](../../../../../phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md).

Discover a skill from its SKILL.md name and description, then read routing.json as a local routing extension. The directory name must match the skill name. Routing metadata is not part of the portable skill format.

```text
skills/release-review/SKILL.md -> name release-review
routing.json -> keywords,paths,priority,requires,permissions
```

## Build and inspect

Validate the merged record with parseSkill. Refuse symlinked or oversized discovery files before parsing them.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-router --init learning-artifacts/skill-router
python3 scripts/project_test.py skill-router --stage 1 --path learning-artifacts/skill-router
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What should happen when directory release-review declares name publish?
