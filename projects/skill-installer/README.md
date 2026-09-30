# Cross-Agent Skill Installer

A cross-agent upgrade tool promising a reviewable diff and no lost local edits.

A portable bundle carries metadata and relative UTF-8 files. Treat SKILL.md as an entry document and reject any resource name that could escape the selected install root. The original Orchard bundle includes a restore checklist.

## Start with a learner workspace

[Data management](../../phases/00-setup-and-tooling/09-data-management/docs/en.md), [Security and secrets audit](../../phases/17-infrastructure-and-production/25-security-secrets-audit/docs/en.md). Language foundation: [TypeScript object types](https://www.typescriptlang.org/docs/handbook/2/objects.html).

Use Node 22.18+ and Python 3.10+ for the grader. Core TypeScript runs without package installation.

```bash
python3 scripts/project_test.py skill-installer --init learning-artifacts/skill-installer
python3 scripts/project_test.py skill-installer --stage 1 --path learning-artifacts/skill-installer
```

## Build route

1. [Validate a portable bundle](stages/01-bundle/docs/en.md)
2. [Translate metadata and hash content](stages/02-translate/docs/en.md)
3. [Install atomically within a root](stages/03-install/docs/en.md)
4. [Protect edits during upgrades](stages/04-upgrades/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
node learning-artifacts/skill-installer/cli.ts inspect projects/skill-installer/examples/orchard-release.json codex
```

To inspect the complete reference first, replace `learning-artifacts/skill-installer` with `projects/skill-installer/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

inspect is a dry run. install needs bundle, agent, root and trusted expected source digest. Supported destination mappings are codex=.agents/skills, claude=.claude/skills and cursor=.cursor/skills. Discovery paths are configured locally; successful installation does not prove a separately running agent activated the skill.

```bash
python3 scripts/project_test.py skill-installer --all --solution --strict
python3 scripts/project_test.py skill-installer --all --path learning-artifacts/skill-installer --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.

## Primary references

- [Agent Skills specification](https://agentskills.io/specification)
- [Node crypto API](https://nodejs.org/api/crypto.html)
- [Node filesystem API](https://nodejs.org/api/fs.html)
