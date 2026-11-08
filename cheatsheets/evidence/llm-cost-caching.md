# Evidence: cheatsheets/llm-cost-caching.md

Abbreviations: L11 = phases/11-llm-engineering/11-caching-cost, L15 = phases/11-llm-engineering/15-prompt-caching, L14 = phases/17-infrastructure-and-production/14-prompt-semantic-caching, B15 = phases/17-infrastructure-and-production/15-batch-apis, F27 = phases/17-infrastructure-and-production/27-finops-llms, TC = projects/token-counter-and-cost-meter, BP = projects/agent-budget-planner. d = docs/en.md.

## Tasks (task-table, 8 rows)
- calculate_cost(model, input_tokens, output_tokens, cached_input_tokens=0): L11/code/caching_cost.py:25, L11/d:239
- "cache_control": {"type": "ephemeral"}: L15/d:68
- "cache_control": {"type": "ephemeral", "ttl": "1h"}: L15/d:108
- response.usage.cache_read_input_tokens: L11/d:779
- resp.usage.prompt_tokens_details.cached_tokens: L15/d:128
- client.caches.create(model=..., config=...): L15/d:143-150
- config=types.GenerateContentConfig(cached_content=cache.name): L15/d:156
- route_model(query, tier="pro"): L11/code/caching_cost.py:320, L11/d:559

## Cache the stable prefix (annotated-code, 12 lines)
- SYSTEM list with "type": "text", "text", "cache_control": {"type": "ephemeral"}: L15/d:64-70
- 5 min TTL: L15/d:81
- client.messages.create, max_tokens=1024, system=SYSTEM, messages user content: L15/d:73-78
- stable first, variable last: L15/d:32
- response.usage.cache_creation_input_tokens, response.usage.cache_read_input_tokens: L11/d:778-779
- paid at 1.25x, paid at 0.1x: L15/d:90, L15/d:98

## Two cache layers (architecture, 6 nodes, 5 edges)
- User query: L14/d:43
- L1 semantic cache, embed and cosine 0.95+: L14/d:43
- L2 prefix cache, provider KV reuse: L14/d:31
- Model, full price on a miss: L14/d:43 (on miss, call LLM)
- Cached response, no LLM call: L14/d:43 (on hit, return the cached response)
- Cost tracker, tokens, cost, user_id: L11/d:137-147, L11/d:470

## Provider prompt caching (comparison, 6 rows)
- API style row: L15/d:28-30
- Hit price row: L15/d:28-30
- Write cost row: L15/d:28-30
- Default TTL row: L15/d:28-30
- Min prefix row: L15/d:28-30
- Use when row: L15/d:180, 182, 183

## Defaults in the code (defaults, 8 rows)
- similarity_threshold 0.85: L11/code/caching_cost.py:116. Demo 0.75: line 368
- ttl_seconds 3600 in both caches: L11/code/caching_cost.py:47, 116
- max_size 1000 in ExactCache: L11/code/caching_cost.py:46-47. Oldest timestamp eviction: L11/d:295-297
- temperature 0.0, skip above 0: L11/code/caching_cost.py:58, L11/d:277-280
- monthly_budget 1000.0: L11/code/caching_cost.py:231
- spend_cap_multiplier 2.0, cap is contract times it: F27/code/main.py:20, 49
- kill_z_score 4.0, pause: F27/code/main.py:21, 57-58
- Anthropic TTL 5 min, "ttl": "1h": L15/d:28, 108

## Submit a batch (annotated-code, 10 lines)
- requests.append with custom_id, method POST, url /v1/chat/completions, body model and messages: L11/d:815-824
- client.files.create(file=open("batch_input.jsonl", "rb"), purpose="batch"): L11/d:830
- client.batches.create(input_file_id=batch_file.id, endpoint=..., completion_window="24h"): L11/d:831
- 50% off, results in 24 hours: L11/d:835

## Numbers that matter (concepts, 8)
- Cache write 1.25x on 5 min, 2x on 1 hour: L14/d:92
- Cache read $0.30/M against $3.00/M, ten times cheaper: L14/d:33, 91
- Break-even 0.675x and 0.205x: L15/d:49
- Reuse 3 times within the TTL: L15/d:49
- Batch 50% off input and output, 24 h guaranteed, 2 to 6 h typical: B15/d:77-78
- Batch plus cache about 10%: B15/d:79
- Routing saves 40 to 70%: L11/d:133
- Stacked about 5 to 10% of baseline: F27/d:106

## Budget guards in order (flow, 6 steps)
1. Rate limit 2 to 3x peak, 429 with Retry-After: F27/d:52
2. Daily spend cap 1.5 to 3x, tighten and alert: F27/d:54
3. Kill switch z-score above 4, auto-pause, page on-call: F27/d:56
4. 70% warning: L11/d:168, L11/code/caching_cost.py:260-261
5. 85% throttle, cheaper models only: L11/d:169, L11/code/caching_cost.py:258
6. 95% stop, cached responses only: L11/d:170, L11/code/caching_cost.py:256

## Troubleshooting (troubleshooting, 6 rows)
- Hit rate 7% from time and request ID in the prompt, move dynamic text after the boundary: L14/d:21, 71, 81
- Parallel calls give N writes, calls beat the first write, send request 1 alone: L14/d:56, 58
- cache_read_input_tokens stays 0, keys drift, check in CI: L15/d:101
- Under 1,024 tokens, 2,048 on Haiku, does not cache: L15/d:171
- OpenAI user field and tool reorder, serialize tools: L15/d:131, 169
- "cached exceeds input", cached is a subset of input: TC/solution/stage2.rs:15, TC/solution/stage3.rs:4, TC/project.json:65

## Run the code (command-table, 5 rows)
- python main.py: L15/code/main.py:11
- --stage 1 --path <workspace>: TC/README.md:15, BP/README.md:13
- --all --solution --strict: BP/README.md:31, TC/README.md:40
- usage.py <file> --out usage-ledger.json: TC/README.md:30
- python3 cli.py samples/input.json --mode execute --output budget.json: BP/README.md:21, 33

## Project ledgers (concepts, 7)
- Rates integer nano-dollars per token, fixture inputs: TC/README.md:37
- estimate: text.chars().count() over chars_per_token, ceiling, ratio 0 error: TC/solution/stage1.rs:2-7
- cost: usage.input - usage.cached at input rate plus cached and output, checked_mul: TC/solution/stage3.rs:6-13
- reserve: spent + sum(holds) + amount > limit raises "budget exceeded": BP/solution/main.py:26-27
- settle: "actual cost exceeds reservation": BP/solution/main.py:39-40
- Statuses completed, rejected, needs_reconciliation: BP/solution/cli.py:25, 40, 50, BP/API.md:7
- Sample run 190 units against 100, two jobs pass, 95 settle: BP/README.md:38

## Q&A (qa, 3)
- Prompt cache same tokens, semantic cache same meaning: L15/d:186
- Threshold 0.92 to 0.95: L11/d:81. Wrong answers at 0.85: L14/d:115
- Cost per resolved query, not $/M tokens: F27/d:113

## Tips (tips, 3)
- Stamp user_id, task_id, route, tenant_id: F27/d:31-37
- Four token layers prompt, tool, memory, response: F27/d:41-48
- Read fraction above 80% gate: L15/d:164
