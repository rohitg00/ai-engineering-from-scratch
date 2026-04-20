---
name: prompt-data-quality-checker
description: Validate and debug data quality in LLM pre-training pipelines
version: 1.0.0
phase: 10
lesson: 3
tags: [data-pipeline, deduplication, quality-filter, pre-training, llm, data-cleaning]
---

# Data Quality Checker for LLM Pre-Training

When building or auditing a data pipeline for LLM pre-training, use this framework to catch problems before they reach the model.

## Red Flags in Pipeline Output

**Deduplication removed less than 20% of web data.** Common Crawl typically contains 30-40% duplicates. If your dedup step removes less than 20%, your MinHash parameters are too conservative or your threshold is too high. Check: shingle size k, number of hash functions, number of LSH bands, Jaccard threshold.

**Compression ratio below 2.0 chars/token.** This means your tokenizer is splitting too aggressively. Either retrain with more merges, increase vocabulary size, or check that pre-tokenization is not fragmenting text unnecessarily.

**Compression ratio above 6.0 chars/token.** Your tokenizer has learned very domain-specific merges that may not generalize. This is fine for a domain-specific model but a warning sign for general-purpose models.

**Sequence utilization below 90%.** Too much padding. Either your documents are very short (filter them or increase minimum document length) or your sequence packing is inefficient (switch from naive padding to multi-document packing).

**Vocab utilization below 50%.** More than half your vocabulary is unused on this corpus. Either the vocabulary is too large for your domain or the tokenizer was trained on very different data.

## Quality Filter Calibration

Run these checks on a random sample of 1,000 documents at each pipeline stage:

1. **Read 20 random documents after cleaning.** Do they contain residual HTML, JavaScript, navigation text, or boilerplate? If yes, your HTML stripping is incomplete.

2. **Read 20 random documents that PASSED the quality filter.** Are any of them spam, keyword lists, or machine-generated? If yes, tighten the filter thresholds.

3. **Read 20 random documents that FAILED the quality filter.** Are any of them genuinely good content? If yes, your filter is too aggressive. Relax thresholds or add exceptions for specific patterns.

4. **Read 20 random near-duplicate pairs from dedup.** Are they actually similar? If not, lower the Jaccard threshold or increase the number of hash functions.

## Data Mixing Ratios

There is no universal formula. Start with these baselines and adjust based on evaluation:

| Category | Llama 3 Ratio | Starting Point |
|----------|--------------|----------------|
| Web text | 50% | 50% |
| Code | 25% | 15-25% |
| Books/academic | 13% | 10-15% |
| Math | 8% | 5-10% |
| Multilingual web | 4% | 5-10% |

Increase code ratio if the model should be strong at programming. Increase math ratio if reasoning matters. Decrease web ratio if you need less noise. Always evaluate on benchmarks after changing ratios.

## Scaling Estimates

For a given target token count:

- 1T tokens from web: expect ~3-5TB raw text, ~1.5-2TB after cleaning and dedup
- Tokenization speed (Rust): ~100M tokens/second per core
- Tokenization speed (Python): ~1-10M tokens/second per core
- MinHash dedup at 128 hashes, 16 bands: ~10K documents/second per core
- Sequence packing: I/O bound, use memory-mapped files for corpora above 10GB

For 15T tokens (Llama 3 scale), plan for ~30-50TB of raw input data, 1-2 weeks of preprocessing on a 64-core machine, and 100TB+ of disk for intermediate files.

## Checklist Before Training

1. Total token count matches your compute budget (use Chinchilla scaling or the Llama 3 overtrain ratio as a guide)
2. Dedup removed 30-40% of web data
3. Quality filter removed 10-20% of remaining data
4. Compression ratio is 3-5 chars/token for English
5. Sequence utilization is above 95%
6. Random spot-checks show clean, coherent text at every pipeline stage
7. Data mix ratios have been validated on a small-scale training run
8. PII removal has been verified on a sample
9. All binary formats (packed sequences, token ID arrays) pass round-trip encoding/decoding tests
10. Pipeline is reproducible: same input produces identical output with fixed random seeds
