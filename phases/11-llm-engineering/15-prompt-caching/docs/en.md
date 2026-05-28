# Prompt Caching and Context Caching

> system prompt が4,000 tokens、RAG context が20,000 tokens あるとします。あなたは毎 request でその両方を送っています。そして毎回、その両方に料金を払っています。Prompt caching は provider 側でその prefix を warm に保ち、reuse 時には通常料金の10%程度で課金できるようにします。正しく使えば inference cost を50-90%、first-token latency を40-85%削減できます。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 11 · 01 (Prompt Engineering), Phase 11 · 05 (Context Engineering), Phase 11 · 11 (Caching and Cost)
**所要時間:** 約60分

## 問題

coding agent が、同じ15,000-token system prompt を conversation の毎 turn で Claude に送っているとします。20 turns で input token が $3/M なら、user の実際の message より前に input cost だけで $0.90 です。1日10,000 conversations に増やすと、変わらない text だけで $9,000/day になります。

prompt を縮めると quality が落ちます。送らないわけにもいきません。model は毎 turn それを必要とします。唯一の手は、provider がすでに見た prefix に full price を払い続けないことです。

その手が prompt caching です。Anthropic は2024年8月に導入し、2025年には 1-hour extended-TTL variant を追加しました。OpenAI は同年後半に自動 caching を導入し、Google は Gemini 1.5 と並行して explicit context caching を公開しました。現在、3社とも frontier model の first-class feature として提供しています。

## The Concept

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**Mechanic。** request の prefix が最近の request の prefix と一致すると、provider は token を再 encode せず、前回 run の KV-cache を使います。初回は小さな write premium を払い、その後の reuse は大きな read discount を受けます。

**2026年の3 provider flavor。**

| Provider | API style | Hit discount | Write premium | Default TTL | Min cacheable |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | content block 上の explicit `cache_control` marker | input 90% off | 25% surcharge | 5 min (1 hour へ extend 可) | 1,024 tokens (Sonnet/Opus), 2,048 (Haiku) |
| OpenAI | automatic prefix detection | input 50% off | none | 最大1 hour (best-effort) | 1,024 tokens |
| Google (Gemini) | explicit `CachedContent` API | storage-billed、read は通常の約25% | token·hour ごとの storage fee | user-set (default 1 hour) | 4,096 tokens (Flash), 32,768 (Pro) |

**Invariant。** 3社とも prefix だけを cache します。request 間で token が1つでも違うと、最初に違った token 以降は miss です。*stable* な部分を上に、*variable* な部分を下に置きます。

### The cache-friendly layout

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

順序を破る、つまり user message を system prompt より上に置く、dynamic retrieval を few-shot の間に挟む、といったことをすると cache は hit しません。

### The break-even calculation

Anthropic の 25% write premium では、cached block は少なくとも2回 read されないと net-save になりません。1 write + 1 read は request あたり平均 0.675x cost (32% savings)、1 write + 10 reads は 0.205x (80% savings) です。rule of thumb: TTL 内で3回以上 reuse される見込みのものを cache します。

## 実装

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

`cache_control` marker は、その block を5分間 store するよう Anthropic に伝えます。その window 内の reuse は hit し、expire 後の reuse は再 write になります。

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

CI で両方の field を確認します。`cache_read_input_tokens` が request 間でずっと zero なら、cache key が drift しています。

### Step 2: one-hour extended TTL

long-running batch job では、5-minute default が job 間で expire します。`ttl` を設定します。

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

1-hour TTL は write premium が2倍 (baseline 比 +50%、default の +25% ではない) ですが、prefix を5回以上 reuse する batch ではすぐ回収できます。

### Step 3: OpenAI automatic caching

OpenAI には設定するものがありません。1,024 tokens を超える prefix が最近の request と一致すれば、自動的に 50% discount になります。

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

同じ cache-friendly layout rule が適用されます。Anthropic では問題にならないのに OpenAI cache を殺すものが2つあります。cache key component として使われる `user` field の変更と、tools の並べ替えです。

### Step 4: Gemini explicit context caching

Gemini は cache を first-class object として create し、name で参照します。

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

Gemini は cache が生きている間、token·hour ごとに storage fee を課金し、read は通常 input rate の約25%です。同じ巨大 prompt を多くの session で days 単位に reuse する場合に合う形です。

### Step 5: measuring hit rate in production

`code/main.py` には、write/read/miss counts を track し、1K requests あたりの blended cost を計算する simulated three-provider accountant があります。target hit rate を deploy gate にしてください。production Anthropic setup の多くは warmup 後に >80% read fraction を見るべきです。

## Pitfalls that still ship in 2026

- **Dynamic timestamps at the top。** system prompt の先頭に `"Current time: 2026-04-22 15:30:02"` を置くと、毎 request miss します。timestamp は cache breakpoint の下に移します。
- **Tool reordering。** tools は stable order で serialize します。deploy 間の dict reshuffle はすべての hit を壊します。
- **Free-text near-duplicates。** "You are helpful." と "You are a helpful assistant." のように1 byte でも違えば full miss です。
- **Too-small blocks。** Anthropic は 1,024-token floor (Haiku は 2,048) を enforce します。小さい block は silently cache されません。
- **Blind cost dashboards。** "input tokens" を cached と uncached に分けます。そうしないと traffic drop が cache win に見えます。

