---
id: which-knob-first
title: Three runs to close a VLM benchmark gap
card: multimodal
kind: tradeoff
level: 3
roles: [applied-ai-engineer, ai-data-engineer]
rounds: [design-review, system-design]
tags: [vlm-recipes, ablation, resolution, data-quality]
minutes: 15
lessons: [phases/12-multimodal-ai/07-open-weight-vlm-recipes, phases/12-multimodal-ai/05-llava-visual-instruction-tuning]
manuals: []
practice: []
cheatsheet: [vlm-model-families, vlm-architectures]
related: [multimodal/llm-size-sets-ceiling]
updated: 2026-11-03
---

You lead a small team training an open vision-language model. The first run lands well below the open-weight models of its size on a general benchmark and on a document-reading benchmark. You can afford three more full runs. Which three changes do you make, in what order, and what do you expect each to move?

## Short answer

Order the runs by the variance each axis explains. First, the resolution schedule and the token count: ramp from a low resolution to a high one and add image splitting for the document benchmark, where moving from 448 to 980 pixels added 3 to 5 points in the ablations. Second, the encoder: swap the common contrastive encoder for the stronger one, which added 3 or more points on the general benchmark, and concatenate a self-supervised encoder if grounding matters. Third, the data: replace distilled synthetic captions with dense human-written ones, which beat the distilled set on every benchmark in the reference comparison; leave the connector alone, because at a fixed token count it moves scores by about a point.

## Full answer

### The evidence behind the order

| Axis | What the ablations found | Expected move |
|---|---|---|
| Visual tokens and resolution | about 60 percent of the variance; 384 to 448 adds 1 to 2 points; 448 to 980 with splitting adds 3 to 5 on reading tasks | the document benchmark |
| Encoder | about 20 percent; a stronger contrastive encoder adds 3 or more; self-supervised features lead vision-centric tests by 5 to 7 | the general benchmark, counting and grounding |
| Data | dense human captions beat distillation on 11 of 11 benchmarks in the reference comparison | both benchmarks, grounded detail most |
| Connector | about 5 percent; within 1 point at a fixed token count | nothing worth a run |
| Language model | 7B to 13B adds 2 to 4 points | both, if the budget allows a larger model |

### Run 1: resolution and tokens

Flat low-resolution training plateaus at medium accuracy. Ramp from 224 to 448 or native, then add splitting for reading tasks up to about 1280 pixels on the long side. The token count explains the most variance, and documents need pixels.

### Run 2: encoder

Swap to the stronger contrastive encoder at native resolution. If the benchmark includes counting or spatial questions, concatenate a self-supervised encoder's features, as the vision-centric recipes do. Retrain the projector; the language model keeps its adapters.

### Run 3: data

Replace distilled captions with dense human captions where you can get them, and top up with task-specific instruction data for the document questions. The reference result: a model trained on 712K densely captioned images with no distilled data beat a much larger competitor on every benchmark listed. Caption density beats caption quantity, which beats distillation convenience.

### What you do not run

A connector ablation. Several controlled studies put it within a point at a fixed token count; the token count is the knob, and run 1 already turned it.

### How to keep the runs comparable

One axis per run, the same eval, the same seed where the framework allows it, and a record of the data mix and the resolution schedule for each. A run that changed two things cannot be credited to either.

## Follow-ups

- **Level 3:** Why does the document benchmark respond to resolution and the general one less? Expected: reading needs pixels per character; general questions need semantics that the encoder already carries at a low resolution.
- **Level 3:** What does a resolution ramp buy over a flat high resolution? Expected: faster alignment early and a higher end point; the ablations show that flat schedules plateau at medium accuracy.
- **Level 4:** You cannot get human captions in time. What is the next best data move? Expected: filter the distilled captions for grounding against the image with a contrastive checker and drop the ungrounded tail; density matters, but ungrounded density teaches hallucination.
- **Level 4:** If a fourth run appears, is it the connector or the language model? Expected: the language model, if memory allows a larger one; it lifts reasoning by points, where the connector moves a fraction of one.

## Wrong answers

- "Start with the connector; it is the cheapest to retrain." Cheap and useless: at a fixed token count it moves scores by about a point in every controlled study.
- "Generate more captions with a stronger proprietary model." Distilled captions inherit hallucinations; the reference comparison shows dense human captions beating distillation across the board.
- "Train longer at the same settings." The ablations put the gap in resolution, encoder and data, not in steps; more steps at a flat low resolution plateau.

## Taught in

The [open-weight recipes lesson](../../../phases/12-multimodal-ai/07-open-weight-vlm-recipes/) gives the five-axis design space and the ablation tables, and the [LLaVA lesson](../../../phases/12-multimodal-ai/05-llava-visual-instruction-tuning/) shows the tiling scheme that the resolution run adds.
