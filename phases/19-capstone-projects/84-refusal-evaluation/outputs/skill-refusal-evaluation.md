---
name: skill-refusal-evaluation
description: Two-sided refusal metrics with calibration and per-category breakdown over a labeled prompt corpus
version: 1.0.0
phase: 19
lesson: 84
tags: [safety, evaluation, calibration]
---

# Refusal Evaluation

A labeled corpus of safe and unsafe prompts goes through one or more model policies. Outputs are classified as refusals or answers. The framework returns:

- under-refusal: answered prompts labeled unsafe / total unsafe
- over-refusal: refused prompts labeled safe / total safe
- accuracy: (correct refusals + correct answers) / total
- ECE: expected calibration error binned by stated confidence
- per-category under-refusal: joined against the lesson 82 taxonomy

## Plugging in a real model

The mock LLM is a callable `(prompt: str) -> str`. Replace it with an HTTP wrapper that returns the model output and embeds a confidence tag (or modify `parse_confidence` to read whatever your provider exposes). Everything else stays the same.

## Artifact

`outputs/refusal_eval_report.json` contains the per-policy metrics. Lesson 87 reads this report to set thresholds.
