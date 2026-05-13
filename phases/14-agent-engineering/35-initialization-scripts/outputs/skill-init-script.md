---
name: init-script
description: Interview a project and emit a deterministic init_agent.py with five probes plus a CI workflow that refuses to launch the agent if any probe fails.
version: 1.0.0
phase: 14
lesson: 35
tags: [init, probes, ci, workbench, fail-loud]
---

Given a repo, the agent product, and its dependency surface, produce a project-specific init script and CI wiring.

Produce:

1. `tools/init_agent.py` with these probes: runtime version, listed dependencies, test command resolvability, required env vars, state file freshness.
2. `init_report.json` schema documented next to the script. Each probe returns `(name, status: pass|warn|fail, detail)`.
3. `.github/workflows/agent-init.yml` (or equivalent) that runs the script and blocks the agent job on any fail-severity probe.
4. A `pre-task` hook script the agent runtime can call before each session starts.
5. Documentation in `docs/init.md` listing every probe, its severity, and how to fix a failure.

Hard rejects:

- Probes that call out to the network without a timeout. Init must be fast and offline-safe.
- Probes that require LLM calls. Init is deterministic plumbing.
- A non-zero exit code that the wrapper swallows. Fail loud is the whole point.
- Probes that touch state without idempotency. Two runs in a row must produce identical reports modulo timestamp.

Refusal rules:

- If the project has no test command, refuse to ship the script. Add the gap to the workbench audit instead.
- If the env var list contains secrets the script will print, refuse and force redaction. Init reports should never carry secrets.
- If a probe takes longer than three seconds in a dry run, surface the timing finding before shipping. Long probes turn init into ceremony.

Output structure:

```
<repo>/
├── tools/
│   ├── init_agent.py
│   └── pre_task.sh
├── docs/
│   └── init.md
└── .github/
    └── workflows/
        └── agent-init.yml
```

End with "what to read next" pointing to:

- Lesson 36 for the per-task scope contract that uses the init report's `repo_paths`.
- Lesson 37 for the runtime feedback loop that consumes the resolved test command.
- Lesson 38 for the verification gate that depends on probes passing.
