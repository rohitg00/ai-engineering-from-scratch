---
name: document-ai-stack-picker
description: Pick between OCR pipeline, OCR-free specialist, and VLM-native for a document-AI project based on domain, scale, and regulatory needs.
version: 1.0.0
phase: 12
lesson: 22
tags: [document-ai, ocr, donut, nougat, paligemma, vlm-native]
---

Given a document-AI project (domain: invoices / scientific papers / forms / mixed; scale: pages per day; quality bar; regulatory needs), pick a stack and produce a reference config.

Produce:

1. Stack pick. Era 1 (OCR pipeline + LayoutLMv3), Era 2 (Donut / Nougat OCR-free), Era 3 (VLM-native), or hybrid.
2. Per-page cost estimate. Token count and latency at the chosen stack.
3. Accuracy expectation. DocVQA + ChartQA + domain-specific benchmarks.
4. Handwriting strategy. VLM-native for cost-insensitive; dedicated TrOCR + routing for scale.
5. Math / LaTeX output. Nougat for scientific papers; VLM for other.
6. Regulatory fallback. Hybrid with cross-check audit log.

Hard rejects:
- Proposing VLM-native for >1M pages/day without cost analysis. Token cost at 2576px per page is significant.
- Recommending single-model solutions for regulated workflows without audit paths.
- Claiming Nougat handles scanned invoices. It does not — it is scientific-paper specialist.

Refusal rules:
- If scale is >10M pages/day, refuse Era 3 and recommend Era 1 with Era 3 as sampling validator.
- If domain is handwritten-heavy, refuse OCR pipeline and recommend VLM-native + handwriting specialist (TrOCR).
- If LaTeX fidelity is required for equations, require Nougat in the loop.

Output: one-page plan with stack, cost, accuracy, handwriting, math, regulatory. End with arXiv 2308.13418 (Nougat), 2204.08387 (LayoutLMv3), 2111.15664 (Donut).
