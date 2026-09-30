# Count independent sessions

**Stage 2 of 4.** Typescript. Plan about 2 hours.

Group by scope and case-preserving, whitespace-normalized rule text. Deduplicate event ids and reject a reused id with different content. Count unique sessions rather than event count, so repeated hook delivery cannot promote a rule. Keep every source id attached to the candidate and sort the final output for reproducible files.

The boundary for this stage is `consolidate`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

```figure
pj-workflow-hooks-2
```

## Worked Orchard case

Before coding, review [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html) and [Repository memory and state](../../../../../phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md). Complete [stage 1](../../01-corrections/docs/en.md) first.

Repeated delivery is not independent evidence. Two distinct corrections in one session still contribute one supporting session. Keep excerpts and locators with the candidate so its source ids remain resolvable later.

```text
events a1,a2 from session A -> sessions=[A]
event b1 from session B -> sessions=[A,B]
rule remains candidate until approval
```

## Build and inspect

Deduplicate event ids using their full validated content. Conflicting reuse of an id must fail rather than silently replace provenance.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py workflow-hooks --stage 2 --path learning-artifacts/workflow-hooks
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why should API_KEY and api_key rules remain separate candidates?
