---
id: llm-cost-caching
title: LLM Cost, Caching and Batch APIs
code: LC
subtitle: Price each call, cache prefixes and meanings, batch offline work and cap spend. Python and Rust from the lessons.
hue: 40
sources: phases/11-llm-engineering/11-caching-cost, phases/11-llm-engineering/15-prompt-caching, phases/17-infrastructure-and-production/14-prompt-semantic-caching, phases/17-infrastructure-and-production/15-batch-apis, phases/17-infrastructure-and-production/27-finops-llms, projects/token-counter-and-cost-meter, projects/agent-budget-planner
source_hash: 379e5b3c4af278f4
---

## Tasks
type: task-table
span: 2
from: phases/11-llm-engineering/11-caching-cost/docs/en.md, phases/11-llm-engineering/11-caching-cost/code/caching_cost.py, phases/11-llm-engineering/15-prompt-caching/docs/en.md

| Task | Code |
|---|---|
| Price one call | `calculate_cost(model, input_tokens, output_tokens, cached_input_tokens=0)` |
| Mark a cacheable block | `"cache_control": {"type": "ephemeral"}` |
| Keep the block for one hour | `"cache_control": {"type": "ephemeral", "ttl": "1h"}` |
| Read Anthropic cache hits | `response.usage.cache_read_input_tokens` |
| Read OpenAI cache hits | `resp.usage.prompt_tokens_details.cached_tokens` |
| Create a Gemini cache | `client.caches.create(model=<model>, config=...)` |
| Use the Gemini cache | `config=types.GenerateContentConfig(cached_content=cache.name)` |
| Route a query to the cheapest model | `route_model(query, tier="pro")` |

## Cache the stable prefix
type: annotated-code
lang: python
from: phases/11-llm-engineering/15-prompt-caching/docs/en.md, phases/11-llm-engineering/11-caching-cost/docs/en.md

```python
SYSTEM = [{
    "type": "text",
    "text": RUBRIC,  # stable text first
    "cache_control": {"type": "ephemeral"},  # 5 min TTL
}]
response = client.messages.create(
    model="<model>", max_tokens=1024,
    system=SYSTEM,
    messages=[{"role": "user", "content": code}],  # variable text last
)
response.usage.cache_creation_input_tokens  # paid at 1.25x
response.usage.cache_read_input_tokens  # paid at 0.1x
```

## Numbers that matter
type: concepts
from: phases/11-llm-engineering/15-prompt-caching/docs/en.md, phases/17-infrastructure-and-production/14-prompt-semantic-caching/docs/en.md, phases/17-infrastructure-and-production/15-batch-apis/docs/en.md, phases/17-infrastructure-and-production/27-finops-llms/docs/en.md, phases/11-llm-engineering/11-caching-cost/docs/en.md

- **Cache write**: 1.25x base for 5 min TTL. 2x base for 1 hour TTL.
- **Cache read**: $0.30/M against $3.00/M fresh. Ten times cheaper.
- **Break-even**: 1 write and 1 read is 0.675x. 1 write and 10 reads is 0.205x.
- **Reuse rule**: cache a block that you read 3 times or more in the TTL.
- **Batch**: 50% off input and output. 24 h guaranteed, 2 to 6 h typical.
- **Batch plus cache**: about 10% of the sync uncached bill.
- **Model routing**: saves 40 to 70% of model cost.
- **All levers stacked**: about 5 to 10% of the naive baseline.

## Budget guards in order
type: flow
from: phases/17-infrastructure-and-production/27-finops-llms/docs/en.md, phases/11-llm-engineering/11-caching-cost/docs/en.md, phases/11-llm-engineering/11-caching-cost/code/caching_cost.py

1. **Rate limit**: per tenant at 2 to 3x expected peak. Returns 429 with `Retry-After`.
2. **Daily spend cap**: 1.5 to 3x the contracted ceiling. Tighten the rate and alert.
3. **Kill switch**: spend z-score above 4 against the tenant baseline. Auto-pause and page on-call.
4. **70% of budget**: `CostTracker` adds a warning alert.
5. **85% of budget**: throttle. Route to cheaper models only.
6. **95% of budget**: stop. Serve cached responses only.

## Two cache layers
type: architecture
from: phases/17-infrastructure-and-production/14-prompt-semantic-caching/docs/en.md, phases/11-llm-engineering/11-caching-cost/docs/en.md

```arch
node | query | 1,1 | User query | | client
node | l1 | 2,1 | L1 semantic cache | embed, cosine 0.95+ | store
node | l2 | 3,1 | L2 prefix cache | provider KV reuse | store
node | llm | 4,1 | Model | full price on a miss | model
node | hit | 2,2 | Cached response | no LLM call |
node | track | 4,2 | Cost tracker | tokens, cost, user_id | process
edge | query | l1 | embed
edge | l1 | hit | hit
edge | l1 | l2 | miss
edge | l2 | llm | prefix
edge | llm | track | usage
```

## Provider prompt caching
type: comparison
from: phases/11-llm-engineering/15-prompt-caching/docs/en.md

| Factor | Anthropic | OpenAI | Gemini |
|---|---|---|---|
| API style | `cache_control` markers | Automatic prefix | `CachedContent` API |
| Hit price | 90% off input | 50% off input | About 25% of normal |
| Write cost | 25% surcharge | None | Storage per token·hour |
| Default TTL | 5 min, 1 hour option | Up to 1 hour | User-set, 1 hour |
| Min prefix | 1,024 tokens, 2,048 Haiku | 1,024 tokens | 4,096 Flash, 32,768 Pro |
| Use when | Stable 10k+ prompt, many turns | Serverless, no custom infra | Multi-day reuse of a corpus |

