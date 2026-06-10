# 15 · 提示词缓存与上下文缓存

> 你的系统提示词有 4,000 个 token。你的 RAG 上下文有 20,000 个 token。你每次请求都把两者一起发送出去，而且每次都为它们付费。「提示词缓存（Prompt Caching）」让服务商在他们一侧把这段前缀「保温」，复用时只按正常费率的 10% 计费。用得当的话，它能把推理成本削减 50–90%，把首 token 延迟降低 40–85%。

**类型：** 实战构建
**语言：** Python
**前置：** 阶段 11 · 01（提示词工程）、阶段 11 · 05（上下文工程）、阶段 11 · 11（缓存与成本）
**时长：** 约 60 分钟

## 问题所在

一个编码智能体在对话的每一轮都向 Claude 发送同样的 15,000-token 系统提示词。按每百万输入 token 收费 3 美元计算，二十轮光是输入成本就要 0.90 美元——这还没算上用户真正发出的消息。乘以每天 10,000 次对话，账单就达到每天 9,000 美元，而这些钱花在了从不变化的文本上。

你无法在不损害质量的前提下精简提示词。你也无法不发送它——模型在每一轮都需要它。唯一的出路是：别再为服务商早已见过的前缀付全价。

这条出路就是提示词缓存。Anthropic 于 2024 年 8 月推出了它（并在 2025 年提供了 1 小时的扩展 TTL 变体），OpenAI 在当年晚些时候将其自动化，Google 则随 Gemini 1.5 一起推出了显式的上下文缓存，如今这三家都在自己的旗舰模型上将其作为一等特性提供。

## 核心概念

〔图：提示词缓存——写一次，读取便宜〕

**运作机制。** 当一个请求的前缀与近期某个请求相匹配时，服务商会直接复用上一次运行的「KV 缓存（KV-cache）」，而不是重新编码这些 token。第一次你支付少量的写入溢价，之后每一次都享受大幅的读取折扣。

**2026 年的三种服务商风味。**

| 服务商 | API 风格 | 命中折扣 | 写入溢价 | 默认 TTL | 最小可缓存量 |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | 在内容块上显式打 `cache_control` 标记 | 输入降价 90% | 加收 25% | 5 分钟（可延长至 1 小时） | 1,024 token（Sonnet/Opus）、2,048（Haiku） |
| OpenAI | 自动前缀检测 | 输入降价 50% | 无 | 最长 1 小时（尽力而为） | 1,024 token |
| Google（Gemini） | 显式 `CachedContent` API | 按存储计费；读取约为正常费率的 25% | 按 token·小时 收取存储费 | 用户设定（默认 1 小时） | 4,096 token（Flash）、32,768（Pro） |

**不变量。** 这三家都只缓存前缀。如果请求之间任何一个 token 不同，那么从第一个不同的 token 起，后面所有内容都算未命中。把*稳定*的部分放在顶部，把*可变*的部分放在底部。

### 缓存友好的布局

```
[system prompt]          <-- 缓存这个
[tool definitions]       <-- 缓存这个
[few-shot examples]      <-- 缓存这个
[retrieved documents]    <-- 若会复用则缓存，否则不缓存
[conversation history]   <-- 缓存到上一轮为止
[current user message]   <-- 永不缓存（每次都不同）
```

一旦违反这个顺序——把用户消息放到系统提示词之上、在 few-shot 示例之间穿插动态检索内容——缓存就永远不会命中。

### 盈亏平衡计算

Anthropic 25% 的写入溢价意味着一个被缓存的块至少要被读取两次才能净省钱。1 次写入 + 1 次读取，平摊到每次请求是 0.675 倍成本（节省 32%）；1 次写入 + 10 次读取，平摊为 0.205 倍（节省 80%）。经验法则：凡是你预期在 TTL 内至少复用 3 次的内容，就把它缓存起来。

## 动手构建

### 第 1 步：用显式标记实现 Anthropic 提示词缓存

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

`cache_control` 标记告诉 Anthropic 把该块存储 5 分钟。在这个时间窗口内复用会命中；过期后复用则会再次写入。

**响应中的用量字段：**

```python
response = review(code_a)
response.usage
# InputTokensUsage(
#     input_tokens=120,
#     cache_creation_input_tokens=15023,   # 按 1.25 倍计费
#     cache_read_input_tokens=0,
#     output_tokens=340,
# )

response_b = review(code_b)
response_b.usage
# cache_creation_input_tokens=0
# cache_read_input_tokens=15023           # 按 0.1 倍计费
```

在 CI 中同时检查这两个字段——如果 `cache_read_input_tokens` 在多次请求间始终为零，说明你的缓存键正在漂移。

### 第 2 步：1 小时扩展 TTL

对于长时间运行的批处理作业，5 分钟的默认时长会在作业之间过期。设置 `ttl`：

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

1 小时 TTL 的写入溢价是 2 倍（比基线高 50% 而非 25%），但只要某个批处理对该前缀复用超过 5 次，就能很快回本。

### 第 3 步：OpenAI 自动缓存

OpenAI 不需要你做任何配置。任何超过 1,024 token 且与近期请求匹配的前缀都会自动获得 50% 的折扣。

```python
from openai import OpenAI
client = OpenAI()

resp = client.chat.completions.create(
    model="gpt-5",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},   # 长且稳定
        {"role": "user", "content": user_msg},
    ],
)
resp.usage.prompt_tokens_details.cached_tokens  # 享受折扣的部分
```

同样适用缓存友好布局规则。有两件事会摧毁 OpenAI 的缓存，而它们不会影响 Anthropic：改动 `user` 字段（它会被用作缓存键的一个组成部分），以及重新排序工具。

### 第 4 步：Gemini 显式上下文缓存

