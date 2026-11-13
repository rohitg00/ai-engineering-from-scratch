# Evaluate Semantic Candidates Against Adversarial Near-Miss Pairs

> Compute cosine query similarity while strictly blocking false cache hits from numerical near-misses, negation inversions, and antonym divergence.

**Type:** Build
**Languages:** Python
**Prerequisites:** 02-exact-lookup-and-invalidation
**Time:** ~120 min

## Learning Objectives
- Compute normalized term-frequency vectors and cosine similarity without external dependencies
- Restrict semantic candidate search strictly to matching `(tenant_id, model, source_revision)` partitions
- Detect and block critical numerical near-misses (e.g. '$50' vs '$500', '2023' vs '2024')
- Detect and block negation polarity inversions (e.g. 'deploy on Friday' vs 'do not deploy on Friday')
- Reject antonym swaps (e.g. 'increase' vs 'decrease', 'allow' vs 'deny')

## What changes

While exact caching achieves zero false hits, it misses natural paraphrases (e.g. "What is your refund policy?" vs "What is the policy regarding refunds?"). Introducing semantic similarity matches these paraphrases, but naive vector search introduces dangerous false positives:
- **Numerical differences:** Queries asking about "$50 plan" vs "$500 plan" share high lexical and semantic overlap (often > 0.90 cosine similarity), yet returning the $50 answer for a $500 question is an incorrect, hallucinated response.
- **Negation inversion:** "Can I deploy on Friday?" and "Can I not deploy on Friday?" have opposite meanings despite high semantic similarity.
- **Antonym divergence:** "How do I increase limits?" vs "How do I decrease limits?".

In this stage, you build a semantic cache store with strict guardrails:
1. Candidate search occurs *only* within the matching tenant partition.
2. If similarity exceeds the threshold, `check_adversarial_near_miss` validates numerical identity, negation alignment, and directional antonyms.
3. If any adversarial difference is detected, the candidate is safely rejected and reported as a miss.

## Work through one concrete case

Incoming queries with high vector similarity pass through adversarial guardrails. Inverted negations, changed numerical quantities, antonym replacements, and entity substitutions are rejected before reaching the tenant partition.

```figure
pj-semantic-cache-correctness-lab-3
```

## Implement the contract

In your workspace `main.py`, implement:

1. `tokenize(text)` and `compute_tf_vector(tokens)`: Normalized term vectors with L2 normalization.
2. `cosine_similarity(vec1, vec2)`: Returns cosine similarity between 0.0 and 1.0.
3. `extract_numbers(text)`: Extracts and normalizes numerical quantities and currency amounts.
4. `extract_negations(text)`: Detects negation keywords (`not`, `never`, `no`, `cannot`, etc.).
5. `check_adversarial_near_miss(query, cached_prompt)`: Returns `(is_adversarial, reason)`.
6. `SemanticCacheStore`:
   - `put(entry: CacheEntry) -> str`: Registers entry in exact store and partitioned semantic index.
   - `query(tenant_id, model, source_revision, prompt, threshold=0.85, current_time=0.0) -> (entry, score, reason)`:
     - Returns exact hit if matched.
     - Searches candidates in the same partition.
     - Enforces similarity threshold.
     - Applies adversarial near-miss verification before approving any semantic hit.

## Verify and inspect

Run the cumulative tests up to Stage 3:

```bash
python3 scripts/project_test.py semantic-cache-correctness-lab --stage 3 --path learning-artifacts/semantic-cache-correctness-lab --strict
```

## References

- [Information Retrieval: Vector Space Model](https://nlp.stanford.edu/IR-book/html/htmldition1/the-vector-space-model-for-scoring-1.html)
