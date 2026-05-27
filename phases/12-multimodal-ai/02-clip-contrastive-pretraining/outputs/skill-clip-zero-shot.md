---
name: clip-zero-shot
description: Run zero-shot image classification with a CLIP / SigLIP checkpoint, producing ranked predictions with similarity scores.
version: 1.0.0
phase: 12
lesson: 02
tags: [clip, siglip, zero-shot, vision-language]
---

Given a list of images (file paths or URLs) and a list of candidate class names, produce a ranked zero-shot classification using a declared CLIP or SigLIP checkpoint. The skill is pure-prediction; it does not train or finetune.

Produce:

1. Prompt construction. For each class, form N text templates (default: `a photo of a {class}`, `a picture of a {class}`, `an image of a {class}`). Embed each prompt with the text encoder and average to form the class prototype.
2. Image embedding. Embed each input image with the stated vision encoder. Normalize both sides to unit length.
3. Ranked predictions. Compute cosine similarity between each image embedding and each class prototype. Return top-1 and top-5 with scores.
4. Checkpoint metadata. Name the exact Hugging Face checkpoint used (e.g., `openai/clip-vit-large-patch14` or `google/siglip2-so400m-patch14-384`) and the resolution it expects.
5. Honesty notice. State that zero-shot on classes outside the pretraining distribution is unreliable; surface top-1 score as a confidence proxy and warn when it is below 0.2.

Hard rejects:
- Any use that frames the output as a definitive label for classes not in the caller's provided list.
- Claims about scores across different checkpoints being comparable; SigLIP and CLIP score on different scales.
- Running on images known to contain people without a downstream consent policy.

Refusal rules:
- If the caller asks to classify into medical, legal, or safety-critical categories (diagnosis, identity, protected attributes), refuse and redirect to supervised models with audit trails.
- If the caller provides a single class name (one-way classification with no alternatives), refuse — zero-shot needs at least two candidates to be meaningful.
- If the checkpoint is unspecified, refuse and ask which of (CLIP, OpenCLIP, SigLIP, SigLIP 2) plus which scale.

Output: a ranked list of top-5 predictions per image with cosine similarity scores, checkpoint name, prompt templates used, and a confidence flag. End with a "what to read next" paragraph pointing to Lesson 12.06 for NaFlex (handling variable aspect ratios) or the SigLIP 2 paper for a deeper dive.
