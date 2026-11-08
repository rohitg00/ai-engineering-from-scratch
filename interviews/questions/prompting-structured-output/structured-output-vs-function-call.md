---
id: structured-output-vs-function-call
title: Typed data or an action, and why the difference matters
card: prompting-structured-output
kind: tradeoff
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer, ai-developer-relations-engineer]
rounds: [screen, system-design]
tags: [structured-outputs, function-calling, tool-use, json-schema]
minutes: 7
lessons: [phases/11-llm-engineering/09-function-calling, phases/11-llm-engineering/03-structured-outputs]
manuals: []
practice: []
cheatsheet: [structured-outputs, tool-calling]
related: [prompting-structured-output/tool-description-is-a-prompt, prompting-structured-output/json-mode-is-not-a-schema]
updated: 2026-11-03
---

You need two things from the same model: a typed summary of a support ticket, and the ability to look up the customer's account during the conversation. A teammate wants to build both as tools. Which mechanism fits each, and why does the distinction matter?

## Short answer

The ticket summary is structured output: the typed data is the final product, so use the schema mode and validate it. The account lookup is a function call: the model declares an intent to act, your code executes it and feeds the result back, so the output is an intermediate step. The two share the JSON Schema machinery but differ in what happens next, and mixing them hides which outputs are data and which are actions your code runs.

## Full answer

### Two uses of one mechanism

| | Structured output | Function call |
|---|---|---|
| What the model emits | a record that matches a schema | a function name and typed arguments |
| What happens next | your code validates and stores it | your code executes it and returns the result to the model |
| The output is | the final product | an intermediate step |
| Fits | extraction, classification, typed summaries | lookups, writes, anything that touches another system |

The function calling lesson states the rule: use structured outputs when you want data, use function calling when you want the model to interact with an external system. The model never executes anything; it only decides what to call and with what arguments.

### When tool use is the right way to get data

The structured outputs lesson gives the exception. When the model has to choose among several schemas based on the input, for example 10 extraction schemas, tool use gives you the selection and the structure in one step. One provider also delivers its schema mode through tool use, with the schema on the tool input. In that case name the tool for the data it returns, never execute it, and route its arguments straight to the validator.

### Why the distinction matters in code

A record gets schema validation and a semantic check. An action gets argument validation, an allowlist, result sanitizing and a call budget before anything runs, because the model chose what to execute. If the summary and the lookup live in one registry, the security rules for actions either cover data they do not need to, or miss an action they should.

## Follow-ups

- **Level 2:** When is tool use the right way to get structured data? Expected: when the model must pick one of several schemas from the input; the lesson's example is 10 extraction schemas, where tool use gives the selection and the structure together.
- **Level 2:** In the lookup case, who runs the function? Expected: your code; the model emits the name and the arguments, and the result goes back as a message.
- **Level 3:** What differs in validation between the two? Expected: data gets schema validation and a semantic check; an action gets argument validation, an allowlist and a call budget before it runs.
- **Level 3:** A provider offers schema output only through tool use. How do you keep the distinction? Expected: name the tool for the data it returns, never execute it, send its arguments to the validator as the final record, and keep real actions in a separate registry.

## Wrong answers

- "They are the same thing with different names." They share the schema machinery; one produces the final data, the other requests an action your code performs.
- "Use function calling for everything, it is more flexible." Every tool is an executable surface with security rules; data extraction does not need one.
- "The model runs the lookup itself." The model never executes anything; it emits a call and your code is the executor.

## Taught in

The lesson [function calling](../../../phases/11-llm-engineering/09-function-calling/) separates data from action and gives the five-step loop, and the lesson [structured outputs](../../../phases/11-llm-engineering/03-structured-outputs/) covers tool use as a way to choose among schemas.
