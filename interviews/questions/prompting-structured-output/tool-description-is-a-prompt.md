---
id: tool-description-is-a-prompt
title: Tool descriptions decide which tool gets called
card: prompting-structured-output
kind: concept
level: 2
roles: [agentic-ai-engineer, applied-ai-engineer, ai-developer-relations-engineer]
rounds: [screen, ml-depth]
tags: [function-calling, tool-schema, tool-choice, error-handling]
minutes: 7
lessons: [phases/11-llm-engineering/09-function-calling]
manuals: []
practice: [tool-call-parser]
cheatsheet: [tool-calling]
related: [prompting-structured-output/structured-output-vs-function-call, prompting-structured-output/tool-call-security-rules]
updated: 2026-11-03
---

An agent has eight tools and keeps calling the wrong one. The tool descriptions are one or two words each, such as "gets weather". What does the description do, and how do you rewrite one?

## Short answer

The model reads the description to decide when and how to call the tool, so the description is a prompt for tool selection. Rewrite it as a full sentence that says what the tool does and what it returns, for example that it gets the current weather for a city and returns the temperature in Celsius and the conditions, and describe each parameter with an example value and an enum where the set is closed. Then validate the arguments against the schema before anything executes.

## Full answer

### What the model sees

A tool definition is a JSON Schema contract: a name, a description, and the parameters with their types, their own descriptions, and the required list. The model never sees your code. It picks a tool and fills the arguments from this text alone, so a vague description produces worse selection than a precise one, and a parameter with an example such as a city name is filled more reliably than a bare string.

### Beyond the description

- **Tool choice.** Auto lets the model decide. Required forces at least one call, which stops the model from guessing when you know a lookup is needed. A named tool forces that one, for routing when upstream logic already knows.
- **Parallel calls.** Two cities in one question can come back as two calls in one turn; execute both and return both results.
- **Structured errors.** Return failures as results with a message, a code and suggestions, such as the city not found and the nearest names. Models self-correct from structured errors and not from empty or generic ones.
- **A call budget.** Set a maximum of 10 to 20 calls per conversation so a loop cannot run away.

### Measure it

Write a set of queries with the expected tool for each; the lesson's exercise uses 30. Run the selection and report the share that picked the right tool, and list the pairs that get confused.

## Follow-ups

- **Level 2:** Where else does a description help besides the tool itself? Expected: on each parameter, with an example value and an enum where the set is closed, so the arguments come out right.
- **Level 2:** The model still guesses instead of calling a tool when it should. Which setting changes that? Expected: tool choice set to required, or to a named tool when upstream logic already knows which one.
- **Level 3:** How do you prove the rewrite worked? Expected: a set of test queries with expected tool names, 30 in the lesson, the share that select the right tool, and the confused pairs listed.
- **Level 3:** A tool fails. What should it return so the model recovers? Expected: a structured error with a message, a code and suggestions, not an exception or an empty response.

## Wrong answers

- "The model infers the purpose from the function name." It reads the description; a vague one produces worse selection than a full sentence.
- "Describe every tool in a paragraph to be safe." Definitions travel with every request; one precise sentence plus parameter descriptions is the target.
- "Let the model call any function by name." The lesson's rule is an allowlist of the tools you define, never a generic execute-by-name tool.

## Taught in

The lesson [function calling](../../../phases/11-llm-engineering/09-function-calling/) gives the tool definition contract, the tool choice modes, structured errors and the selection accuracy exercise.
