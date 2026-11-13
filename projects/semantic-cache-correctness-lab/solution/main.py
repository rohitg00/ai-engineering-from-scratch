# projects/semantic-cache-correctness-lab/solution/main.py
# RFC 9111: HTTP Caching
# NIST SP 800-88: Guidelines for Media Sanitization
# Information Retrieval: Sublinear TF-IDF and N-Gram Cosine Matching

from __future__ import annotations

from dataclasses import asdict, dataclass, field
import hashlib
from http.server import BaseHTTPRequestHandler
import json
import math
import re
import time
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

MAX_HTTP_BODY_BYTES: int = 1_048_576


class CacheError(Exception):
    """Base exception for caching engine errors."""


class TenantIsolationError(CacheError):
    """Raised when an operation attempts to breach tenant partition boundaries."""


class MalformedRequestError(CacheError):
    """Raised when an incoming cache query is malformed or invalid."""


@dataclass
class CacheEntry:
    """Represents a cached LLM response bound to identity, freshness, and audit metadata."""

    entry_id: str
    tenant_id: str
    model: str
    source_revision: str
    prompt: str
    response: str
    created_at: float
    ttl_seconds: float
    soft_ttl_seconds: float = 0.0
    last_accessed_at: float = field(default=0.0)
    hit_count: int = 0
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Initialize access timestamp if unset."""
        if self.last_accessed_at == 0.0:
            self.last_accessed_at = self.created_at

    def to_dict(self) -> Dict[str, Any]:
        """Serialize cache entry to a standard dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> CacheEntry:
        """Instantiate a CacheEntry from dictionary data.

        Args:
            data: Dictionary containing serialized CacheEntry fields.

        Returns:
            A reconstructed CacheEntry object.

        Raises:
            KeyError: If any required field is missing.
        """
        return cls(
            entry_id=str(data["entry_id"]),
            tenant_id=str(data["tenant_id"]),
            model=str(data["model"]),
            source_revision=str(data["source_revision"]),
            prompt=str(data["prompt"]),
            response=str(data["response"]),
            created_at=float(data["created_at"]),
            ttl_seconds=float(data.get("ttl_seconds", 3600.0)),
            soft_ttl_seconds=float(data.get("soft_ttl_seconds", 0.0)),
            last_accessed_at=float(data.get("last_accessed_at", data["created_at"])),
            hit_count=int(data.get("hit_count", 0)),
            tags=list(data.get("tags", [])),
            metadata=dict(data.get("metadata", {})),
        )


