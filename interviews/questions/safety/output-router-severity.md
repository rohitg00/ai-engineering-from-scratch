---
id: output-router-severity
title: The input passed and the output leaked
card: safety
kind: design
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [output-classifier, pii, instruction-leakage, router, redaction]
minutes: 9
lessons: [phases/19-capstone-projects/85-content-classifier-integration]
manuals: []
practice: []
cheatsheet: [guardrails-moderation]
related: [safety/one-regex-is-not-a-detector]
updated: 2026-11-03
---

Every request to your assistant passes an input detector, and yet a response last week contained a customer's email address and part of the system prompt. Design the output side, say how three separate classifiers combine into one action, and explain what happens to latency.

## Short answer

Put three classifiers on the model output behind one router: toxicity by rules, personal data by regexes for emails, phone numbers and card shaped strings, and instruction leakage by trigram overlap with the known system prompt. Each returns a severity, and the router takes the maximum and applies one action: block on high, redact on medium, warn on low, log on none. Run the classifiers in parallel with token streaming and hold the final chunk until the verdict arrives. Earlier chunks have already shipped, so where a block or a redaction must cover the whole response, hold the full response and accept the latency.

## Full answer

### Why the output side exists

The input layer asks how the prompt got here. The output layer asks whether what is about to ship is acceptable, whatever the prompt was. A model can leak personal data, repeat a slur from its training distribution or echo its system prompt without any attack in the input. Skipping output classification hands every new attack family a one shot bypass.

### The verdict

Each classifier is a callable that returns a name, a score in the unit range, a severity of none, low, medium or high, and a list of findings. The three classifiers:

- **Toxicity.** A curated keyword list with whitespace bounded matching and a small negation window, so a sentence that denies the slur does not fire.
- **Personal data.** Regexes for the common shapes: email, phone, social security number, credit card, IP address.
- **Instruction leakage.** The classifier holds the system prompt and measures trigram overlap with the output; high overlap is the signal.

### The router

| Maximum severity | Action |
|---|---|
| high | block, return a policy refusal |
| medium | redact with each classifier's redactor |
| low | warn, log and append a soft notice |
| none | log and ship as is |

Block wins. Redact plus warn is redact. Each classifier owns its redactor, so an output with both a slur and an email flows through both: the email becomes a redacted email tag, the digits a redacted card tag, the slur a redacted language tag, and leakage removes the lines that look like the system prompt header. The router emits an action with the verb, the output, the severity, the verdicts and metadata for the trace.

### Latency

The classifiers run in parallel with token streaming. The gate buffers the final chunk, applies the verdict and then flushes. The chunks before it have already reached the client, so an email or a system prompt span in an early chunk ships before a block or a redaction can act. When that exposure is not acceptable, hold the full response before the first flush and accept the added latency. With rule based classifiers the added time is close to zero; neural classifiers add their own time, and the plumbing stays the same.

## Follow-ups

- **Level 2:** Why does block win when two classifiers disagree? Expected: the router takes the maximum severity, so the most dangerous finding sets the action.
- **Level 2:** Why does each classifier own its redactor? Expected: an output with both a slur and an email must flow through both redactors, and independence makes the composition automatic.
- **Level 3:** How does the leakage check work without a model? Expected: it holds the system prompt and measures trigram overlap with the output; high overlap is the leak signal and header like lines are removed.
- **Level 3:** The product team says output checks add latency they cannot afford. Expected: the classifiers run in parallel with streaming and only the final chunk waits, but earlier chunks ship before the verdict; hold the full response where that exposure is not acceptable, because the alternative is a one shot bypass for every new attack family.

## Wrong answers

- "The input detector passed, so the output is fine." The input layer cannot know about outputs the model produces on its own, such as a training data slur or an echoed system prompt.
- "One combined classifier is simpler." Three independent verdicts with their own redactors compose; one model hides which finding drove the action.
- "Redact everything to be safe." Redaction is the medium action; a high finding must block, and a none finding must ship as is with a log, or the product degrades.

## Taught in

The [content classifier integration capstone](../../../phases/19-capstone-projects/85-content-classifier-integration/) builds the three classifiers, the router and the redactors.
