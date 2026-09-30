# SKILL.md Validator and Loader

A compatibility linter explaining why a skill works in one agent but fails in another.

The installer emits quoted metadata. Accept plain single-line scalars and JSON-compatible double-quoted scalars, including escaped quotes and Unicode. Reject tags, aliases and multiline YAML rather than silently reinterpreting them.

## Start with a learner workspace

[Data management](../../phases/00-setup-and-tooling/09-data-management/docs/en.md), [Structured outputs](../../phases/11-llm-engineering/03-structured-outputs/docs/en.md). Language foundation: [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html).

Install Rust (`rustc`) and Python 3.10+. The core uses the Rust standard library; Python adapters compile into private temporary directories.

```bash
python3 scripts/project_test.py skill-validator --init learning-artifacts/skill-validator
python3 scripts/project_test.py skill-validator --stage 1 --path learning-artifacts/skill-validator
```

## Build route

1. [Parse an explicit frontmatter subset](stages/01-parse-an-explicit-frontmatter-subset/docs/en.md)
2. [Validate names and descriptions](stages/02-validate-names-and-descriptions/docs/en.md)
3. [Contain resource paths](stages/03-contain-resource-paths/docs/en.md)
4. [Load context within a character budget](stages/04-load-context-within-a-character-budget/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
rustc --edition=2021 learning-artifacts/skill-validator/cli.rs -o learning-artifacts/skill-validator/validator
learning-artifacts/skill-validator/validator projects/skill-validator/examples/orchard-release 2000 --activate references/restore.md
```

To inspect the complete reference first, replace `learning-artifacts/skill-validator` with `projects/skill-validator/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

The parser accepts plain single-line values and JSON-compatible quoted strings. It intentionally rejects multiline YAML, aliases, tags and flow collections. Discovery and activated context use character budgets, not model tokens. Existing canonical paths must remain within the supplied skill directory.

```bash
python3 scripts/project_test.py skill-validator --all --solution --strict
python3 scripts/project_test.py skill-validator --all --path learning-artifacts/skill-validator --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.

## Primary references

- [Official reference](https://agentskills.io/specification)
