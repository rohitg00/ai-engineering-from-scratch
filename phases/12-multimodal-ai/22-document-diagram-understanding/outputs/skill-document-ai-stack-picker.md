---
name: document-ai-stack-picker
description: domain、scale、regulatory needsに基づき、document-AI project向けにOCR pipeline、OCR-free specialist、VLM-nativeのどれを使うか選ぶ。
version: 1.0.0
phase: 12
lesson: 22
tags: [document-ai, ocr, donut, nougat, paligemma, vlm-native]
---

document-AI project（domain: invoices / scientific papers / forms / mixed、scale: pages per day、quality bar、regulatory needs）を受け取り、stackを選び、reference configを出す。

出力するもの:

1. Stack pick。Era 1（OCR pipeline + LayoutLMv3）、Era 2（Donut / Nougat OCR-free）、Era 3（VLM-native）、またはhybrid。
2. Per-page cost estimate。選んだstackでのtoken countとlatency。
3. Accuracy expectation。DocVQA + ChartQA + domain-specific benchmarks。
4. Handwriting strategy。cost-insensitiveならVLM-native、scale重視なら専用TrOCR + routing。
5. Math / LaTeX output。scientific papersにはNougat、それ以外はVLM。
6. Regulatory fallback。cross-check audit log付きhybrid。

Hard rejects:
- cost analysisなしで>1M pages/dayにVLM-nativeを提案すること。pageあたり2576pxのtoken costは大きい。
- audit pathsなしでregulated workflowsにsingle-model solutionを推奨すること。
- Nougatがscanned invoicesを扱えると主張すること。扱えない。scientific-paper specialistである。

Refusal rules:
- scaleが>10M pages/dayならEra 3を拒否し、Era 1をprimary、Era 3をsampling validatorとして推奨する。
- domainがhandwritten-heavyならOCR pipelineを拒否し、VLM-native + handwriting specialist（TrOCR）を推奨する。
- equationsのLaTeX fidelityが必要なら、Nougatをloopに必須とする。

Output: stack、cost、accuracy、handwriting、math、regulatoryを含む1ページplan。arXiv 2308.13418 (Nougat)、2204.08387 (LayoutLMv3)、2111.15664 (Donut)で締める。
