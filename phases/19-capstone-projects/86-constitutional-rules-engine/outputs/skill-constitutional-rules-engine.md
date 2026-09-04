---
name: skill-constitutional-rules-engine
description: Declarative YAML rules engine for output constraints with severity, explanation, fixer operations, and structured diff
version: 1.0.0
phase: 19
lesson: 86
tags: [safety, rules, constitutional]
---

# Constitutional Rules Engine

A constitution is a YAML file. Each rule has `name`, `severity` (low | medium | high), `applies_when` (predicate), `must` (predicate), `explanation`, and optional `fix`.

## Predicates

Atomic:

- `contains_regex` / `not_contains_regex`
- `starts_with_regex` / `ends_with_regex`
- `max_words` / `min_words`

Compositional:

- `all_of: [...predicates]`
- `any_of: [...predicates]`
- `not_: predicate`

## Fix operations

- `append_if_missing: <suffix>`
- `prepend_if_missing: <prefix>`
- `replace_regex: { pattern: <regex>, replacement: <text> }`

## Engine output

`Engine.evaluate(text) -> EngineReport` returns one `RuleResult` per rule with `status` in `pass`, `violation`, `not_applicable`. `report.violations()` filters to violations and `report.max_severity()` returns the worst severity present.

## Artifact

`outputs/rules_report.json` carries draft, revised, and structured diff per case.
