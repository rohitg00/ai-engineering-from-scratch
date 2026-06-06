# Prompt Caching and Context Caching

> Your system prompt is 4,000 tokens. Your RAG context is 20,000 tokens. You send both with every request. You also pay for both — every time. Prompt caching lets the provider keep that prefix warm on their side and bill you 10% of the normal rate on reuse. Used correctly, it cuts inference cost by 50–90% and first-token latency by 40–85%.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 11 · 01 (Prompt Engineering), Phase 11 · 05 (Context Engineering), Phase 11 · 11 (Caching and Cost)
**Time:** ~60 minutes

## The Problem

A coding agent sends the same 15,000-token system prompt to Claude on every turn of a conversation. Twenty turns at $3/M input tokens is $0.90 in input cost alone — before any of the user's actual messages. Multiply by 10,000 daily conversations and the bill hits $9,000/day for text that never changes.

You cannot shrink the prompt without hurting quality. You cannot avoid sending it — the model needs it on every turn. The only move is to stop paying full price for a prefix the provider has already seen.

That move is prompt caching. Anthropic shipped it in August 2024 (with a 1-hour extended-TTL variant in 2025), OpenAI automated it later that year, Google shipped explicit context caching alongside Gemini 1.5, and all three now offer it as a first-class feature on their frontier models.

## The Concept

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**The mechanic.** When a request's prefix matches one from a recent request, the provider serves the KV-cache from the previous run instead of re-encoding the tokens. You pay a small write premium the first time and a large read discount every time after.

**Three provider flavors in 2026.**

| Provider | API style | Hit discount | Write premium | Default TTL | Min cacheable |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | Explicit `cache_control` markers on content blocks | 90% off input | 25% surcharge | 5 min (extendable to 1 hour) | 1,024 tokens (Sonnet/Opus), 2,048 (Haiku) |
| OpenAI | Automatic prefix detection | 50% off input | none | Up to 1 hour (best-effort) | 1,024 tokens |
| Google (Gemini) | Explicit `CachedContent` API | Storage-billed; read at ~25% of normal | Storage fee per token·hour | User-set (default 1 hour) | 4,096 tokens (Flash), 32,768 (Pro) |

**The invariant.** All three cache prefixes only. If any token differs between requests, everything after the first differing token is a miss. Put the *stable* parts at the top, the *variable* parts at the bottom.

### The cache-friendly layout

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

Violate the order — put the user message above the system prompt, interleave dynamic retrievals between few-shots — and the cache never hits.

### The break-even calculation

Anthropic's 25% write premium means a cached block has to be read at least twice to net-save money. 1 write + 1 read averages 0.675x cost per request (saves 32%); 1 write + 10 reads averages 0.205x (saves 80%). Rule of thumb: cache anything you expect to reuse at least 3 times within the TTL.

## Build It

### Step 1: Anthropic prompt caching with explicit markers

```python
import anthropic

client = anthropic.Anthropic()

SYSTEM = [
    {
        "type": "text",
        "text": "You are a senior Python reviewer. Follow the rubric exactly.\n\n" + RUBRIC_15K_TOKENS,
        "cache_control": {"type": "ephemeral"},
    }
]

def review(code: str):
    return client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=SYSTEM,
        messages=[{"role": "user", "content": code}],
    )
```

The `cache_control` marker tells Anthropic to store the block for 5 minutes. Reuse within that window hits; reuse after expires and writes again.

**Response usage fields:**

```python
response = review(code_a)
response.usage
# InputTokensUsage(
#     input_tokens=120,
#     cache_creation_input_tokens=15023,   # paid at 1.25x
#     cache_read_input_tokens=0,
#     output_tokens=340,
# )

response_b = review(code_b)
response_b.usage
# cache_creation_input_tokens=0
# cache_read_input_tokens=15023           # paid at 0.1x
```

Check both fields in CI — if `cache_read_input_tokens` stays at zero across requests, your cache keys are drifting.

### Step 2: one-hour extended TTL

For long-running batch jobs, the 5-minute default expires between jobs. Set `ttl`:

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

1-hour TTL costs 2x the write premium (50% over baseline instead of 25%) but pays back fast on any batch reusing the prefix more than 5 times.

### Step 3: OpenAI automatic caching

OpenAI gives you nothing to configure. Any prefix over 1,024 tokens that matches a recent request gets a 50% discount automatically.

```python
from openai import OpenAI
client = OpenAI()

resp = client.chat.completions.create(
    model="gpt-5",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},   # long and stable
        {"role": "user", "content": user_msg},
    ],
)
resp.usage.prompt_tokens_details.cached_tokens  # the discounted portion
```

Same cache-friendly layout rule applies. Two things kill OpenAI's cache that don't kill Anthropic's: changing the `user` field (used as a cache key component) and reordering tools.

### Step 4: Gemini explicit context caching

Gemini treats the cache as a first-class object you create and name:

```python
from google import genai
from google.genai import types

client = genai.Client()

cache = client.caches.create(
    model="gemini-3-pro",
    config=types.CreateCachedContentConfig(
        display_name="rubric-v3",
        system_instruction=RUBRIC,
        contents=[FEW_SHOT_EXAMPLES],
        ttl="3600s",
    ),
)

resp = client.models.generate_content(
    model="gemini-3-pro",
    contents=["Review this code:\n" + code],
    config=types.GenerateContentConfig(cached_content=cache.name),
)
```

