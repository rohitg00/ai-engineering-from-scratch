---
name: skill-contract-reviewer
description: Validate an Agent Skill package and choose the right instruction, capability, or lifecycle primitive before implementation.
license: MIT
metadata:
  lesson: "22"
---

# Skill contract reviewer

Use this skill when a workflow is about to become a reusable agent artifact.

1. Set `SKILL_ROOT` to the absolute directory containing this installed
   `SKILL.md`. Do not assume the process working directory is the bundle.
2. Set `TARGET_ROOT` to the absolute original workspace working directory and
   resolve the proposed skill directory under that root.
3. Read `$SKILL_ROOT/references/contract.md` and validate the portable
   `SKILL.md` identity fields.
4. Read `$SKILL_ROOT/references/decision-model.md` and separate repository
   context, reusable method, external capability, lifecycle timing,
   deterministic logic, and isolated delegation.
5. Before execution, show the exact resolved argument vector. Run
   `python3 "$SKILL_ROOT/scripts/check_skill.py" "$TARGET_SKILL"`, where
   `TARGET_SKILL` is the absolute proposed skill directory under
   `TARGET_ROOT`.
6. Inspect the JSON report. Fix every error before discussing host-specific
   extensions.
7. Compare the proposed artifact with
   `$SKILL_ROOT/assets/task-shapes.json` and return the smallest composable set
   of primitives.

Do not claim that a runtime extension is part of the portable contract. Do not treat a valid skill as permission to run scripts or access tools.

Return the validation report, the selected primitives, and one sentence
explaining each selection. Include execution evidence with the resolved script
path, resolved target path, cwd, exact argv, and exit code. If the host cannot
expose one of those observations, mark it unverified instead of inventing it.
