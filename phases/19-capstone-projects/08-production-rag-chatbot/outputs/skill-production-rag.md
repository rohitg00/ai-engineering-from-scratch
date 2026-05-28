---
name: production-rag
description: role + jurisdiction filtering、prompt caching、guardrails、live drift monitoring を備えた regulated-domain RAG chatbot を deploy する。
version: 1.0.0
phase: 19
lesson: 08
tags: [capstone, rag, chatbot, regulated, llama-guard, nemo-guardrails, ragas, langfuse]
---

regulated-domain corpus (legal contracts、clinical trial protocols、insurance policies など) を受け取り、検証可能な citation 付きで回答し、role と jurisdiction の access policy を尊重し、drift を監視する chatbot を deploy する。

構築計画:

1. docling または Unstructured で corpus を parse し、visually rich documents は ColPali へ route する。role label と jurisdiction label 付きの chunk を出力する。
2. dense (Voyage-3 または Nomic-embed-v2) を pgvector + pgvectorscale に index し、sparse BM25 は Tantivy で構築する。
3. LangGraph conversational agent を配線する: retrieve (role + jurisdiction で filter、hybrid dense+BM25、reciprocal rank fusion)、rerank (bge-reranker-v2-gemma-2b または Voyage rerank-2)、synth (prompt caching 付き Claude Sonnet 4.7)。
4. stable prefix で prompt を組み立てる: system preamble -> policy block -> reranked context -> user query。steady state で 60-80% prompt-cache hit rate を狙う。
5. guardrails: input/output の Llama Guard 4、off-domain と policy-forbidden questions 用の NeMo Guardrails v0.12 rails、output の Presidio PII scrub、citation enforcement post-filter。
6. domain expert が label した200問の golden set (answer, citations) を作る。exact-citation match、answer correctness、RAGAS faithfulness で score する。
7. 50 prompt の red team (PAIR, TAP, PII extraction, off-domain, cross-jurisdiction probes) を作る。
8. retrieval nDCG と citation faithfulness を週次追跡する Arize Phoenix drift dashboard を作り、5% drop で alert する。
9. Langfuse cost report: prompt-cache hit rate、query あたり tokens、stage 別 $/query。

評価 rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | RAGAS faithfulness + answer relevance | 200-question golden set 上の online scores |
| 20 | Citation correctness | verifiable source anchor を持つ回答の割合 |
| 20 | Guardrail coverage | Llama Guard 4 pass rate + jailbreak suite result |
| 20 | Cost / latency engineering | prompt-cache hit rate、p95 latency、$/query |
| 15 | Drift monitoring dashboard | weekly retrieval-quality trend を持つ live Phoenix dashboard |

ハードリジェクト:

- cross-jurisdiction data を漏らす chatbot。role+jurisdiction filtering は retrieval 前に強制する必要があり、生成後ではない。
- cache prefix を壊す synthesis prompt (system と context の間で policy を並べ替えるなど)。cache economics を破壊する。
- logged red-team runs のない guardrail configuration。
- citation のない回答、または検証不能な anchor の citation。

拒否ルール:

- すべての chunk に jurisdiction tag がない regulated domain deploy を拒否する。
- expert-labeled golden set question で retrieval を train することを拒否する。contamination は eval credibility を壊す。
- README に明示的な SOC2/HIPAA/GDPR applicability matrix なしに「compliant」と主張することを拒否する。

出力: ingestion pipeline、LangGraph conversational agent、200-question golden set、50-prompt red team、Phoenix drift dashboard、Langfuse cost dashboard、観測した上位3つの citation-breakage pattern と、それぞれの retrieval または prompt fix を示す write-up を含むリポジトリ。
