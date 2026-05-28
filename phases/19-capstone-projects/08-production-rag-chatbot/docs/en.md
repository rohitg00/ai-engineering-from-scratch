# Capstone 08 — Regulated Vertical 向け Production RAG Chatbot

> Harvey、Glean、Mendable、LlamaCloud は2026年に同じ production shape を走らせています。docling または Unstructured で ingest し、visual は ColPali。hybrid search。bge-reranker-v2-gemma で re-rank。prompt caching hit rate 60-80% の Claude Sonnet 4.7 で synthesize。Llama Guard 4 と NeMo Guardrails で guard。Langfuse と Phoenix で watch。200問の golden set を RAGAS で grade。regulated domain (legal、clinical、insurance) で1つ作り、golden set、red team、drift dashboard を通過します。

**種別:** Capstone
**言語:** Python (pipeline + API), TypeScript (chat UI)
**前提条件:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P5 · P7 · P11 · P12 · P17 · P18
**所要時間:** 30時間

## 問題

regulated-domain RAG (legal contracts、clinical trial protocols、insurance policies) は2026年に最も多く production に出た形です。ROI が明確で、stakes が具体的だからです。Harvey は legal 向けに作りました。Mendable は developer-docs 版を出しています。Glean は enterprise search をカバーします。pattern は、高忠実度 ingest、hybrid retrieval + rerank、citation enforcement と prompt caching 付き synthesis、多層 safety guard、continuous drift monitoring です。

難しいのは model ではありません。jurisdiction-aware compliance (HIPAA, GDPR, SOC2)、citation-level auditability、cost control (prompt caching は hit rate が高いと 60-90% discount を生む)、RAGAS faithfulness による hallucination detection、source document が更新されたのに index が追いつかない drift detection です。この capstone では、200問の golden set と red-team suite に対してすべてを出荷します。

## コンセプト

pipeline は2つの側面を持ちます。**Ingestion**: docling または Unstructured が structured document を parse し、ColPali が visually rich なものを処理します。chunk には summary、tag、role-based access label を付けます。vector は 50M vectors 未満なら pgvector + pgvectorscale、または Qdrant Cloud に入り、sparse BM25 も並走します。**Conversation**: LangGraph が memory と multi-turn を処理します。各 query は hybrid retrieval、bge-reranker-v2-gemma-2b で rerank、Claude Sonnet 4.7 (prompt-cached) で synthesize、Llama Guard 4 と NeMo Guardrails で guard され、citation-anchored response を出します。

eval stack は4層です。**Golden set** (citation 付き200 labeled Q/A) で correctness。**Red team** (jailbreak、PII extraction attempt、off-domain question) で safety。**RAGAS** で per-turn の faithfulness / answer relevance / context precision を自動評価。**Drift dashboard** (Arize Phoenix) が retrieval quality と hallucination score を週次で監視します。

prompt caching が cost lever です。Claude 4.5+ と GPT-5+ は system prompt + retrieved context の caching に対応しています。60-80% hit rate では per-query cost が 3-5x 下がります。高い hit rate を得るには、stable prefix (system prompt + reranked context first) を保つよう pipeline を設計しなければなりません。

## Architecture

```
documents (contracts, protocols, policies)
      |
      v
docling / Unstructured parse + ColPali for visuals
      |
      v
chunks + summaries + role-labels + jurisdiction tags
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
query + role + jurisdiction
      |
      v
LangGraph conversational agent
   +--- retrieve (hybrid)
   +--- filter by role + jurisdiction
   +--- rerank (bge-reranker-v2-gemma-2b or Voyage rerank-2)
   +--- synthesize (Claude Sonnet 4.7, prompt cached)
   +--- guard (Llama Guard 4 + NeMo Guardrails + Presidio output PII scrub)
   +--- cite + return
      |
      v
eval:
  RAGAS faithfulness / answer_relevance / context_precision (online)
  Langfuse annotation queue (sampled)
  Arize Phoenix drift (weekly)
  red team suite (pre-release)
```

## Stack

- Ingestion: structured document は Unstructured.io または docling、visually-rich PDF は ColPali
- Vector DB: 50M vectors 未満は pgvector + pgvectorscale、それ以外は Qdrant Cloud
- Sparse: field weight 付き Tantivy BM25
- Orchestration: ingestion は LlamaIndex Workflows、conversation は LangGraph
- Re-ranker: self-hosted bge-reranker-v2-gemma-2b または hosted Voyage rerank-2
- LLM: prompt caching 付き Claude Sonnet 4.7、fallback は self-hosted Llama 3.3 70B
- Eval: online RAGAS 0.2、hallucination / jailbreak suite は DeepEval
- Observability: annotation queue 付き self-hosted Langfuse、drift は Arize Phoenix
- Guardrails: Llama Guard 4 input/output classifier、NeMo Guardrails v0.12 policy、Presidio PII scrub
- Compliance: chunk 上の role-based access label、GDPR/HIPAA 用 jurisdiction tag

## 実装

1. **Ingestion.** corpus (serious build なら1000-10000 documents) を Unstructured または docling で parse します。scanned / visual-heavy page は ColPali に route します。summary、role-label、jurisdiction tag 付き chunk を生成します。

