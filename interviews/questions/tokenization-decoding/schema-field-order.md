---
id: schema-field-order
title: Every output validates and the answers are wrong
card: tokenization-decoding
kind: design
level: 3
roles: [applied-ai-engineer, agentic-ai-engineer, forward-deployed-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [design-review, system-design]
tags: [structured-output, json-schema, field-order, constrained-decoding, schema-design]
minutes: 10
lessons: [phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding]
manuals: []
practice: []
cheatsheet: [structured-outputs]
related: [tokenization-decoding/constrained-decoding-how]
updated: 2026-11-03
---

You review the schema of an extraction service. It is `{"answer": ..., "reasoning": ..., "date": <a strict year-month-day regex>}`, enforced by constrained decoding. Compliance is perfect, yet accuracy is poor and some dates are invented. What is wrong with the design, and how do you change it?

## Short answer

Two faults that no validator can catch. The answer field comes before the reasoning field, so the model commits to an answer before it has reasoned, and the strict date pattern leaves no legal way to say unknown, so the model complies by inventing a date. Put reasoning first and the answer last, and allow a null or a sentinel for a missing date; field order is logic, not formatting, and a grammar that is too strict forces a confident wrong value.

## Full answer

### Fault one: premature commitment

Generation is left to right. With `answer` first, the model must emit the label before it has written a single word of analysis; the reasoning that follows is a justification of a choice already made. Swap the order and the model writes its analysis into the context that the answer is then conditioned on. The JSON is equally valid either way. Only the second way is correct.

```json
{"reasoning": "... therefore ...", "answer": "yes"}
```

### Fault two: a grammar with no exit

The date regex admits only well-formed dates. When the source has no date, the model cannot output "unknown", and a mask that forbids every honest token leaves only dishonest ones. Allow `null` or a sentinel string in the schema and instruct the model to use it.

### The other pitfalls to check in the same review

- **Recursive schemas behind a state-machine library.** The machine flattens recursion to a fixed depth; nested structures need a context-free grammar engine.
- **Huge enums.** An enum of 10,000 options compiles slowly or times out; narrow the candidates with a retriever first, then constrain to those.
- **Plain JSON mode without a schema.** It guarantees syntax, not your fields.

### The validation plan that would have caught it

Compliance rate is one number of four. Add semantic validity, measured with a judge or a labeled set, the field coverage rate, and latency at p50 and p99. A system with perfect compliance and poor semantic validity is exactly this case.

### The rule for the team

Refuse any schema that puts `answer` or `decision` before its reasoning fields. Refuse bare JSON mode without a schema. Flag any recursive schema that sits behind a state-machine-only library.

## Follow-ups

- **Level 3:** How do you measure semantic validity when compliance is already perfect? Expected: a labeled sample scored by a judge or by rules on the content, tracked separately from schema compliance.
- **Level 3:** The output needs a tree, such as nested comments. What changes? Expected: a state-machine library flattens recursion; move to a context-free grammar engine.
- **Level 4:** The product streams the answer to the user and wants it first for latency. How do you resolve the conflict? Expected: name the trade; options are two calls, reasoning in a hidden field before a visible answer, or accepting the latency; never answer-first with the same accuracy expectation.
- **Level 4:** How would the invented dates have shown up in monitoring? Expected: a field coverage rate near 100 percent on a corpus where the date is often missing is itself the alarm; compare the rate with the base rate of the field in the source.

## Wrong answers

- "Tighten the regex so only plausible dates pass." The grammar is already the problem; a tighter one forces more invention.
- "Add a line to the prompt asking the model to be honest." The mask forbids the honest tokens; no instruction can make the model emit a token with minus infinity logit.
- "Validation passes, so the system works." Validation checks shape; it cannot see that the answer was committed before the reasoning or that a date was made up.

## Taught in

The [structured outputs and constrained decoding lesson](../../../phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/) names the field-order pitfall, the too-strict grammar, and the validation plan.