def compute_exact_key(
    tenant_id: str,
    model: str,
    source_revision: str,
    prompt: str,
    extra_params: Optional[Dict[str, Any]] = None,
) -> str:
    """Generate a deterministic cryptographic cache key.

    Binds tenant ID, model, source revision, normalized prompt, and extra parameters
    so that entries across tenants, revisions, or models never collide.

    Args:
        tenant_id: The tenant or customer partition identifier.
        model: Target model name (e.g. 'claude-3-5-sonnet', 'gpt-4o').
        source_revision: Version hash or tag of underlying documents or prompt template.
        prompt: Raw user prompt string.
        extra_params: Optional configuration like temperature or system parameters.

    Returns:
        A 64-character SHA-256 hexadecimal string.

    Raises:
        ValueError: If tenant_id, model, or prompt is empty or invalid.
    """
    if not tenant_id or not isinstance(tenant_id, str) or not tenant_id.strip():
        raise ValueError("tenant_id must be a non-empty string")
    if not model or not isinstance(model, str) or not model.strip():
        raise ValueError("model must be a non-empty string")
    if not prompt or not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("prompt must be a non-empty string")

    norm_tenant = tenant_id.strip()
    norm_model = model.strip()
    norm_rev = (source_revision or "").strip()
    norm_prompt = " ".join(prompt.strip().split())

    canonical_data = {
        "tenant_id": norm_tenant,
        "model": norm_model,
        "source_revision": norm_rev,
        "prompt": norm_prompt,
        "extra_params": extra_params or {},
    }
    encoded = json.dumps(canonical_data, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def make_partition_key(
    tenant_id: str,
    model: str,
    source_revision: str,
    extra_params: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str, str, str]:
    """Build a deterministic partition key binding tenant, model, revision, and policy contexts."""
    serialized_params = json.dumps(extra_params or {}, sort_keys=True, separators=(",", ":"))
    return (tenant_id.strip(), model.strip(), (source_revision or "").strip(), serialized_params)


def is_fresh(entry: CacheEntry, current_time: Optional[float] = None) -> bool:
    """Determine whether a cache entry remains within its hard time-to-live period.

    Args:
        entry: The CacheEntry to inspect.
        current_time: Epoch timestamp representing current time. Defaults to time.time().

    Returns:
        True if the entry is permanent (ttl_seconds <= 0) or unexpired.
    """
    if entry.ttl_seconds <= 0:
        return True
    now = time.time() if current_time is None else float(current_time)
    return now <= (entry.created_at + entry.ttl_seconds)


def is_soft_expired(entry: CacheEntry, current_time: Optional[float] = None) -> bool:
    """Determine whether a cache entry has exceeded its soft TTL (stale-while-revalidate).

    Args:
        entry: The CacheEntry to inspect.
        current_time: Current epoch timestamp. Defaults to time.time().

    Returns:
        True if soft_ttl_seconds is configured and exceeded.
    """
    if entry.soft_ttl_seconds <= 0:
        return False
    now = time.time() if current_time is None else float(current_time)
    return now > (entry.created_at + entry.soft_ttl_seconds)


def validate_cache_request(request: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and normalize an incoming caching request.

    Args:
        request: Raw dictionary containing query parameters.

    Returns:
        Sanitized and validated request dictionary.

    Raises:
        ValueError: If required fields are absent or invalid.
    """
    if not isinstance(request, dict):
        raise ValueError("Request must be a JSON object dictionary")

    for field_name in ("tenant_id", "model", "prompt"):
        val = request.get(field_name)
        if not val or not isinstance(val, str) or not val.strip():
            raise ValueError(f"Field '{field_name}' is required and must be a non-empty string")

    source_rev = request.get("source_revision", "")
    if not isinstance(source_rev, str):
        raise ValueError("Field 'source_revision' must be a string")

    ttl = request.get("ttl_seconds", 3600.0)
    try:
        ttl_float = float(ttl)
        if math.isnan(ttl_float) or math.isinf(ttl_float) or ttl_float < 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValueError("Field 'ttl_seconds' must be a non-negative finite number")

    soft_ttl = request.get("soft_ttl_seconds", 0.0)
    try:
        soft_ttl_float = float(soft_ttl)
        if math.isnan(soft_ttl_float) or math.isinf(soft_ttl_float) or soft_ttl_float < 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValueError("Field 'soft_ttl_seconds' must be a non-negative finite number")

    tags = request.get("tags", [])
    if not isinstance(tags, list):
        raise ValueError("Field 'tags' must be a list of strings")

    return {
        "tenant_id": request["tenant_id"].strip(),
        "model": request["model"].strip(),
        "source_revision": source_rev.strip(),
        "prompt": request["prompt"].strip(),
        "ttl_seconds": ttl_float,
        "soft_ttl_seconds": soft_ttl_float,
        "tags": [str(t).strip() for t in tags if str(t).strip()],
        "metadata": dict(request.get("metadata", {})),
        "extra_params": dict(request.get("extra_params", {})),
    }


class ExactCacheStore:
    """In-memory key-value cache store with per-tenant LRU capacity and scoped invalidation."""

    def __init__(self, max_entries_per_tenant: int = 1000) -> None:
        """Initialize an ExactCacheStore.

        Args:
            max_entries_per_tenant: Maximum active cache entries allowed per tenant before LRU eviction.
        """
        self.max_entries_per_tenant = max_entries_per_tenant
        self._entries: Dict[str, CacheEntry] = {}
        self._tenant_keys: Dict[str, List[str]] = {}
        self._stats: Dict[str, int] = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "invalidations": 0,
            "capacity_evictions": 0,
        }

    def put(self, entry: CacheEntry) -> str:
        """Insert or replace a cache entry with tenant quota management.

        Args:
            entry: The CacheEntry to store.

        Returns:
            The computed cache key string.
        """
        key = compute_exact_key(
            tenant_id=entry.tenant_id,
            model=entry.model,
            source_revision=entry.source_revision,
            prompt=entry.prompt,
            extra_params=entry.metadata.get("extra_params") if isinstance(entry.metadata, dict) else None,
        )

        if self.max_entries_per_tenant <= 0:
            return key

        tenant = entry.tenant_id
        if tenant not in self._tenant_keys:
            self._tenant_keys[tenant] = []

        if key in self._entries:
            if key in self._tenant_keys[tenant]:
                self._tenant_keys[tenant].remove(key)
        else:
            while len(self._tenant_keys[tenant]) >= self.max_entries_per_tenant and self._tenant_keys[tenant]:
                lru_key = self._tenant_keys[tenant].pop(0)
                if lru_key in self._entries:
                    del self._entries[lru_key]
                    self._stats["capacity_evictions"] += 1
                    self._stats["evictions"] += 1

        self._entries[key] = entry
        self._tenant_keys[tenant].append(key)
        return key

    def touch(self, entry: CacheEntry, current_time: Optional[float] = None) -> None:
        """Update last access metadata and promote entry to MRU position in tenant LRU queue."""
        now = time.time() if current_time is None else float(current_time)
        entry.hit_count += 1
        entry.last_accessed_at = now
        key = compute_exact_key(
            tenant_id=entry.tenant_id,
            model=entry.model,
            source_revision=entry.source_revision,
            prompt=entry.prompt,
            extra_params=entry.metadata.get("extra_params") if isinstance(entry.metadata, dict) else None,
        )
        tenant = entry.tenant_id
        if tenant in self._tenant_keys and key in self._tenant_keys[tenant]:
            self._tenant_keys[tenant].remove(key)
            self._tenant_keys[tenant].append(key)

    def get(
        self,
        tenant_id: str,
        model: str,
        source_revision: str,
        prompt: str,
        current_time: Optional[float] = None,
        extra_params: Optional[Dict[str, Any]] = None,
    ) -> Optional[CacheEntry]:
        """Retrieve an unexpired entry matching exact identity constraints.

        Args:
            tenant_id: Tenant partition identifier.
            model: Expected model name.
            source_revision: Expected source revision.
            prompt: Query prompt string.
            current_time: Current epoch timestamp. Defaults to time.time().
            extra_params: Optional configuration dictionary.

        Returns:
            The matching fresh CacheEntry or None if missed or expired.
        """
        now = time.time() if current_time is None else float(current_time)
        key = compute_exact_key(
            tenant_id=tenant_id,
            model=model,
            source_revision=source_revision,
            prompt=prompt,
            extra_params=extra_params,
        )
        entry = self._entries.get(key)
        if entry is None:
            self._stats["misses"] += 1
            return None

        if not is_fresh(entry, now):
            self._remove_key(key, tenant_id)
            self._stats["evictions"] += 1
            self._stats["misses"] += 1
            return None

        if entry.tenant_id != tenant_id or entry.model != model or entry.source_revision != source_revision:
            self._stats["misses"] += 1
            return None

        self.touch(entry, now)
        self._stats["hits"] += 1
        return entry

    def _remove_key(self, key: str, tenant_id: str) -> None:
        """Internal helper to remove key from store and tenant index."""
        if key in self._entries:
            del self._entries[key]
        if tenant_id in self._tenant_keys and key in self._tenant_keys[tenant_id]:
            self._tenant_keys[tenant_id].remove(key)

    def invalidate_tenant(self, tenant_id: str) -> int:
        """Evict all cached entries belonging to a specific tenant.

        Args:
            tenant_id: The tenant identifier to purge.

        Returns:
            Count of evicted entries.
        """
        keys = list(self._tenant_keys.get(tenant_id, []))
        for k in keys:
            if k in self._entries:
                del self._entries[k]
        self._tenant_keys[tenant_id] = []
        count = len(keys)
        self._stats["invalidations"] += count
        return count

    def invalidate_source_revision(self, source_revision: str) -> int:
        """Evict all cached entries tied to an outdated source revision.

        Args:
            source_revision: The source revision hash or tag to purge.

        Returns:
            Count of evicted entries.
        """
        keys_to_delete = [
            (k, entry.tenant_id)
            for k, entry in self._entries.items()
            if entry.source_revision == source_revision
        ]
        for k, tenant in keys_to_delete:
            self._remove_key(k, tenant)
        count = len(keys_to_delete)
        self._stats["invalidations"] += count
        return count

    def invalidate_tag(self, tag: str, tenant_id: Optional[str] = None) -> int:
        """Evict all cached entries carrying a specific metadata tag.

        Args:
            tag: Metadata tag to invalidate.
            tenant_id: Optional tenant filter.

        Returns:
            Count of evicted entries.
        """
        keys_to_delete = [
            (k, entry.tenant_id)
            for k, entry in self._entries.items()
            if tag in entry.tags and (tenant_id is None or entry.tenant_id == tenant_id)
        ]
        for k, t in keys_to_delete:
            self._remove_key(k, t)
        count = len(keys_to_delete)
        self._stats["invalidations"] += count
        return count

    def stats(self) -> Dict[str, Any]:
        """Obtain a snapshot of cache performance metrics.

        Returns:
            Dictionary containing hits, misses, evictions, invalidations, and active entry counts.
        """
        res = dict(self._stats)
        res["active_entries"] = len(self._entries)
        res["active_tenants"] = len([t for t, keys in self._tenant_keys.items() if keys])
        return res


NEGATION_TERMS: Set[str] = {
    "not",
    "never",
    "no",
    "none",
    "neither",
    "nor",
    "without",
    "cannot",
    "cant",
    "wont",
    "shouldnt",
    "dont",
    "doesnt",
    "didnt",
    "isnt",
    "arent",
    "wasnt",
    "werent",
    "hardly",
    "scarcely",
    "barely",
}

ANTONYM_PAIRS: List[Tuple[str, str]] = [
    ("before", "after"),
    ("increase", "decrease"),
    ("higher", "lower"),
    ("enable", "disable"),
    ("allow", "deny"),
    ("true", "false"),
    ("buy", "sell"),
    ("inbound", "outbound"),
    ("up", "down"),
    ("start", "stop"),
    ("above", "below"),
    ("create", "delete"),
    ("credit", "debit"),
    ("internal", "external"),
    ("public", "private"),
]

TEMPORAL_MARKERS: List[Tuple[str, str]] = [
    ("yesterday", "tomorrow"),
    ("past", "future"),
    ("earlier", "later"),
    ("previous", "next"),
]

KNOWN_ENTITY_IDENTIFIERS: Set[str] = {
    "alpha",
    "beta",
    "gamma",
    "delta",
    "epsilon",
    "zeta",
    "eta",
    "theta",
    "iota",
    "kappa",
    "lambda",
    "mu",
    "nu",
    "xi",
    "omicron",
    "pi",
    "rho",
    "sigma",
    "tau",
    "upsilon",
    "phi",
    "chi",
    "psi",
    "omega",
    "alice",
    "bob",
    "charlie",
    "david",
    "eve",
    "frank",
    "grace",
}


def tokenize(text: str, ngrams: bool = True) -> List[str]:
    """Split text into normalized lowercase unigrams and consecutive bigrams.

    Preserves token order and local phrase context through sublinear n-gram extraction.

    Args:
        text: Raw text string.
        ngrams: Whether to include consecutive bigram tokens. Defaults to True.

    Returns:
        List of cleaned token strings.
    """
    clean = re.sub(r"[^\w\s]", " ", text.lower())
    words = [t for t in clean.split() if t]
    tokens = list(words)
    if ngrams and len(words) > 1:
        for i in range(len(words) - 1):
            tokens.append(f"{words[i]}_{words[i+1]}")
    return tokens


def compute_tf_vector(tokens: List[str]) -> Dict[str, float]:
    """Calculate sublinear term-frequency vector with L2 Euclidean normalization.

    Uses 1 + log(tf) sublinear scaling to prevent frequent word repetition distortion.

    Args:
        tokens: Tokenized words and bigrams.

    Returns:
        Dictionary mapping token to normalized frequency weight.
    """
    if not tokens:
        return {}
    counts: Dict[str, float] = {}
    for tok in tokens:
        counts[tok] = counts.get(tok, 0.0) + 1.0

    sublinear: Dict[str, float] = {}
    for tok, c in counts.items():
        sublinear[tok] = 1.0 + math.log(c)

    sum_sq = sum(v * v for v in sublinear.values())
    norm = math.sqrt(sum_sq)
    if norm == 0:
        return {}
    return {k: v / norm for k, v in sublinear.items()}


def cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
    """Compute cosine similarity between two normalized sparse term vectors.

    Args:
        vec1: First normalized frequency vector.
        vec2: Second normalized frequency vector.

    Returns:
        Cosine similarity float bounded between 0.0 and 1.0.
    """
    if not vec1 or not vec2:
        return 0.0
    common = set(vec1.keys()) & set(vec2.keys())
    dot = sum(vec1[k] * vec2[k] for k in common)
    return max(0.0, min(1.0, float(dot)))


def extract_numbers_and_units(text: str) -> List[str]:
    """Extract and normalize all numbers, percentages, and measurement units.

    Matches quantities like '50', '$50', '50.0', '500MB', '50 MB', '2024'.
    Normalizes whitespace and formatting so '50MB' and '50 MB' produce identical tokens.

    Args:
        text: Raw query text.

    Returns:
        Sorted list of normalized numerical/unit tokens.
    """
    pattern = r"[\$€£¥]?\b\d+(?:[.,]\d+)?(?:\s*(?:%|k|m|b|gb|mb|tb|ms|s|hr|days?|users?|seats?))?\b"
    matches = re.findall(pattern, text.lower())
    cleaned = []
    for m in matches:
        norm = m.replace(",", "")
        norm = re.sub(r"\s+", "", norm).strip()
        norm = re.sub(r"(\d+)\.0+\b", r"\1", norm)
        cleaned.append(norm)
    return sorted(cleaned)


def extract_numbers(text: str) -> List[str]:
    """Extract raw numerical quantities from text (backward compatible).

    Args:
        text: Raw query text.

    Returns:
        Sorted list of normalized string numbers.
    """
    matches = re.findall(r"\b\d+(?:[.,]\d+)?\b", text)
    cleaned = []
    for m in matches:
        norm = m.replace(",", "")
        if "." in norm:
            norm = norm.rstrip("0").rstrip(".")
        cleaned.append(norm)
    return sorted(cleaned)


def extract_negations(text: str) -> Set[str]:
    """Identify negation words occurring in query text.

    Args:
        text: Raw query text.

    Returns:
        Set of detected negation words.
    """
    tokens = set(re.sub(r"[^\w\s]", " ", text.lower()).split())
    return tokens & NEGATION_TERMS


UNIT_ABBREVIATIONS: Set[str] = {"mb", "gb", "kb", "tb", "ms", "sec", "min", "hr", "hrs"}


def extract_entities(text: str) -> Set[str]:
    """Extract named entities, Greek codenames, and distinct identifiers from text.

    Excludes numerical unit tokens, pure digits, and sentence-initial common words.

    Args:
        text: Raw query text.

    Returns:
        Set of identified entity names and codes.
    """
    entities: Set[str] = set()
    raw_tokens = re.findall(r"\b[A-Za-z0-9_#-]+\b", text)
    units_in_text = set(extract_numbers_and_units(text))

    for i, tok in enumerate(raw_tokens):
        lower = tok.lower()
        if lower in UNIT_ABBREVIATIONS or lower in units_in_text or tok.isdigit():
            continue
        if any(c.isdigit() for c in tok) and re.sub(r"\s+", "", lower) in units_in_text:
            continue
        if lower in KNOWN_ENTITY_IDENTIFIERS:
            entities.add(lower)
        elif ("-" in tok or "_" in tok) and not tok.isdigit():
            entities.add(lower)
        elif tok.isupper() and len(tok) >= 2 and not tok.isdigit() and lower not in UNIT_ABBREVIATIONS:
            entities.add(lower)
        elif tok[0].isupper() and tok[1:].islower() and i > 0 and len(tok) > 2:
            if lower not in {
                "what", "when", "where", "which", "who", "whom", "whose", "why", "how",
                "can", "could", "should", "would", "is", "are", "was", "were", "do",
                "does", "did", "if", "the", "a", "an", "in", "on", "at", "to", "for",
                "with", "show", "tell", "explain", "describe", "please", "regarding",
                "about", "policy", "return", "refund", "laptop", "laptops", "service",
            }:
                entities.add(lower)
    return entities


def check_adversarial_near_miss(query: str, cached_prompt: str) -> Tuple[bool, str]:
    """Inspect whether a candidate match is an adversarial semantic near-miss.

    Blocks false hits caused by:
      1. Altered numerical values and units.
      2. Inverted negation polarity.
      3. Critical antonym swaps.
      4. Temporal marker divergence.
      5. Entity identifier divergence.

    Args:
        query: New incoming query string.
        cached_prompt: Previously cached prompt string.

    Returns:
        Tuple of (is_adversarial: bool, reason: str).
    """
    units_q = extract_numbers_and_units(query)
    units_c = extract_numbers_and_units(cached_prompt)
    if units_q != units_c:
        return True, f"number_mismatch: {units_q} != {units_c}"

    neg_q = extract_negations(query)
    neg_c = extract_negations(cached_prompt)
    if bool(neg_q) != bool(neg_c):
        return True, f"negation_inversion: {sorted(neg_q)} vs {sorted(neg_c)}"
    if neg_q != neg_c:
        return True, f"negation_mismatch: {sorted(neg_q)} != {sorted(neg_c)}"

    tokens_q = set(tokenize(query, ngrams=False))
    tokens_c = set(tokenize(cached_prompt, ngrams=False))
    for w1, w2 in ANTONYM_PAIRS:
        if (w1 in tokens_q and w2 in tokens_c) or (w2 in tokens_q and w1 in tokens_c):
            return True, f"antonym_divergence: {w1} vs {w2}"

    for t1, t2 in TEMPORAL_MARKERS:
        if (t1 in tokens_q and t2 in tokens_c) or (t2 in tokens_q and t1 in tokens_c):
            return True, f"temporal_divergence: {t1} vs {t2}"

    entities_q = extract_entities(query)
    entities_c = extract_entities(cached_prompt)
    if entities_q != entities_c:
        return True, f"entity_mismatch: {sorted(entities_q)} vs {sorted(entities_c)}"

    return False, "safe"


class SemanticCacheStore:
    """Multi-tenant semantic caching store with partitioned index and near-miss verification."""

    def __init__(self, max_entries_per_tenant: int = 1000) -> None:
        """Initialize semantic cache store.

        Args:
            max_entries_per_tenant: Maximum entries per tenant partition.
        """
        self.exact_store = ExactCacheStore(max_entries_per_tenant=max_entries_per_tenant)
        self._partitions: Dict[Tuple[str, str, str, str], List[Tuple[str, CacheEntry, Dict[str, float]]]] = {}

    def put(self, entry: CacheEntry) -> str:
        """Add entry to exact store and semantic partition index.

        Args:
            entry: The CacheEntry to register.

        Returns:
            The exact cryptographic cache key.
        """
        key = self.exact_store.put(entry)
        if self.exact_store.max_entries_per_tenant <= 0:
            return key

        extra_params = entry.metadata.get("extra_params") if isinstance(entry.metadata, dict) else None
        part_key = make_partition_key(entry.tenant_id, entry.model, entry.source_revision, extra_params)
        if part_key not in self._partitions:
            self._partitions[part_key] = []

        self._partitions[part_key] = [
            item for item in self._partitions[part_key] if item[0] != key
        ]

        tf_vec = compute_tf_vector(tokenize(entry.prompt, ngrams=True))
        self._partitions[part_key].append((key, entry, tf_vec))
        return key

    def query(
        self,
        tenant_id: str,
        model: str,
        source_revision: str,
        prompt: str,
        threshold: float = 0.80,
        current_time: Optional[float] = None,
        extra_params: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Optional[CacheEntry], float, str]:
        """Search the cache for an exact match or safe semantic match.

        Restricts search strictly to the matching (tenant_id, model, source_revision, extra_params) partition.

        Args:
            tenant_id: Tenant partition identifier.
            model: Model name.
            source_revision: Source revision hash.
            prompt: User query text.
            threshold: Minimum cosine similarity required for a semantic hit.
            current_time: Current epoch timestamp. Defaults to time.time().
            extra_params: Optional extra parameters.

        Returns:
            Tuple of (matched_entry or None, similarity_score, reason_string).
        """
        now = time.time() if current_time is None else float(current_time)
        exact_hit = self.exact_store.get(
            tenant_id=tenant_id,
            model=model,
            source_revision=source_revision,
            prompt=prompt,
            current_time=now,
            extra_params=extra_params,
        )
        if exact_hit is not None:
            return exact_hit, 1.0, "exact_hit"

        part_key = make_partition_key(tenant_id, model, source_revision, extra_params)
        candidates = self._partitions.get(part_key, [])
        if not candidates:
            return None, 0.0, "partition_empty"

        query_vec = compute_tf_vector(tokenize(prompt, ngrams=True))
        valid_candidates: List[Tuple[str, CacheEntry, Dict[str, float]]] = []
        matching_candidates: List[Tuple[float, CacheEntry]] = []

        for key, entry, vec in candidates:
            if not is_fresh(entry, now):
                continue
            valid_candidates.append((key, entry, vec))
            raw_sim = cosine_similarity(query_vec, vec)
            sim = round(raw_sim, 4)
            if sim >= threshold:
                matching_candidates.append((sim, entry))

        self._partitions[part_key] = valid_candidates

        if not matching_candidates:
            highest_score = max((round(cosine_similarity(query_vec, vec), 4) for _, _, vec in valid_candidates), default=0.0)
            return None, highest_score, "below_threshold"

        matching_candidates.sort(key=lambda x: x[0], reverse=True)

        last_blocked_reason = ""
        for sim, candidate in matching_candidates:
            is_adversarial, reason = check_adversarial_near_miss(prompt, candidate.prompt)
            if is_adversarial:
                last_blocked_reason = reason
                continue
            self.exact_store.touch(candidate, now)
            return candidate, sim, "semantic_hit"

        top_score = matching_candidates[0][0]
        return None, top_score, f"adversarial_blocked: {last_blocked_reason}"

    def invalidate_tenant(self, tenant_id: str) -> int:
        """Purge all exact and semantic entries for a tenant.

        Args:
            tenant_id: Tenant to purge.

        Returns:
            Number of entries removed.
        """
        count = self.exact_store.invalidate_tenant(tenant_id)
        keys_to_purge = [k for k in self._partitions if k[0] == tenant_id]
        for k in keys_to_purge:
            del self._partitions[k]
        return count

    def invalidate_source_revision(self, source_revision: str) -> int:
        """Purge entries bound to an obsolete source revision.

        Args:
            source_revision: Revision tag to purge.

        Returns:
            Number of entries removed.
        """
        count = self.exact_store.invalidate_source_revision(source_revision)
        keys_to_purge = [k for k in self._partitions if k[2] == source_revision]
        for k in keys_to_purge:
            del self._partitions[k]
        return count

    def invalidate_tag(self, tag: str, tenant_id: Optional[str] = None) -> int:
        """Purge entries carrying a specific tag across exact and semantic indices.

        Args:
            tag: Tag to purge.
            tenant_id: Optional tenant filter.

        Returns:
            Number of entries removed.
        """
        count = self.exact_store.invalidate_tag(tag, tenant_id=tenant_id)
        for part_key, items in list(self._partitions.items()):
            if tenant_id is not None and part_key[0] != tenant_id:
                continue
            self._partitions[part_key] = [
                (k, e, v) for k, e, v in items if tag not in e.tags
            ]
        return count

    def copy(self) -> SemanticCacheStore:
        """Create an isolated deep copy of the semantic cache store.

        Returns:
            A cloned SemanticCacheStore containing copies of all active entries.
        """
        new_store = SemanticCacheStore(
            max_entries_per_tenant=self.exact_store.max_entries_per_tenant
        )
        for entry in self.exact_store._entries.values():
            new_store.put(CacheEntry.from_dict(entry.to_dict()))
        return new_store


class CacheAdapter:
    """In-process HTTP middleware adapter simulating transparent caching with RFC 9111 headers."""

    def __init__(self, store: Optional[SemanticCacheStore] = None) -> None:
        """Initialize CacheAdapter with an underlying SemanticCacheStore."""
        self.store = store or SemanticCacheStore()

    def handle_request(
        self,
        request: Dict[str, Any],
        upstream_handler: Optional[Callable[[str], str]] = None,
        threshold: float = 0.80,
        current_time: Optional[float] = None,
        write_through: bool = True,
        authorized_tenant_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Process an LLM query through the caching layer with HTTP headers.

        Args:
            request: Validated query dictionary.
            upstream_handler: Optional callable invoked on cache miss or soft expiry.
            threshold: Semantic similarity threshold.
            current_time: Current epoch timestamp. Defaults to time.time().
            write_through: Whether to populate cache on miss.
            authorized_tenant_id: Optional enforced tenant boundary for access control.

        Returns:
            Dictionary with response text, HTTP headers, and performance audit metadata.
        """
        now = time.time() if current_time is None else float(current_time)
        validated = validate_cache_request(request)

        if authorized_tenant_id is not None and validated["tenant_id"] != authorized_tenant_id:
            raise TenantIsolationError(
                f"Access denied: request tenant '{validated['tenant_id']}' does not match authorized tenant '{authorized_tenant_id}'"
            )

        entry, score, match_type = self.store.query(
            tenant_id=validated["tenant_id"],
            model=validated["model"],
            source_revision=validated["source_revision"],
            prompt=validated["prompt"],
            threshold=threshold,
            current_time=now,
            extra_params=validated["extra_params"],
        )

        headers: Dict[str, Any] = {
            "X-Cache-Tenant": validated["tenant_id"],
            "X-Cache-Model": validated["model"],
            "X-Cache-Revision": validated["source_revision"],
        }

        if entry is not None:
            cache_status = "HIT-EXACT" if match_type == "exact_hit" else "HIT-SEMANTIC"
            age_seconds = max(0, int(now - entry.created_at))
            remaining_ttl = max(0, int((entry.created_at + entry.ttl_seconds) - now)) if entry.ttl_seconds > 0 else int(validated["ttl_seconds"])

            headers["X-Cache"] = cache_status
            headers["X-Cache-Score"] = score
            headers["X-Cache-Match-Type"] = match_type
            headers["X-Cache-Latency-Saved-Ms"] = 350.0
            headers["Age"] = str(age_seconds)
            headers["Cache-Control"] = f"private, max-age={remaining_ttl}"

            if is_soft_expired(entry, now):
                if upstream_handler is not None:
                    revalidated_response = upstream_handler(validated["prompt"])
                    entry.response = revalidated_response
                    entry.created_at = now
                    headers["X-Cache-Revalidated"] = "true"
                    if write_through:
                        self.store.put(entry)
                else:
                    headers["Warning"] = '110 - "Response is Stale"'

            return {
                "status": 200,
                "response": entry.response,
                "headers": headers,
                "cached": True,
            }

        headers["X-Cache"] = "MISS"
        headers["X-Cache-Score"] = score
        headers["X-Cache-Miss-Reason"] = match_type
        headers["X-Cache-Latency-Saved-Ms"] = 0.0
        headers["Age"] = "0"
        headers["Cache-Control"] = f"private, max-age={int(validated['ttl_seconds'])}"

        if upstream_handler is not None:
            upstream_response = upstream_handler(validated["prompt"])
        else:
            upstream_response = f"Simulated generation for: {validated['prompt']}"

        if write_through:
            new_entry = CacheEntry(
                entry_id=hashlib.md5(f"{validated['tenant_id']}:{validated['prompt']}".encode("utf-8")).hexdigest()[:12],
                tenant_id=validated["tenant_id"],
                model=validated["model"],
                source_revision=validated["source_revision"],
                prompt=validated["prompt"],
                response=upstream_response,
                created_at=now,
                ttl_seconds=validated["ttl_seconds"],
                soft_ttl_seconds=validated["soft_ttl_seconds"],
                tags=validated["tags"],
                metadata=dict(validated["metadata"], extra_params=validated["extra_params"]),
            )
            self.store.put(new_entry)

        return {
            "status": 200,
            "response": upstream_response,
            "headers": headers,
            "cached": False,
        }


def make_http_handler_class(adapter: CacheAdapter) -> type:
    """Create a standard library BaseHTTPRequestHandler class bound to a CacheAdapter."""

    class SemanticCacheHTTPHandler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            try:
                raw_cl = self.headers.get("Content-Length")
                if raw_cl is None:
                    self.send_error_response(411, "Length Required: Content-Length header is mandatory")
                    return

                try:
                    content_length = int(raw_cl.strip())
                except (ValueError, TypeError):
                    self.send_error_response(400, f"Bad Request: Non-numeric Content-Length '{raw_cl}'")
                    return

                if content_length < 0:
                    self.send_error_response(400, "Bad Request: Content-Length must be non-negative")
                    return

                if content_length > MAX_HTTP_BODY_BYTES:
                    self.send_error_response(413, f"Payload Too Large: Maximum allowed size is {MAX_HTTP_BODY_BYTES} bytes")
                    return

                try:
                    body_bytes = self.rfile.read(content_length)
                    body_text = body_bytes.decode("utf-8")
                except UnicodeDecodeError:
                    self.send_error_response(400, "Bad Request: Body must be valid UTF-8")
                    return

                try:
                    payload = json.loads(body_text)
                except json.JSONDecodeError as exc:
                    self.send_error_response(400, f"Bad Request: Invalid JSON - {exc.msg}")
                    return

                if not isinstance(payload, dict):
                    self.send_error_response(400, "Bad Request: JSON payload must be an object")
                    return

                caller_tenant = self.headers.get("X-Tenant-ID")
                if caller_tenant:
                    caller_tenant = caller_tenant.strip()
                    payload_tenant = payload.get("tenant_id")
                    if payload_tenant and str(payload_tenant).strip() != caller_tenant:
                        self.send_error_response(
                            403,
                            f"Forbidden: Authenticated tenant '{caller_tenant}' cannot access partition '{payload_tenant}'",
                        )
                        return
                    payload["tenant_id"] = caller_tenant

                try:
                    result = adapter.handle_request(payload, authorized_tenant_id=caller_tenant)
                except TenantIsolationError as tie:
                    self.send_error_response(403, f"Forbidden: {tie}")
                    return
                except ValueError as ve:
                    self.send_error_response(400, f"Bad Request: {ve}")
                    return

                self.send_response(result["status"])
                for header_key, header_val in result["headers"].items():
                    self.send_header(header_key, str(header_val))
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                response_bytes = json.dumps({
                    "response": result["response"],
                    "cached": result["cached"],
                }).encode("utf-8")
                self.wfile.write(response_bytes)

            except Exception as exc:
                self.send_error_response(500, f"Internal Server Error: {exc}")

        def send_error_response(self, status: int, message: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": message}).encode("utf-8"))

        def log_message(self, format: str, *args: Any) -> None:
            pass

    return SemanticCacheHTTPHandler


def analyze_threshold_sensitivity(
    dataset: List[Dict[str, Any]],
    store: Optional[SemanticCacheStore] = None,
    threshold_range: Optional[List[float]] = None,
    current_time: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """Evaluate cache accuracy and savings across multiple threshold cutoffs.

    Identifies the optimal similarity threshold where false hits remain zero.

    Args:
        dataset: List of benchmark query dictionaries.
        store: Seeded SemanticCacheStore.
        threshold_range: List of threshold cutoffs to evaluate.
        current_time: Current epoch timestamp. Defaults to time.time().

    Returns:
        List of sensitivity data points with hits, false hits, and accuracy.
    """
    thresholds = threshold_range or [0.65, 0.75, 0.80, 0.85, 0.90, 0.95]
    curve = []

    for thresh in thresholds:
        isolated_store = store.copy() if store is not None else None
        benchmark = run_correctness_benchmark(
            dataset=dataset,
            store=isolated_store,
            threshold=thresh,
            current_time=current_time,
        )
        curve.append({
            "threshold": thresh,
            "exact_hits": benchmark["exact_hits"],
            "semantic_hits": benchmark["semantic_hits"],
            "false_hits": benchmark["false_hits"],
            "accuracy_pct": benchmark["accuracy_pct"],
            "latency_saved_ms": benchmark["estimated_latency_saved_ms"],
            "safe": benchmark["false_hits"] == 0,
        })
    return curve


def run_correctness_benchmark(
    dataset: List[Dict[str, Any]],
    store: Optional[SemanticCacheStore] = None,
    threshold: float = 0.80,
    current_time: Optional[float] = None,
) -> Dict[str, Any]:
    """Execute a comprehensive correctness benchmark across test cases.

    Evaluates exact queries, paraphrases, cross-tenant isolation, numerical near-misses,
    and negation inversions to verify 0% false-hit rate.

    Args:
        dataset: List of test case dictionaries.
        store: Pre-populated or fresh SemanticCacheStore.
        threshold: Semantic similarity threshold. Defaults to 0.80.
        current_time: Current epoch timestamp. Defaults to time.time().

    Returns:
        Structured evaluation metrics report dictionary.
    """
    cache = store or SemanticCacheStore()
    adapter = CacheAdapter(cache)

    total = len(dataset)
    exact_hits = 0
    semantic_hits = 0
    safe_misses = 0
    false_hits = 0
    near_misses_blocked = 0
    cross_tenant_blocks = 0
    detailed_results = []

    for item in dataset:
        expected = item.get("expected_outcome", "MISS")
        res = adapter.handle_request(
            request=item,
            upstream_handler=lambda p: item.get("expected_response", f"Response for {p}"),
            threshold=threshold,
            current_time=current_time,
            write_through=False,
        )
        actual = res["headers"]["X-Cache"]
        score = res["headers"].get("X-Cache-Score", 0.0)
        reason = res["headers"].get("X-Cache-Miss-Reason", res["headers"].get("X-Cache-Match-Type", ""))

        is_correct = actual == expected
        if actual == "HIT-EXACT":
            exact_hits += 1
        elif actual == "HIT-SEMANTIC":
            semantic_hits += 1
        else:
            safe_misses += 1

        if actual.startswith("HIT") and expected == "MISS":
            false_hits += 1

        if "adversarial_blocked" in str(reason):
            near_misses_blocked += 1
        if item.get("category") == "cross_tenant" and actual == "MISS":
            cross_tenant_blocks += 1

        detailed_results.append({
            "name": item.get("name", "test"),
            "category": item.get("category", "general"),
            "prompt": item["prompt"],
            "expected": expected,
            "actual": actual,
            "score": score,
            "reason": reason,
            "passed": is_correct,
        })

    passed_count = sum(1 for d in detailed_results if d["passed"])
    accuracy_pct = round((passed_count / total * 100.0) if total > 0 else 0.0, 2)
    saved_latency = (exact_hits + semantic_hits) * 350.0

    return {
        "total_queries": total,
        "exact_hits": exact_hits,
        "semantic_hits": semantic_hits,
        "safe_misses": safe_misses,
        "false_hits": false_hits,
        "near_misses_blocked": near_misses_blocked,
        "cross_tenant_blocks": cross_tenant_blocks,
        "passed_queries": passed_count,
        "accuracy_pct": accuracy_pct,
        "estimated_tokens_saved": (exact_hits + semantic_hits) * 128,
        "estimated_latency_saved_ms": saved_latency,
        "compatible": (false_hits == 0 and passed_count == total and total > 0),
        "detailed_results": detailed_results,
    }


def export_report(output_path: str, benchmark_result: Dict[str, Any]) -> None:
    """Write benchmark correctness results to a formatted JSON file.

    Args:
        output_path: File system path for report artifact.
        benchmark_result: Dictionary output of run_correctness_benchmark.
    """
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(benchmark_result, f, indent=2)
