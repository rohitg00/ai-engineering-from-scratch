---
id: three-failure-modes-structured
title: The three ways a structured output call fails
card: prompting-structured-output
kind: concept
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-depth]
tags: [structured-outputs, refusal, retry, strict-mode]
minutes: 7
lessons: [phases/13-tools-and-protocols/04-structured-output, phases/11-llm-engineering/03-structured-outputs]
manuals: []
practice: []
cheatsheet: [structured-outputs]
related: [prompting-structured-output/json-mode-is-not-a-schema, prompting-structured-output/design-extraction-with-refusals]
updated: 2026-11-03
---

An extraction service turns purchase-order emails into typed records. Name the ways a structured output call can fail, say which of them disappear under strict schema enforcement, and describe how the code should treat what remains.

## Short answer

Three ways: a parse error, where the output is not JSON; a schema violation, where it parses but breaks a type, a required field, an enum or a range; and a refusal, where the model decides the input does not fit the schema. Strict enforcement removes the first two by construction for a response that finishes. The refusal stays, and it must be a typed outcome that the code logs and returns, never a retry. A response cut at the token limit can still fail to parse, so check the stop reason before you read the output.

## Full answer

### Three approaches, three failure profiles

1. **Prompt for JSON.** Works 85 to 95 percent of the time on a frontier model. Fails six ways: a missing brace, a trailing comma, wrong types, invented fields, truncation at the token limit, and leaked prose such as "here is your JSON".
2. **Validate after generation.** Generate freely, parse, validate against the schema, and on failure inject the error and retry. Reliable but you pay for every retry.
3. **Constrained decoding.** The provider masks invalid tokens at decode time, so a finished output parses and validates by construction. The model-side failure collapses to one mode, refusal; a response cut at the token limit and a request error still need their own error path.

### The retry loop, when you are outside strict mode

```text
generate -> parse -> validate -> if fail, inject the error and retry, at most 3 times
```

One retry is usually enough. Three catches weak-model flakes. Beyond three means the schema or the prompt is wrong for some inputs, and the fix is there, not in a fourth attempt. The validator should return a typed error list with a path and a message for each failure, which is the shape the retry prompt needs.

### The refusal branch

The model declines because the input does not fit, for example the email was a poem and not an order, or because of a safety reason. The refusal carries the reason. Log it, return it typed, and do not retry. The lesson also uses refusals as a safety signal downstream.

### One schema setting that matters

`additionalProperties: false` forbids fields the schema did not name, which is how strict mode shuts the door on invented fields. Strict mode requires it everywhere.

## Follow-ups

- **Level 2:** How many retries, and what does needing more tell you? Expected: at most three; one is usually enough, and beyond three the schema or the prompt is wrong for some inputs.
- **Level 2:** Why must the refusal branch not retry? Expected: the model declined for a reason, often fit or safety; a retry wastes cost and can push a wrong extraction through.
- **Level 3:** What does the retry prompt need from the validator? Expected: a typed error list with a path and a message per failure, so the model knows which field to fix.
- **Level 3:** Which schema setting blocks invented fields? Expected: additional properties set to false, which strict mode requires everywhere.

## Wrong answers

- "A refusal is a failed call, retry it." It is a first-class outcome with a reason attached; log it and return it typed.
- "Strict mode removes every failure." It removes parse errors and schema violations for a finished response; refusals, truncated responses and wrong values with the right type remain.
- "Retry until it validates." Past three retries the cost grows and the schema is the real problem.

## Taught in

The lesson [structured output](../../../phases/13-tools-and-protocols/04-structured-output/) names the three failure modes, the retry pattern and the refusal branch, and the lesson [structured outputs](../../../phases/11-llm-engineering/03-structured-outputs/) covers validation with error feedback.
