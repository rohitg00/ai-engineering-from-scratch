---
id: effective-context-spec-sheet
title: A long context battery for every model upgrade
card: evaluation
kind: design
level: 4
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [long-context, niah, multi-hop, regression, spec-sheet]
minutes: 12
lessons: [phases/05-nlp-foundations-to-advanced/28-long-context-evaluation]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/niah-is-not-enough]
updated: 2026-11-03
---

Your team will adopt a new model next quarter and needs a long context evaluation that runs again on every future upgrade. Design the battery for a product that answers questions over long documents and sometimes has to combine facts from several places: the tests, the sampling grid, the metrics, the cutoffs and the regression procedure.

## Short answer

Build a fixed in house harness with three parts: a needle grid over depth and length on your own documents, a multi hop variable tracing task at the same lengths, and a slice of real long document questions. Sample five depths at each length and record pass rates, time to first token and cost per query. Publish two cutoffs, the effective retrieval length at a 90 percent pass and the effective reasoning length at 70 percent, and rerun the same harness on every upgrade.

## Full answer

### The tests

1. **Domain needle.** Plant a fact from your domain in filler built from your documents at a chosen depth ratio and total length. Use needles that share no words with the filler, so retrieval needs one step of reasoning rather than keyword matching.
2. **Multi needle.** Plant three facts at different depths and ask for all three. Single needle success does not predict this.
3. **Variable tracing.** Plant a chain such as a first value, a second defined from the first and a third defined from the second, and ask for the last one. This is the task that fails first, and it is the one your product does when it combines facts.
4. **Real questions.** A fixed subset of your long documents with answers, graded per category.

### The grid

Depths 0, 0.25, 0.5, 0.75 and 1.0 at each length, because models under attend to the middle. Lengths 1k, 4k, 16k, 64k and your target. Plot pass rate as a heatmap per task type.

### The metrics

Retrieval pass rate, reasoning pass rate, time to first token and cost per query at every length. A million token prompt can take 30 to 120 seconds to prefill, so the product's length budget comes from latency as much as from accuracy.

### The cutoffs

The effective retrieval length is the longest length where the needle grid passes at 90 percent. The effective reasoning length is the longest length where tracing passes at 70 percent. Expect the second to be 25 to 50 percent of the advertised window, and put both on the spec sheet.

### The regression rule

Keep the harness fixed and version it. Run it on every candidate model and publish the deltas per task type. Refuse the model card as evidence, refuse vendor self reported scores, and refuse a needle only result for a multi hop workload.

## Follow-ups

- **Level 3:** Why a fixed harness instead of the newest public benchmark each time? Expected: a regression needs the same test on both models; a changing benchmark confounds the model change with the test change.
- **Level 3:** The new model passes the needle grid at the target length but fails tracing at a quarter of it. What do you ship? Expected: the reasoning effective length as the product limit; chunk or retrieve beyond it and say so on the spec sheet.
- **Level 4:** Prefill at the target length takes two minutes. Does it change the design? Expected: yes; the length budget is what the product can afford in latency and cost, not what the model can read.

## Wrong answers

- "Run the needle test at the advertised length and stop." Needle only says nothing about multi hop; the lesson refuses it for any multi hop workload.
- "Use the vendor's published long context scores." They are self reported; rerun independently on your use case.
- "Test the middle depth at one length." Models under attend to the middle and degrade with length; one point hides both effects.

## Taught in

The [long context evaluation lesson](../../../phases/05-nlp-foundations-to-advanced/28-long-context-evaluation/) gives the battery, the sampling grid, the two cutoffs and the regression rule.
