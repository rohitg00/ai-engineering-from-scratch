---
id: the-agent-ignores-a-written-rule
title: The rule is in the repo, and the agent keeps breaking it
card: agents
kind: debug
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [agent-rules, reachability, conflicting-instructions, aspirational-rule, router]
minutes: 12
lessons: [phases/14-agent-engineering/33-instructions-as-executable-constraints, phases/14-agent-engineering/32-minimal-agent-workbench]
manuals: []
practice: []
cheatsheet: [agent-workbench-ops, coding-agents]
related: [agents/router-or-manual, agents/rules-the-workbench-can-check]
updated: 2026-11-03
---

A rule says that no migration file may change without an approval. It lives in `docs/database.md`, which `docs/architecture.md` links, which the top-level instructions file links. The root file also says to always use the ORM, while the database document says to write raw SQL in migrations. The agent changed a migration twice this week without asking. Find the causes and fix them in order.

## Short answer

There are three independent causes, and any one of them is enough. The rule is three hops from the router, past the two-hop reachability limit, so the agent never loads it, and it is prose with no check, so nothing refuses the write even when the agent reads it. And the root file conflicts with the database document, and conflicting instructions silently move an agent from asking to guessing. Fix the reach first, make the rule an approval-category rule with a block-severity check, and remove the conflict.

## Full answer

### Cause one: reachability

The agent should reach any rule in at most two hops from the router. This rule needs three. The router must link every topic document by path, so `docs/database.md` belongs in the router, and the rule itself belongs in `docs/agent-rules.md`, which the agent reads at every startup. A pointer that does not resolve is a worse failure than a missing rule, so check that each path in the router exists, and make a broken link a startup violation.

### Cause two: an aspirational rule

"Do not change migrations without approval" is a wish until a check exists. Rewrite it as an approval-category rule with a slug, a one-line description, a `check` that compares the diff against `migrations/**` and looks for an approval record, and `block` severity. The runtime refuses on block. The checker reports it. An override needs a human signature in the audit log.

### Cause three: conflicting instructions

The root file requires the ORM everywhere. The database document requires raw SQL inside migration files. The agent cannot satisfy both, and the measured effect of conflicting instructions is a quiet shift from an interactive mode, where the agent asks, to a greedy mode, where it guesses. One measurement in the lesson put the resolve rate at 48.8 percent without the conflict and 28 percent with it. An agent in greedy mode does not ask for approval. Number the priorities instead of stacking them flat, or scope the ORM rule to application code and the SQL rule to migrations so that they no longer overlap.

### The order

1. Move the rule into the rules file and link the database document from the router. Now the agent reads it.
2. Add the check and the severity. Now the runtime refuses.
3. Resolve the conflict. Now the agent asks instead of guessing.
4. Add a workbench lint that fails when the router is over its line budget or references a missing file, so the regression cannot return.

### Prove it

Run the checker over this week's two runs. The rule report must show the approval rule failing on both, with block severity. Then run the agent on a task that touches a migration and confirm that it opens an approval request before the write.

## Follow-ups

- **Level 3:** Why does a shorter root file help here? Expected: a short router is read in full on every session and on every pull request review, so a pointer to the database document stays current and reachable.
- **Level 3:** The team wants to keep the rule in the database document because that is where the context is. What do you do? Expected: keep the explanation there, put the rule and its check in the rules file, and link both from the router, so the rule is two hops away and still has its context.
- **Level 4:** How would you find two rules that contradict each other before an incident? Expected: a lint that flags two rules whose scopes overlap with different verbs, and a review habit of numbering priorities in the router.
- **Level 4:** The checker passes in CI, and the agent still edits a migration in a live session. Where is the gap? Expected: the checker runs after the fact, so the same check must also run as a pre-tool hook in the runtime, where it can refuse the write before it happens.

## Wrong answers

- "Add the rule to the system prompt in capital letters." Emphasis does not add a check, and the conflict in the router still pushes the agent toward guessing.
- "The model is ignoring instructions, so switch models." The rule was unreachable, uncheckable and contradicted, and a different model meets the same three problems.
- "Delete the ORM rule, since it caused the conflict." The ORM rule is correct for application code, so scope it rather than delete it.

## Taught in

The [executable constraints lesson](../../../phases/14-agent-engineering/33-instructions-as-executable-constraints/) sets the two-hop rule and the five categories, and the [minimal workbench lesson](../../../phases/14-agent-engineering/32-minimal-agent-workbench/) measures the cost of instructions that contradict each other.
