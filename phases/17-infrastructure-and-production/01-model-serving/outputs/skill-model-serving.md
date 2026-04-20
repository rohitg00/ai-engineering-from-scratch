---
name: skill-model-serving
description: Deploy and operate LLM inference servers with proper queuing, streaming, and metrics
version: 1.0.0
phase: 17
lesson: 1
tags: [model-serving, inference, vllm, streaming, gpu, production]
---

# Model Serving Pattern

Every model server follows this flow:

```
request -> validate -> queue -> batch -> prefill -> decode -> stream -> metrics
```

Prefill processes the entire input prompt in one forward pass. Decode generates tokens one at a time autoregressively.

## When to serve models yourself

- You need control over latency, cost, or data residency
- The model is fine-tuned or proprietary
- You need to serve multiple models behind one endpoint
- API provider rate limits or pricing do not fit your workload

## When to use an API provider

- Prototyping or low-volume usage
- The model you need is only available as an API
- You do not want to manage GPU infrastructure
- Burst traffic patterns where idle GPU cost is wasteful

## Framework selection

| Use case | Framework |
|----------|-----------|
| High-throughput LLM serving | vLLM (PagedAttention + continuous batching) |
| Hugging Face model ecosystem | TGI |
| Multi-model serving (LLM + vision + embeddings) | Triton Inference Server |
| Local development and testing | Ollama |

## Metrics checklist

1. TTFT (Time to First Token): target under 500ms for interactive use
2. TPS (Tokens per Second): target 30-50 for readable streaming
3. P99 latency: the number angry users see, not the average
4. GPU utilization: single request ~15%, good batching ~70-80%
5. Queue depth: rising queue means demand exceeds capacity
6. Error rate: 429s (queue full) and 5xx (server errors)

## Common mistakes

- Pre-allocating max sequence length per request (wastes GPU memory, use PagedAttention)
- Static batching (wastes GPU cycles waiting for longest request, use continuous batching)
- Not streaming responses (users wait for full generation, perceived latency spikes)
- Measuring average latency instead of P99 (hides tail latency from 1% of users)
- Running one request at a time (GPU utilization stays under 20%)
- No backpressure mechanism (unbounded queues lead to OOM or cascading timeouts)

## Production parameters

- Queue size: 50-200 depending on traffic pattern
- Batch size: 8-32 depending on GPU memory and model size
- Max sequence length: set per-model, do not use global max
- Health check interval: 5-10 seconds
- Timeout: 30-60 seconds for generation, 5 seconds for prefill
- Streaming: always enable for user-facing endpoints
