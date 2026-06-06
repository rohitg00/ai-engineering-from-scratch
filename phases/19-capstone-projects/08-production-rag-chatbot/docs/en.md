# Capstone 08 — Production RAG Chatbot for a Regulated Vertical

> Harvey, Glean, Mendable, and LlamaCloud all run the same production shape in 2026. Ingest with docling or Unstructured and ColPali for visuals. Hybrid search. Re-rank with bge-reranker-v2-gemma. Synthesize with Claude Sonnet 4.7 using prompt caching at 60-80% hit rate. Guard with Llama Guard 4 and NeMo Guardrails. Watch with Langfuse and Phoenix. Grade with RAGAS on a 200-question golden set. Build one in a regulated domain (legal, clinical, insurance), and the capstone is passing the golden set, the red team, and the drift dashboard.

**Type:** Capstone
**Languages:** Python (pipeline + API), TypeScript (chat UI)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P5 · P7 · P11 · P12 · P17 · P18
**Time:** 30 hours

## Problem

Regulated-domain RAG (legal contracts, clinical trial protocols, insurance policies) is the most-shipped production shape of 2026 because the ROI is obvious and the stakes are concrete. Harvey (Allen & Overy) built it for legal. Mendable ships the developer-docs flavor. Glean covers enterprise search. The pattern is: ingest high-fidelity, retrieve hybrid with rerank, synthesize with citation enforcement and prompt caching, guard with multiple safety layers, and monitor drift continuously.

The hard parts are not the model. They are jurisdiction-aware compliance (HIPAA, GDPR, SOC2), citation-level auditability, cost control (prompt caching buys 60-90% discount when hit rate is high), hallucination detection via RAGAS faithfulness, and drift detection when the source documents get updated without the index catching up. This capstone asks you to ship all of it on a 200-question golden set with a red-team suite alongside.

## Concept

The pipeline has two sides. **Ingestion**: docling or Unstructured parses structured documents; ColPali handles visually rich ones; chunks get summaries, tags, and role-based access labels. Vectors go into pgvector + pgvectorscale (under 50M vectors) or Qdrant Cloud; sparse BM25 runs alongside. **Conversation**: LangGraph handles memory and multi-turn; each query runs hybrid retrieval, reranks with bge-reranker-v2-gemma-2b, synthesizes with Claude Sonnet 4.7 (prompt-cached), passes output through Llama Guard 4 and NeMo Guardrails, and emits a citation-anchored response.

The eval stack has four layers. **Golden set** (200 labeled Q/A with citations) for correctness. **Red team** (jailbreaks, PII extraction attempts, off-domain questions) for safety. **RAGAS** for faithfulness / answer relevance / context precision automatically per-turn. **Drift dashboard** (Arize Phoenix) watching retrieval quality and hallucination score weekly.

Prompt caching is the cost lever. Claude 4.5+ and GPT-5+ support caching system prompts + retrieved context. At 60-80% hit rate, per-query cost drops 3-5x. The pipeline must be designed for stable prefixes (system prompt + reranked context first) to achieve high cache hit rates.

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

- Ingestion: Unstructured.io or docling for structured documents; ColPali for visually-rich PDFs
- Vector DB: pgvector + pgvectorscale under 50M vectors; Qdrant Cloud otherwise
- Sparse: Tantivy BM25 with field weights
- Orchestration: LlamaIndex Workflows (ingestion) + LangGraph (conversation)
- Re-ranker: bge-reranker-v2-gemma-2b self-hosted or Voyage rerank-2 hosted
- LLM: Claude Sonnet 4.7 with prompt caching; fallback Llama 3.3 70B self-hosted
- Eval: RAGAS 0.2 online, DeepEval for hallucination and jailbreak suites
- Observability: Langfuse self-hosted with annotation queue; Arize Phoenix for drift
- Guardrails: Llama Guard 4 input/output classifier, NeMo Guardrails v0.12 policy, Presidio PII scrub
- Compliance: role-based access labels on chunks; jurisdiction tags for GDPR/HIPAA

## Build It

1. **Ingestion.** Parse your corpus (1000-10000 documents for a serious build) with Unstructured or docling. For scanned / visual-heavy pages, route through ColPali. Produce chunks with summaries, role-labels, jurisdiction tags.

