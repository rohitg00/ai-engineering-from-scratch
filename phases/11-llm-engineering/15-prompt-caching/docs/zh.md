# Prompt 缓存与 Context 缓存（Prompt Caching and Context Caching）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 你的 system prompt 有 4,000 个 token。你的 RAG context 有 20,000 个 token。每次请求两份都要发出去，也都按 token 计费——每一次都付钱。Prompt caching（提示缓存）让 provider 在他们那侧把这段前缀保持「热」状态，复用时只按正常价的 10% 计费。用对了，可以把推理成本砍掉 50–90%，把首 token 延迟降低 40–85%。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 11 · 01 (Prompt Engineering), Phase 11 · 05 (Context Engineering), Phase 11 · 11 (Caching and Cost)
**Time:** ~60 minutes

## 问题（The Problem）

一个写代码的 agent，每一轮对话都要把同一份 15,000-token 的 system prompt 发给 Claude。20 轮、按 $3/M 输入 token 计算，仅 input 成本就 $0.90——这还不算用户真正说的话。每天 10,000 次对话乘起来，光是为这段从不变化的文本，每天就要付 $9,000。

你不能为了省钱把 prompt 砍短——那会伤质量。你也不能不发——模型每一轮都需要它。唯一的办法是：别再为 provider 已经看过的前缀付全价。

这条路就是 prompt caching。Anthropic 在 2024 年 8 月上线了它（2025 年又加了一个 1 小时延长 TTL 的变体），OpenAI 在同年晚些时候做成了自动化，Google 在 Gemini 1.5 一起发了显式的 context caching，三家现在都在自己的前沿模型上把它列为头等功能。

## 概念（The Concept）

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**机制。** 当一次请求的前缀和最近某次请求匹配时，provider 直接复用上次留下的 KV cache，而不是重新对这些 token 做编码。第一次写入要付一点点写入溢价，之后每一次读取都享受很大的折扣。

**2026 年的三家 provider 三种风格。**

| Provider | API 风格 | 命中折扣 | 写入溢价 | 默认 TTL | 最小可缓存量 |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | 在 content block 上显式打 `cache_control` 标记 | input 9 折优惠（即只付 10%） | 加价 25% | 5 分钟（可延长到 1 小时） | 1,024 tokens（Sonnet/Opus），2,048（Haiku） |
| OpenAI | 自动检测前缀 | input 5 折 | 无 | 至多 1 小时（best-effort） | 1,024 tokens |
| Google (Gemini) | 显式的 `CachedContent` API | 按存储计费；读取约为正常价的 25% | 按 token·小时收存储费 | 用户自定（默认 1 小时） | 4,096 tokens（Flash），32,768（Pro） |

**不变量。** 三家都只对前缀做缓存。只要两次请求之间有任何一个 token 不同，从第一个不同的 token 之后的所有内容都算 miss。把*稳定*的部分放最上面，把*易变*的部分放最下面。

### 缓存友好的版式

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

打破这个顺序——把用户消息放在 system prompt 上面、把动态检索结果穿插在 few-shot 之间——缓存就永远不会命中。

### 盈亏平衡的算术

Anthropic 的 25% 写入溢价意味着一个被缓存的块至少要被读 2 次才能净省钱。1 写 + 1 读，每次请求平均成本是 0.675x（省 32%）；1 写 + 10 读，每次请求平均 0.205x（省 80%）。经验法则：在 TTL 之内你预期会复用至少 3 次的内容，就值得缓存。

## 动手实现（Build It）

### 第 1 步：用显式标记开启 Anthropic prompt caching

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

`cache_control` 标记告诉 Anthropic 把这个块存 5 分钟。在这窗口内复用就命中；过期后再用就重新写入。

**响应里的 usage 字段：**

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

在 CI 里两个字段都要查——如果 `cache_read_input_tokens` 跨多次请求一直为 0，说明你的 cache key 在漂移。

### 第 2 步：1 小时延长 TTL

对于跑得久的批处理作业，5 分钟默认值会在两个 job 之间过期。设置 `ttl`：

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

1 小时 TTL 的写入溢价是 2 倍（即比基线高 50%，而不是 25%），但只要这段前缀在一个 batch 里被复用超过 5 次，就能很快回本。

### 第 3 步：OpenAI 自动缓存

OpenAI 不让你配任何东西。任何超过 1,024 token、且与最近请求匹配的前缀，自动获得 5 折优惠。

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

同一条「缓存友好版式」规则适用。有两件事会杀掉 OpenAI 的缓存、但不会杀掉 Anthropic 的：改 `user` 字段（OpenAI 把它作为 cache key 的一部分），以及 tool 顺序变化。

### 第 4 步：Gemini 显式 context caching

Gemini 把 cache 当成一个一等公民对象，由你创建并命名：

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

只要 cache 还活着，Gemini 就按 token·小时收存储费，读取大约是正常 input 价的 25%。当你要把同一份巨大 prompt 在很多 session 里、跨好几天反复用的时候，这种形态最合适。

### 第 5 步：在生产里测命中率

