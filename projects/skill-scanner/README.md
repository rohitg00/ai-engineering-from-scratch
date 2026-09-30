# Skill Supply-Chain Scanner

A skill-change review assistant quoting newly introduced capabilities.

Source evidence uses byte offsets. A line containing café occupies more UTF-8 bytes than visible letters, so character indices cannot safely slice a Rust string. Preserve start and end offsets while splitting lines.

## Start with a learner workspace

[Data management](../../phases/00-setup-and-tooling/09-data-management/docs/en.md), [Security and secrets audit](../../phases/17-infrastructure-and-production/25-security-secrets-audit/docs/en.md). Language foundation: [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html).

Install Rust (`rustc`) and Python 3.10+. The core uses the Rust standard library; Python adapters compile into private temporary directories.

```bash
python3 scripts/project_test.py skill-scanner --init learning-artifacts/skill-scanner
python3 scripts/project_test.py skill-scanner --stage 1 --path learning-artifacts/skill-scanner
```

## Build route

1. [Retain byte-accurate source spans](stages/01-retain-byte-accurate-source-spans/docs/en.md)
2. [Detect named advisory patterns](stages/02-detect-named-advisory-patterns/docs/en.md)
3. [Score distinct evidence without inflation](stages/03-score-distinct-evidence-without-inflation/docs/en.md)
4. [Build an explicit review gate](stages/04-build-an-explicit-review-gate/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
rustc --edition=2021 learning-artifacts/skill-scanner/cli.rs -o learning-artifacts/skill-scanner/scanner
learning-artifacts/skill-scanner/scanner projects/skill-scanner/examples/reviewable 3
```

To inspect the complete reference first, replace `learning-artifacts/skill-scanner` with `projects/skill-scanner/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

The scanner emits versioned JSON with file paths, exact UTF-8 byte spans and advisory rules. Explicit patterns can miss obfuscation and flag benign documentation. below-threshold does not mean safe; scan status never replaces installation integrity or human review.

```bash
python3 scripts/project_test.py skill-scanner --all --solution --strict
python3 scripts/project_test.py skill-scanner --all --path learning-artifacts/skill-scanner --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.

## Primary references

- [Official reference](https://agentskills.io/specification)
