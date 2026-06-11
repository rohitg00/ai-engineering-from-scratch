# Prompt Caching 和 Context Caching

> 你的系统 prompt 是 4,000 token。你的 RAG 上下文是 20,000 token。你每次请求都发送两者。你也每次为两者付费——每次。Prompt caching 让提供商在它们那边保持该前缀热态，并在重用时按正常费率的 10% 计费。正确使用可将推理成本降低 50–90%，首 token 延迟降低 40–85%。

**类型：** Build
**语言：** Python
**前置知识：** Phase 11 · 01（Prompt Engineering），Phase 11 · 05（Context Engineering），Phase 11 · 11（Caching and Cost）
**时间：** ~60 分钟

## 问题所在

一个编码 agent 在对话的每一轮都将相同的 15,000-token 系统 prompt 发送给 Claude。二十轮，按 $3/M 输入 token 计算，仅输入成本就是 $0.90——在用户实际消息之前。乘以 10,000 次每日对话，账单达到 $9,000/天，用于从未改变的文本。

你无法在不损害质量的情况下缩小 prompt。你无法避免发送它——模型每轮都需要它。唯一的办法是停止为提供商已经见过的前缀支付全价。

这个办法就是 prompt caching。Anthropic 在 2024 年 8 月发布（2025 年推出 1 小时扩展 TTL 变体），OpenAI 在当年晚些时候自动化了它，Google 在 Gemini 1.5 旁边发布了显式 context caching，现在三家都将其作为前沿模型的一流功能提供。

## 核心概念

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**机制。** 当请求的前缀匹配最近的请求时，提供商从上次运行提供 KV-cache，而不是重新编码 token。你第一次支付少量写入溢价，之后每次享受大量读取折扣。

**2026 年的三种提供商风格。**

| 提供商 | API 风格 | 命中折扣 | 写入溢价 | 默认 TTL | 最小可缓存 |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | 内容块上的显式 `cache_control` 标记 | 输入 90% 折扣 | 25% 附加费 | 5 分钟（可扩展到 1 小时） | 1,024 token（Sonnet/Opus），2,048（Haiku） |
| OpenAI | 自动前缀检测 | 输入 50% 折扣 | 无 | 最多 1 小时（尽力而为） | 1,024 token |
| Google (Gemini) | 显式 `CachedContent` API | 按存储计费；读取约正常费率的 25% | 每 token·小时 存储费 | 用户设置（默认 1 小时） | 4,096 token（Flash），32,768（Pro） |

**不变性。** 三家都只缓存前缀。如果请求之间任何 token 不同，第一个不同 token 之后的所有内容都是未命中。将*稳定*部分放在顶部，*可变*部分放在底部。

### 缓存友好布局

```
[system prompt]          <-- 缓存这个
[tool definitions]       <-- 缓存这个
[few-shot examples]      <-- 缓存这个
[retrieved documents]    <-- 如果重用则缓存，否则不缓存
[conversation history]   <-- 缓存到上一轮
[current user message]   <-- 永不缓存（每次不同）
```

违反顺序——将用户消息放在系统 prompt 之上，在 few-shot 之间交错动态检索——缓存永远不会命中。

### 盈亏平衡计算

Anthropic 的 25% 写入溢价意味着缓存块必须至少读取两次才能净省钱。1 次写入 + 1 次读取平均每次请求 0.675x 成本（节省 32%）；1 次写入 + 10 次读取平均 0.205x（节省 80%）。经验法则：缓存任何你期望在 TTL 内至少重用 3 次的内容。

## 动手实现

### 步骤 1：使用显式标记的 Anthropic prompt caching

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

`cache_control` 标记告诉 Anthropic 将块存储 5 分钟。在该窗口内重用时命中；过期后重用时再次写入。

**响应使用字段：**

```python
response = review(code_a)
response.usage
# InputTokensUsage(
#     input_tokens=120,
#     cache_creation_input_tokens=15023,   # 按 1.25x 计费
#     cache_read_input_tokens=0,
#     output_tokens=340,
# )

response_b = review(code_b)
response_b.usage
# cache_creation_input_tokens=0
# cache_read_input_tokens=15023           # 按 0.1x 计费
```

在 CI 中检查两个字段——如果 `cache_read_input_tokens` 在请求间保持为零，你的缓存键正在漂移。

### 步骤 2：一小时扩展 TTL

对于长时间运行的批处理作业，5 分钟默认值在作业之间过期。设置 `ttl`：

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

1 小时 TTL 的写入溢价成本是 2 倍（比基线高 50% 而不是 25%），但任何在 TTL 内重用前缀超过 5 次的批处理都能快速回本。

### 步骤 3：OpenAI 自动缓存