2. **Index.** dense embeddings (Voyage-3 または Nomic-embed-v2) を pgvector + pgvectorscale に入れます。Tantivy で BM25 side-index を作ります。role と jurisdiction は payload filter にします。

3. **Hybrid retrieve.** まず role+jurisdiction で filter します。その後 dense + BM25 を parallel に走らせ、reciprocal rank fusion で merge します。top-20 を reranker、top-5 を synth へ送ります。

4. **Synthesize with prompt caching.** system prompt + static policies を cache header に、reranked context を cache extension に、user question を uncached suffix にします。steady state で 60-80% cache hit rate を目標にします。

5. **Guardrails.** input は Llama Guard 4、off-domain や policy-forbidden topic は NeMo Guardrails rails、output の accidental PII は Presidio で scrub、citation enforcement は post-filter で行います。

6. **Golden set.** domain expert が (answer, citations) 付きで label した200 Q/A pair を作ります。exact-citation match、answer correctness、faithfulness (RAGAS) で agent を score します。

7. **Red team.** 50 adversarial prompts を作ります: jailbreak (PAIR, TAP)、PII exfiltration attempts、off-domain、cross-jurisdiction leaks。pass/fail と severity で score します。

8. **Drift dashboard.** Arize Phoenix が retrieval quality (nDCG、citation faithfulness) を週次で追跡します。5% drop で alert します。

9. **Cost report.** Langfuse で prompt-caching hit rate、query あたり tokens、stage 別 $/query breakdown を出します。

## Use It

```
$ chat --role=analyst --jurisdiction=GDPR
> what is the data-retention obligation for EU user profiles under our contract?
[retrieve]  hybrid top-20 filtered to GDPR + analyst-role
[rerank]    top-5 kept
[synth]     claude-sonnet-4.7, cache hit 74%, 0.8s
answer:
  The contract (Section 12.4, Master Services Agreement dated 2024-03-11)
  obligates EU user profile deletion within 30 days of termination per GDPR
  Article 17. The DPA amendment (DPA-v2.1, Section 5) extends this to 14 days
  for "restricted" category data.
  citations: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## Ship It

`outputs/skill-production-rag.md` が deliverable を説明します。compliance label 付きで deploy され、rubric を通過し、live drift monitoring で観測される regulated-domain chatbot です。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RAGAS faithfulness + answer relevance | golden set (200 Q/A) 上の online scores |
| 20 | Citation correctness | verifiable source anchor を持つ answer の割合 |
| 20 | Guardrail coverage | Llama Guard 4 pass rate + jailbreak suite results |
| 20 | Cost / latency engineering | prompt-cache hit rate、p95 latency、$/query |
| 15 | Drift monitoring dashboard | weekly retrieval-quality trend を持つ Phoenix live dashboard |
| **100** | | |

## Exercises

1. 異なる jurisdiction の2つ目の corpus slice (例: GDPR と HIPAA) を作ります。20-question cross-jurisdiction probe で role+jurisdiction filtering が cross-leak を防ぐことを示します。

2. production traffic 1週間分で prompt-cache hit rate を測ります。cache prefix を壊す query を特定し、restructure します。

3. 10k-token summary buffer を持つ multi-turn memory を追加します。conversation が長くなるにつれて faithfulness が落ちるか測ります。

4. Claude Sonnet 4.7 を self-hosted Llama 3.3 70B に差し替えます。$/query と faithfulness delta を測ります。

5. "unsure" mode を追加します。top reranked score が threshold 未満なら agent は回答せず「確信できる citation がありません」と言います。false-confidence reduction を測ります。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Prompt caching | 「Cached system + context」 | Claude/OpenAI feature。hit 時に cached prefix token が 60-90% discount される |
| RAGAS | 「RAG evaluator」 | faithfulness、answer relevance、context precision の automated scoring |
| Golden set | 「Labeled eval」 | citation 付き200+ expert-labeled Q/A。ground truth |
| Jurisdiction tag | 「Compliance label」 | chunk に付く GDPR/HIPAA/SOC2 scope。retrieval filter が強制する |
| Citation faithfulness | 「Grounded answer rate」 | claim が retrievable source span に裏付けられる割合 |
| Drift | 「Retrieval quality decay」 | nDCG または citation score の週次変化。alert threshold は5% |
| Red team | 「Adversarial eval」 | pre-release jailbreak、PII extraction、off-domain probe |

## 参考文献

- [Harvey AI](https://www.harvey.ai) — reference legal production stack
- [Glean enterprise search](https://www.glean.com) — enterprise scale RAG reference
- [Mendable documentation](https://mendable.ai) — developer-docs RAG reference
- [LlamaCloud Parse + Index](https://docs.llamaindex.ai/en/stable/examples/llama_cloud/llama_parse/) — managed ingestion
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — cost-lever reference
- [RAGAS 0.2 documentation](https://docs.ragas.io/) — canonical RAG eval framework
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — drift observability reference
- [Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) — 2026 safety classifier
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — policy rail framework
