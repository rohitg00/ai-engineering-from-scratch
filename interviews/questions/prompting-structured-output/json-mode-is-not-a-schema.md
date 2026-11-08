---
id: json-mode-is-not-a-schema
title: What JSON mode guarantees and what it does not
card: prompting-structured-output
kind: concept
level: 1
roles: [applied-ai-engineer, agentic-ai-engineer, ai-developer-relations-engineer]
rounds: [screen, ml-breadth]
tags: [json-mode, json-schema, strict-mode, constrained-decoding]
minutes: 6
lessons: [phases/11-llm-engineering/03-structured-outputs, phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding, phases/13-tools-and-protocols/04-structured-output]
manuals: []
practice: []
cheatsheet: [structured-outputs]
related: [prompting-structured-output/three-failure-modes-structured, prompting-structured-output/schema-valid-value-wrong]
updated: 2026-11-03
---

A teammate turned on the provider's JSON mode and says the extraction output is now guaranteed. What does JSON mode guarantee, what does it not, and what do you turn on instead?

## Short answer

JSON mode guarantees that a finished output parses, nothing more; a response cut at the token limit can still fail, so check the finish reason first. It does not guarantee your keys, your types, your enum values or the absence of extra fields. Turn on the schema mode, where the provider takes a JSON Schema and constrains decoding to it, and keep a check on your side for the values that a schema cannot judge.

## Full answer

### Four levels of control

| Level | Guarantee | Typical failure |
|---|---|---|
| A prompt that says "respond in JSON" | none; about 90 percent valid | code fences, preamble text, truncation, wrong structure |
| JSON mode | valid syntax | extra keys, wrong types, missing fields |
| Schema mode | the output conforms to your schema | a wrong value with the right type, or a refusal |
| Constrained decoding | every token is valid for the schema | the same as schema mode; this is how schema mode is built |

The constrained decoding lesson is blunt about it: pure JSON mode guarantees valid JSON, not JSON that is valid for your use case, so always provide a full schema.

### What strict schema mode asks of you

The structured output lesson lists the strict mode rules: every property appears in `required`, `additionalProperties` is false everywhere, and there is no unresolved reference. A schema that breaks these is rejected at request time with a 400.

### What stays with you

Under strict enforcement two failures disappear for a response that finishes, the parse error and the schema violation. A response cut at the token limit can still fail to parse, so check the finish reason before you read it. Two more remain. The model can refuse when the input does not fit the schema, which your code treats as a typed outcome. And the model can fill a field with a value that has the right type and the wrong content; no format layer sees that.

## Follow-ups

- **Level 1:** Which failure remains under strict schema mode? Expected: a refusal, when the model decides the input does not fit the schema; handle it as a typed outcome, and route a response cut at the token limit to the error path.
- **Level 2:** What does strict mode demand of the schema? Expected: every property required, additional properties forbidden, no unresolved references; otherwise the request is rejected with a 400.
- **Level 2:** The output matches the schema and the price is wrong. Which layer failed? Expected: none of the format layers; the value is invented, and only a semantic check or an eval catches that.
- **Level 3:** A field is sometimes unknown in the source text. How do you write the schema? Expected: allow null or a sentinel; a grammar that forces a value makes the model invent one, such as a date.

## Wrong answers

- "JSON mode means the keys match my model." It only guarantees syntax; extra keys, wrong types and missing fields still happen.
- "Adding 'respond in valid JSON' to the prompt is the same thing." A prompt-only approach is about 90 percent reliable and fails with fences, preambles and truncation.
- "With schema mode I can drop validation." A schema cannot catch a wrong value with the right type; keep a semantic check.

## Taught in

The lesson [structured outputs](../../../phases/11-llm-engineering/03-structured-outputs/) lays out the four levels, the lesson [constrained decoding](../../../phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/) warns against JSON mode without a schema, and the lesson [structured output](../../../phases/13-tools-and-protocols/04-structured-output/) gives the strict mode rules.