OpenAI 无需你配置任何东西。任何超过 1,024 token 且匹配最近请求的前缀自动获得 50% 折扣。

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
resp.usage.prompt_tokens_details.cached_tokens  # 折扣部分
```

相同的缓存友好布局规则适用。两件事会杀死 OpenAI 的缓存而不会影响 Anthropic 的：更改 `user` 字段（用作缓存键组件）和重新排序工具。

### 步骤 4：Gemini 显式 context caching

Gemini 将缓存视为你创建和命名的第一类对象：

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

Gemini 按缓存存活的 token·小时 收取存储费，读取约正常输入费率的 25%。当你跨多天在多会话中重用相同巨型 prompt 时，这是合适的方案。

### 步骤 5：生产中测量命中率

参见 `code/main.py` 获取模拟的三提供商核算器，追踪写入/读取/未命中计数并计算每 1K 请求的混合成本。在目标命中率上控制部署——大多数生产 Anthropic 设置在预热后应看到 >80% 的读取比例。

## 2026 年仍会遇到的陷阱

- **顶部的动态时间戳。** `"Current time: 2026-04-22 15:30:02"` 在系统 prompt 顶部。每次请求都未命中。将时间戳移到缓存断点下方。
- **工具重新排序。** 以稳定顺序序列化工具——部署之间的字典重排会破坏每次命中。
- **自由文本近似重复。** "You are helpful." vs "You are a helpful assistant."——一个字节差异 = 完全未命中。
- **太小的块。** Anthropic 强制执行 1,024-token 下限（Haiku 为 2,048）。更小的块静默不缓存。
- **盲目的成本面板。** 将"输入 token"拆分为缓存 vs 未缓存。否则流量下降看起来像缓存胜利。

## 使用它

2026 年的缓存技术栈：

| 场景 | 选择 |
|-----------|------|
| 具有稳定 10k+ 系统 prompt、多轮的 Agent | Anthropic `cache_control`，5 分钟 TTL |
| 重用前缀 30+ 分钟的批处理作业 | Anthropic，`ttl: "1h"` |
| GPT-5 上的无服务器端点，无自定义基础设施 | OpenAI 自动（只需让你的前缀稳定且长） |
| 巨型代码/文档语料库的多天重用 | Gemini 显式 `CachedContent` |
| 跨提供商降级 | 保持缓存前缀布局在所有提供商间相同，以便任何命中都有效 |

与语义缓存（Phase 11 · 11）结合用于用户消息层：prompt caching 处理*token 完全相同*的重用，语义缓存处理*含义完全相同*的重用。

## 上线

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

1. **简单。** 对 Claude 进行一个 10 轮对话，包含 5,000-token 系统 prompt。先不带 `cache_control` 运行，然后带它运行。报告每种情况的输入 token 账单。
2. **中等。** 编写一个测试框架，给定一个 prompt 模板和请求日志，计算每个提供商的预期命中率和美元节省（Anthropic 5m、Anthropic 1h、OpenAI 自动、Gemini 显式）。
3. **困难。** 构建一个布局优化器：给定一个 prompt 和标记为 `stable=True/False` 的字段列表，重写 prompt 以将单个缓存断点放在最大缓存友好位置而不丢失信息。在真实 Anthropic 端点上验证。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Prompt caching | "让长 prompts 便宜" | 重用提供商端 KV-cache 以匹配前缀；重复输入 token 50-90% 折扣。 |
| `cache_control` | "Anthropic 标记" | 声明"到此为止的所有内容都可缓存"的内容块属性；`{"type": "ephemeral"}`。 |
| 缓存写入 | "支付溢价" | 首次填充缓存的请求；Anthropic 按 ~1.25x 输入费率计费，OpenAI 免费。 |
| 缓存读取 | "折扣" | 匹配前缀的后续请求；Anthropic 按 10% 计费，OpenAI 50%，Gemini ~25%。 |
| TTL | "存活多久" | 缓存保持热态的秒数；Anthropic 默认 5m（可扩展 1h），OpenAI 尽力最多 1h，Gemini 用户设置。 |
| 扩展 TTL | "1 小时 Anthropic 缓存" | `{"type": "ephemeral", "ttl": "1h"}`；2x 写入溢价，但批处理重用时值得。 |
| 前缀匹配 | "为什么我的缓存未命中" | 仅当从开头到断点的每个 token 都字节相同时缓存才命中。 |
| Context caching (Gemini) | "显式那个" | Google 的命名、按存储计费的缓存对象；最适合大型语料库的多天重用。 |

## 延伸阅读

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)——`cache_control`、1h TTL、盈亏平衡表。
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching)——自动前缀匹配。
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching)——`CachedContent` API 和存储定价。
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching)——包含延迟数字的原始发布文章。
- Phase 11 · 05（Context Engineering）——在哪里切分 prompt 以便缓存可以落地。
- Phase 11 · 11（Caching and Cost）——将 prompt caching 与用户消息上的语义缓存配对。
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102)——prompt caching 向用户暴露的 KV-cache 内存模型；解释为什么缓存前缀的重新读取比重新计算便宜约 10 倍。
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369)——prefill 是 prompt caching 跳过的阶段；本文解释为什么缓存命中时 TTFT 大幅下降而 TPOT 不受影响。
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192)——prompt caching 与推测解码、Flash Attention 和 MQA/GQA 并列，作为弯曲推理成本曲线的杠杆；阅读本文了解其他三个。
