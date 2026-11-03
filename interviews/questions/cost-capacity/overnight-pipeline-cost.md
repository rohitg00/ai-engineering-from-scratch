---
id: overnight-pipeline-cost
title: Price a nightly pipeline on batch with a cached prompt
card: cost-capacity
kind: estimate
level: 3
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [system-design, screen]
tags: [batch-api, prompt-caching, cost-per-request, offline-jobs]
minutes: 12
lessons: [phases/17-infrastructure-and-production/15-batch-apis, phases/17-infrastructure-and-production/14-prompt-semantic-caching]
manuals: [vllm-101#s-run-batch-and-offline-jobs]
practice: []
cheatsheet: [llm-cost-caching, inference-load-testing]
related: [cost-capacity/batch-lane-triage, cost-capacity/cache-break-even]
updated: 2026-11-03
---

A nightly pipeline summarizes 50,000 documents, and every call opens with the same system prompt. It runs synchronously against a provider for four hours and costs about 2,000 dollars a night. Estimate what the same job costs on the batch API with the system prompt cached, and say when you would move it onto your own GPU instead.

## Short answer

Batch gives a flat 50 percent discount on input and output tokens, and the cached system prompt makes the repeated input about ten times cheaper after the first write. Stacked, the lesson's worked example lands at about 180 dollars a night, near 9 percent of the synchronous bill, from three configuration changes. Move the job to your own GPU when it runs every night at high utilization and the shared prefix is short, so that neither discount has much to work on, and size that run by raising concurrency until the output stops growing.

## Full answer

### The three bills

The lesson writes the synchronous uncached bill as the document count times the input and output tokens of each call at full rates, with a shared prompt of about 4000 tokens and an output of about 200 tokens per document.

1. **Synchronous, uncached.** Every call pays for the full prompt and the full output.
2. **Synchronous, cached.** The system prompt is written once, and the remaining 49999 calls read it at about a tenth of the input price.
3. **Batch, cached.** Everything above, plus the 50 percent discount on the reads, the write and the output.

The lesson's conclusion: batch plus cache comes to about 10 percent of the synchronous uncached bill, and its worked pipeline goes from 2,000 dollars a night to about 180.

### What the estimate hides

- Output tokens take the batch discount only. Caching reuses the prompt's attention state and does nothing for generated tokens, so a job with long outputs and a short prompt saves much less.
- The first call of a batch pays the cache write premium. Against tens of thousands of reads, it is noise. If the batch runs longer than the cache lifetime, the one-hour variant with its 2x write is worth it once the reads pass five.
- Check the usage fields on a sample of the results. A batch whose requests all missed the cache shows writes and no reads, and then the second discount never happened.
- The return is promised within 24 hours and typical within a few hours. A night is shorter than the promise, so the morning deadline holds only on the typical return. Submit the batch a day ahead, or keep a synchronous fallback for a late batch.

### When your own GPU wins

The lesson's exercise asks for the shared-prefix length at which batch plus cache beats a reserved GPU running overnight. Your own GPU wins when three things hold: the job keeps a reserved GPU busy every night, the shared prefix is short, so there is little to cache, and the outputs are long, so the batch discount is the only lever on the provider side. Data residency can decide it on its own.

### How to size the self-hosted run

The vLLM manual's recipe for an offline job: pass the whole prompt list to the offline engine class in one call, or run the batch command on a file of requests, and raise the concurrency until the output stops growing. On its card, the output grew to 273.9 tokens per second at 32 concurrent requests and fell to 241.4 at 64, because the pool filled and the GPU throttled. Raise the token budget above 8,192 for throughput, because a slow first token costs nothing when nobody waits, and watch the running count against the cache usage to see which limit binds.

## Follow-ups

- **Level 3:** Which of the two discounts applies to output tokens? Expected: only the batch discount. Caching lowers the price of repeated input and does nothing for generated tokens.
- **Level 3:** The first call in each batch pays a cache write premium. Does that change the estimate? Expected: not at this volume. One write at a quarter more, against tens of thousands of reads at a tenth of the price.
- **Level 4:** When does a reserved GPU beat batch plus cache? Expected: when the job keeps the GPU busy every night, the shared prefix is short and the outputs are long, so the two discounts have little to work on. The lesson's exercise computes the break-even prefix length.
- **Level 4:** How do you find the right concurrency for the job on your own GPU? Expected: pass the whole list to the offline engine or the batch command, raise concurrency until the output tokens per second stop growing, and raise the token budget. The manual's card peaked near 32 concurrent requests.

## Wrong answers

- "Batch alone gets you to a tenth of the cost." Batch alone halves the bill. The other factor is the cached shared prompt.
- "Caching saves the same on output as on input." The cache reuses the prompt's attention state. Every output token is generated and billed in full, less the batch discount.
- "Batch is too slow for a nightly job." The promise is a day and the typical return is hours. Submit a day ahead, or keep a synchronous fallback for the rare late batch.

## Taught in

The [batch APIs lesson](../../../phases/17-infrastructure-and-production/15-batch-apis/) stacks the two discounts on the nightly pipeline, the [caching economics lesson](../../../phases/17-infrastructure-and-production/14-prompt-semantic-caching/) gives the cache write and read prices, and the [batch jobs section of vLLM 101](../../../manuals/vllm-101/sections/3-6-run-batch-and-offline-jobs.md) finds the throughput ceiling of a self-hosted run.
