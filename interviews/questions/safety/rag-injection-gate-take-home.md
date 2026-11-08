---
id: rag-injection-gate-take-home
title: Build the safety gate around a retrieval assistant
card: safety
kind: take-home
level: 4
roles: [agentic-ai-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [take-home]
tags: [safety-gate, prompt-injection, context-smuggling, output-classifier, trace]
minutes: 60
lessons: [phases/19-capstone-projects/83-prompt-injection-detector, phases/19-capstone-projects/82-jailbreak-taxonomy, phases/19-capstone-projects/87-end-to-end-safety-gate, phases/19-capstone-projects/85-content-classifier-integration]
manuals: []
practice: []
cheatsheet: [guardrails-moderation]
related: [safety/one-regex-is-not-a-detector, safety/output-router-severity, safety/gate-aggregation-table]
updated: 2026-11-03
---

Take home. We give you the fixture corpus of labeled attack prompts, a benign prompt list and a mock assistant that answers questions over retrieved documents. Build the safety gate around it: an input detector whose coverage is measured for each attack category, an output side with at least two classifiers behind a router, and a trace per request. The retrieved documents can carry instructions. What do you deliver, how do you measure it, and what do you say you did not do?

## Short answer

Deliver a detector as rules in data with a normalize pass, a metrics runner that writes per category precision and recall against the fixture corpus and the benign list, an output router with a personal data classifier and an instruction leakage classifier and their redactors, and a gate that runs before, during and after generation with a deterministic aggregation table and writes the verdict of every checkpoint for each request. Add a category and a rule family for instructions hidden in retrieved documents, because the corpus has none. State that the detector is wrong on purpose on benign looking role play, that a real model and a real sandbox are out of scope, and that the thresholds were not tuned on held out data.

## Full answer

### The detector

Rules live in a data file, each with a name, a category, a score and either a substring or a regex. A normalize pass strips zero width characters, lowercases a copy, decodes base64, rot13 and hex and maps leet digits, while the raw text stays available. The aggregator returns the highest scoring category and its confidence, or benign at zero. The metrics runner reads the taxonomy artifact, scores every fixture and every benign prompt, and writes precision, recall and raw counts per category to a report file.

### The retrieval problem

An instruction inside a retrieved document is context smuggling: it abuses the gap between data and instructions, and the user turn looks benign. The fixture corpus has six categories and none for an attack that arrives through retrieval, so add the seventh category the taxonomy sets as an exercise, author about ten fixtures for it, and add a rule family for instructions hidden in tool results and documents. Measure the recall gain on that category and the false positive cost on the benign list.

### The output side

A personal data classifier with regexes for emails, phone numbers and card shaped strings, and an instruction leakage classifier that compares the output with the known system prompt by trigram overlap. Each returns a severity and owns a redactor. The router takes the maximum severity and maps high to block, medium to redact, low to warn and none to log.

### The gate and the trace

Before generation the detector runs: block at or above 0.85 confidence on a non benign category, otherwise attach the signal. During generation a filter over the stream watches a two chunk window for continuation phrases and stops the stream on a match. After generation the router and the rules run on the full text. The aggregator takes the maximum rank. Every request writes a trace with the id, the prompt, the detector verdict, the stream verdict, the post generation verdicts, the final action, the final output and the latency. Run the whole corpus and the benign list through it and print the summary counts per category.

### What to measure

Per category precision and recall for the detector, the false positive count on benign prompts, the gate's action counts per category, and a threshold sweep from 0 to 1 with a precision and recall curve per category.

### What to leave out and say so

A real model in place of the mock. A real sandbox for anything the model might execute. Tuned thresholds, because the corpus is the training set for the rules and tuning on it would report a number that does not hold. Neural classifiers; the plumbing is the same when they arrive. Over refusal on real users, which needs a benign suite from production traffic.

## Follow-ups

- **Level 3:** Why do retrieved documents need their own category and rules? Expected: the attack sits in data the user never wrote, so the user turn looks benign; without fixtures for it, recall on that attack is unmeasured.
- **Level 4:** How do you show the new rule family did not cost benign recall? Expected: the false positive count on the benign list before and after, next to the recall gain in the new category.
- **Level 4:** What would you do first with a real model behind the mock? Expected: rerun the whole corpus through the gate and read the trace summary per category, then tune the aggregation thresholds on a held out split and report precision and recall per category.

## Wrong answers

- "A good detector makes the output side unnecessary." A retrieved document can carry the attack past any input rule, and the model can leak personal data on its own; the output side is where that is caught.
- "Hide the cases the detector gets wrong." The report exposes the intentional misses so the gate's other layers can be designed around them.
- "Tune the thresholds on the fixture corpus." The corpus is the training set for the rules; tuning on it reports a number that will not hold.

## Taught in

The [prompt injection detector capstone](../../../phases/19-capstone-projects/83-prompt-injection-detector/) builds the detector and its metrics runner, the [jailbreak taxonomy capstone](../../../phases/19-capstone-projects/82-jailbreak-taxonomy/) sets the seventh category as an exercise, the [content classifier integration capstone](../../../phases/19-capstone-projects/85-content-classifier-integration/) builds the output router, and the [end to end safety gate capstone](../../../phases/19-capstone-projects/87-end-to-end-safety-gate/) composes them with a trace.
