# Capture corrections with provenance

**Stage 1 of 4.** Typescript. Plan about 2 hours.

Require a correction id, session id, scope, rule and source excerpt. Normalize scope while preserving rule case and source evidence. Reject oversized values and obvious credential-shaped content. This heuristic is not a complete secret scanner: callers must redact source data before ingestion.

The boundary for this stage is `normalize, ingest`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

```figure
pj-workflow-hooks-1
```

## Worked Orchard case

Before coding, review [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html) and [Repository memory and state](../../../../../phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md).

A correction is evidence from a specific session and source locator. Preserve the exact case of API_KEY in the rule; case folding would turn a useful instruction into a contradictory one.

```text
rule: Read API_KEY; never rename it to api_key.
scope: Orchard -> orchard
source locator: local:orchard/config.py:12
```

## Build and inspect

Normalize scope for matching, but only collapse rule whitespace. Reject obvious credential-shaped data before it enters the durable store.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py workflow-hooks --init learning-artifacts/workflow-hooks
python3 scripts/project_test.py workflow-hooks --stage 1 --path learning-artifacts/workflow-hooks
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Which parts of a source excerpt must the caller sanitize before ingestion?
