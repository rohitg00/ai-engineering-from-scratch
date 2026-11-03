---
id: rule-needs-three-parts
title: Constraints a classifier cannot see
card: safety
kind: design
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [rules-engine, constitution, predicates, fixer, yaml]
minutes: 9
lessons: [phases/19-capstone-projects/86-constitutional-rules-engine]
manuals: []
practice: []
cheatsheet: [guardrails-moderation]
related: [safety/output-router-severity]
updated: 2026-11-03
---

A support assistant must never end a refusal without offering a next step, and a coding assistant must close every code answer with a runnable block or a stated assumption. Neither is something a content classifier recognizes. Design the component that enforces constraints like these, and say what happens after a violation.

## Short answer

Put these constraints in a declarative rules file that lives in version control next to the code and has its own review. Each rule has a name, a severity, an explanation, a predicate that says when the rule is in scope and a predicate the response must satisfy, with atomic checks composed by all of, any of and not. After a violation a fixer applies a local declarative edit, the engine checks the revision again, and a structured diff of the two versions goes into the trace.

## Full answer

### Why not a classifier

These are contractual constraints: predicates over the response, the conversation and the policy. A non engineer should be able to read them. A classifier recognizes patterns; a rule states a contract.

### The rule shape

```yaml
- name: end-with-runnable-or-assumption
  severity: medium
  applies_when:
    contains_regex: '```python'
  must:
    any_of:
      - ends_with_regex: '```\s*$'
      - contains_regex: 'assumption:'
  explanation: "Code responses must end in a closing fence or an explicit assumption."
  fix:
    append_if_missing: "\n\nAssumption: example inputs are valid."
```

Atomic predicates: contains regex, not contains regex, ends with regex, starts with regex, maximum words, minimum words. Compositions: all of, any of, not. The engine evaluates the scope predicate first; if the rule does not apply it records not applicable, so the report shows the rule was evaluated. Otherwise the must predicate gives pass or violation. Severities are low, medium and high, and the gate treats a high rule violation like a high classifier verdict: block.

### The shipped constitution

Six rules: a refusal must include a suggestion or a redirect; code responses must close cleanly; example data must not contain emails or phone shapes; lines that begin with a citation phrase must carry a parenthetical citation; two internal library names must never appear; responses must not exceed 800 words. The last two of the first five are high; the rest are low or medium.

### After a violation

The fixer is a list of declarative operations mapped by rule name: append if missing, prepend if missing, replace regex. It makes local edits only; a structural rewrite belongs in a separate layer. The engine runs again on the revision, and a diff of add, remove and edit records between draft and revision is logged so a reviewer can audit the fixer over time.

## Follow-ups

- **Level 2:** Why split the predicate into a scope part and a must part? Expected: so a rule can be out of scope and say so; a code rule on a response without code records not applicable instead of a pass, and the report shows the engine looked.
- **Level 2:** Why does the file live in YAML and not in code? Expected: a non engineer can read and review it, it has its own review and history, and the engine stays generic.
- **Level 3:** What can the fixer not do, and why is that a feature? Expected: structural rewrites; local declarative edits keep its behavior predictable and auditable through the diff.
- **Level 3:** How does the gate treat a high severity rule violation? Expected: the same as a high classifier verdict, which is block.

## Wrong answers

- "Train the classifier to detect missing next steps." The constraint is a predicate over the response; a rule with an explanation is readable and testable, and a classifier is neither.
- "Let the model fix its own violation." The fixer is deterministic so the diff can be audited; a model rewrite belongs in a separate layer.
- "A rule is a regex." A rule is a name, a predicate and an explanation; anything missing one of the three is a vibe.

## Taught in

The [constitutional rules engine capstone](../../../phases/19-capstone-projects/86-constitutional-rules-engine/) gives the rule grammar, the fixer and the diff.
