# Abstain on ambiguous or blocked requests

**Stage 4 of 4.** Typescript. Plan about 2 hours.

Join ranking and dependency planning while preserving four distinct outcomes: ready, no-match, ambiguous and blocked. A score gap below the margin is ambiguous even if the tie-breaker produces a first result. A ranked winner can still be blocked by permissions. Return the ranked explanations in every outcome so a caller can display the decision.

The boundary for this stage is `route`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

```figure
pj-skill-router-4
```

## Worked Orchard case

Before coding, review [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html) and [Tool schema design](../../../../../phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md). Complete [stage 3](../../03-dependencies/docs/en.md) first.

Abstain when two skills score too closely or the chosen plan needs unavailable permissions. An explanation of why routing stopped is more useful than an arbitrary winning skill.

```text
publish request -> release-publish score 2
allowed=[read]; publish requires network
status=blocked, no execution plan
```

## Build and inspect

Apply the score margin before dependency planning. Treat ranking as evidence for selection, not authority to execute a tool.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-router --stage 4 --path learning-artifacts/skill-router
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
node learning-artifacts/skill-router/cli.ts projects/skill-router/examples/skills projects/skill-router/examples/request.json
```

SKILL.md provides standard name and description; routing.json is this project's documented local extension. The router emits plans and explanations, and never executes a selected skill. Keyword tokenization is an ASCII lexical baseline; a multilingual routing model is an extension.

## Investigate next

How would you tune one ambiguous keyword without overfitting to the example request?