Gemini charges storage per token·hour for as long as the cache lives, and reads at ~25% of normal input rate. This is the right shape when you reuse the same giant prompt across many sessions over days.

### Step 5: measuring hit rate in production

See `code/main.py` for a simulated three-provider accountant that tracks write/read/miss counts and computes blended cost per 1K requests. Gate deploys on a target hit rate — most production Anthropic setups should see >80% read fraction after warmup.

## Pitfalls that still ship in 2026

- **Dynamic timestamps at the top.** `"Current time: 2026-04-22 15:30:02"` at the top of the system prompt. Every request misses. Move timestamps below the cache breakpoint.
- **Tool reordering.** Serialize tools in a stable order — a dict reshuffle between deploys breaks every hit.
- **Free-text near-duplicates.** "You are helpful." vs "You are a helpful assistant." — one byte difference = full miss.
- **Too-small blocks.** Anthropic enforces a 1,024-token floor (2,048 for Haiku). Smaller blocks silently do not cache.
- **Blind cost dashboards.** Split "input tokens" into cached vs uncached. Otherwise a traffic drop looks like a cache win.

## Use It

The 2026 caching stack:

| Situation | Pick |
|-----------|------|
| Agent with stable 10k+ system prompt, many turns | Anthropic `cache_control` with 5-min TTL |
| Batch job reusing a prefix for 30+ minutes | Anthropic with `ttl: "1h"` |
| Serverless endpoints on GPT-5, no custom infra | OpenAI automatic (just make your prefix stable and long) |
| Multi-day reuse of a giant code/doc corpus | Gemini explicit `CachedContent` |
| Cross-provider fallback | Keep the cacheable prefix layout identical across providers so any hit works |

Combine with semantic caching (Phase 11 · 11) for the user-message layer: prompt caching handles *token-identical* reuse, semantic caching handles *meaning-identical* reuse.

## Ship It

Save `outputs/skill-prompt-caching-planner.md`:

```markdown
---
name: prompt-caching-planner
description: Design a cache-friendly prompt layout and pick the right provider caching mode.
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---

Given a prompt (system + tools + few-shot + retrieval + history + user) and a usage profile (requests per hour, TTL needed, provider), output:

1. Layout. Reordered sections with a single cache breakpoint marked; explain which sections are stable, which are volatile.
2. Provider mode. Anthropic cache_control, OpenAI automatic, or Gemini CachedContent. Justify from TTL and reuse pattern.
3. Break-even. Expected reads per write within TTL; net cost vs no-cache with math.
4. Verification plan. CI assertion that cache_read_input_tokens > 0 on the second identical request; dashboard split by cached vs uncached tokens.
5. Failure modes. List the three most likely reasons the cache will miss in this setup (dynamic timestamp, tool reorder, near-duplicate text) and how you will prevent each.

Refuse to ship a cache plan that places a dynamic field above the breakpoint. Refuse to enable 1h TTL without a reuse count that makes the 2x write premium pay back.
```

## Exercises

1. **Easy.** Take a 10-turn conversation with a 5,000-token system prompt against Claude. Run it without `cache_control` and then with. Report the input-token bill for each.
2. **Medium.** Write a test harness that, given a prompt template and a request log, computes the expected hit rate and dollar savings per provider (Anthropic 5m, Anthropic 1h, OpenAI automatic, Gemini explicit).
3. **Hard.** Build a layout optimizer: given a prompt and a list of fields marked `stable=True/False`, rewrite the prompt to put a single cache breakpoint at the maximum cache-friendly position without losing information. Verify on a real Anthropic endpoint.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Prompt caching | "Makes long prompts cheap" | Reusing a provider-side KV-cache for matching prefixes; 50-90% discount on repeated input tokens. |
| `cache_control` | "The Anthropic marker" | Content-block attribute that declares "everything up to here is cacheable"; `{"type": "ephemeral"}`. |
| Cache write | "Paying the premium" | The first request that populates the cache; billed at ~1.25x input rate on Anthropic, free on OpenAI. |
| Cache read | "The discount" | Subsequent requests matching the prefix; billed at 10% (Anthropic), 50% (OpenAI), ~25% (Gemini). |
| TTL | "How long it lives" | Seconds the cache stays warm; Anthropic 5m default (extendable 1h), OpenAI best-effort up to 1h, Gemini user-set. |
| Extended TTL | "1-hour Anthropic cache" | `{"type": "ephemeral", "ttl": "1h"}`; 2x write premium but worth it for batch reuse. |
| Prefix match | "Why my cache missed" | Caches only hit when every token from the start up to the breakpoint is byte-identical. |
| Context caching (Gemini) | "The explicit one" | Google's named, storage-billed cache object; best for multi-day reuse of large corpora. |

## Further Reading

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — `cache_control`, 1h TTL, break-even tables.
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) — automatic prefix matching.
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) — `CachedContent` API and storage pricing.
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) — original launch post with latency numbers.
- Phase 11 · 05 (Context Engineering) — where to slice the prompt so the cache can land.
- Phase 11 · 11 (Caching and Cost) — pair prompt caching with a semantic cache on user messages.
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) — the KV-cache memory model that prompt caching exposes to users; explains why a cached prefix is ~10× cheaper to reread than to recompute.
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) — prefill is the phase prompt caching shortcuts; this paper explains why TTFT drops dramatically on cache hit while TPOT is unaffected.
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) — prompt caching sits alongside speculative decoding, Flash Attention, and MQA/GQA as levers that bend the inference cost curve; read this for the other three.
