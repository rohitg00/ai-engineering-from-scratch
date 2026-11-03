---
id: design-extraction-with-refusals
title: Design an extraction service for purchase-order emails
card: prompting-structured-output
kind: design
level: 3
roles: [applied-ai-engineer, forward-deployed-ai-engineer, agentic-ai-engineer]
rounds: [system-design, design-review]
tags: [structured-outputs, json-schema, strict-mode, refusal, extraction]
minutes: 20
lessons: [phases/13-tools-and-protocols/04-structured-output, phases/11-llm-engineering/03-structured-outputs, phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding]
manuals: []
practice: []
cheatsheet: [structured-outputs]
related: [prompting-structured-output/three-failure-modes-structured, prompting-structured-output/schema-valid-value-wrong]
updated: 2026-11-03
---

Design the extraction service for purchase-order emails. The input is free text; the output is a typed record with a customer, line items and a total. Cover the schema, the enforcement mode, the retry and refusal handling, and how you prove it works before it touches the accounting system.

## Short answer

Write one JSON Schema 2020-12 with the constraints that matter: required fields, enums for closed sets, a minimum of zero on the total, additional properties forbidden, and any reasoning field ahead of any decision field. Run it in the provider's strict schema mode so that a response that finishes cannot have a parse error or a schema violation, check the stop reason so that a response cut at the token limit goes to the error path, and treat a refusal as a typed outcome that goes to a review queue. Prove it with a labeled set of real emails scored per field, a refusal check on inputs that must not extract, and a run beside the human process before any record is written.

## Full answer

### The schema

- `type`, `properties` and `required` for the shape; every property listed as required, with null allowed where the source can lack a value.
- `enum` for closed sets such as currency or status; `minimum` on the total; `pattern`, `minLength` and `maxLength` on identifiers; `items` for the line items.
- `additionalProperties: false` everywhere, which blocks invented fields and which strict mode demands.
- Field order as logic: any `reasoning` field before `total` or `status`, because the model commits to the first field it writes.

In Python, a Pydantic model generates this schema; the service keeps the schema as the contract and the model as its binding.

### The enforcement mode

| Situation | Pick |
|---|---|
| A hosted frontier model, a flat schema | the provider's strict schema mode |
| Several providers, retries acceptable | a retry library over the Pydantic model, which is portable and does not touch logits |
| A local model, validity required | a grammar engine, finite state for a flat schema and context-free for a recursive one |

Strict mode is the default here: a finished output parses and validates by construction. Two failures remain: the refusal, and a response cut at the token limit, which can still fail to parse. Check the stop reason before you read the output, and send an incomplete response to the error path.

### Retry and refusal

Outside strict mode: generate, parse, validate, inject the typed errors and retry, at most three times. More than three means the schema or the prompt is wrong for some inputs. In every mode: a refusal is a first-class outcome with a reason attached. Log it, return it typed, send it to the review queue, and never retry it, because forcing a record on an input that does not fit produces an invented record.

### Proof before accounting sees a record

1. **A labeled set** of real emails with gold records; the structured outputs lesson uses 50 documents. Report exact match, accuracy per field and type compliance.
2. **A refusal check.** Construct inputs that must not extract, such as a lyric, a proof or a blank email, and count refusals against invented outputs.
3. **A confidence per field** from repeated extraction or token probabilities, with low-confidence records routed to a human.
4. **A schema version** on every record, and a schema diff that separates breaking changes from non-breaking ones before any deploy.
5. **A side-by-side run** against the human process on the labeled set, with the service writing nothing until the field-level numbers clear the bar you set with finance.

## Follow-ups

- **Level 3:** Why forbid additional properties? Expected: it blocks invented fields, and strict mode requires it everywhere.
- **Level 3:** You expect to switch providers next year. Which mode do you pick? Expected: a retry library over the Pydantic model for portability, or keep the schema identical across providers so each strict mode receives the same contract.
- **Level 4:** How do you version the schema once records exist? Expected: a version field on each record and a schema diff that separates breaking changes from non-breaking ones. Strict mode makes every field required, so an added field is breaking too, because the records written before it do not contain it; removed fields and changed types are breaking, and relaxed constraints are not.
- **Level 4:** Which failure can this design not remove, and where does it go? Expected: a wrong value with the right type; it goes to the field-level eval and the confidence flags, and the low-confidence records go to review.

## Wrong answers

- "Prompt for JSON and parse it, the model is good." That works 85 to 95 percent of the time and fails six different ways; accounting needs the contract.
- "Retry refusals until the model gives a record." A refusal says the input does not fit; forcing a record invents one.
- "Validation after generation is as good as strict mode." It is reliable but pays for every retry, and a truncated output costs a turn each time.

## Taught in

The lesson [structured output](../../../phases/13-tools-and-protocols/04-structured-output/) gives the schema constructs, the strict mode rules, the retry pattern and the refusal handling, the lesson [structured outputs](../../../phases/11-llm-engineering/03-structured-outputs/) sets the labeled eval and the schema diff, and the lesson [constrained decoding](../../../phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/) gives the mode table and the field order rule.
