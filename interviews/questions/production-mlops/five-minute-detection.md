---
id: five-minute-detection
title: Catch a leaking prompt within five minutes
card: production-mlops
kind: design
level: 3
roles: [ai-evaluation-reliability-engineer, ai-data-engineer, inference-engineer]
rounds: [system-design, design-review]
tags: [observability, evals, alerting, pii, mttd]
minutes: 15
lessons: [phases/19-capstone-projects/11-llm-observability-dashboard, phases/11-llm-engineering/13-production-app]
manuals: []
practice: []
cheatsheet: [genai-observability]
related: [production-mlops/drift-score-on-prompts, production-mlops/keep-every-error-trace, production-mlops/dev-platform-or-telemetry-tool]
updated: 2026-11-03
---

A regression ships. One of your prompts starts to leak fake customer identifiers in about one answer in a hundred. Design the observability pipeline so that an alert reaches a person within five minutes of the first bad answer, and say what each stage adds to that clock.

## Short answer

Instrument every model call with GenAI-convention spans and ship them over OTLP to a collector. Run a cheap pattern check on every output at the collector, run a judge over the sampled traces on a short schedule, write the scores back as eval spans, export the aggregates as metrics, and alert when the leak score crosses a threshold. The five minutes are the sum of the scrape interval, the judge batch window and the alert routing, so each stage has to be short, and the sampler must keep enough traffic to see a one-in-a-hundred event. The five-minute target covers only the leaks that the pattern flags or the sampler keeps.

## Full answer

### The stages and their share of the clock

| Stage | What it adds | Time it costs |
|---|---|---|
| instrumentation and OTLP export | the span with the output | seconds |
| collector with tail sampling | the decision to keep the trace | seconds, plus the buffer wait |
| pattern check on the output | an instant flag for identifier shapes | none worth counting |
| judge over sampled traces | a score for leaks the pattern misses | the batch window |
| eval spans and metrics export | the aggregate the alert reads | the scrape interval |
| alert rule and routing | the page | the evaluation interval plus routing |

The capstone's eval job reads the last fifteen minutes of sampled traces. For a five-minute target, the judge has to run every minute on the newest traces, or the batch window alone eats the budget.

### Make the rare event visible

At one leak in a hundred, a sampler that keeps a tenth of the successes sees one leak in a thousand answers. At high volume that is fine, and at low volume it is blind. Run a pattern check for identifier shapes on every output at the collector, as the production application capstone does in its output guardrail, and keep every trace that the check flags. The judge then scores the paraphrased leaks on the sampled share only. A paraphrased leak in an unsampled trace gets no score and fires no alert.

### The alert chain

Eval scores land as eval spans linked to the parent trace. A metrics exporter aggregates them, an alert rule fires when the leak score in a window crosses the threshold, and the alert manager routes warnings to chat and critical breaches to the pager.

### Prove it

The capstone's regression probe injects a bug that leaks fake identifiers in one percent of answers and measures the time from deployment to the alert. Detection is the part of the recovery that the dashboard owns. The fix is the rollback, and that belongs to the release path.

## Follow-ups

- **Level 3:** Which stage usually dominates the five minutes? Expected: the judge batch window. A job that runs every fifteen minutes cannot meet a five-minute target.
- **Level 3:** The sampler drops nine of every ten successes. What happens to detection when the leak rate is one percent? Expected: it sees one leak in a thousand answers, so at low traffic the detection takes longer. Keep every trace that a cheap pattern check flags.
- **Level 4:** How do you prove the pipeline meets the target? Expected: inject the regression on purpose, as the capstone does, and measure the time from the deployment to the alert.

## Wrong answers

- "Run the judge on every trace." At volume that costs more than the model calls. Sample, and filter with a cheap check first.
- "A daily eval report is enough." A day of leaked identifiers is the incident. The target is minutes.
- "The pattern check catches everything." Patterns miss paraphrases. The judge catches what the pattern misses, and the pattern keeps the judge affordable.

## Taught in

The [observability dashboard capstone](../../../phases/19-capstone-projects/11-llm-observability-dashboard/) builds the ingest, eval and alert chain and measures detection time with an injected regression, and the [production app lesson](../../../phases/11-llm-engineering/13-production-app/) gives the pattern-based output guardrail.
