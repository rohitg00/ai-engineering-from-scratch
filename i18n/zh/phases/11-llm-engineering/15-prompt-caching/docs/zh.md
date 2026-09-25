# 提示词缓存与上下文缓存

> 你的系统提示词有 4,000 个 token。你的 RAG 上下文有 20,000 个 token。你在每次请求中都发送这两者，也为两者付费——每一次都是如此。提示词缓存让提供商在他们的服务器端保持该前缀的“热度”，并在复用时只按正常费率的 10% 计费。正确使用时，它可以将推理成本降低 50–90%,将首 token 延迟降低 40–85%。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 11 · 01 (提示词工程)， Phase 11 · 05 (上下文工程)， Phase 11 · 11 (缓存与成本)
**Time:** ~60 分钟

## 问题

一个编码智能体在对话的每一轮都向 Claude 发送相同的 15,000-token 系统提示词。二十轮对话在 $3/M input tokens is $0.90 的输入成本——这还没算用户实际的消息。乘以每天 10,000 次对话，账单就达到每天 $9,000,而这些文本从未改变。

你无法在不损害质量的前提下缩减提示词。你也无法避免发送它——模型在每一轮都需要它。唯一的办法是：不再为提供商已经见过的前缀支付全价。

这一招就是提示词缓存。Anthropic 于 2024 年 8 月推出了它(2025 年又推出了 1 小时延长 TTL 变体)，OpenAI 在同年晚些时候实现了自动化，Google 随 Gemini 1.5 推出了显式上下文缓存，如今这三家都将其作为前沿模型的一等特性提供。

## 概念

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**机制。** 当请求的前缀与近期某个请求匹配时，提供商会复用上一次运行的 KV-cache,而不是重新编码 token。你第一次支付少量写入溢价，之后每次支付大量的读取折扣。

**2026 年的三种提供商方案。**

| 提供商 | API 风格 | 命中折扣 | 写入溢价 | 默认 TTL | 最小可缓存长度 |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | 在内容块上显式标记 `cache_control` | 输入 90% 折扣 | 25% 附加费 | 5 分钟(可延长至 1 小时) | 1,024 tokens (Sonnet/Opus)、2,048 (Haiku) |
| OpenAI | 自动前缀检测 | 输入 50% 折扣 | 无 | 最长 1 小时(尽力而为) | 1,024 tokens |
| Google (Gemini) | 显式 `CachedContent` API | 按存储计费；读取约为正常的 25% | 每 token·小时的存储费 | 用户设定(默认 1 小时) | 4,096 tokens (Flash)、32,768 (Pro) |

**不变量。** 三者都只缓存前缀。如果任意 token 在请求间存在差异，那么从第一个不同的 token 之后的一切都是未命中。把*稳定*的部分放在顶部，把*可变*的部分放在底部。

### 缓存友好的布局

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

违反这个顺序——把用户消息放在系统提示词之上，在 few-shot 示例之间穿插动态检索内容——缓存就永远不会命中。

### 盈亏平衡计算

Anthropic 的 25% 写入溢价意味着一个缓存块至少要被读取两次才能净省钱。1 次写入 + 1 次读取平均每次请求成本为 0.675 倍(节省 32%);1 次写入 + 10 次读取平均为 0.205 倍(节省 80%)。经验法则：任何你预计在 TTL 内至少复用 3 次的内容都可以缓存。

```figure
prompt-cache-hit
```

## 动手构建

### 步骤 1:使用显式标记的 Anthropic 提示词缓存

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

`cache_control` 标记告诉 Anthropic 将该块存储 5 分钟。在该窗口内的复用即为命中；超过之后则过期并重新写入。

**响应的用量字段:**

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

在 CI 中检查这两个字段——如果 `cache_read_input_tokens` 在各请求间始终为零，说明你的缓存键在漂移。

### 步骤 2:一小时延长 TTL

对于长时间运行的批处理任务，默认的 5 分钟会在任务间隔间过期。设置 `ttl`:

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

1 小时 TTL 的写入溢价为 2 倍(比基线高 50% 而非 25%),但对于任何复用前缀超过 5 次的批处理任务，成本很快就能收回。

### 步骤 3:OpenAI 自动缓存

OpenAI 无需任何配置。任何超过 1,024 tokens 且与近期请求匹配的前缀都会自动获得 50% 折扣。

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

同样的缓存友好布局规则也适用。有两个因素会破坏 OpenAI 的缓存，但不会破坏 Anthropic 的：更改 `user` 字段(它被用作缓存键的组成部分)以及重新排列工具的顺序。

### 步骤 4:Gemini 显式上下文缓存

Gemini 将缓存视为你可以创建和命名的一等对象：

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

在缓存存续期间，Gemini 按 token·小时收取存储费，读取费率约为正常输入费率的 25%。当你需要在数天内跨多个会话复用同一个巨型提示词时，这是正确的形态。

### 步骤 5:在生产环境中测量命中率