## Use It

2026年の caching stack:

| Situation | Pick |
|-----------|------|
| stable 10k+ system prompt を持つ multi-turn agent | Anthropic `cache_control` with 5-min TTL |
| 30分以上 prefix を reuse する batch job | Anthropic with `ttl: "1h"` |
| GPT-5 上の serverless endpoints、custom infra なし | OpenAI automatic (prefix を stable かつ long にするだけ) |
| 巨大 code/doc corpus の multi-day reuse | Gemini explicit `CachedContent` |
| cross-provider fallback | cacheable prefix layout を provider 間で同一にし、どの hit でも使えるようにする |

user-message layer には semantic caching (Phase 11 · 11) と組み合わせます。prompt caching は *token-identical* reuse を扱い、semantic caching は *meaning-identical* reuse を扱います。

## Ship It

`outputs/skill-prompt-caching-planner.md` を保存します:

```markdown
---
name: prompt-caching-planner
description: Design a cache-friendly prompt layout and pick the right provider caching mode.
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---

prompt (system + tools + few-shot + retrieval + history + user) と usage profile (requests per hour、TTL needed、provider) が与えられたら、次を出力する:

1. Layout。section を並べ替え、single cache breakpoint を mark する。どの section が stable で、どれが volatile かを説明する。
2. Provider mode。Anthropic cache_control、OpenAI automatic、Gemini CachedContent のいずれか。TTL と reuse pattern から理由を述べる。
3. Break-even。TTL 内の expected reads per write。no-cache と比べた net cost を計算式付きで示す。
4. Verification plan。2回目の identical request で cache_read_input_tokens > 0 を CI で assert する。dashboard は cached と uncached tokens を分ける。
5. Failure modes。この setup で cache miss になる最もありそうな理由を3つ (dynamic timestamp、tool reorder、near-duplicate text) 挙げ、それぞれの防止策を書く。

dynamic field を breakpoint より上に置く cache plan は ship しない。reuse count が 2x write premium を回収できることを示さずに 1h TTL を有効にしない。
```

## Exercises

1. **Easy。** 5,000-token system prompt を持つ 10-turn conversation を Claude に対して実行します。`cache_control` なしとありの両方で実行し、それぞれの input-token bill を報告します。
2. **Medium。** prompt template と request log を受け取り、provider ごとの expected hit rate と dollar savings (Anthropic 5m、Anthropic 1h、OpenAI automatic、Gemini explicit) を計算する test harness を書きます。
3. **Hard。** layout optimizer を作ります。prompt と `stable=True/False` が付いた field list を受け取り、情報を失わずに maximum cache-friendly position へ single cache breakpoint を置くよう prompt を rewrite します。real Anthropic endpoint で verify します。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Prompt caching | "long prompt を安くする" | matching prefix に対する provider-side KV-cache を reuse すること。repeated input token が50-90% discount になる。 |
| `cache_control` | "Anthropic marker" | "ここまで cacheable" と宣言する content-block attribute。`{"type": "ephemeral"}`。 |
| Cache write | "premium を払う" | cache を populate する最初の request。Anthropic では約1.25x input rate、OpenAI では free。 |
| Cache read | "discount" | prefix が一致する subsequent request。Anthropic は10%、OpenAI は50%、Gemini は約25%で課金。 |
| TTL | "どのくらい生きるか" | cache が warm に保たれる秒数。Anthropic は default 5m (1h に extend 可)、OpenAI は best-effort 最大1h、Gemini は user-set。 |
| Extended TTL | "1-hour Anthropic cache" | `{"type": "ephemeral", "ttl": "1h"}`。write premium は2倍だが batch reuse では価値がある。 |
| Prefix match | "cache が miss した理由" | cache は start から breakpoint までのすべての token が byte-identical な場合にだけ hit する。 |
| Context caching (Gemini) | "explicit なやつ" | Google の named, storage-billed cache object。large corpus の multi-day reuse に最適。 |

## 参考文献

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — `cache_control`、1h TTL、break-even table。
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) — automatic prefix matching。
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) — `CachedContent` API と storage pricing。
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) — latency number を含む original launch post。
- Phase 11 · 05 (Context Engineering) — cache が landing できるよう prompt をどこで slice するか。
- Phase 11 · 11 (Caching and Cost) — prompt caching と user message 向け semantic cache の組み合わせ。
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) — prompt caching が user に expose する KV-cache memory model。cached prefix reread が recompute より約10倍安い理由。
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) — prompt caching が shortcut する prefill phase を説明します。cache hit で TTFT が大きく下がり TPOT は変わらない理由。
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) — prompt caching は speculative decoding、Flash Attention、MQA/GQA と並ぶ inference cost curve を曲げる lever です。他の3つを読む入口として。