参见 `code/main.py`，里面有一个模拟的三家 provider 的会计程序，统计 write/read/miss 数量并按 1K 请求算混合成本。在部署门槛上设一个目标命中率——大多数 Anthropic 生产环境在预热之后应该能看到 read fraction（读命中比例）>80%。

## 2026 年依然在线上犯的坑（Pitfalls that still ship in 2026）

- **顶部放动态时间戳。** 在 system prompt 顶部写 `"Current time: 2026-04-22 15:30:02"`。每次请求都 miss。把时间戳挪到 cache 断点之下。
- **Tool 重排序。** 让 tools 序列化的顺序保持稳定——两次部署之间一个 dict 的洗牌就能让所有命中崩盘。
- **自由文本接近重复。** "You are helpful." 和 "You are a helpful assistant." ——一个字节的差就是整段 miss。
- **块太小。** Anthropic 强制 1,024 token 下限（Haiku 是 2,048）。低于阈值的块会静默地不缓存。
- **盲目的成本仪表盘。** 把 "input tokens" 拆成 cached 和 uncached。否则一次流量下跌会被误读成缓存胜利。

## 用起来（Use It）

2026 年的缓存技术栈：

| 场景 | 选什么 |
|-----------|------|
| Agent，10k+ 的稳定 system prompt，多轮对话 | Anthropic `cache_control`，5 分钟 TTL |
| Batch 作业，前缀复用超过 30 分钟 | Anthropic 配 `ttl: "1h"` |
| GPT-5 上的 serverless endpoint，没有自定义基础设施 | OpenAI 自动（只要让前缀又长又稳定） |
| 跨多天反复使用的巨型代码/文档语料 | Gemini 显式 `CachedContent` |
| 跨 provider 容灾 | 在所有 provider 上保持可缓存前缀的版式一致，这样无论命中哪家都有效 |

和语义缓存（Phase 11 · 11）配合用在用户消息层：prompt caching 处理*token 完全相同*的复用，semantic caching 处理*语义相同*的复用。

## 上线部署（Ship It）

存为 `outputs/skill-prompt-caching-planner.md`：

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

## 练习（Exercises）

1. **简单。** 拿一段 10 轮对话、配上一个 5,000-token 的 system prompt，跑在 Claude 上。先不带 `cache_control` 跑一遍，再带上跑一遍。分别报告 input-token 账单。
2. **中等。** 写一个测试用的脚手架：给定一个 prompt 模板和一份请求日志，计算每家 provider（Anthropic 5m、Anthropic 1h、OpenAI 自动、Gemini 显式）的预期命中率和省下的美元数。
3. **难。** 写一个版式优化器：给定一个 prompt 和一份字段列表（标了 `stable=True/False`），把 prompt 重写为「在最缓存友好的位置打一个 cache 断点」并保证不丢信息。在真实 Anthropic endpoint 上验证。

## 关键术语（Key Terms）

| Term | 大家嘴上说的 | 它实际是什么 |
|------|-----------------|-----------------------|
| Prompt caching | 「让长 prompt 变便宜」 | 复用 provider 侧的 KV cache 来匹配前缀；重复 input token 享 50-90% 折扣。 |
| `cache_control` | 「Anthropic 那个标记」 | content block 上的属性，声明「到这里为止的内容都可缓存」；`{"type": "ephemeral"}`。 |
| Cache write | 「付溢价」 | 第一次填充缓存的请求；Anthropic 按约 1.25 倍 input 价计，OpenAI 免费。 |
| Cache read | 「享折扣」 | 后续匹配前缀的请求；Anthropic 收 10%，OpenAI 收 50%，Gemini 约 25%。 |
| TTL | 「能活多久」 | 缓存保持热的秒数；Anthropic 默认 5 分钟（可延 1 小时），OpenAI best-effort 至多 1 小时，Gemini 用户自定。 |
| Extended TTL | 「Anthropic 1 小时缓存」 | `{"type": "ephemeral", "ttl": "1h"}`；写入溢价 2 倍，但批量复用值回票价。 |
| Prefix match | 「为啥我缓存 miss 了」 | 只有从开头一直到断点的每一个 token 都逐字节相同时才命中。 |
| Context caching (Gemini) | 「显式的那个」 | Google 命名的、按存储计费的缓存对象；适合大语料的多天复用。 |

## 延伸阅读（Further Reading）

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — `cache_control`、1h TTL、盈亏平衡表。
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) — 自动前缀匹配。
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) — `CachedContent` API 与存储计费。
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) — 原始发布博客，含延迟数据。
- Phase 11 · 05 (Context Engineering) — 在哪里切分 prompt，缓存才能落点对位。
- Phase 11 · 11 (Caching and Cost) — 把 prompt caching 与用户消息层的语义缓存搭配起来。
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) — KV cache 的内存模型；prompt caching 把它暴露给了用户；解释了为什么重读一段已缓存前缀的成本约为重新计算的 1/10。
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) — prefill 正是 prompt caching 走捷径绕过的那个阶段；这篇解释了为何缓存命中时 TTFT（首 token 延迟）骤降而 TPOT（每 token 延迟）几乎不动。
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) — prompt caching 与 speculative decoding、Flash Attention、MQA/GQA 一同构成扭转推理成本曲线的几根杠杆；其余三根读这一篇。