参见 `code/main.py`,其中有一个模拟的三提供商记账器，用于跟踪写入/读取/未命中次数并计算每 1K 次请求的混合成本。以目标命中率为部署门槛——大多数生产环境的 Anthropic 部署在预热后应达到 >80% 的读取占比。

## 2026 年仍然会踩的坑

- **顶部放动态时间戳。** 在系统提示词顶部放 `"Current time: 2026-04-22 15:30:02"`。每次请求都未命中。把时间戳移到缓存断点之下。
- **工具重新排序。** 以稳定顺序序列化工具——部署之间的字典重排会破坏所有命中。
- **自由文本的近似重复。** "You are helpful." 对比 "You are a helpful assistant."——一字节之差 = 完全未命中。
- **块太小。** Anthropic 强制 1,024-token 下限(Haiku 为 2,048)。更小的块会被静默地不缓存。
- **盲目的成本仪表盘。** 将“输入 token”拆分为已缓存与未缓存。否则流量的下降看起来像缓存的胜利。

## 使用场景

2026 年的缓存技术栈：

| 场景 | 选择 |
|-----------|------|
| 智能体拥有稳定的 10k+ 系统提示词，多轮对话 | Anthropic `cache_control`,5 分钟 TTL |
| 批处理任务复用前缀超过 30 分钟 | Anthropic 配合 `ttl: "1h"` |
| GPT-5 上的 serverless 端点，无自定义基础设施 | OpenAI 自动缓存(只需让前缀稳定且长) |
| 多天复用巨型代码/文档语料库 | Gemini 显式 `CachedContent` |
| 跨提供商回退 | 让可缓存前缀的布局在各提供商间完全一致，使任意命中都有效 |

结合语义缓存(Phase 11 · 11)处理用户消息层：提示词缓存处理*token 完全相同*的复用，语义缓存处理*含义相同*的复用。

## 交付上线

保存 `outputs/skill-prompt-caching-planner.md`:

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

## 练习

1. **简单。** 针对 Claude 进行一场 10 轮对话，系统提示词为 5,000 tokens。先不使用 `cache_control` 运行，然后再使用。报告两者的输入 token 账单。
2. **中等。** 编写一个测试工具，在给定提示词模板和请求日志的情况下，计算每个提供商(Anthropic 5 分钟、Anthropic 1 小时、OpenAI 自动、Gemini 显式)的预期命中率和美元节省。
3. **困难。** 构建一个布局优化器：给定一个提示词和一组标记为 `stable=True/False` 的字段，重写提示词，在不丢失信息的前提下将单个缓存断点放在最大缓存友好位置。在真实的 Anthropic 端点上验证。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Prompt caching(提示词缓存) | “让长提示词变便宜” | 为匹配的前缀复用提供商侧的 KV-cache;重复输入 token 享受 50–90% 折扣。 |
| `cache_control` | “Anthropic 的标记” | 内容块属性，声明“到此处为止的所有内容均可缓存”；`{"type": "ephemeral"}`。 |
| Cache write(缓存写入) | “支付溢价” | 填充缓存的第一个请求；在 Anthropic 上按约 1.25 倍输入费率计费，OpenAI 上免费。 |
| Cache read(缓存读取) | “折扣” | 匹配前缀的后续请求；按 10%(Anthropic)、50%(OpenAI)、约 25%(Gemini)计费。 |
| TTL | “它存活多久” | 缓存保持热度的秒数；Anthropic 默认 5 分钟(可延长至 1 小时)，OpenAI 尽力而为最长 1 小时，Gemini 用户设定。 |
| Extended TTL(延长 TTL) | “Anthropic 的 1 小时缓存” | `{"type": "ephemeral", "ttl": "1h"}`;写入溢价 2 倍，但对批处理复用是值得的。 |
| Prefix match(前缀匹配) | “为什么我的缓存未命中” | 只有从开头到断点的每个 token 都逐字节相同时，缓存才会命中。 |
| Context caching(上下文缓存，Gemini) | “显式的那种” | Google 的命名式、按存储计费的缓存对象；最适合多天复用大型语料库。 |

## 延伸阅读

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — `cache_control`、1 小时 TTL、盈亏平衡表。
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) — 自动前缀匹配。
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) — `CachedContent` API 与存储定价。
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) — 包含延迟数据的原始发布文章。
- Phase 11 · 05 (上下文工程) — 如何切分提示词以便缓存落地。
- Phase 11 · 11 (缓存与成本) — 将提示词缓存与用户消息上的语义缓存配对。
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) — 提示词缓存向用户暴露的 KV-cache 内存模型；解释了为什么重新读取缓存前缀比重新计算便宜约 10 倍。
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) — prefill 是提示词缓存所捷径化的阶段；该论文解释了为什么缓存命中时 TTFT 大幅下降而 TPOT 不受影响。
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) — 提示词缓存与投机解码、Flash Attention 以及 MQA/GQA 并列，都是弯曲推理成本曲线的杠杆；阅读本文以了解另外三个。