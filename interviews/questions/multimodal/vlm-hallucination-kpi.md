---
id: vlm-hallucination-kpi
title: Monitor a deployed VLM for invented objects
card: multimodal
kind: design
level: 3
roles: [ai-evaluation-reliability-engineer, forward-deployed-ai-engineer, applied-ai-engineer]
rounds: [system-design, design-review]
tags: [hallucination, monitoring, cmer, production]
minutes: 15
lessons: [phases/04-computer-vision/25-vision-language-models]
manuals: []
practice: []
cheatsheet: [vlm-model-families, genai-observability]
related: [multimodal/spatial-reasoning-limit]
updated: 2026-11-03
---

Your deployed vision-language model answers questions about product photos. Support tickets say that it invents objects and misreads numbers, but the offline benchmark score is fine. Design the production monitoring and the response plan.

## Short answer

Treat hallucination as a production metric, not as a model property. Score every answer with a cross-modal error rate: embed the image and the generated text with an independent contrastive checker, and flag outputs where the text confidence is high but the image-text similarity is low. Track that rate per endpoint, per prompt type and per customer, alert on a rise, and route the flagged answers to human review instead of to the user. The team that introduced the metric cut its hallucination rate by about 35 percent this way, without a model change.

## Full answer

### Why the benchmark does not see it

About 12 percent of the image and text pairs in crawled training data describe things that are not fully in the image. A model trained on them learns to say plausible things the image does not support, and benchmarks built from the same kind of data reward plausibility. In production the inputs are your photos, your questions and your numbers, and this failure is the dominant one.

### The metric

```python
def cross_modal_error_rate(image_emb, text_emb, text_confidence, sim_threshold=0.25, conf_threshold=0.8):
    image_emb = F.normalize(image_emb, dim=-1)
    text_emb = F.normalize(text_emb, dim=-1)
    sim = (image_emb * text_emb).sum(dim=-1)
    high_conf_low_sim = (text_confidence > conf_threshold) & (sim < sim_threshold)
    return high_conf_low_sim.float().mean().item()
```

The text confidence is the mean per-token probability of the answer. The checker is a contrastive image-text model that is independent of the generator. The two thresholds come from your own data: calibrate them on a labelled sample of grounded and hallucinated answers.

### The dashboard

- The rate per endpoint, per prompt type and per customer, over time.
- The rate split by image source and resolution, because a new camera or a new upload path shifts it.
- A sample of flagged answers for a weekly read, with the label a reviewer gave.
- An alert on a rise above a baseline window.

### The response plan

1. Route. A flagged answer goes to a review queue, or returns a hedged response that shows the image region, not a confident wrong number. An answer whose numbers fail the text-recognition check also goes to the review queue, even when the whole-image rate does not flag it.
2. Read. The weekly sample tells you which prompt types fail: numbers, counts, small text.
3. Fix at the data level. Add grounded examples for the failing prompt types, and tiling or a higher resolution for small text and numbers.
4. Re-measure with the same metric before and after each change.

### Limits of the metric

A contrastive checker scores whole-image similarity, so it misses a wrong digit in an otherwise matching description. Pair it with task checks: parse the numbers in the answer and compare them with a text-recognition pass, or ask the model for the region it read and check that the region is not empty.

## Follow-ups

- **Level 3:** Why an independent checker and not the model's own confidence? Expected: the model is confident when it hallucinates, which is the failure; the checker gives a second opinion that does not share the generator's blind spots.
- **Level 3:** How do you set the two thresholds? Expected: label a few hundred answers as grounded or not, sweep the thresholds, and pick the pair that catches most hallucinations at a review load the team can afford.
- **Level 4:** The rate rises for one customer only. What do you check? Expected: their image source: resolution, lighting, a new product line with text the model misreads; the per-customer split exists for that reason.
- **Level 4:** How do you decide between a model change and a routing change? Expected: routing is cheap and immediate and protects users today; a model change needs grounded data and a re-measurement; do both in that order and let the metric arbitrate.

## Wrong answers

- "Raise the benchmark score and the hallucinations will go away." The benchmark rewards plausible text; the production failure is confident text the image does not support, which the benchmark does not measure.
- "Add a system prompt that says do not hallucinate." The model does not know when it hallucinates; a prompt does not create grounding, and only a measurement and a review route reduce the harm.
- "Block every answer with a low image-text similarity." Low similarity with low confidence is often a right answer about a hard image; the signal is high confidence with low similarity.

## Taught in

The [vision-language models lesson](../../../phases/04-computer-vision/25-vision-language-models/) defines the cross-modal error rate, gives the code, and reports the production result.
