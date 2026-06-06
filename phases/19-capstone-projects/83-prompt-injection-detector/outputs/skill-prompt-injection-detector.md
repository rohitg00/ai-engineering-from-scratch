---
name: skill-prompt-injection-detector
description: Layered detector pipeline that returns a category and confidence for any prompt, with measurable precision and recall
version: 1.0.0
phase: 19
lesson: 83
tags: [safety, detector, prompt-injection]
---

# Prompt Injection Detector

A detector here is a function from prompt to verdict. A verdict carries a category from the lesson 82 taxonomy and a confidence in [0, 1].

## Pipeline

1. Normalize - strip zero-width characters, undo homoglyphs, decode base64/hex, fold leet-speak digits, attempt rot13 with a common-words sanity check.
2. Substring rules - hand-written needles such as `ignore previous`, `from now on you are`, `decode this base64`.
3. Regex rules - token-level patterns such as `\bignor\w*\s+(all|prior|previous|earlier)\b`.

Aggregation keeps the maximum score per category and returns the category with the largest score, or `benign` if nothing fires.

## Adding a rule

Edit `code/rules.py`. A rule is a dictionary with `name`, `category` (one of the six taxonomy categories), `score` (float 0 to 1), and one of `substring` or `regex`. Re-run `main.py` to see the impact on per-category precision and recall.

## Artifact

`outputs/detector_report.json` is the per-category metrics file. The end to end gate in lesson 87 reads it to threshold confidence.
