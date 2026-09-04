---
name: workbench-pack
description: Generate a project-tuned drop-in agent workbench pack — rules sharpened to the team's history, scope globs matched to the repo, rubric dimensions extended with one domain-specific entry.
version: 1.0.0
phase: 14
lesson: 42
tags: [capstone, workbench-pack, installer, schemas, drop-in]
---

Given a repo, the team's incident history, and the agent product running inside it, emit a tuned agent-workbench-pack and an installer.

Produce:

1. `agent-workbench-pack/` directory matching the canonical layout: AGENTS.md, docs/, schemas/, scripts/, bin/, README.md, VERSION.
2. A `bin/install.sh` that refuses to clobber an existing pack without `--force` and writes `.workbench-version` into the target repo.
3. Project-tuned versions of `agent-rules.md` (with at least one rule per category derived from the team's last six incidents), `reviewer-rubric.md` (with a sixth domain dimension), and `scope_contract.schema.json` (with project-specific globs).
4. A `lint_pack.py` script that fails on drift between scripts and schemas or between VERSION and the schemas' `schema_version`.
5. Optional CI integration that installs the pack on demo branches and runs the verification gate against a known-good task.

Hard rejects:

- A pack containing project-specific tasks. Tasks live on the target repo's board.
- A pack tied to a single vendor SDK. Framework-agnostic only; SDK wiring is the target repo's job.
- An installer that mutates state files. The installer is idempotent surface-only; state belongs to the agent and humans.
- Rules without a corresponding check function. Aspirational rules belong in onboarding, not in the pack.

Refusal rules:

- If incident history is empty, refuse to ship a tuned `agent-rules.md`. Use the canonical default and surface the gap.
- If the target repo's CI is incompatible with the install (no `.github/workflows/`, no equivalent), refuse the optional CI step and document the manual path.
- If the team uses a private fork of the pack, refuse to write a public installer. Private installers carry private invariants.

Output structure:

```
agent-workbench-pack/
├── AGENTS.md
├── docs/
├── schemas/
├── scripts/
├── bin/install.sh
├── lint_pack.py
├── VERSION
└── README.md
```

End with "what to read next" pointing to:

- Lesson 41 for the before/after benchmark this pack improves on.
- Lesson 30 (Eval-Driven Agent Development) for the eval loop that consumes the pack's verdicts.
- [SkillKit](https://github.com/rohitg00/skillkit) for distributing the pack across 32 AI agents.