## Defaults in the code
type: defaults
from: phases/11-llm-engineering/11-caching-cost/code/caching_cost.py, phases/17-infrastructure-and-production/27-finops-llms/code/main.py, phases/11-llm-engineering/15-prompt-caching/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `similarity_threshold` | 0.85 | `SemanticCache`. The demo uses 0.75 |
| `ttl_seconds` | 3600 | Exact and semantic caches |
| `max_size` | 1000 | `ExactCache`. Evicts the oldest entry |
| `temperature` | 0.0 | Above 0 the exact cache skips |
| `monthly_budget` | 1000.0 | `CostTracker` alert base |
| `spend_cap_multiplier` | 2.0 | Cap is contract times this |
| `kill_z_score` | 4.0 | Pauses the tenant above it |
| Anthropic TTL | 5 min | `"ttl": "1h"` for one hour |

## Submit a batch
type: annotated-code
lang: python
from: phases/11-llm-engineering/11-caching-cost/docs/en.md

```python
requests.append({
    "custom_id": f"request-{i}",  # match results to inputs
    "method": "POST", "url": "/v1/chat/completions",
    "body": {"model": "<model>", "messages": [{"role": "user", "content": query}]},
})
batch_file = client.files.create(file=open("batch_input.jsonl", "rb"), purpose="batch")
batch = client.batches.create(
    input_file_id=batch_file.id,
    endpoint="/v1/chat/completions",
    completion_window="24h",  # 50% off, results in 24 hours
)
```

## Troubleshooting
type: troubleshooting
from: phases/17-infrastructure-and-production/14-prompt-semantic-caching/docs/en.md, phases/11-llm-engineering/15-prompt-caching/docs/en.md, phases/11-llm-engineering/11-caching-cost/docs/en.md, projects/token-counter-and-cost-meter/solution

| Symptom | Cause | Fix |
|---|---|---|
| Hit rate near 7% | Time or request ID in the prefix | Put dynamic text after the boundary |
| Parallel calls: N writes | Calls beat the first write | Send request 1 alone, then the rest |
| `cache_read_input_tokens` stays 0 | Cache keys drift | Check both usage fields in CI |
| Block does not cache | Under 1,024 tokens (2,048 Haiku) | Make the cached block larger |
| OpenAI hits stop on deploy | Tool reorder or new `user` field | Serialize tools in a stable order |
| `cached exceeds input` | Cached counted as extra tokens | Cached is a subset of input |

## Run the code
type: command-table
span: 2
from: phases/11-llm-engineering/15-prompt-caching/code/main.py, projects/token-counter-and-cost-meter/README.md, projects/agent-budget-planner/README.md, projects/agent-budget-planner/solution/cli.py

| Command | What it does |
|---|---|
| `python main.py` | Runs the lesson simulator in `code/` |
| `python3 scripts/project_test.py <project> --stage 1 --path <workspace>` | Grades one stage |
| `python3 scripts/project_test.py <project> --all --solution --strict` | Grades the reference solution |
| `python3 <workspace>/usage.py <usage-file> --out usage-ledger.json` | Replays recorded usage into a ledger |
| `python3 cli.py samples/input.json --mode execute --output budget.json` | Runs budget planner jobs |

## Project ledgers
type: concepts
span: 2
from: projects/token-counter-and-cost-meter/solution, projects/token-counter-and-cost-meter/README.md, projects/agent-budget-planner/solution/main.py, projects/agent-budget-planner/solution/cli.py, projects/agent-budget-planner/README.md

- **Rates**: integer nano-dollars per token. Fixture inputs, not provider prices.
- **estimate**: `text.chars().count()` over `chars_per_token`, rounded up. Ratio 0 is an error.
- **cost**: `usage.input - usage.cached` at the input rate, plus cached and output. Each uses `checked_mul`.
- **reserve**: `spent + sum(holds) + amount > limit` raises `budget exceeded`.
- **settle**: actual above the hold raises `actual cost exceeds reservation`.
- **Statuses**: `completed`, `rejected`, `needs_reconciliation`.
- **Sample run**: 190 units against a 100-unit limit. Two jobs pass. 95 units settle.

## Q&A
type: qa
from: phases/11-llm-engineering/15-prompt-caching/docs/en.md, phases/11-llm-engineering/11-caching-cost/docs/en.md, phases/17-infrastructure-and-production/14-prompt-semantic-caching/docs/en.md, phases/17-infrastructure-and-production/15-batch-apis/docs/en.md, phases/17-infrastructure-and-production/27-finops-llms/docs/en.md

- **Prompt or semantic cache?** Prompt: same tokens. Semantic: same meaning.
- **Which semantic threshold?** 0.92 to 0.95. At 0.85 wrong answers appear.
- **Which unit metric?** Cost per resolved query, not $/M tokens.

## Tips
type: tips
from: phases/17-infrastructure-and-production/27-finops-llms/docs/en.md, phases/11-llm-engineering/15-prompt-caching/docs/en.md

- Stamp `user_id`, `task_id`, `route` and `tenant_id` on every call.
- Split tokens: prompt, tool, memory, response.
- Gate deploys on read fraction above 80%.