Gemini 把缓存当作一个你创建并命名的一等对象：

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

只要缓存还存活，Gemini 就按 token·小时 收取存储费，读取费用约为正常输入费率的 25%。当你需要在多天、跨多个会话中复用同一个巨型提示词时，这种形态最合适。

### 第 5 步：在生产环境中度量命中率

参见 `code/main.py`，那里有一个模拟的三服务商「记账器」，它会追踪写入/读取/未命中的次数，并计算每 1,000 次请求的混合成本。给部署设置一个目标命中率门槛——大多数生产环境下的 Anthropic 配置在预热后的读取占比应当超过 80%。

## 2026 年仍在频繁出现的坑

- **把动态时间戳放在顶部。** 系统提示词顶部出现 `"Current time: 2026-04-22 15:30:02"`，每个请求都会未命中。把时间戳移到缓存断点之下。
- **工具重排序。** 以稳定的顺序序列化工具——两次部署之间字典顺序被打乱就会破坏每一次命中。
- **自由文本的近似重复。** "You are helpful." 与 "You are a helpful assistant." 之间——只差一个字节就是完全未命中。
- **块太小。** Anthropic 强制 1,024-token 下限（Haiku 是 2,048）。更小的块会静默地不被缓存。
- **盲目的成本看板。** 把「输入 token」拆分为已缓存与未缓存两部分。否则流量下降看起来就会像是缓存带来的收益。

## 实际运用

2026 年的缓存技术栈：

| 场景 | 选择 |
|-----------|------|
| 拥有稳定的 10k+ 系统提示词、多轮交互的智能体 | Anthropic `cache_control`，搭配 5 分钟 TTL |
| 在 30 分钟以上时间里复用某前缀的批处理作业 | Anthropic，搭配 `ttl: "1h"` |
| 跑在 GPT-5 上、没有自定义基础设施的无服务器端点 | OpenAI 自动缓存（只要让你的前缀稳定且足够长） |
| 跨多天复用一个巨型代码/文档语料库 | Gemini 显式 `CachedContent` |
| 跨服务商降级回退 | 在各服务商间保持可缓存前缀布局完全一致，这样任何一处命中都能生效 |

在用户消息层面，可与「语义缓存（semantic caching）」（阶段 11 · 11）结合使用：提示词缓存处理的是*token 完全一致*的复用，语义缓存处理的是*语义一致*的复用。

## 交付落地

保存 `outputs/skill-prompt-caching-planner.md`：

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

1. **简单。** 取一段对 Claude 的 10 轮对话，系统提示词为 5,000 token。分别在不带 `cache_control` 和带 `cache_control` 的情况下运行。报告每种情况下的输入 token 账单。
2. **中等。** 编写一个测试套件：给定一个提示词模板和一份请求日志，计算每个服务商（Anthropic 5 分钟、Anthropic 1 小时、OpenAI 自动、Gemini 显式）的预期命中率和省下的美元数。
3. **困难。** 构建一个布局优化器：给定一个提示词和一份标注了 `stable=True/False` 的字段列表，在不丢失信息的前提下重写该提示词，把单个缓存断点放在最大化缓存友好度的位置。在真实的 Anthropic 端点上进行验证。

## 关键术语

| 术语 | 人们怎么说 | 它的真正含义 |
|------|-----------------|-----------------------|
| 提示词缓存 | "让长提示词变便宜" | 对匹配的前缀复用服务商一侧的 KV 缓存；对重复的输入 token 给予 50-90% 的折扣。 |
| `cache_control` | "那个 Anthropic 标记" | 内容块属性，声明「到此为止的所有内容均可缓存」；`{"type": "ephemeral"}`。 |
| 缓存写入 | "支付溢价" | 填充缓存的第一个请求；在 Anthropic 上按约 1.25 倍输入费率计费，在 OpenAI 上免费。 |
| 缓存读取 | "享受折扣" | 后续匹配该前缀的请求；按 10%（Anthropic）、50%（OpenAI）、约 25%（Gemini）计费。 |
| TTL | "它能存活多久" | 缓存保持「温热」的秒数；Anthropic 默认 5 分钟（可延长至 1 小时），OpenAI 尽力而为最长 1 小时，Gemini 由用户设定。 |
| 扩展 TTL | "1 小时的 Anthropic 缓存" | `{"type": "ephemeral", "ttl": "1h"}`；写入溢价 2 倍，但对批处理复用而言值得。 |
| 前缀匹配 | "我的缓存为什么没命中" | 缓存只有在从起点到断点的每一个 token 都字节级一致时才会命中。 |
| 上下文缓存（Gemini） | "那个显式的" | Google 的具名、按存储计费的缓存对象；最适合对大型语料库的多天复用。 |

## 延伸阅读

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) —— `cache_control`、1 小时 TTL、盈亏平衡表。
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) —— 自动前缀匹配。
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) —— `CachedContent` API 与存储定价。
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) —— 含延迟数据的原始发布博文。
- 阶段 11 · 05（上下文工程）—— 在哪里切分提示词才能让缓存命中。
- 阶段 11 · 11（缓存与成本）—— 把提示词缓存与作用于用户消息的语义缓存配对使用。
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) —— 提示词缓存向用户暴露的那套 KV 缓存内存模型；解释了为什么重读一段被缓存的前缀比重新计算便宜约 10 倍。
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) —— 预填充（prefill）正是提示词缓存所抄近路的那个阶段；本文解释了为什么缓存命中时 TTFT 会大幅下降而 TPOT 不受影响。
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) —— 提示词缓存与推测解码（speculative decoding）、Flash Attention 以及 MQA/GQA 并列，都是扭弯推理成本曲线的杠杆；想了解另外三种就读这篇。
