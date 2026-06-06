# Batch APIs — the 50% Discount as Industry Standard

> Every major provider ships an async batch API with a 50% discount and ~24-hour turnaround. OpenAI, Anthropic, Google, and most of the inference platforms (Fireworks batch tier, Together batch) implement the same pattern. Stack batch with prompt caching and overnight pipelines drop to ~10% of synchronous-uncached cost. The rule is brutally simple: if it is not interactive, it belongs on batch. Content generation pipelines, document classification, data extraction, report generation, bulk labeling, catalog tagging — anything tolerant of 24-hour latency is money left on the table until it moves to batch. The 2026 production pattern is to triage every new LLM workload into three lanes: interactive (synchronous with caching), semi-interactive (async queue with fallback), batch (overnight, cached input stacked). Workloads that pretend to be interactive but tolerate minutes of latency waste most.

**Type:** Learn
**Languages:** Python (stdlib, toy batch-vs-sync cost simulator)
**Prerequisites:** Phase 17 · 14 (Prompt & Semantic Caching)
**Time:** ~45 minutes

## Learning Objectives

- Name the three provider batch APIs (OpenAI, Anthropic, Google) and the common 50% discount + 24h turnaround guarantees.
- Compute the cost for stacking batch + cached-input on an overnight classification workload and compare to synchronous-uncached baseline.
- Triage a workload into interactive / semi-interactive / batch and justify the lane.
- Name the two traps: partial interactivity (user expects faster than 24h) and output-schema drift (batch file format differs per provider).

## The Problem

Your team ships a nightly report generation pipeline. 50,000 documents, summarize each, cluster the summaries, draft an executive brief. Running synchronously it takes 4 hours at $2,000/night. You hear about batch APIs.

The batch gets you 50% off. You also enable prompt caching on the system prompt (shared across all 50k calls). Stacked, the bill drops to $180/night — ~9% of baseline. Same pipeline, three config changes.

Batch is the cheapest lever in the LLM cost toolkit that nobody pulls. The reason is mostly organizational: teams think "real-time" when the SLA actually is "by morning." This lesson is about not leaving 90% of the bill on the table.

## The Concept

### The three batch APIs

**OpenAI Batch API**: JSONL file upload with a list of requests. Promised 24-hour turnaround (usually ~2-8 hours in practice). 50% discount on input and output tokens. `/v1/batches` endpoint. Cache-eligible inputs also get cached-input pricing on top.

**Anthropic Message Batches**: JSONL upload. 24-hour turnaround. 50% discount. Supports `cache_control` — cache writes are explicit, reads happen automatically within the batch.

**Google Vertex AI Batch Prediction**: BigQuery or GCS input. Similar 50% discount for Gemini. Integrates with Vertex pipelines.

### Semantic: asynchronous, not slow

Batch is "I promise to return within 24 hours" — not "this will take 24 hours." Typical P50 is 2-6 hours. Provider schedules your batch during off-peak windows when GPU inventory is underutilized.

### Stack with caching

A 50k-document summarization with the same 4K-token system prompt:

- Synchronous uncached: 50000 × ($input × 4000 + $output × 200) at full rates.
- Synchronous cached: system prompt cached after first write; remaining 49999 get 10x cheaper input.
- Batch cached: all of the above plus 50% discount on both read and write.

The stack: batch + cache = ~10% of sync uncached bill. Any workload that runs overnight and has a shared system prompt should use this.

### Workload triage

**Interactive** — user waits for the response. TTFT matters. Synchronous call with prompt caching. Cannot batch.

**Semi-interactive** — user submits a task, checks back in minutes. Async queue with fallback to sync if batch not available. Think moderate-volume RAG indexing.

**Batch** — user expects results "by morning" or "next hour." Content pipelines, classification at scale, offline analysis. Always batch, always stack caching.

Common mistake: classifying everything as interactive because the pipeline is production. Production is not a latency spec — SLA is.

### The partial-interactivity trap

Some features look interactive but tolerate 5-10 minutes. Example: a nightly customer health report with "refresh" button. User clicks refresh; wait 10 minutes is fine. Team ships it as synchronous. 50 concurrent refreshes cost 10x what batched-and-delivered-via-email would cost.

The question to ask: "What does 24-hour mean for this user?" If the answer is "they wouldn't notice," batch it.

### The output-schema trap

Batch file formats differ per provider:

- OpenAI: JSONL, one request per line.
- Anthropic: JSONL, one message per line; response format embedded.
- Vertex: BigQuery table or GCS prefix with TFRecord.

Writing "one batch client" across providers means adapter code per provider. Gateways that advertise multi-provider batch (Portkey, LiteLLM some tiers) still thin-wrap the raw format.

### Numbers you should remember

- Batch discount across providers: 50% flat on input + output.
- Turnaround SLA: 24 hours guaranteed, 2-6 hours typical P50.
- Stacked batch + cached input: ~10% of sync uncached cost.
- Workload triage rule: if 24h latency acceptable, always batch.

## Use It

`code/main.py` computes costs across sync, sync+cache, batch, and batch+cache for a 50k-document workload. Reports savings in $ and percent.

## Ship It

This lesson produces `outputs/skill-batch-triager.md`. Given workload characteristics, triages into interactive/semi/batch and estimates savings.

## Exercises

1. Run `code/main.py`. For a 100k-doc pipeline with 3K-token system prompt and 500-token output, compute the savings of full stack (batch + cache) vs sync baseline.
2. Pick three features in a real product you know. Triage each into interactive/semi/batch.
3. A user complains their report took 3 hours. Was that a batch mis-triage or a legitimate interactive? Write the decision criterion.
4. Your batch API return SLA is 24h but P99 is 20 hours. How do you communicate this to the user — what is the downstream system behavior on the edge case?
5. Compute break-even: at what shared-prefix length does batch + cache become cheaper than running overnight on your own reserved GPU?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Batch API | "async discount" | 50% off with 24h turnaround |
| JSONL | "batch format" | One JSON request per line; OpenAI/Anthropic standard |
| Message Batches | "Anthropic batch" | Anthropic's batch API product name |
| Batch prediction | "Vertex batch" | Vertex AI's batch API product |
| Turnaround SLA | "24h promise" | Guarantee, not typical; typical is 2-6h |
| Workload triage | "interactivity decision" | Interactive / semi / batch routing decision |
| Output schema | "response format" | Per-provider JSONL layout; not portable |
| Stacked discount | "batch + cache" | ~10% of uncached sync bill when both apply |

## Further Reading

- [OpenAI Batch API](https://platform.openai.com/docs/guides/batch) — JSONL format and `/v1/batches` semantics.
- [Anthropic Message Batches](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing) — batch format and `cache_control` interaction.
- [Vertex AI Batch Prediction](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/batch-prediction) — Gemini batch semantics.
- [Finout — OpenAI vs Anthropic API Pricing 2026](https://www.finout.io/blog/openai-vs-anthropic-api-pricing-comparison)
- [Zen Van Riel — LLM API Cost Comparison 2026](https://zenvanriel.com/ai-engineer-blog/llm-api-cost-comparison-2026/)
