# Implement Exact-Match Lookup and Scoped Invalidation

> Build an in-memory cache store with exact lookup, expiry eviction, and bulk invalidation by tenant or source revision.

**Type:** Build
**Languages:** Python
**Prerequisites:** 01-identity-and-freshness
**Time:** ~120 min

## Learning Objectives
- Implement an in-memory cache store indexed by deterministic cryptographic keys
- Evict expired entries lazily during lookup requests
- Implement scoped invalidation purging all entries for a specific tenant
- Support versioned invalidation when source revisions change
- Track audit metrics including cache hits, misses, evictions, and invalidations

## What changes

With exact identity keys established, you now implement the exact cache store. In production systems, caches must support deterministic invalidation:
1. When a tenant terminates or purges their data (e.g. GDPR right to be forgotten), `invalidate_tenant(tenant_id)` must cleanly wipe all cached responses belonging to that tenant without affecting other tenants.
2. When documentation or system prompt templates change, `invalidate_source_revision(source_revision)` must evict all entries generated under previous versions.
3. Requests arriving after TTL expiration must be evicted immediately and recorded as misses.

## Implement the contract

In your workspace `main.py`, implement the `ExactCacheStore` class:

```python
class ExactCacheStore:
    def __init__(self) -> None:
        ...

    def put(self, entry: CacheEntry) -> str:
        """Store an entry and return its computed key."""
        ...

    def get(
        self,
        tenant_id: str,
        model: str,
        source_revision: str,
        prompt: str,
        current_time: float,
        extra_params: Optional[Dict[str, Any]] = None,
    ) -> Optional[CacheEntry]:
        """Look up an entry, evict if expired, and verify tenant/revision matches."""
        ...

    def invalidate_tenant(self, tenant_id: str) -> int:
        """Evict all entries for a tenant and return count evicted."""
        ...

    def invalidate_source_revision(self, source_revision: str) -> int:
        """Evict all entries for a source revision and return count evicted."""
        ...

    def stats(self) -> Dict[str, int]:
        """Return dict with hits, misses, evictions, invalidations, and active_entries."""
        ...
```

## Verify and inspect

Run the cumulative tests up to Stage 2:

```bash
python3 scripts/project_test.py semantic-cache-correctness-lab --stage 2 --path learning-artifacts/semantic-cache-correctness-lab --strict
```

## References

- [RFC 9111: HTTP Caching - Section 5.2: Invalidation](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2)
