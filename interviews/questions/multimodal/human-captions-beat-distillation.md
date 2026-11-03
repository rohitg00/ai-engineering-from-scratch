---
id: human-captions-beat-distillation
title: Dense human captions or two million distilled ones
card: multimodal
kind: tradeoff
level: 3
roles: [ai-data-engineer, applied-ai-engineer]
rounds: [system-design, ml-breadth]
tags: [data-quality, captions, distillation, grounding]
minutes: 12
lessons: [phases/12-multimodal-ai/07-open-weight-vlm-recipes, phases/04-computer-vision/25-vision-language-models, phases/12-multimodal-ai/05-llava-visual-instruction-tuning]
manuals: []
practice: []
cheatsheet: [vlm-model-families]
related: [multimodal/which-knob-first]
updated: 2026-11-03
---

You can spend your data budget on one of two things: have a strong proprietary model write captions for two million images, or pay people to describe seven hundred thousand images in detail by speaking for a minute or more about each one. Which do you choose for a new vision-language model, and what is the evidence?

## Short answer

Pay the people. The reference result is a model trained on 712K densely captioned images and no distilled captions that beat a much larger model on 11 of 11 benchmarks. Dense human captions carry 5 to 10 times the information of a short web caption and stay grounded in the image, while distilled captions inherit the hallucinations of the model that wrote them; about 12 percent of crawled pairs already describe things that are not in the image. Caption density beats caption quantity, which beats distillation convenience.

## Full answer

### The evidence

- The dense-caption recipe: annotators described each image for one to three minutes in speech, transcribed to text, which gave 712K densely captioned images. The 72B model trained on them beat a 90B competitor on every one of 11 benchmarks. The difference was not architecture.
- Two other datasets followed the same path with mixed human and synthetic captions, and the trend across them is that density wins.
- The first visual instruction set was written by a text-only model from captions and boxes without seeing the image, 158k turns; it worked to unlock dialogue, with noise.

### Why density beats volume

A dense caption of 80 to 300 tokens names objects, counts, relations, text in the image and context; a web alt text names one thing. For alignment and instruction tuning the model learns from what the caption says about the image, so the information per image is the currency, not the image count.

### Why distillation is risky

The writing model does not see what it does not see. It hallucinates plausible content, and the student learns to hallucinate with the same confidence. A benchmark built from similar data does not punish it; production users do.

### When distillation still has a place

- Bootstrapping a new domain fast, before human data arrives.
- Generating questions and answers from a human-written caption, which keeps the grounding in the caption.
- Filtered: score each synthetic caption against the image with a contrastive checker and drop the ungrounded tail.

### What to do with the budget

Dense human captions for the alignment and instruction stages, task-specific instruction data on top, and synthetic data only where a human caption anchors it. Measure grounding on a held-out human-labelled set, not only benchmark accuracy.

## Follow-ups

- **Level 3:** Why did the speech-based collection matter? Expected: people say far more in a minute than they type, so the captions are long and specific at a cost that scales.
- **Level 3:** How do you check that a synthetic caption is grounded? Expected: embed the image and the caption with a contrastive checker and flag low similarity, then read a sample; drop or rewrite the tail.
- **Level 4:** How would you prove to a skeptic that the gain is data and not model size? Expected: the reference comparison beat a larger model; replicate at one size with two data mixes and the same encoder, connector and schedule.
- **Level 4:** Where in the three-stage pipeline do dense captions pay most? Expected: alignment and the first instruction stage, where the projector and the language model learn what an image contains; task-specific data pays in the last stage.

## Wrong answers

- "Two million captions beat seven hundred thousand; more data wins." The reference result beat a larger model with fewer, denser, grounded captions; volume of thin or hallucinated captions is no substitute.
- "The strong model's captions are better than what annotators write." They are longer than web captions but not grounded; the model describes what it expects, and the student learns the same habit.
- "Caption quality only matters for captioning tasks." The reference model gained on every benchmark, reasoning and reading included, because the alignment stage learned more about each image.

## Taught in

The [open-weight recipes lesson](../../../phases/12-multimodal-ai/07-open-weight-vlm-recipes/) gives the dense-caption result and the data axis, the [vision-language models lesson](../../../phases/04-computer-vision/25-vision-language-models/) quantifies the ungrounded pairs, and the [LLaVA lesson](../../../phases/12-multimodal-ai/05-llava-visual-instruction-tuning/) shows the generated instruction data that started the field.
