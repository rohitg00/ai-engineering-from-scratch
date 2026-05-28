---
name: doc-qa
description: late-interaction retrieval と evidence-region citation を使い、1万ページ上で vision-first multimodal document QA system を構築する。
version: 1.0.0
phase: 19
lesson: 04
tags: [capstone, multimodal, rag, colpali, colqwen, late-interaction, pdf]
---

PDF corpus (10-K、scientific papers、scanned documents) を受け取り、ColPali-style late interaction でページを画像として index し、page-level evidence region 付きで質問に答える pipeline を構築する。

構築計画:

1. PyMuPDF を使い、180 DPI で各 PDF page を 1536x2048 PNG に render する。
2. 各 page を ColQwen2.5-v0.2 または ColQwen3-omni で embed する。multi-vector patch embeddings を Vespa、Qdrant multi-vector、または AstraDB に保存する。
3. DocPruner-style の 50% patch pruning を適用する。ViDoRe v3 で accuracy drop が 0.5% 未満に収まることを確認する。
4. query 時: query token を embed し、各 page の patch に対して MaxSim を計算し、top-k を rank する。
5. query と top-5 page images を渡して Qwen3-VL-30B または Gemini 2.5 Pro で synthesize する。`(doc_id, page, region)` anchor の citation を必須にする。
6. equation-heavy または table-heavy page には、任意の text channel として Nougat または dots.ocr を走らせ、image と一緒に渡す。
7. source page 上に evidence region を bounding box として overlay する Next.js 15 viewer を構築する。
8. ViDoRe v3 と M3DocVQA で評価する。plain text、tables、charts、handwriting、equations について vision-first と OCR-then-text を比較する content-class x approach matrix を作る。

評価 rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA accuracy | matched pages 上で OCR-then-text baseline と比較した benchmark |
| 20 | Evidence-region grounding | cited region のうち answer span を含む割合 |
| 20 | Storage and latency engineering | DocPruner compression、index p95、2秒未満の answer p95 |
| 20 | Multi-page reasoning | hand-labeled 100-question multi-page set での accuracy |
| 15 | Source-inspection UX | overlay fidelity、comparison tools、page-by-page explorer |

ハードリジェクト:

- OCR text を single-vector embed に後付けして「vision-first」と主張する OCR-first pipeline。
- patch-level bounding box を落とし、evidence overlay を render できない system。
- DocPruner settings を文書化せずに報告された storage numbers。

拒否ルール:

- 専用の redaction policy なしに scanned legal contracts を index することを拒否する。ColQwen embeddings は content を漏らし得る。
- user が開示していない corpus に対して query を提供することを拒否する。regulated domains では audit trail が必須。
- 同じ corpus 上で両 pipeline を走らせずに OCR-then-text と比較することを拒否する。

出力: ingestion pipeline、Vespa (または Qdrant multi-vector) config、100-question multi-page eval set、viewer UI、content-class x approach matrix と、2026年時点でも OCR-then-text が有利な content class について具体的な推奨を含む write-up を持つリポジトリ。
