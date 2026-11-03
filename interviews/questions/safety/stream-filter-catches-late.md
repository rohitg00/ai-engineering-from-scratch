---
id: stream-filter-catches-late
title: The detector said benign and the stream was cut
card: safety
kind: debug
level: 3
roles: [agentic-ai-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, system-design]
tags: [safety-gate, streaming-filter, prefix-injection, encoding-trick, trace]
minutes: 9
lessons: [phases/19-capstone-projects/87-end-to-end-safety-gate, phases/19-capstone-projects/82-jailbreak-taxonomy]
manuals: []
practice: []
cheatsheet: [guardrails-moderation]
related: [safety/gate-aggregation-table, safety/one-regex-is-not-a-detector]
updated: 2026-11-03
---

Your gate blocks most attacks before the model runs. In the trace of one request the detector said benign, the model began answering with a procedure it must never give, and the response was cut after a few tokens and shipped as a redacted partial. Explain which layer acted, why the first layer missed, and whether the outcome is correct.

## Short answer

The streaming filter acted: it buffers a short window of emitted chunks, sweeps it for known continuation phrases, terminates the stream on a match and marks the output as terminated early, which the aggregator treats as a medium signal and maps to redact. The detector missed because the prompt was an encoding trick or a prefix injection whose surface the input rules did not cover. The outcome is correct for the design: the harmful continuation never completed, and the trace records the miss for the detector team.

## Full answer

### The layer that acted

The gate runs at three checkpoints. Pre generation is the detector. During generation is a filter over the model's stream: the mock yields chunks of four tokens, the filter holds up to two chunks, runs a regex of continuation phrases over the window, and on a match stops the iterator and returns the partial output marked as terminated early. Post generation runs the classifier router and the rules engine on whatever was emitted.

### Why the detector missed

Two taxonomy categories are built to pass input rules. An encoding trick hides the forbidden tokens in base64, rot13, leet speak or zero width characters, and a rule set that does not decode that form sees nothing. A prefix injection ends the prompt with the first words of the answer, so the model continues from an assumed yes instead of deciding; the prompt itself can look harmless. The capstone's mock produces a partial harmful continuation on exactly that subset of attacks, on purpose, so the layers can be seen interacting.

### Why redact and not block

Early termination is one medium signal. The post generation pass on the partial text found nothing high. The maximum is medium, so the action is redact: the classifier redactors and the rules fixer run over the partial, and it ships with a trace that shows the detector verdict, the matched termination pattern, the post generation verdicts, the final action and the latency.

### What to do with the trace

Add the prompt to the taxonomy as a fixture with its category and severity. Add or adjust a detector rule for its family. Rerun the metrics runner and read the recall change in that category and the false positive change on the benign list. The trace exists so that a miss becomes a fixture instead of a story.

### The limit

The window holds two chunks. A continuation phrase split across more chunks escapes the filter, and the post generation pass is the backstop. A gate that looked only after generation would let a prefix injection stream its procedure to the user before any check.

## Follow-ups

- **Level 3:** Why does the filter hold two chunks instead of scanning each chunk alone? Expected: a continuation phrase can span a chunk boundary; the window lets the regex see across it at the cost of a short delay.
- **Level 3:** Which taxonomy categories does this layer exist for? Expected: encoding tricks that pass the input rules, and prefix injection, where the prompt sets the first words of the answer.
- **Level 4:** What is the next action for the detector team, and how do they know it worked? Expected: add the prompt as a fixture with its category, add or adjust a rule, and read the per category recall and the benign false positive rate from the metrics runner.

## Wrong answers

- "The gate failed because the detector said benign." The gate is layered so that a miss in one layer is caught by the next; the trace shows the design working.
- "Ship nothing when the stream is cut." The design maps early termination to redact and ships the partial through the redactors; a block needs a high signal.
- "Scan the whole output after generation instead." A post hoc only look lets a prefix injection stream its procedure to the user before the check; the filter exists to stop the stream early.

## Taught in

The [end to end safety gate capstone](../../../phases/19-capstone-projects/87-end-to-end-safety-gate/) builds the streaming filter and the trace, and the [jailbreak taxonomy capstone](../../../phases/19-capstone-projects/82-jailbreak-taxonomy/) defines the categories that reach it.
