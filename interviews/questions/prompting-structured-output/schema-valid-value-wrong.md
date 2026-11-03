---
id: schema-valid-value-wrong
title: Zero validation errors and wrong invoice totals
card: prompting-structured-output
kind: debug
level: 3
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, forward-deployed-ai-engineer]
rounds: [debugging, design-review]
tags: [structured-outputs, hallucination, extraction-eval, enum]
minutes: 10
lessons: [phases/11-llm-engineering/03-structured-outputs, phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding, phases/13-tools-and-protocols/04-structured-output]
manuals: []
practice: []
cheatsheet: [structured-outputs]
related: [prompting-structured-output/json-mode-is-not-a-schema, prompting-structured-output/design-extraction-with-refusals]
updated: 2026-11-03
---

An extraction pipeline with strict schema enforcement has reported zero validation errors for a month. A finance review finds that a share of the extracted invoice totals do not match the source documents, and that a status field often holds a value that is allowed by the enum and wrong for the document. The engineers say the schema guarantees correctness. What do you tell them, and what do you build?

## Short answer

Schema enforcement guarantees shape, not truth. A total with the right type and the wrong number passes every format check, and an enum member can be allowed and still be the wrong one. Build a semantic eval: a labeled set of documents with gold records, exact match and field-level accuracy per field, plus a confidence signal from repeated extraction or token probabilities that sends low-confidence fields to human review.

## Full answer

### The failures a schema cannot see

The structured outputs lesson lists them even with enforcement on:

| Failure | Example | Why the schema passes it |
|---|---|---|
| Invented value | the text says one amount and the record holds another | right type, wrong content |
| Enum confusion | the model picks an allowed member that does not fit the document | the member is in the set |
| Array length | too many or too few line items | not every provider enforces the item bounds at decode time |
| Optional omission | a field left out when it was inconvenient | optional means allowed to be absent |

The constrained decoding lesson adds two causes that make the values worse: a grammar too strict for missing data, which pushes the model to invent, and a decision field placed before the reasoning.

### What to build

1. **A labeled set.** The lesson's exercise uses 50 documents with hand-labeled records. Label real invoices, including the hard cases.
2. **Field-level metrics.** Exact match on the record, accuracy per field, and type compliance as a sanity row that should sit near 100 percent.
3. **A confidence per field.** Run the extraction three times and measure agreement, or read the token probabilities, and flag the fields that disagree.
4. **A review queue.** Low-confidence records go to a human before they reach accounting.
5. **Schema repairs.** Put a reasoning field ahead of the status, give enum members descriptions that make their meaning explicit, and add a null or an "other" member if the source has cases that none of the members fit.

### Why size does not fix it

The structured output lesson notes that grammar enforcement lets a small model beat a much larger one on structured tasks, because the format is decoupled from the model size. The values are not. Only a labeled eval tells you how often they are right.

## Follow-ups

- **Level 3:** Which failure can a schema never see? Expected: a value with the right type and the wrong content, such as a total copied from the wrong line.
- **Level 3:** How do you get a confidence per field without a new model? Expected: run the extraction three times and measure agreement, or read token probabilities, and flag fields that disagree for review.
- **Level 4:** The status enum has a member the model keeps picking wrongly. What are the candidate fixes? Expected: describe the members so their meaning is explicit, put a reasoning field before the status, and check whether the source has cases no member fits, which calls for a null or an "other" member.
- **Level 4:** What does the finished eval report look like? Expected: schema compliance near 100 percent as a sanity row, then exact match and field-level accuracy per field on the labeled set, with the hardest fields named.

## Wrong answers

- "Zero validation errors means zero extraction errors." Validation checks shape; the review found value errors that no shape check can see.
- "Switch to a bigger model and the values will be right." Size changes the error rate, not the blind spot; without a labeled eval you cannot tell by how much.
- "Add a tighter pattern to the total field." A tighter grammar does not make the number true; a grammar too strict even pushes the model to invent one.

## Taught in

The lesson [structured outputs](../../../phases/11-llm-engineering/03-structured-outputs/) lists the failures that survive a schema and sets the labeled extraction eval, the lesson [constrained decoding](../../../phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/) covers the strict grammar and field order causes, and the lesson [structured output](../../../phases/13-tools-and-protocols/04-structured-output/) separates format reliability from model size.
