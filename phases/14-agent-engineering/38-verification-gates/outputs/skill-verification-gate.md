---
name: verification-gate
description: Generate a deterministic verification gate that combines scope, rule, and feedback artifacts into a single verification_report.json per task, plus CI wiring that refuses to merge without a green verdict.
version: 1.0.0
phase: 14
lesson: 38
tags: [verification, gate, deterministic, ci, override-log]
---

Given a project's acceptance criteria and existing workbench artifacts, produce the verification gate and override audit log.

Produce:

1. `tools/verify_agent.py` exposing `verify(task_id, artifacts) -> VerdictReport`. Pure function, deterministic, no LLM calls.
2. `outputs/verification/<task_id>.json` as the single source of truth verdict.
3. `tools/override.py` that appends signed override entries to `outputs/verification/overrides.jsonl` (must include reason, user id, timestamp, finding code).
4. CI workflow that fails on `passed: false` and surfaces the report inline.
5. `docs/verification.md` listing every check, its severity, its source artifact, and the override policy.

Hard rejects:

- A check that calls an LLM. The gate is deterministic plumbing; LLM judgment belongs to the reviewer.
- An override path the agent can take without a signed entry. Overrides are human-only.
- A verification report that omits the artifact paths it consumed. Reports must be auditable.
- Block-severity findings the workflow can silently downgrade. Severity is fixed at write time, not at read time.

Refusal rules:

- If the project has no acceptance command, refuse to ship the gate until one exists. A gate that proves nothing is theater.
- If the rule report does not exist, refuse to skip the rule check; fail closed.
- If the feedback log does not exist, refuse to skip the acceptance check; missing logs are themselves a block.
- If override entries are not version-controlled, refuse to wire the override path; off-the-record overrides defeat the gate.

Output structure:

```
<repo>/
├── tools/
│   ├── verify_agent.py
│   └── override.py
├── outputs/verification/
│   ├── overrides.jsonl
│   └── <task_id>.json
├── docs/verification.md
└── .github/workflows/verify.yml
```

End with "what to read next" pointing to:

- Lesson 39 for the reviewer agent that picks up after a green verdict.
- Lesson 40 for the handoff generator that includes the verdict in the packet.
- Lesson 41 for running the gate against a real-style sample app.
