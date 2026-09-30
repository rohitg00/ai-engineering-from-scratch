# Skill Router

A routing debugger showing why the wrong skill activated and how to fix a rule.

Discover a skill from its SKILL.md name and description, then read routing.json as a local routing extension. The directory name must match the skill name. Routing metadata is not part of the portable skill format.

## Start with a learner workspace

[Tool schema design](../../phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md), [Verification gates](../../phases/14-agent-engineering/38-verification-gates/docs/en.md). Language foundation: [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html).

Use Node 22.18+ and Python 3.10+ for the grader. Core TypeScript runs without package installation.

```bash
python3 scripts/project_test.py skill-router --init learning-artifacts/skill-router
python3 scripts/project_test.py skill-router --stage 1 --path learning-artifacts/skill-router
```

## Build route

1. [Parse a typed skill catalog](stages/01-catalog/docs/en.md)
2. [Score words and repository paths](stages/02-score/docs/en.md)
3. [Resolve dependencies before execution](stages/03-dependencies/docs/en.md)
4. [Abstain on ambiguous or blocked requests](stages/04-route/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
node learning-artifacts/skill-router/cli.ts projects/skill-router/examples/skills projects/skill-router/examples/request.json
```

To inspect the complete reference first, replace `learning-artifacts/skill-router` with `projects/skill-router/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

SKILL.md provides standard name and description; routing.json is this project's documented local extension. The router emits plans and explanations, and never executes a selected skill. Keyword tokenization is an ASCII lexical baseline; a multilingual routing model is an extension.

```bash
python3 scripts/project_test.py skill-router --all --solution --strict
python3 scripts/project_test.py skill-router --all --path learning-artifacts/skill-router --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.

## Primary references

- [Agent Skills specification](https://agentskills.io/specification)
- [Node path API](https://nodejs.org/api/path.html)
