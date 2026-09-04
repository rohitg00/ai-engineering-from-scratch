# Discovery contract

Discovery has three disclosure levels:

1. Catalog: read the `name`, `description`, scope, and path required for routing.
2. Activation: load the selected SKILL.md body under an explicit size budget.
3. Execution support: load a directly named file such as `references/schema.md` only when needed.

The host owns scope locations, precedence, collision behavior, and budgets. The catalog builder must keep those choices visible in its output.

A portable one-level reference is a regular file in the skill directory or one immediate subdirectory. Reject absolute paths, `..`, backslashes, symlinks, and deeper chains.
