---
id: spatial-reasoning-limit
title: A general VLM for which shelf the item is on
card: multimodal
kind: tradeoff
level: 2
roles: [forward-deployed-ai-engineer, applied-ai-engineer]
rounds: [customer, system-design]
tags: [spatial-reasoning, evaluation, vlm-limits, fine-tuning]
minutes: 10
lessons: [phases/04-computer-vision/25-vision-language-models]
manuals: []
practice: []
cheatsheet: [vlm-model-families]
related: [multimodal/vlm-three-parts]
updated: 2026-11-03
---

A warehouse team wants a general vision-language model to answer "which shelf is the item on" and "is the box on top of or under the pallet" from camera frames. They plan to ship as soon as a demo works on ten images. What do you tell them?

## Short answer

Spatial relations are the weak spot of today's general-purpose vision-language models: on benchmarks of above and below, left and right, counting and distance they score about 50 to 60 percent, below human level. A demo on ten images proves nothing about that distribution. Build a labelled eval of a few hundred frames with the exact questions first, measure the model, and compare it with a specialised detection or depth model whose box geometry you post-process; if the general model stays, fine-tune it on the task and keep a human-review route for low-confidence answers.

## Full answer

### Why the general model struggles

The model sees projected patch tokens and reasons in language. It learned what is in an image from caption pairs that rarely say where exactly. The lesson's figure for spatial reasoning benchmarks is 50 to 60 percent, and its recommended alternatives for pure spatial tasks are a keypoint or pose estimator, a depth model, or a detector with the box geometry post-processed.

### What a real eval looks like

- A few hundred frames from the warehouse cameras, not stock photos, with the two question types written the way the operators will ask them.
- Labels from two people, with the agreement measured.
- A split by lighting and camera position, because the demo images will not cover them.
- A confusion matrix per question type, not one accuracy number.

### The alternatives

| Approach | Strength | Cost |
|---|---|---|
| Detector plus box geometry | exact image-plane above, under, left and right from coordinates | labels for the object classes; no language interface |
| Depth model plus detector | distance and stacking | calibration per camera |
| General VLM, zero-shot | any question in plain language | weak on spatial relations; hallucination risk |
| General VLM, fine-tuned | a plain-language interface with the domain learned | 5,000 to 50,000 labelled examples and hours of GPU time |

### If the VLM stays

Fine-tune with low-rank adapters on the attention and projector layers, which the lesson sizes at rank 16 to 64 on one datacenter GPU for 2 to 10 hours. Then monitor hallucination in production: a cross-modal error rate flags answers where the text confidence is high but the image-text similarity is low, and routes them to review.

### What to tell them

Ship a measured system, not a demo. Ten images is a smoke test. The eval decides between the detector route and the fine-tuned model, and the hallucination monitor stays whichever route wins.

## Follow-ups

- **Level 2:** Why does a model that captions well fail at which object is on top? Expected: captions describe content, not geometry; the training pairs rarely contain precise relations, and fine position fades as the language model reasons over projected tokens.
- **Level 2:** What does the detector route lose? Expected: the plain-language interface and the open vocabulary; it answers only the relations you compute from boxes, for the classes you labelled.
- **Level 3:** How many frames does the eval need, and how do you decide? Expected: enough that each question type and each camera condition has tens of examples; a few hundred in total is the floor, and you grow it where the confusion matrix is unstable.
- **Level 3:** How does a stronger encoder change the picture? Expected: self-supervised encoders carry more dense spatial features and lead vision-centric benchmarks; swapping the encoder and retraining the projector is the lesson's hard exercise for these tasks.

## Wrong answers

- "The demo worked on ten images, so it works." Ten images cannot cover the cameras, the lighting or the relation types; the benchmark figure for this kind of question is near a coin flip for some relations.
- "A bigger VLM will fix spatial reasoning." Size lifts language reasoning more than geometry; the lesson's advice for pure spatial tasks is a specialised model.
- "Fine-tune on the demo images." Tens of examples teach nothing and overfit; the fine-tuning route needs thousands of labelled frames and an eval that is separate from them.

## Taught in

The [vision-language models lesson](../../../phases/04-computer-vision/25-vision-language-models/) gives the spatial reasoning figure, the fine-tuning budget and the cross-modal error rate.
