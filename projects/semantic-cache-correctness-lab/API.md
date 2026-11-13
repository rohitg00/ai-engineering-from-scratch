# Public implementation contract

Semantic Cache Correctness Lab evaluates exact versus semantic caching for multi-tenant LLM applications, enforcing partition isolation, freshness boundaries, and adversarial near-miss guardrails.

### main.py

```python
class CacheEntry:
    entry_id: str
    tenant_id: str
    model: str
    source_revision: str
    prompt: str
    response: str
    created_at: float
    ttl_seconds: float
    soft_ttl_seconds: float = 0.0
    last_accessed_at: float = 0.0
    hit_count: int = 0
    tags: List[str] = []
    metadata: Dict[str, Any] = {}
    def to_dict(self) -> Dict[str, Any]
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> CacheEntry

def compute_exact_key(tenant_id: str, model: str, source_revision: str, prompt: str, extra_params: Optional[Dict[str, Any]] = None) -> str
def make_partition_key(tenant_id: str, model: str, source_revision: str, extra_params: Optional[Dict[str, Any]] = None) -> Tuple[str, str, str, str]
def is_fresh(entry: CacheEntry, current_time: Optional[float] = None) -> bool
def is_soft_expired(entry: CacheEntry, current_time: Optional[float] = None) -> bool
def validate_cache_request(request: Dict[str, Any]) -> Dict[str, Any]

class ExactCacheStore:
    def __init__(self, max_entries_per_tenant: int = 1000) -> None
    def put(self, entry: CacheEntry) -> str
    def touch(self, entry: CacheEntry, current_time: Optional[float] = None) -> None
    def get(self, tenant_id: str, model: str, source_revision: str, prompt: str, current_time: Optional[float] = None, extra_params: Optional[Dict[str, Any]] = None) -> Optional[CacheEntry]
    def invalidate_tenant(self, tenant_id: str) -> int
    def invalidate_source_revision(self, source_revision: str) -> int
    def invalidate_tag(self, tag: str, tenant_id: Optional[str] = None) -> int
    def stats(self) -> Dict[str, Any]

def tokenize(text: str, ngrams: bool = True) -> List[str]
def compute_tf_vector(tokens: List[str]) -> Dict[str, float]
def cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float
def extract_numbers_and_units(text: str) -> List[str]
def extract_numbers(text: str) -> List[str]
def extract_negations(text: str) -> Set[str]
def extract_entities(text: str) -> Set[str]
def check_adversarial_near_miss(query: str, cached_prompt: str) -> Tuple[bool, str]

class SemanticCacheStore:
    def __init__(self, max_entries_per_tenant: int = 1000) -> None
    def put(self, entry: CacheEntry) -> str
    def query(self, tenant_id: str, model: str, source_revision: str, prompt: str, threshold: float = 0.80, current_time: Optional[float] = None, extra_params: Optional[Dict[str, Any]] = None) -> Tuple[Optional[CacheEntry], float, str]
    def invalidate_tenant(self, tenant_id: str) -> int
    def invalidate_source_revision(self, source_revision: str) -> int
    def invalidate_tag(self, tag: str, tenant_id: Optional[str] = None) -> int
    def copy(self) -> SemanticCacheStore

class CacheAdapter:
    def __init__(self, store: Optional[SemanticCacheStore] = None) -> None
    def handle_request(self, request: Dict[str, Any], upstream_handler: Optional[Callable[[str], str]] = None, threshold: float = 0.80, current_time: Optional[float] = None, write_through: bool = True, authorized_tenant_id: Optional[str] = None) -> Dict[str, Any]

def make_http_handler_class(adapter: CacheAdapter) -> type
def analyze_threshold_sensitivity(dataset: List[Dict[str, Any]], store: Optional[SemanticCacheStore] = None, threshold_range: Optional[List[float]] = None, current_time: Optional[float] = None) -> List[Dict[str, Any]]
def run_correctness_benchmark(dataset: List[Dict[str, Any]], store: Optional[SemanticCacheStore] = None, threshold: float = 0.80, current_time: Optional[float] = None) -> Dict[str, Any]
def export_report(output_path: str, benchmark_result: Dict[str, Any]) -> None
```

### CLI invocation

```bash
python3 cli.py --benchmark samples/benchmark.json --output report.json --threshold 0.85 --sensitivity --strict
```

### Exit codes

- `0`: All evaluated benchmark cases pass with 0% false hit rate and 100% expected outcome compatibility. The CLI also exits 0 when `--strict` is omitted.
- `1`: When `--strict` is enabled and any false hits occur or any query outcome fails expectation.
- `2`: When benchmark dataset file cannot be found.
