---
id: exact-cache-temperature
title: Read the exact-match cache before it ships
card: cost-capacity
kind: code-reading
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [coding, debugging]
tags: [exact-cache, hashing, eviction, temperature]
minutes: 10
lessons: [phases/11-llm-engineering/11-caching-cost]
manuals: []
practice: []
cheatsheet: [llm-cost-caching]
related: [cost-capacity/two-cache-layers]
updated: 2026-11-03
---

Read this exact-match cache from the caching lesson. Why does it refuse every request with a positive temperature, what goes into the key and why, and what would you change before it runs in production?

```python
class ExactCache:
    def __init__(self, max_size=1000, ttl_seconds=3600):
        self.cache = {}
        self.max_size = max_size
        self.ttl = ttl_seconds
        self.hits = 0
        self.misses = 0

    def _hash(self, model, messages, temperature):
        key_data = json.dumps({"model": model, "messages": messages, "temperature": temperature}, sort_keys=True)
        return hashlib.sha256(key_data.encode()).hexdigest()

    def get(self, model, messages, temperature=0.0):
        if temperature > 0:
            self.misses += 1
            return None
        key = self._hash(model, messages, temperature)
        if key in self.cache:
            entry = self.cache[key]
            if time.time() - entry["timestamp"] < self.ttl:
                self.hits += 1
                entry["access_count"] += 1
                return entry["response"]
            del self.cache[key]
        self.misses += 1
        return None

    def put(self, model, messages, temperature, response):
        if temperature > 0:
            return
        if len(self.cache) >= self.max_size:
            oldest_key = min(self.cache, key=lambda k: self.cache[k]["timestamp"])
            del self.cache[oldest_key]
        key = self._hash(model, messages, temperature)
        self.cache[key] = {"response": response, "timestamp": time.time(), "access_count": 1}
```

## Short answer

The cache serves deterministic calls only. A positive temperature asks for sampled variation, and a replayed answer would remove that variation without telling the caller, so the cache treats those calls as misses and never stores them. The key is a hash of the model, the full message list and the temperature, serialized with sorted keys so that the same request always produces the same bytes. Before production, the key needs every other field that changes the answer, the eviction needs a least-recently-used policy instead of a full scan for the oldest entry, and the expiry needs a sweep, because an expired entry is only removed when someone reads it.

## Full answer

### The temperature guard

Both `get` and `put` return early above zero. The lesson's rule is that exact caching works for deterministic calls: the same model, the same prompt, temperature zero. Serving a stored sample to a caller who asked for variation changes the behavior silently, which is worse than a miss.

### What the key holds, and what it misses

The key covers the model, because the same prompt on another model is another answer, the whole message list, because the system prompt and the context are part of the request, and the temperature. `sort_keys=True` makes the serialization stable, so two callers who build the same dictionary in a different order still hash alike. The key does not cover other fields that change the answer: the sampling parameters beyond temperature, the output limit, the tool definitions and the response format. Add them, or the cache returns an answer produced under different settings.

### Expiry is lazy

The lifetime is checked on read. An entry past its lifetime stays in memory until a read finds it or an eviction drops it. A periodic sweep, or an expiry check during `put`, keeps the memory honest.

### Eviction is a full scan, oldest first

At capacity, `put` scans every entry to find the oldest timestamp. That is linear work on every insert once the cache is full, and it evicts by insertion time, so a popular entry that was inserted early goes first. The lesson's first exercise asks for least-recently-used eviction on the last access time, which the `access_count` field hints at but does not implement.

### Prove that it pays

The cache counts hits and misses. The lesson's cost tracker logs a cache status on every call and computes the saved cost from the hits with the pricing table. Wire that in before you argue about the hit rate.

## Follow-ups

- **Level 2:** Why serialize with sorted keys? Expected: the order of a dictionary can differ between callers, and a different byte order gives a different hash for the same request.
- **Level 3:** Which request fields are missing from the key? Expected: anything else that changes the answer, such as the other sampling parameters, the output limit, the tool definitions and the response format.
- **Level 3:** What does the eviction do at capacity, and what does the exercise ask for instead? Expected: it scans all entries for the oldest timestamp and drops it. The exercise asks for least-recently-used eviction on the last access time.
- **Level 4:** How would you show that this cache pays for itself? Expected: log the cache status on every call and compute the saved cost from the hits with the pricing table, as the lesson's cost tracker does.

## Wrong answers

- "The temperature check is pointless, a cached answer is a good answer." A positive temperature means the caller wants variation. A replay removes it without telling anyone.
- "Hash only the user message." The same question under a different system prompt, model or tool set has a different correct answer.
- "The lifetime removes expired entries." It only hides them on read. The entry stays in memory until a read or an eviction removes it.

## Taught in

The [caching and cost lesson](../../../phases/11-llm-engineering/11-caching-cost/) builds the exact cache, and its first exercise replaces the eviction policy.
