---
id: two-hundred-tools-in-the-catalog
title: Two hundred registered tools, forty visible at a time
card: agents
kind: design
level: 4
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [tool-registry, progressive-disclosure, tool-catalog, schema, dispatcher]
minutes: 15
lessons: [phases/19-capstone-projects/21-tool-registry-schema-validation, phases/14-agent-engineering/31-agent-workbench-why-models-fail]
manuals: []
practice: []
cheatsheet: [tool-calling, agent-harness]
related: [agents/error-paths-the-model-can-fix]
updated: 2026-11-03
---

Your harness has grown to about two hundred tools across several teams. The model cannot hold all of them in context, two teams once registered the same name and the second silently replaced the first, and the success rate has fallen as the catalog grew. Design the registry and the policy for what the model sees on each turn.

## Short answer

Make the registry the only source of truth for what exists, what shape the arguments take and which handler runs, and surface only ten to forty tools per turn. The registry holds a typed record per tool, rejects a second registration of a name unless the caller asks to override, and validates every call against a small schema subset with pointer-shaped errors. The exposure policy loads tool metadata into context only when the task needs it, and the fewer tools the model sees, the better it calls them.

## Full answer

### The record

| Field | Purpose |
|---|---|
| `name` | Unique, lower-case segments separated by dots |
| `description` | One line shown to the model |
| `schema` | A subset of JSON Schema with eight keywords |
| `handler` | The callable, opaque to the validator |
| `idempotent` | Lets the dispatcher decide whether a retry is safe |
| `timeout_ms` | Per-tool override of the dispatcher default |

The schema is data and the handler is code. Keep them apart so that validation never ends up inside handlers.

### Three registry rules

1. **No silent overwrite.** `register` raises on a known name unless `override=True`. The incident in the prompt is this rule missing.
2. **Validate before dispatch.** A pure, recursive walk over the schema returns `Ok` or a list of errors with JSON pointer paths. No coercion, no handler call, no I/O, so the validator can run again over a replay log.
3. **The registry is shape, not safety.** Timeouts and sandboxing live in the dispatcher. A validated call can still misbehave.

### The exposure policy

A catalog of two hundred tools and a context that fits forty is a routing problem. Surface a subset per turn based on the task, and load the rest just in time. The workbench lesson describes the pattern as skills that are revealed step by step: a function registry whose metadata enters context only when needed. The same lesson reports a team that deleted 80 percent of its agent's tools and saw the success rate go from 80 percent to 100 percent. More tools in view means more wrong choices, longer prompts and more schema to misread.

Practical selection signals: the active scope contract, the task type on the board, the tools used in the last few turns, and an explicit request from the model for a named family. Log the exposed set per turn so that a failure can be traced to a missing tool rather than a wrong call.

### What grows next

Past about fifty tools, add `$ref` against a local definitions block so that shared argument shapes are written once, and `additionalProperties: false` so that an extra argument is an error rather than a silent drop. Both are small. Both are common.

## Follow-ups

- **Level 3:** Two teams want the same tool name for different handlers. What do you do? Expected: refuse the collision, namespace by dotted segment, and let the exposure policy pick the family the task needs.
- **Level 3:** How do you prove the validator is still correct after a refactor? Expected: run it over a saved replay log of real calls, which works because it has no I/O, no clock and no globals.
- **Level 4:** What breaks if the exposure policy is itself a model call? Expected: a second nondeterministic step on every turn, so the selection should be rule-based from the contract and the board, with the model allowed only to request a named family.
- **Level 4:** The dispatcher retries a failed call. Which record field decides whether it may? Expected: `idempotent`, because a retry of a non-idempotent tool can repeat a side effect.

## Wrong answers

- "Give the model the whole catalog and let it choose." The model cannot hold two hundred schemas, and success fell as the catalog grew, so the fix is fewer tools in view.
- "Put validation in each handler, close to the code it protects." Validation inside handlers drifts per team and turns the dispatcher into a guessing game that ends in a stack trace.
- "Allow re-registration so that teams can hot-fix a tool." A silent replace is the incident in the prompt, and a fix should pass an explicit override that shows up in review.

## Taught in

The [tool registry lesson](../../../phases/19-capstone-projects/21-tool-registry-schema-validation/) builds the record and the validator, and the [why capable models still fail lesson](../../../phases/14-agent-engineering/31-agent-workbench-why-models-fail/) places skills and tool catalogs among the harness primitives.
