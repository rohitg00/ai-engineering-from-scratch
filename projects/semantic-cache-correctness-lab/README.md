# Semantic Cache Correctness Lab

Measure when a similar question can reuse an answer and when it must miss.

Python 3.10+; cryptographic hashing, vector similarity, and adversarial filtering. The core uses the Python standard library with no external dependencies.

## Build and run your version

From the repository root, initialize once:

```bash
python3 scripts/project_test.py semantic-cache-correctness-lab --init learning-artifacts/semantic-cache-correctness-lab
python3 scripts/project_test.py semantic-cache-correctness-lab --stage 1 --path learning-artifacts/semantic-cache-correctness-lab --strict
```

Implement each stage, then run the cumulative grader and CLI driver:

```bash
python3 scripts/project_test.py semantic-cache-correctness-lab --all --path learning-artifacts/semantic-cache-correctness-lab --strict
cd learning-artifacts/semantic-cache-correctness-lab
python3 cli.py --benchmark samples/benchmark.json --output report.json --threshold 0.85
```

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py semantic-cache-correctness-lab --all --solution --strict
cd projects/semantic-cache-correctness-lab/solution
python3 cli.py --benchmark samples/benchmark.json --output report.json --threshold 0.85
```

## Observe the change

The demo evaluates a benchmark of exact queries, natural paraphrases, cross-tenant requests, and adversarial near-misses. While naive semantic caching blindly serves cached responses for high-similarity queries, this engine enforces strict tenant isolation, source-revision freshness, and catches critical semantic near-misses (such as inverted negation and changed numbers like `$50` vs `$500`).

## Integration and limits

The caching engine operates offline using deterministic tokenization and cosine similarity over term frequencies, augmented with regex-based negation and numerical guardrails. Similarity scores alone never bypass tenant, model, or source revision boundaries. Expired TTL entries are automatically evicted. Production implementations can plug in learned embedding providers while retaining these exact identity and adversarial verification boundaries.

## Stages

1. [Enforce identity, freshness and tenant boundaries](stages/01-identity-and-freshness/docs/en.md)
2. [Implement exact-match lookup and scoped invalidation](stages/02-exact-lookup-and-invalidation/docs/en.md)
3. [Evaluate semantic candidates against adversarial near-miss pairs](stages/03-semantic-matching-and-adversarial-near-misses/docs/en.md)
4. [Export a bounded HTTP adapter and correctness report](stages/04-http-adapter-and-correctness-report/docs/en.md)

## Primary references

- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
- [NIST SP 800-88: Media Sanitation and Data Isolation](https://csrc.nist.gov/publications/detail/sp/800-88/rev-1/final)
