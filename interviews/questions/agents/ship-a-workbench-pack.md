---
id: ship-a-workbench-pack
title: Package the workbench so one command installs it anywhere
card: agents
kind: take-home
level: 3
roles: [agentic-ai-engineer, ai-developer-relations-engineer, forward-deployed-ai-engineer]
rounds: [take-home, design-review]
tags: [workbench-pack, installer, versioning, schemas, idempotent]
minutes: 45
lessons: [phases/14-agent-engineering/42-agent-workbench-capstone]
manuals: []
practice: []
cheatsheet: [agent-workbench-ops, agent-harness]
related: [agents/seven-surfaces-one-symptom-each, agents/rules-the-workbench-can-check]
updated: 2026-11-03
---

Take-home. Your team has the workbench surfaces as loose scripts, a shared document and some memory. Package them into one directory that a new repository can install with one command, and defend what you leave out. Bring the layout, the installer, the versioning rule and the uninstall rule. We grade the second install as much as the first.

## Short answer

Ship a versioned directory with four parts: the docs that carry the rules and the rubric, the schemas that are the contract, the scripts that are the runtime, and a short installer. The installer refuses to install over an existing pack without a force flag, copies the pack, connects CI if a workflows directory exists, and prints the next steps. Running it twice gives the same result. Project tasks, vendor SDK calls and onboarding prose stay out, because the pack is the recipe and each install is a serving.

## Full answer

### Layout

```text
agent-workbench-pack/
  AGENTS.md
  docs/        agent-rules.md  reliability-policy.md  handoff-protocol.md  reviewer-rubric.md
  schemas/     agent_state.schema.json  task_board.schema.json  scope_contract.schema.json
  scripts/     init_agent.py  run_with_feedback.py  verify_agent.py  generate_handoff.py
  bin/         install.sh
  README.md
  VERSION
```

### In and out

In: the schemas, because they are the contract; the four scripts, because they are the runtime; the four docs, because they are the rules and the rubric.

Out: project-specific tasks, which belong on the target repository's board; vendor SDK calls, because the pack is framework-agnostic; onboarding prose, because the pack lives next to the team's onboarding and not inside it.

### The installer

1. Refuse to install over an existing pack unless `--force` is passed.
2. Copy the pack into the target repository.
3. Connect CI if `.github/workflows/` exists.
4. Print the next steps: fill the board, set the acceptance commands, run the init script.

The installer also writes the pack version into the target repository, and emits symlinks so that every coding agent product reads the same root file. Forking the pack for one product is a failure mode.

### Versioning

`VERSION` is the contract. A schema change or a script change that needs a migration bumps the major. A docs-only change bumps the patch. The target's state file records which pack version it was initialized against, and a lint refuses to ship when the target's recorded version disagrees with the pack's. This is how package managers survive a decade of churn, and nothing about agents changes the rule.

### Uninstall

The uninstaller removes the schemas, the scripts, the docs and the root file, and refuses to run when the state files have uncommitted changes. It never deletes the state file, the board or the outputs directory. State belongs to the user. The pack does not own it.

### What we grade

- The second run of the installer changes nothing.
- The lint fails when the pack drifts from `VERSION`.
- The uninstaller refuses on non-trivial state and leaves the user's files in place.
- The written defense of each cut, one paragraph each.

## Follow-ups

- **Level 3:** Which one optional fifth document would you promote into the pack, and why? Expected: a reasoned choice with the cut defended, for example a migration runbook, with the argument that it is needed on every major bump and not on one project.
- **Level 3:** What counts as non-trivial state for the uninstaller? Expected: any uncommitted change in the state file, the board or the outputs, because those are the user's work and not the pack's.
- **Level 4:** How do you migrate a hand-rolled workbench to the pack with the least downtime? Expected: install beside it, map each existing file to a schema, run the gate on both for one task, then switch the router pointer and archive the old files.
- **Level 4:** What breaks if two repositories pin different major versions of the pack? Expected: nothing, as long as each records its version and the lint checks each against its own pack, while a shared CI job must run the matching version per repository.

## Wrong answers

- "Put the team's current backlog into the pack so that new repos start with real tasks." Tasks belong to the target repository, and a pack that carries them is wrong for every repository but one.
- "Call the vendor SDK from the scripts to save time." The pack must survive a framework change, and an SDK call ties every install to one runtime.
- "Make the installer overwrite by default so that updates are easy." An overwrite without a flag destroys local changes, and the force flag is what makes an update a decision.

## Taught in

The [workbench capstone](../../../phases/14-agent-engineering/42-agent-workbench-capstone/) assembles the pack, the installer and the version rule.