2. **Index.** Dense embeddings (Voyage-3 or Nomic-embed-v2) into pgvector + pgvectorscale. BM25 side-index via Tantivy. Role and jurisdiction filters as payload.

3. **Hybrid retrieve.** Filter by role+jurisdiction first; then parallel dense + BM25; merge with reciprocal rank fusion; top-20 to reranker; top-5 to synth.

4. **Synthesize with prompt caching.** System prompt + static policies in cache header; reranked context as cache extension; user question as uncached suffix. Target 60-80% cache hit rate in steady state.

5. **Guardrails.** Llama Guard 4 on input; NeMo Guardrails rails block off-domain questions or policy-forbidden topics; Presidio scrubs accidental PII in the output; citation enforcement post-filter.

6. **Golden set.** 200 Q/A pairs labeled by a domain expert with (answer, citations). Score agent on exact-citation match, answer correctness, faithfulness (RAGAS).

7. **Red team.** 50 adversarial prompts: jailbreaks (PAIR, TAP), PII exfiltration attempts, off-domain, cross-jurisdiction leaks. Score with pass/fail and severity.

8. **Drift dashboard.** Arize Phoenix tracks retrieval quality (nDCG, citation faithfulness) weekly. Alert on 5% drop.

9. **Cost report.** Langfuse: prompt-caching hit rate, tokens per query, $/query breakdown by stage.

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

`outputs/skill-production-rag.md` describes the deliverable. A regulated-domain chatbot deployed with compliance labels, passed through the rubric, observed with live drift monitoring.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RAGAS faithfulness + answer relevance | Online scores on the golden set (200 Q/A) |
| 20 | Citation correctness | Fraction of answers with verifiable source anchors |
| 20 | Guardrail coverage | Llama Guard 4 pass rate + jailbreak suite results |
| 20 | Cost / latency engineering | Prompt-cache hit rate, p95 latency, $/query |
| 15 | Drift monitoring dashboard | Phoenix live dashboard with weekly retrieval-quality trend |
| **100** | | |

## Exercises

1. Build a second corpus slice under a different jurisdiction (e.g., HIPAA alongside GDPR). Demonstrate role+jurisdiction filtering preventing cross-leak on a 20-question cross-jurisdiction probe.

2. Measure prompt-cache hit rate over a week of production traffic. Identify which queries break the cache prefix. Restructure.

3. Add multi-turn memory with a 10k-token summary buffer. Measure whether faithfulness drops as the conversation grows.

4. Swap Claude Sonnet 4.7 for Llama 3.3 70B self-hosted. Measure $/query and faithfulness delta.

5. Add an "unsure" mode: if top reranked scores are below a threshold, the agent says "I do not have confident citations" instead of answering. Measure false-confidence reduction.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Prompt caching | "Cached system + context" | Claude/OpenAI feature: cached prefix tokens discounted 60-90% on hit |
| RAGAS | "RAG evaluator" | Automated scoring of faithfulness, answer relevance, context precision |
| Golden set | "Labeled eval" | 200+ expert-labeled Q/A with citations; the ground truth |
| Jurisdiction tag | "Compliance label" | GDPR/HIPAA/SOC2 scope attached to chunks; enforced by retrieval filter |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims backed by retrievable source spans |
| Drift | "Retrieval quality decay" | Weekly change in nDCG or citation score; alert threshold 5% |
| Red team | "Adversarial eval" | Pre-release jailbreak, PII extraction, off-domain probes |

## Further Reading

- [Harvey AI](https://www.harvey.ai) — reference legal production stack
- [Glean enterprise search](https://www.glean.com) — reference RAG at enterprise scale
- [Mendable documentation](https://mendable.ai) — developer-docs RAG reference
- [LlamaCloud Parse + Index](https://docs.llamaindex.ai/en/stable/examples/llama_cloud/llama_parse/) — managed ingestion
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — the cost-lever reference
- [RAGAS 0.2 documentation](https://docs.ragas.io/) — the canonical RAG eval framework
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — reference drift observability
- [Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) — 2026 safety classifier
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — policy rail framework
