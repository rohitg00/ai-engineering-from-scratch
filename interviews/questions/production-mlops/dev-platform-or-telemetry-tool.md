---
id: dev-platform-or-telemetry-tool
title: Pick an observability stack without locking in
card: production-mlops
kind: tradeoff
level: 3
roles: [ai-evaluation-reliability-engineer, inference-engineer, ai-data-engineer]
rounds: [system-design, design-review]
tags: [observability, opentelemetry, evals, vendor-lock-in]
minutes: 12
lessons: [phases/17-infrastructure-and-production/13-llm-observability, phases/14-agent-engineering/24-agent-observability-platforms]
manuals: []
practice: []
cheatsheet: [genai-observability]
related: [production-mlops/keep-every-error-trace, production-mlops/five-minute-detection]
updated: 2026-11-03
---

Your team must choose an observability stack for a new model service. Half the team wants an all-in-one platform with evals, prompt versions and session replays. The other half wants a thin gateway that records every call and nothing more. How do you decide, and which pattern lets you avoid the choice?

## Short answer

Decide on four axes: the framework you run on, the license you can accept, the budget, and whether you must self-host. A bundled development platform fits a team that iterates on prompts and needs evals tied to traces. A gateway or telemetry tool fits a team that needs portable instrumentation that does not depend on a framework. The pattern that avoids the choice is to emit OpenTelemetry spans with the GenAI conventions from every call and ship them to more than one place: a gateway for day-to-day, an eval platform for regressions, and an archive for long-term analysis.

## Full answer

### Two categories of tool

Development platforms bundle observability with evals, prompt management, dataset versioning and session replay. You run experiments, compare prompts and regression-test a new prompt against old winners. Gateway and telemetry tools record the prompt, the response, the tokens, the latency, the model and the cost, and they stop there.

### The four axes

| Axis | Question |
|---|---|
| stack | one framework, a raw SDK, or several vendors |
| license | open source only, a source-available license, or commercial |
| budget | a free tier, a team plan, or an enterprise contract |
| self-host | required, welcome, or never |

### The trap

Instrumenting inside the agent framework ties the traces to that framework. Instrumenting at the HTTP or SDK layer is portable, so a change of framework or a second framework does not lose the history.

### The glue pattern

1. Emit OpenTelemetry spans with the GenAI conventions from every model call.
2. Route them to a gateway or telemetry tool for the daily view.
3. Ship a copy to an eval platform for regressions.
4. Archive them in a data lake for long-term analysis.

Every tool that reads the conventions can read the same spans, so the stack is a routing decision, not a rewrite.

### What to insist on in either case

- Prompt versions tied to traces. When production regresses, you must be able to bisect to the prompt change that caused it.
- An eval strategy. Tracing without evaluation is expensive logging.
- A sampling policy at scale, because full retention at volume is more expensive than the calls it records.

## Follow-ups

- **Level 3:** Why instrument at the SDK layer rather than inside the framework? Expected: framework hooks tie you to the framework. The SDK layer keeps working when you change frameworks or add a second one.
- **Level 3:** What breaks when prompt versions are not tied to traces? Expected: when production regresses you cannot bisect to the prompt change that caused it.
- **Level 4:** You ship the same spans to two backends. What do you check so that they agree? Expected: the same conventions version, the same sampling rules on both exporters, and one source of truth for cost attribution, so that two dashboards do not show two bills.

## Wrong answers

- "Pick the tool with the most features." Features you do not use cost money and couple you. Pick on stack, license, budget and hosting.
- "Tracing is enough, evals can come later." Traces without evals are logs with a price. A regression hides in them until a user reports it.
- "The gateway records every call, so skip the platform." A proxy sees calls, not agent steps or sessions. It misses the multi-step traces that an agent regression needs.

## Taught in

The [observability stack lesson](../../../phases/17-infrastructure-and-production/13-llm-observability/) gives the two categories, the four axes and the glue pattern, and the [agent observability lesson](../../../phases/14-agent-engineering/24-agent-observability-platforms/) warns against tracing without evals.
