# Enforce Identity, Freshness and Tenant Boundaries

> Cryptographically bind cached LLM answers to tenant identity, model versions, and time-to-live expiration.

**Type:** Build
**Languages:** Python
**Prerequisites:** None
**Time:** ~120 min

## Learning Objectives
- Construct deterministic cryptographic cache keys incorporating tenant partitions and source revisions
- Implement time-to-live freshness boundaries to prevent stale cached responses
- Validate incoming caching query payloads with strict input sanitation
- Prevent cross-tenant data leaks by enforcing tenant partition isolation

## What changes

In naive caching implementations, caching queries based solely on prompt text leads to critical cross-tenant data leakage: if Tenant A asks about their private account balance, Tenant B might receive Tenant A's cached response. Furthermore, when underlying knowledge bases or system instructions update, stale cached entries continue to serve outdated answers.

In this stage, you will build the foundational identity and freshness model. Every cached entry will be explicitly bound to:
1. `tenant_id`: Mandatory tenant identifier ensuring complete data isolation.
2. `model`: Target LLM model name.
3. `source_revision`: Version hash of underlying documents, prompt templates, or embeddings.
4. `ttl_seconds`: Expiration duration relative to creation timestamp.

## Implement the contract

Open `main.py` in your workspace and implement:

1. `CacheEntry`: Dataclass holding cached responses with `to_dict()` and `from_dict()` serialization.
2. `compute_exact_key(tenant_id, model, source_revision, prompt, extra_params=None)`:
   - Validates that `tenant_id`, `model`, and `prompt` are non-empty strings.
   - Computes a deterministic SHA-256 hash across canonicalized parameters.
3. `is_fresh(entry, current_time)`:
   - Returns `True` if `ttl_seconds <= 0` (permanent) or if `current_time <= entry.created_at + entry.ttl_seconds`.
4. `validate_cache_request(request)`:
   - Validates required fields, strips whitespace, and ensures `ttl_seconds` is a non-negative finite number.

## Verify and inspect

Run the stage test suite from repository root:

```bash
python3 scripts/project_test.py semantic-cache-correctness-lab --stage 1 --path learning-artifacts/semantic-cache-correctness-lab --strict
```

## References

- [RFC 9111: HTTP Caching - Section 4: Freshness](https://www.rfc-editor.org/rfc/rfc9111.html#section-4)
- [NIST SP 800-88: Data Isolation Guidelines](https://csrc.nist.gov/publications/detail/sp/800-88/rev-1/final)
