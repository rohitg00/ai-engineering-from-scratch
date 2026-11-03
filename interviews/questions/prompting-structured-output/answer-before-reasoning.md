---
id: answer-before-reasoning
title: Valid JSON, worse accuracy, and the field order to blame
card: prompting-structured-output
kind: debug
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer]
rounds: [debugging, ml-depth]
tags: [constrained-decoding, schema-design, field-order, reasoning]
minutes: 8
lessons: [phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding, phases/11-llm-engineering/03-structured-outputs]
manuals: []
practice: []
cheatsheet: [structured-outputs]
related: [prompting-structured-output/json-mode-is-not-a-schema, prompting-structured-output/read-the-constrained-decoder]
updated: 2026-11-03
---

A classifier uses constrained decoding with a schema of two fields, `answer` and `reasoning`, in that order. The output is always valid JSON and the accuracy is worse than the free-text version was. What is wrong?

## Short answer

The field order. The model commits to the answer before it writes any reasoning, so the reasoning tokens never shape the answer, and you lose the gain that step-by-step gives. Put `reasoning` first and `answer` last; the schema stays valid, and no validator will ever flag the difference, because the order is logic and not formatting.

## Full answer

### The pitfall

The constrained decoding lesson calls it the pitfall that costs you. With `answer` first, the model writes the decision token at the first position where the grammar allows it, and the reasoning that follows is a story about a choice already made. With `reasoning` first, the chain comes before the decision, and the decision token is conditioned on it. Both documents validate. Only one is right.

The lesson's skill refuses any design that puts an `answer` or `decision` field before the reasoning fields.

### Neighbors of the same mistake

| Schema choice | What goes wrong | Fix |
|---|---|---|
| A strict pattern for a value that can be missing, such as a date | the model invents a value to satisfy the grammar | allow null or a sentinel |
| A field left optional that matters | the model omits it when it is inconvenient | make it required and allow null, so the absence is explicit |
| Nesting four levels deep or more | each level is one more place to lose the structure | flatten |
| An enum with thousands of options | the grammar compiles slowly or times out | predict a short list of candidates first, then constrain to it |

### Why the unconstrained reply did better

A free-text reply tends to explain before it concludes, so it had the chain by accident. The constrained schema removed it. The fix restores it on purpose.

## Follow-ups

- **Level 2:** Why can no validator catch this? Expected: both orders are valid against the schema; the harm is in what the model has seen when it writes the answer token.
- **Level 2:** The schema forces a date pattern and the model fills in dates that are not in the text. Which related mistake is that? Expected: a grammar too strict for missing data; allow null or a sentinel so the model does not invent a value.
- **Level 3:** A field is optional and the model leaves it out when it matters. What do you change? Expected: make it required and allow null, so the model has to state that the value is missing.
- **Level 3:** The schema nests four levels deep and errors rise. What do you do? Expected: flatten, because each level of nesting is one more place to lose track of the structure.

## Wrong answers

- "Constrained decoding guarantees a correct output." It guarantees the shape; the lesson shows valid JSON with a wrong answer.
- "Order does not matter in JSON." It does not matter to the parser; it matters to the model, which writes the fields in order.
- "Add a check that the reasoning supports the answer." That is an eval, not a fix; the fix is to generate the reasoning first.

## Taught in

The lesson [constrained decoding](../../../phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/) names the field order pitfall and the strict grammar pitfall, and the lesson [structured outputs](../../../phases/11-llm-engineering/03-structured-outputs/) covers nesting depth and optional fields.
