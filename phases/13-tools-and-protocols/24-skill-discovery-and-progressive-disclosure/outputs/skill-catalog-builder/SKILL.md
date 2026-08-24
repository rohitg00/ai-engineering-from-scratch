---
name: skill-catalog-builder
description: Build a bounded Agent Skill catalog across explicit discovery scopes and report collisions before loading instruction bodies.
license: MIT
metadata:
  lesson: "24"
---

# Skill catalog builder

Use this skill when an agent host needs deterministic discovery across more than one skill directory.

1. Read `references/discovery-contract.md`.
2. Review the example host policy in `assets/scope-policy.json`; do not assume its order is universal.
3. Run `python3 scripts/build_catalog.py project=PATH user=PATH` with scopes listed from highest to lowest precedence.
4. Inspect the JSON `collisions` and `omitted` arrays before activating a skill.
5. Load only the selected SKILL.md body. Load a direct reference only when that body names it.

Never execute a bundled script during discovery. Never choose an equal-precedence duplicate by incidental filesystem order.

Return the catalog budget, selected entries, collision resolutions, and omissions.
